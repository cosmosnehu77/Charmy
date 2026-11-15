# ruff: noqa: E501  (el texto del reporte se deja en líneas enteras)
"""Paso 3: de la probabilidad por celda a provincias y a un área dibujada, y el reporte para leer.

Uso:
  uv run --package prediccion python services/prediccion/entrenamiento/03_salidas.py                       # provincias + REPORTE.md
  uv run --package prediccion python services/prediccion/entrenamiento/03_salidas.py --bbox -71.9,-42.3,-71.2,-41.7   # lon0,lat0,lon1,lat1
  uv run --package prediccion python services/prediccion/entrenamiento/03_salidas.py --geojson mi_area.geojson        # polígono dibujado
"""

import argparse
import json
from pathlib import Path

import numpy as np
import polars as pl
import shapely
from shapely.geometry import box, shape

AQUI = Path(__file__).parent
SALIDAS = AQUI / "salidas"
CELDAS_BLOQUE = {"0.3°": 9, "0.5°": 25, "1.0°": 100, "2.0°": 400}  # celdas de 0,1° en cada cuadrado de prueba
AREAS_DEMO = {  # lon0, lat0, lon1, lat1
    "Comarca Andina (El Bolsón, Lago Puelo)": (-71.9, -42.3, -71.2, -41.7),
    "Delta del Paraná": (-60.0, -34.2, -58.6, -33.2),
    "Sierras de Córdoba": (-64.9, -31.8, -64.3, -30.9),
    "Esteros del Iberá": (-58.0, -29.0, -56.6, -27.6),
    "Araucanía costera": (-73.4, -38.9, -72.4, -37.9),
}


def nivel(p: float) -> str:
    for tope, nombre in ((0.10, "muy baja"), (0.30, "baja"), (0.60, "media"), (0.85, "alta")):
        if p < tope:
            return nombre
    return "muy alta"


def kappa_de(metricas: dict, h: int, n_celdas: int) -> float:
    """κ para un área de n celdas: se interpola entre los tamaños de cuadrado probados."""
    area = metricas["area"][str(h)]
    xs = np.log([CELDAS_BLOQUE[k] for k in CELDAS_BLOQUE])
    ys = [area[k]["kappa"] for k in CELDAS_BLOQUE]
    return float(np.interp(np.log(max(n_celdas, 1)), xs, ys))


def prob_area(p: np.ndarray, kappa: float) -> float:
    return float(1 - np.exp(kappa * np.log1p(-np.clip(p, 0, 1 - 1e-6)).sum()))


def resumen_area(pred: pl.DataFrame, metricas: dict, geom) -> pl.DataFrame:
    """Probabilidad por mes para las celdas cuyo centro cae dentro de `geom`."""
    celdas = pred.select("cell_id", "lat", "lon").unique()
    dentro = shapely.contains_xy(geom, celdas["lon"].to_numpy(), celdas["lat"].to_numpy())
    mias = pred.join(celdas.filter(pl.Series(dentro)).select("cell_id"), on="cell_id")
    filas = []
    for (mes, h), g in mias.group_by("mes", "horizonte", maintain_order=True):
        k = kappa_de(metricas, h, g.height)
        p, hab = prob_area(g["prob"].to_numpy(), k), prob_area(g["prob_habitual"].to_numpy(), k)
        filas.append(
            {
                "mes": mes,
                "horizonte": h,
                "celdas": g.height,
                "prob_evento": round(p, 3),
                "prob_habitual": round(hab, 3),
                "celdas_esperadas": round(float(g["prob"].sum()), 2),
                "celda_mas_alta": round(float(g["prob"].max()), 3),
                "nivel": nivel(p),
            }
        )
    return pl.DataFrame(filas)


def provincias(pred: pl.DataFrame, metricas: dict, nombres: dict) -> pl.DataFrame:
    hist = pl.read_csv(SALIDAS / "historia_provincias.csv")
    filas = []
    for (region, mes, h), g in pred.group_by("region", "mes", "horizonte", maintain_order=True):
        k = metricas["area"][str(h)]["provincia"]["kappa"]
        p = prob_area(g["prob"].to_numpy(), k)
        esperadas, habituales = float(g["prob"].sum()), float(g["prob_habitual"].sum())
        hm = hist.filter((pl.col("region") == region) & (pl.col("mes_del_anio") == int(mes[5:]))).row(
            0, named=True
        )
        filas.append(
            {
                "region": region,
                "provincia": nombres[region],
                "mes": mes,
                "horizonte": h,
                "prob_evento": round(p, 3),
                "nivel": nivel(p),
                "celdas_esperadas": round(esperadas, 1),
                "celdas_habituales": round(habituales, 1),
                "vs_habitual_pct": round(100 * (esperadas / habituales - 1)) if habituales >= 0.5 else None,
                "celdas_con_historia": g.height,
                "historia_anios_con_evento": f"{hm['anios_con_evento']}/{hm['anios']}",
                "historia_celdas_mediana": hm["celdas_mediana"],
                "historia_celdas_max": hm["celdas_max"],
            }
        )
    return pl.DataFrame(filas).sort(
        "horizonte", "prob_evento", "celdas_esperadas", descending=[False, True, True]
    )


def tabla(df: pl.DataFrame, pct: tuple[str, ...] = ()) -> str:
    cols = df.columns
    lineas = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for r in df.iter_rows(named=True):
        celdas = []
        for c in cols:
            v = r[c]
            if v is None:
                celdas.append("s/d")
            elif c in pct:
                celdas.append("<1 %" if 0 < v < 0.01 else f"{v:.0%}".replace("%", " %"))
            else:
                celdas.append(str(v))
        lineas.append("| " + " | ".join(celdas) + " |")
    return "\n".join(lineas)


def reporte(pred: pl.DataFrame, prov: pl.DataFrame, metricas: dict) -> str:
    hs = sorted(metricas["horizontes"], key=int)
    meses = {int(h): pred.filter(pl.col("horizonte") == int(h))["mes"][0] for h in hs}
    partes = ["# Prototipo de predicción con LightGBM: resultados", ""]
    partes += [
        "Generado por `03_salidas.py`. El evento se mide con VIIRS S-NPP 2012-2026 (filtros de la armonización).",
        "El modelo mira además NOAA-20, NOAA-21 y MODIS desde 2001 (sin clima: se probó y no aportó), hasta el mes",
        "de emisión.",
        "**Es un prototipo**: los números son resultados de esta corrida de prueba, no un pronóstico publicado.",
        "",
        "**Evento**: en una celda de 0,1° (~10 km) y un mes, al menos un foco de confianza alta, o fuego en 2 o más días.",
        "",
        "## 1. ¿Qué tan bien predice? (24 meses nunca vistos: "
        f"{' a '.join(metricas.get('prueba', ['2024-11', '2026-10']))})",
        "",
        "`mejora_brier` es la compuerta D-10: cuánto baja el error frente a la climatología (la frecuencia histórica",
        "de esa celda en ese mes). Mayor que 0 es mejor que la climatología. `auc` mide si ordena bien las celdas",
        "(0,5 es azar, 1 es perfecto).",
        "",
    ]
    filas = []
    for h in hs:
        m = metricas["horizontes"][h]
        filas.append(
            {
                "meses_adelante": int(h),
                "mes_que_emitiria_hoy": meses[int(h)],
                "auc_modelo": m["auc"],
                "auc_climatologia": m["auc_clim"],
                "mejora_brier": m["mejora_brier"],
                "peor_anio_2019_2026": min(metricas["por_anio"][h].values()),
                "mejor_anio": max(metricas["por_anio"][h].values()),
            }
        )
    partes += [tabla(pl.DataFrame(filas), pct=("mejora_brier", "peor_anio_2019_2026", "mejor_anio")), ""]
    if "top10_aciertos" in metricas["horizontes"][hs[0]]:
        partes += [
            "### Detección y 10 % de mayor riesgo",
            "",
            "Cada mes se marca el 10 % de celdas con más riesgo: `aciertos` es qué parte de las marcadas tuvo",
            "evento y `captura` qué parte de todos los eventos quedó adentro. `recall` es qué parte de los eventos",
            "se avisa si se avisa desde 50 % o desde 20 %, y `precision` qué parte de esos avisos acierta.",
            "`(clim)` es lo mismo usando solo la climatología.",
            "",
        ]
        filas = []
        for h in hs:
            m = metricas["horizontes"][h]
            filas.append(
                {
                    "meses_adelante": int(h),
                    "top10_aciertos": m["top10_aciertos"],
                    "top10_aciertos (clim)": m["top10_aciertos_clim"],
                    "top10_captura": m["top10_captura"],
                    "top10_captura (clim)": m["top10_captura_clim"],
                    "recall_50": m["recall_50"],
                    "precision_50": m["precision_50"],
                    "recall_20": m["recall_20"],
                    "precision_20": m["precision_20"],
                    "mejora_perdida_log": m["mejora_perdida_log"],
                }
            )
        f = pl.DataFrame(filas)
        partes += [tabla(f, pct=tuple(c for c in f.columns if c != "meses_adelante")), ""]
    variantes = {
        "base": "solo S-NPP",
        "sat": "+ NOAA-20, NOAA-21 y MODIS",
        "clima": "S-NPP + clima pasado",
        "satclima": "satélites + clima pasado",
        "oraculo": "satélites + clima, sabiendo el clima del mes pronosticado (no usable: techo)",
    }
    filas = []
    for clave, nombre in variantes.items():
        ruta = SALIDAS / f"metricas-{clave}.json"
        if ruta.exists():
            mh = json.loads(ruta.read_text())["horizontes"]
            fila = {"variables": nombre}
            for h in ("1", "2", "3"):
                fila[f"mejora_{h}_mes"] = round(1 - mh[h]["brier_sin_calibrar"] / mh[h]["brier_clim"], 4)
            filas.append(fila)
    if filas:
        partes += [
            "### ¿Qué aporta cada grupo de variables?",
            "",
            "Mejora del error (Brier, sin calibrar) frente a la climatología, en la misma prueba.",
            "",
            tabla(pl.DataFrame(filas), pct=("mejora_1_mes", "mejora_2_mes", "mejora_3_mes")),
            "",
        ]
    ruta = SALIDAS / "metricas-rb1.json"
    if ruta.exists():
        rb1 = json.loads(ruta.read_text())["rb1"]
        filas = []
        for h in ("1", "2", "3"):
            for quien in ("modelo", "climatologia"):
                filas.append({"meses_adelante": int(h), "prediccion": quien, **rb1[h][quien]})
        f = pl.DataFrame(filas)
        partes += [
            "### Medido como R-B1 (para comparar con #223)",
            "",
            "Evento = cualquier foco (`fire_days > 0`), emisiones 2025-01 a 2026-09, muestra de 3.000 celdas con",
            f"semilla 0; este modelo cubre {rb1['celdas_en_este_modelo']} de ellas (solo Argentina y Chile).",
            "Detección con corte en 50 %; top 10 % global de celdas-mes.",
            "",
            tabla(f, pct=("recall", "precision", "precision_top10", "captura_top10")),
            "",
        ]
    partes += [
        "### ¿Los porcentajes son creíbles? (a 1 mes, por celda)",
        "",
        "Cuando el modelo dice un rango, ¿qué parte de las veces pasó el evento?",
        "",
        tabla(pl.DataFrame(metricas["horizontes"]["1"]["fiabilidad"]), pct=("predicho", "observado")),
        "",
        "### Por área (a 1 mes)",
        "",
        "Probabilidad de al menos un evento dentro del área, contra lo observado en los mismos 24 meses.",
        "",
    ]
    filas = []
    for nombre, a in metricas["area"]["1"].items():
        filas.append(
            {
                "tamaño_del_area": nombre,
                "areas_probadas": a["areas"],
                "veces_con_evento": a["tasa_evento"],
                "auc": a["auc"],
                "mejora_brier": a["mejora_brier"],
                "kappa": a["kappa"],
            }
        )
    partes += [tabla(pl.DataFrame(filas), pct=("veces_con_evento", "mejora_brier")), ""]
    partes += ["Fiabilidad en cuadrados de 0,5° (~50 km):", ""]
    partes += [
        tabla(pl.DataFrame(metricas["area"]["1"]["0.5°"]["fiabilidad"]), pct=("predicho", "observado")),
        "",
    ]

    for h in (2, 1, 3):
        if h not in meses:
            continue
        titulo = "el próximo mes" if h == 2 else ("el mes en curso" if h == 1 else "dos meses adelante")
        p = prov.filter(pl.col("horizonte") == h).select(
            "provincia",
            "prob_evento",
            "nivel",
            "celdas_esperadas",
            "celdas_habituales",
            "vs_habitual_pct",
            "historia_anios_con_evento",
            "historia_celdas_max",
        )
        partes += [
            f"## Provincias: {meses[h]} ({titulo}, {h} mes(es) después del último dato)",
            "",
            "`prob_evento`: probabilidad de al menos un evento en la provincia. `celdas_esperadas`: cuántas celdas de",
            "~10 km tendrían evento; `celdas_habituales`, lo normal para ese mes. `historia`: en cuántos de los años",
            "con datos hubo evento ese mes, y el máximo de celdas.",
            "",
            tabla(p, pct=("prob_evento",)),
            "",
        ]
    partes += ["## Áreas dibujadas (ejemplos)", ""]
    for nombre, (x0, y0, x1, y1) in AREAS_DEMO.items():
        r = resumen_area(pred, metricas, box(x0, y0, x1, y1))
        partes += [
            f"**{nombre}** (lon {x0} a {x1}, lat {y0} a {y1})",
            "",
            tabla(r, pct=("prob_evento", "prob_habitual", "celda_mas_alta")),
            "",
        ]
    top = (
        pred.filter(pl.col("horizonte") == 2)
        .sort("prob", descending=True)
        .head(15)
        .select("cell_id", "region", "lat", "lon", "prob", "prob_habitual")
    )
    partes += [
        f"## Las 15 celdas más probables en {meses.get(2, '')}",
        "",
        tabla(top, pct=("prob", "prob_habitual")),
        "",
    ]
    return "\n".join(partes)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", help="lon0,lat0,lon1,lat1")
    ap.add_argument("--geojson", type=Path, help="Feature o geometría con el polígono dibujado")
    args = ap.parse_args()
    pred = pl.read_csv(SALIDAS / "prediccion_celdas.csv")
    metricas = json.loads((SALIDAS / "metricas.json").read_text())
    if args.bbox or args.geojson:
        if args.bbox:
            geom = box(*map(float, args.bbox.split(",")))
        else:
            g = json.loads(args.geojson.read_text())
            geom = shape(g.get("geometry", g))
        with pl.Config(tbl_rows=20, tbl_cols=12, tbl_width_chars=160):
            print(resumen_area(pred, metricas, geom))
        return
    regiones = json.loads((AQUI / "datos" / "regiones.geojson").read_text())
    nombres = {f["properties"]["region"]: f["properties"]["nombre"] for f in regiones["features"]}
    prov = provincias(pred, metricas, nombres)
    prov.write_csv(SALIDAS / "prediccion_provincias.csv")
    (AQUI / "REPORTE.md").write_text(reporte(pred, prov, metricas))
    print("prediccion_provincias.csv y REPORTE.md listos")


if __name__ == "__main__":
    main()
