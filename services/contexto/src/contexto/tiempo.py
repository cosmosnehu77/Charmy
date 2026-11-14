"""/weather (F3-B3, RF-CTX-01): tiempo en el foco con Meteomatics.

- Un pedido por celda de 0,1° y media hora, con 48 horas de pronóstico: los demás pedidos salen de la caché.
  Meteomatics permite 1.000 pedidos por día.
- Copia de respaldo (D-26): cada respuesta buena queda guardada por celda. Si Meteomatics falla, agota el cupo
  o la cuenta venció (22/11/2026), se responde la última copia de esa celda, con su fecha y `stale: true`.
  Sin copia, 503 con el esquema `Error` (RNF-14). Nunca 500.
- Las credenciales se leen al pedir, van en la cabecera de autenticación y nunca en errores ni registros.
"""

import json
import logging
import math
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)

URL = "https://api.meteomatics.com"
HORAS = 48  # el máximo del contrato: se pide siempre todo y cada respuesta toma lo suyo
# Parámetro de Meteomatics -> campo de WeatherPoint en el contrato.
PARAMETROS = {
    "wind_speed_10m:ms": "wind_speed_ms",
    "wind_dir_10m:d": "wind_dir_deg",
    "t_2m:C": "temperature_c",
    "relative_humidity_2m:p": "relative_humidity_pct",
    "forest_fire_warning:idx": "fire_risk_index",
}
# forest_fire_warning va de 0 (riesgo bajo) a 1 (muy alto) y Meteomatics solo dice que sube desde 0,5: sin
# niveles intermedios publicados, no se inventa fire_risk_label (es opcional en el contrato).
# shortcut: la copia vive en el disco del servidor y se pierde si el contenedor se recrea sin volumen;
# pasar a Postgres o a un volumen si la API se redespliega seguido después del 22/11.
RESPALDO = Path("data/respaldo/meteomatics")
CLIENTE = httpx.Client(timeout=10.0)
NO_DISPONIBLE = {
    "code": "fuente_no_disponible",
    "message": "El tiempo no está disponible ahora. El resto de Charmy sigue funcionando.",
}

router = APIRouter()
_cache: dict[tuple[str, datetime], dict] = {}


class FuenteNoDisponible(Exception):
    pass


def _ahora() -> datetime:
    return datetime.now(UTC)


def _iso(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def _celda(lat: float, lon: float) -> tuple[str, float, float]:
    """cell_id (esquina SO, como en el esquema de datos) y el centro de la celda, donde se pide el tiempo."""
    sur, oeste = (math.floor(v * 10 + 1e-9) / 10 for v in (lat, lon))
    return f"{sur:.1f}_{oeste:.1f}", round(sur + 0.05, 2), round(oeste + 0.05, 2)


def _pedir(lat: float, lon: float, desde: datetime) -> dict:
    usuario, clave = os.environ.get("METEOMATICS_USER"), os.environ.get("METEOMATICS_PASSWORD")
    if not usuario or not clave:
        raise FuenteNoDisponible("faltan METEOMATICS_USER o METEOMATICS_PASSWORD")
    rango = f"{_iso(desde)}--{_iso(desde + timedelta(hours=HORAS))}:PT1H"
    url = f"{URL}/{rango}/{','.join(PARAMETROS)}/{lat},{lon}/json"
    try:
        r = CLIENTE.get(url, auth=(usuario, clave))
        r.raise_for_status()
        return r.json()
    except (httpx.HTTPError, ValueError) as e:
        # Solo el tipo de error y el estado: el mensaje de httpx puede traer la URL.
        estado = getattr(getattr(e, "response", None), "status_code", "")
        raise FuenteNoDisponible(f"{type(e).__name__} {estado}".strip()) from None


def _puntos(crudo: dict) -> list[dict]:
    por_hora: dict[str, dict] = {}
    for serie in crudo["data"]:
        campo = PARAMETROS[serie["parameter"]]
        for d in serie["coordinates"][0]["dates"]:
            por_hora.setdefault(d["date"], {"time": d["date"]})[campo] = float(d["value"])
    return [por_hora[t] for t in sorted(por_hora)]


def _respuesta(guardada: dict, horas: int) -> dict:
    puntos = guardada["puntos"]
    return {
        "source": "Meteomatics",
        "fetched_at": guardada["fetched_at"],
        "now": puntos[0],
        "forecast": puntos[1 : horas + 1],
    }


def consultar(lat: float, lon: float, horas: int) -> dict:
    cell_id, clat, clon = _celda(lat, lon)
    ahora = _ahora()
    media_hora = ahora.replace(minute=ahora.minute // 30 * 30, second=0, microsecond=0)
    clave = (cell_id, media_hora)
    if clave not in _cache:
        copia = RESPALDO / f"{cell_id}.json"
        try:
            crudo = _pedir(clat, clon, ahora.replace(minute=0, second=0, microsecond=0))
            guardada = {"fetched_at": _iso(ahora), "puntos": _puntos(crudo)}
        except (FuenteNoDisponible, KeyError, TypeError) as e:
            motivo = e if isinstance(e, FuenteNoDisponible) else f"respuesta inesperada ({type(e).__name__})"
            log.warning("Meteomatics no responde para %s: %s", cell_id, motivo)
            if not copia.exists():
                raise FuenteNoDisponible from None
            respuesta = _respuesta(json.loads(copia.read_text()), horas)
            fecha = respuesta["fetched_at"][:16].replace("T", " ")
            message = f"Meteomatics no responde: mostramos la copia del {fecha} UTC."
            return {**respuesta, "stale": True, "message": message}
        copia.parent.mkdir(parents=True, exist_ok=True)
        copia.write_text(json.dumps(guardada))
        # Solo se guarda la media hora actual: lo anterior ya venció.
        for vieja in [k for k in _cache if k[1] != media_hora]:
            del _cache[vieja]
        _cache[clave] = guardada
    return _respuesta(_cache[clave], horas)


@router.get("/weather", operation_id="getWeather", tags=["vivo"])
def weather(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    hours: int = Query(12, ge=0, le=HORAS),
):
    try:
        return consultar(lat, lon, hours)
    except FuenteNoDisponible:
        return JSONResponse(NO_DISPONIBLE, status_code=503)
