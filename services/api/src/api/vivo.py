"""GET /live: focos de las últimas horas (RF-VIV-01).

Los guarda services/worker en Postgres (`focos_vivo` y `estado_vivo`), con una consulta a FIRMS cada
30 minutos.
La API nunca llama a FIRMS. Si la última consulta falló, sirve la anterior con su fecha y lo dice.
"""

import os
from datetime import UTC, datetime, timedelta
from typing import Annotated

import psycopg
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from api.datos import DatosNoDisponibles
from api.hotspots import leer_bbox

router = APIRouter()

# Más de una hora sin una consulta exitosa (el worker pide cada 30 minutos) cuenta como dato viejo.
VIGENCIA = timedelta(hours=1)


@router.get("/live", operation_id="listLive", tags=["vivo"])
def listar(
    bbox: Annotated[str, Query(description="oeste,sur,este,norte en grados decimales")],
    hours: Annotated[int, Query(ge=1, le=120)] = 48,
) -> JSONResponse:
    oeste, sur, este, norte = leer_bbox(bbox)
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise DatosNoDisponibles("Falta DATABASE_URL")
    ahora = datetime.now(UTC)
    try:
        with psycopg.connect(url, connect_timeout=10) as con:
            estado = con.execute("SELECT fetched_at, error FROM estado_vivo WHERE id = 1").fetchone()
            filas = con.execute(
                """
                SELECT id, latitude, longitude, acq_datetime, satellite, instrument, confidence, frp,
                       daynight, cell_id
                FROM focos_vivo
                WHERE longitude BETWEEN %s AND %s AND latitude BETWEEN %s AND %s AND acq_datetime >= %s
                ORDER BY acq_datetime, satellite, latitude, longitude
                """,
                [oeste, este, sur, norte, ahora - timedelta(hours=hours)],
            ).fetchall()
    except psycopg.Error as error:
        raise DatosNoDisponibles(f"La base no responde: {type(error).__name__}") from None
    if estado is None or estado[0] is None:
        raise DatosNoDisponibles("Todavía no hay una consulta exitosa a FIRMS")

    consultado, error = estado
    respuesta = {
        "type": "FeatureCollection",
        "features": [_feature(*fila) for fila in filas],
        "fetched_at": f"{consultado.astimezone(UTC):%Y-%m-%dT%H:%M:%SZ}",
        "stale": error is not None or ahora - consultado > VIGENCIA,
    }
    if respuesta["stale"]:
        hora = f"{consultado.astimezone(UTC):%d/%m %H:%M}"
        respuesta["message"] = (
            f"Mostramos los focos de la última consulta a FIRMS ({hora} UTC): "
            "las más recientes no respondieron."
        )
    return JSONResponse(respuesta, media_type="application/geo+json")


def _feature(id_, lat, lon, cuando, satelite, instrumento, confianza, frp, diaonoche, celda) -> dict:
    return {
        "type": "Feature",
        "id": id_,
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "acq_datetime": f"{cuando.astimezone(UTC):%Y-%m-%dT%H:%M:%SZ}",
            "satellite": satelite,
            "instrument": instrumento,
            "confidence": confianza,
            "frp": frp,
            "daynight": diaonoche,
            "cell_id": celda,
        },
    }
