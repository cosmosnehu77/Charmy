"""GET /hotspots: focos de un área y un período, en GeoJSON o en CSV (RF-MAP-05, RF-EXP-01)."""

import csv
import io
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, Response

from api.datos import archivos, conexion
from api.errores import ErrorDeContrato

router = APIRouter()

NIVELES = ["low", "nominal", "high"]
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

    consulta = f"""
        SELECT latitude, longitude, strftime(acq_datetime, '%Y-%m-%dT%H:%M:%SZ') AS acq_datetime,
               satellite, instrument, confidence, confidence_pct, frp, daynight
        FROM read_parquet(?, union_by_name = true)
        WHERE {" AND ".join(condiciones)}
        ORDER BY acq_datetime, satellite, latitude, longitude
    """
    con = conexion()
    filas = con.execute(consulta, [archivos("focos"), *parametros]).fetchall()

    if format == "csv":
        return _csv(filas)
    return JSONResponse(_geojson(filas), media_type="application/geo+json")


def _geojson(filas: list[tuple]) -> dict:
    features = []
    for lat, lon, cuando, satelite, instrumento, confianza, _, frp, diaonoche in filas:
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
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _csv(filas: list[tuple]) -> Response:
    salida = io.StringIO()
    escritor = csv.writer(salida, lineterminator="\n")
    escritor.writerow(ENCABEZADO_CSV)
    for lat, lon, cuando, satelite, instrumento, confianza, confianza_pct, frp, diaonoche in filas:
        # Atributos crudos de FIRMS: MODIS da la confianza en 0-100 y VIIRS en l, n o h.
        crudo = confianza_pct if instrumento == "MODIS" and confianza_pct is not None else confianza[0]
        hora = cuando[11:13] + cuando[14:16]
        escritor.writerow([lat, lon, cuando[:10], hora, satelite, instrumento, crudo, frp, diaonoche])
    return Response(
        salida.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="charmy-focos.csv"'},
    )
