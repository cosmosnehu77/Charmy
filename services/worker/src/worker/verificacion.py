"""Verificación de focos recientes con varias señales (RF-VIV-02 a 04, D-09).

Cada señal va de 0 a 1 y trae su evidencia. El veredicto sale de reglas fijas sobre las señales, no del
modelo de lenguaje, que solo etiqueta titulares. Que no haya noticias suma 0 pero nunca resta: un foco no
pasa a falso por eso.
"""

import json
import math
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
import psycopg

from worker.datos import fuentes_fijas, regiones
from worker.noticias import NoticiasNoDisponibles, buscar, etiquetar

PESOS = {"satellite": 0.5, "news": 0.2, "reports": 0.3}
BASE_CONFIANZA = {"low": 0.3, "nominal": 0.5, "high": 0.7}
NOMBRES = {"N20": "NOAA-20", "N21": "NOAA-21"}
RADIO_REPORTES_KM = 10
VENTANA_REPORTES = timedelta(hours=48)
FRESCURA_NOTICIAS = timedelta(hours=2)
MAX_PROVINCIAS = 8  # provincias con más focos que buscan noticias en cada vuelta (cuida el cupo del modelo)
ESTADOS = {"visto": "visto", "en_camino": "en camino", "controlado": "controlado", "falso": "falso"}
APOYO_REPORTE = {"sin_verificar": 0.5, "visto": 0.7, "en_camino": 1.0, "controlado": 1.0, "falso": 0.0}

TABLAS = """
ALTER TABLE focos_vivo ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE focos_vivo ADD COLUMN IF NOT EXISTS fixed_source boolean;
ALTER TABLE focos_vivo ADD COLUMN IF NOT EXISTS score double precision;
ALTER TABLE focos_vivo ADD COLUMN IF NOT EXISTS signals jsonb;
ALTER TABLE focos_vivo ADD COLUMN IF NOT EXISTS evidence jsonb;
CREATE TABLE IF NOT EXISTS noticias_vivo (
    region text PRIMARY KEY,
    fetched_at timestamptz NOT NULL,
    items jsonb NOT NULL
);
ALTER TABLE noticias_vivo ENABLE ROW LEVEL SECURITY;
"""


def senal_satelite(foco: dict, pasadas_en_celda: int) -> tuple[float, dict]:
    valor = BASE_CONFIANZA[foco["confidence"]]
    if pasadas_en_celda >= 2:
        valor += 0.2
    if (foco["frp"] or 0) >= 10:
        valor += 0.1
    satelite = NOMBRES.get(foco["satellite"], foco["satellite"])
    if pasadas_en_celda >= 2:
        titulo = f"{pasadas_en_celda} pasadas de VIIRS con fuego en la misma celda en 24 horas"
    else:
        titulo = f"Una pasada de {satelite} con confianza {foco['confidence']}"
    return round(min(valor, 1.0), 2), {"kind": "satelite", "title": titulo, "label": "apoya"}


def senal_fuente_fija(cell_id: str, mascara: set[str] | None) -> tuple[float, dict]:
    if mascara is None:
        titulo = "Todavía no hay una máscara de fuentes fijas para comparar este foco."
        return 0.0, {"kind": "satelite", "title": titulo, "label": "sin_informacion"}
    if cell_id in mascara:
        titulo = "La celda coincide con una fuente fija conocida (antorchas de gas, industria)."
        return 1.0, {"kind": "satelite", "title": titulo, "label": "contradice"}
    return 0.0, {"kind": "satelite", "title": "La celda no es una fuente fija conocida.", "label": "apoya"}


def senal_noticias(noticias: list[dict] | None, provincia: str | None) -> tuple[float, list[dict]]:
    """`noticias` None: no se pudieron leer. Lista vacía: no hubo titulares."""
    lugar = provincia or "la zona"
    if noticias is None:
        titulo = "No pudimos leer noticias ahora. El veredicto sigue con las otras señales."
        return 0.0, [{"kind": "noticia", "title": titulo, "label": "sin_informacion"}]
    utiles = [n for n in noticias if n["label"] != "sin_informacion"]
    if not utiles:
        titulo = (
            f"No encontramos noticias de incendios en {lugar} en los últimos dos días. No descarta el foco."
        )
        return 0.0, [{"kind": "noticia", "title": titulo, "label": "sin_informacion"}]
    apoyan = sum(n["label"] == "apoya" for n in utiles)
    evidencia = [
        {"kind": "noticia", "title": n["title"], "url": n["url"], "label": n["label"]} for n in utiles
    ]
    return min(1.0, 0.5 * apoyan), evidencia[:5]


def senal_reportes(reportes: list[dict], aviso_entidad: str | None) -> tuple[float, list[dict], bool]:
    """Reportes ciudadanos cercanos y el estado que marcó la entidad en el aviso del foco.

    Devuelve la señal, la evidencia y si la entidad lo marcó como falso.
    """
    evidencia, valor = [], 0.0
    if aviso_entidad in ESTADOS:
        etiqueta = "contradice" if aviso_entidad == "falso" else "apoya"
        titulo = f"La entidad de la zona marcó el aviso como {ESTADOS[aviso_entidad]}."
        evidencia.append({"kind": "entidad", "title": titulo, "label": etiqueta})
        valor = APOYO_REPORTE[aviso_entidad]
    for r in sorted(reportes, key=lambda r: r["km"])[:3]:
        etiqueta = "contradice" if r["status"] == "falso" else "apoya"
        estado = "sin verificar" if r["status"] == "sin_verificar" else ESTADOS[r["status"]]
        titulo = f"Reporte ciudadano a {r['km']:.0f} km ({estado})"
        evidencia.append({"kind": "reporte", "title": titulo, "label": etiqueta})
        valor = max(valor, APOYO_REPORTE[r["status"]])
    return valor, evidencia, aviso_entidad == "falso"


def veredicto(senales: dict, entidad_dijo_falso: bool) -> tuple[str, float]:
    """Reglas de D-09. Se prueban con la tabla de casos del PR."""
    puntaje = round(sum(peso * senales[nombre] for nombre, peso in PESOS.items()), 2)
    if entidad_dijo_falso:
        return "sin_confirmar", puntaje
    if senales["fixed_source"] >= 0.5 and senales["reports"] < 0.7:
        return "fuente_fija", puntaje
    if senales["reports"] >= 0.7 and senales["satellite"] >= 0.3:
        return "confirmado", puntaje
    if puntaje >= 0.6:
        return "confirmado", puntaje
    if puntaje >= 0.35:
        return "probable", puntaje
    return "sin_confirmar", puntaje


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    a = (
        math.sin(math.radians(lat2 - lat1) / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    return 6371 * 2 * math.asin(math.sqrt(a))


def _existe(con: psycopg.Connection, tabla: str) -> bool:
    return con.execute("SELECT to_regclass(%s) IS NOT NULL", [tabla]).fetchone()[0]


def _noticias(con, ahora, por_provincia: dict, cliente) -> dict[str, list[dict] | None]:
    """Noticias etiquetadas por región, con caché de 2 horas. Solo las provincias con más focos buscan."""
    guardadas = {
        region: (consultado, items)
        for region, consultado, items in con.execute("SELECT region, fetched_at, items FROM noticias_vivo")
    }
    resultado: dict[str, list[dict] | None] = {}
    elegidas = sorted(por_provincia, key=lambda r: -por_provincia[r]["focos"])[:MAX_PROVINCIAS]
    for region in por_provincia:
        if region in guardadas and ahora - guardadas[region][0] < FRESCURA_NOTICIAS:
            resultado[region] = guardadas[region][1]
        elif region in elegidas:
            nombre, pais = por_provincia[region]["nombre"], por_provincia[region]["pais"]
            try:
                titulares = buscar(nombre, pais, cliente)
                etiquetas = etiquetar(titulares, nombre, pais, cliente)
            except NoticiasNoDisponibles as error:
                print(f"noticias de {region}: {error}", flush=True)
                resultado[region] = guardadas.get(region, (None, None))[1]
                continue
            items = [t | {"label": e} for t, e in zip(titulares, etiquetas, strict=True)]
            con.execute(
                """
                INSERT INTO noticias_vivo (region, fetched_at, items) VALUES (%s, %s, %s)
                ON CONFLICT (region) DO UPDATE SET fetched_at = excluded.fetched_at, items = excluded.items
                """,
                [region, ahora, json.dumps(items)],
            )
            resultado[region] = items
        else:
            resultado[region] = guardadas.get(region, (None, None))[1]
    return resultado


def verificar(con: psycopg.Connection, ahora: datetime, cliente: httpx.Client) -> str:
    """Calcula señales, evidencia y veredicto de todos los focos de `focos_vivo`."""
    con.execute(TABLAS)
    # ALTER TABLE bloquea focos_vivo entero aunque no cambie nada: se suelta antes de las noticias, que pueden
    # tardar minutos, para que /live siga respondiendo (#268).
    con.commit()
    columnas = ["id", "latitude", "longitude", "acq_datetime", "satellite", "confidence", "frp", "cell_id"]
    focos = [
        dict(zip(columnas, fila, strict=True))
        for fila in con.execute(f"SELECT {', '.join(columnas)} FROM focos_vivo")
    ]
    if not focos:
        con.commit()
        return "sin focos para verificar"

    pasadas = defaultdict(list)
    for f in focos:
        pasadas[f["cell_id"]].append(f["acq_datetime"])

    zonas = regiones(cliente)
    por_provincia: dict[str, dict] = {}
    for f in focos:
        region = zonas.de(f["longitude"], f["latitude"])
        f["region"], f["provincia"] = (region[0], region[1]) if region else (None, None)
        if region:
            datos = por_provincia.setdefault(region[0], {"nombre": region[1], "focos": 0})
            datos["focos"] += 1
            datos["pais"] = "Chile" if region[0].startswith("CL") else "Argentina"
    noticias = _noticias(con, ahora, por_provincia, cliente)
    mascara = fuentes_fijas(cliente)

    reportes = []
    if _existe(con, "reportes"):
        reportes = [
            {"lat": lat, "lon": lon, "status": estado}
            for lat, lon, estado in con.execute(
                "SELECT lat, lon, status FROM reportes WHERE created_at >= %s", [ahora - VENTANA_REPORTES]
            )
        ]
    avisos, por_celda = {}, {}
    if _existe(con, "avisos"):
        filas_avisos = con.execute(
            "SELECT hotspot_id, status FROM avisos "
            "WHERE kind = 'foco_satelital' AND hotspot_id IS NOT NULL ORDER BY updated_at"
        ).fetchall()
        avisos = dict(filas_avisos)
        # D-37: un aviso por celda. Lo que marca la entidad vale para toda la celda; si hay varios, el último.
        celda_de = {f["id"]: f["cell_id"] for f in focos}
        por_celda = {
            celda_de[id_]: estado for id_, estado in filas_avisos if estado in ESTADOS and id_ in celda_de
        }

    cuenta, filas = defaultdict(int), []
    for f in focos:
        cercanas = sum(abs(t - f["acq_datetime"]) <= timedelta(hours=24) for t in set(pasadas[f["cell_id"]]))
        sat, ev_sat = senal_satelite(f, cercanas)
        fija, ev_fija = senal_fuente_fija(f["cell_id"], mascara)
        noti, ev_noti = senal_noticias(noticias.get(f["region"]) if f["region"] else [], f["provincia"])
        cerca = [
            r | {"km": km}
            for r in reportes
            if (km := _km(f["latitude"], f["longitude"], r["lat"], r["lon"])) <= RADIO_REPORTES_KM
        ]
        propio = avisos.get(f["id"])
        estado_entidad = propio if propio in ESTADOS else por_celda.get(f["cell_id"])
        rep, ev_rep, falso = senal_reportes(cerca, estado_entidad)
        senales = {"satellite": sat, "fixed_source": fija, "news": noti, "reports": rep}
        resultado, puntaje = veredicto(senales, falso)
        cuenta[resultado] += 1
        filas.append(
            [
                resultado,
                fija >= 0.5,
                puntaje,
                json.dumps(senales),
                json.dumps([ev_sat, ev_fija, *ev_noti, *ev_rep]),
                f["id"],
            ]
        )
    with con.cursor() as cursor:
        cursor.executemany(
            """
            UPDATE focos_vivo SET verdict = %s, fixed_source = %s, score = %s, signals = %s, evidence = %s
            WHERE id = %s
            """,
            filas,
        )
    con.commit()
    return "veredictos: " + ", ".join(f"{k} {v}" for k, v in sorted(cuenta.items()))
