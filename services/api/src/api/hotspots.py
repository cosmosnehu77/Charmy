"""GET /hotspots: focos de un área y un período, en GeoJSON o en CSV (RF-MAP-05, RF-EXP-01)."""

import csv
import io
import re
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, Response

from api.datos import archivos, conexion
from api.errores import ErrorDeContrato

router = APIRouter()

NIVELES = ["low", "nominal", "high"]
TOPE = 20_000
SATELITES = {"modis": {"Terra", "Aqua"}, "viirs": {"N", "N20", "N21"}}
# focos/<satélite>-<año>.parquet (esquema.md); en el release la carpeta se aplana con `--`.
ARCHIVO_FOCOS = re.compile(r"([A-Za-z0-9]+)-(\d{4})\.parquet$")
ENCABEZADO_CSV = [
    "latitude",
    "longitude",
    "acq_date",
    "acq_time",
    "satellite",
    "instrument",
    "confidence",
    "frp",
    "daynight",
]


def leer_bbox(texto: str) -> tuple[float, float, float, float]:
    try:
        oeste, sur, este, norte = (float(v) for v in texto.split(","))
    except ValueError:
        raise ErrorDeContrato(
            400, "bbox_invalido", "El área debe tener el formato oeste,sur,este,norte."
        ) from None
    if not (-180 <= oeste < este <= 180 and -90 <= sur < norte <= 90):
        raise ErrorDeContrato(
            400, "bbox_invalido", "El área no es válida: revisá el orden oeste,sur,este,norte."
        )
    return oeste, sur, este, norte


@router.get("/hotspots", operation_id="listHotspots", tags=["historico"])
def listar(
    bbox: Annotated[str, Query(description="oeste,sur,este,norte en grados decimales")],
    desde: Annotated[date | None, Query(alias="from")] = None,
    hasta: Annotated[date | None, Query(alias="to")] = None,
    source: Literal["harmonized", "modis", "viirs"] = "harmonized",
    min_confidence: Literal["low", "nominal", "high"] = "nominal",
    format: Literal["geojson", "csv"] = "geojson",
) -> Response:
    oeste, sur, este, norte = leer_bbox(bbox)
    if desde and hasta and desde > hasta:
        raise ErrorDeContrato(400, "fechas_invalidas", "La fecha de inicio tiene que ir antes que la de fin.")

    condiciones = ["longitude BETWEEN ? AND ?", "latitude BETWEEN ? AND ?", "list_contains(?, confidence)"]
    parametros: list = [oeste, este, sur, norte, NIVELES[NIVELES.index(min_confidence) :]]
    if desde:
        condiciones.append("acq_datetime >= ?::TIMESTAMPTZ")
        parametros.append(desde.isoformat())
    if hasta:
        condiciones.append("acq_datetime < ?::TIMESTAMPTZ")
        parametros.append((hasta + timedelta(days=1)).isoformat())
    if source == "modis":
        condiciones.append("instrument = 'MODIS'")
    elif source == "viirs":
        condiciones.append("instrument = 'VIIRS'")
    else:
        # D-04: solo vegetación. Los focos NRT no traen `type` y se conservan.
        condiciones.append("(type = 0 OR type IS NULL)")

    origen = f"FROM read_parquet(?, union_by_name = true) WHERE {' AND '.join(condiciones)}"
    consulta = f"""
        SELECT latitude, longitude, strftime(acq_datetime, '%Y-%m-%dT%H:%M:%SZ') AS acq_datetime,
               satellite, instrument, confidence, confidence_pct, frp, daynight, cell_id
        {origen}
        ORDER BY acq_datetime, satellite, latitude, longitude
    """
    con = conexion()
    rutas = podar(archivos("focos"), desde, hasta, source)
    if not rutas:
        filas_vacias: list[tuple] = []
        if format == "csv":
            return _csv(filas_vacias)
        return JSONResponse(_geojson(filas_vacias), media_type="application/geo+json")
    parametros = [rutas, *parametros]

    if format == "csv":
        return _csv(con.execute(consulta, parametros).fetchall())
    # El mapa recibe como máximo TOPE focos; la descarga en CSV trae todos. El total sale de la misma lectura.
    con_total = consulta.replace(" AS acq_datetime,", " AS acq_datetime, count(*) OVER () AS total,", 1)
    filas = con.execute(con_total + " LIMIT ?", [*parametros, TOPE]).fetchall()
    total = filas[0][3] if filas else 0
    respuesta = _geojson([fila[:3] + fila[4:] for fila in filas])
    if total > TOPE:
        respuesta |= {"truncated": True, "total": total}
    return JSONResponse(respuesta, media_type="application/geo+json")


def podar(rutas: list[str], desde: date | None, hasta: date | None, source: str) -> list[str]:
    """Solo los archivos de los años y satélites pedidos: leerlos todos por HTTPS tarda minutos.

    Un archivo sin satélite y año en el nombre (las muestras) se lee siempre.
    """
    elegidos = []
    for ruta in rutas:
        partes = ARCHIVO_FOCOS.search(ruta.rsplit("/", 1)[-1].rsplit("--", 1)[-1])
        if partes:
            satelite, anio = partes[1], int(partes[2])
            if desde and anio < desde.year or hasta and anio > hasta.year:
                continue
            if source in SATELITES and satelite not in SATELITES[source]:
                continue
        elegidos.append(ruta)
    return elegidos


def _geojson(filas: list[tuple]) -> dict:
    features = []
    for lat, lon, cuando, satelite, instrumento, confianza, _, frp, diaonoche, celda in filas:
        features.append(
            {
                "type": "Feature",
                "id": f"{satelite}-{cuando}-{lat:.5f}-{lon:.5f}",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "acq_datetime": cuando,
                    "satellite": satelite,
                    "instrument": instrumento,
                    "confidence": confianza,
                    "frp": frp,
                    "daynight": diaonoche,
                    "cell_id": celda,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _csv(filas: list[tuple]) -> Response:
    salida = io.StringIO()
    escritor = csv.writer(salida, lineterminator="\n")
    escritor.writerow(ENCABEZADO_CSV)
    for lat, lon, cuando, satelite, instrumento, confianza, confianza_pct, frp, diaonoche, _ in filas:
        # Atributos crudos de FIRMS: MODIS da la confianza en 0-100 y VIIRS en l, n o h.
        crudo = confianza_pct if instrumento == "MODIS" and confianza_pct is not None else confianza[0]
        hora = cuando[11:13] + cuando[14:16]
        escritor.writerow([lat, lon, cuando[:10], hora, satelite, instrumento, crudo, frp, diaonoche])
    return Response(
        salida.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="charmy-focos.csv"'},
    )
