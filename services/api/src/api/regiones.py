"""GET /regions/summary: las 39 regiones con sus focos recientes y su último mes (F4-R1, vista Relieve).

Los focos salen de `focos_vivo` (services/worker) y se asignan a la región que los contiene. El último mes
sale de la tabla `calendario`. Si la base no responde, igual se devuelven las regiones (para dibujar el mapa)
con `live.available: false` y los conteos en null: el resto de la vista sigue andando (RNF-02).
"""

from datetime import UTC, date, datetime, timedelta
from functools import cache
from typing import Annotated

from fastapi import APIRouter, Query
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from api.base import conectar
from api.datos import DatosNoDisponibles, archivos, conexion, geojson

router = APIRouter()

# Como en /live: más de una hora sin una consulta exitosa a FIRMS cuenta como dato viejo.
VIGENCIA = timedelta(hours=1)


def _ahora() -> datetime:
    return datetime.now(UTC)


@cache
def _indice(id_regiones: int) -> tuple[STRtree, list[str]]:
    # La clave es el id del GeoJSON en caché: si cambian los datos publicados, se arma de nuevo.
    features = geojson("regiones")["features"]
    return STRtree([shape(f["geometry"]) for f in features]), [f["properties"]["region"] for f in features]


def _region_de(lon: float, lat: float, arbol: STRtree, codigos: list[str]) -> str | None:
    punto = Point(lon, lat)
    for i in arbol.query(punto, predicate="intersects"):
        return codigos[int(i)]
    return None


def _ultimos_meses() -> dict[str, dict]:
    """Último mes de cada región en `calendario`. Sin la tabla, ninguna región lo trae."""
    try:
        filas = (
            conexion()
            .execute(
                """
                SELECT region, year, month, value, median, percentile
                FROM read_parquet(?, union_by_name = true)
                QUALIFY row_number() OVER (PARTITION BY region ORDER BY year DESC, month DESC) = 1
                """,
                [archivos("calendario")],
            )
            .fetchall()
        )
    except DatosNoDisponibles:
        return {}
    return {
        region: {"year": anio, "month": mes, "value": valor, "median": mediana, "percentile": percentil}
        for region, anio, mes, valor, mediana, percentil in filas
    }


def _vivo(desde: datetime) -> tuple[tuple | None, list[tuple]]:
    with conectar() as con:
        estado = con.execute("SELECT fetched_at, error FROM estado_vivo WHERE id = 1").fetchone()
        focos = con.execute(
            "SELECT latitude, longitude, acq_datetime, frp FROM focos_vivo WHERE acq_datetime >= %s",
            [desde],
        ).fetchall()
    return estado, focos


@router.get("/regions/summary", operation_id="getRegionsSummary", tags=["vivo"])
def resumen(hours: Annotated[int, Query(ge=1, le=120)] = 120) -> dict:
    ahora = _ahora()
    desde = ahora - timedelta(hours=hours)
    dias = [desde.date() + timedelta(days=i) for i in range((ahora.date() - desde.date()).days + 1)]
    posicion = {d: i for i, d in enumerate(dias)}
    regiones = geojson("regiones")
    ultimos = _ultimos_meses()

    try:
        estado, focos = _vivo(desde)
        if estado is None or estado[0] is None:
            raise DatosNoDisponibles("Todavía no hay una consulta exitosa a FIRMS")
    except DatosNoDisponibles:
        live = {"available": False, "message": "Los focos recientes no están disponibles ahora."}
        conteos = None
    else:
        consultado, error = estado
        live = {
            "available": True,
            "fetched_at": f"{consultado.astimezone(UTC):%Y-%m-%dT%H:%M:%SZ}",
            "stale": error is not None or ahora - consultado > VIGENCIA,
        }
        if live["stale"]:
            hora = f"{consultado.astimezone(UTC):%d/%m %H:%M}"
            live["message"] = f"Mostramos los focos de la última consulta a FIRMS ({hora} UTC)."
        arbol, codigos = _indice(id(regiones))
        conteos = {c: ([0] * len(dias), [0.0] * len(dias)) for c in codigos}
        for lat, lon, cuando, frp in focos:
            region = _region_de(lon, lat, arbol, codigos)
            dia: date = cuando.astimezone(UTC).date()
            if region is None or dia not in posicion:
                continue
            conteos[region][0][posicion[dia]] += 1
            conteos[region][1][posicion[dia]] += frp or 0.0

    features = []
    for f in regiones["features"]:
        props = f["properties"]
        codigo = props["region"]
        por_dia, frp_por_dia = conteos[codigo] if conteos is not None else (None, None)
        features.append(
            {
                "type": "Feature",
                "id": codigo,
                "geometry": f["geometry"],
                "properties": {
                    "region": codigo,
                    "name": props["nombre"],
                    "country": props["pais"],
                    "hotspots": sum(por_dia) if por_dia is not None else None,
                    "frp_mw": round(sum(frp_por_dia), 1) if frp_por_dia is not None else None,
                    "by_day": por_dia,
                    "frp_by_day": [round(v, 1) for v in frp_por_dia] if frp_por_dia is not None else None,
                    "last_month": ultimos.get(codigo),
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "hours": hours,
        "days": [d.isoformat() for d in dias],
        "live": live,
        "features": features,
    }
