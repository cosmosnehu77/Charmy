"""Predicción por zona y por región (F4-C4, #345, RF-PRE-01, RF-PRE-02, D-10).

La calcula el servicio `charmy-prediccion` (services/prediccion, #336, #341): el modelo binario
charmy-eventos-v1 da, para los próximos seis meses, la probabilidad de al menos un evento en la zona y cuántas
celdas de 0,1° lo tendrían, contra lo habitual. El navegador nunca llama al servicio: lo llama esta API con
`PREDICCION_TOKEN`.

La compuerta D-10 pasa en los seis plazos, pero a 3 meses o más hubo un año peor que la climatología: los
plazos 1 y 2 van como pronóstico y los demás como lo habitual ajustado (#341).

La emisión cambia una vez por mes: cada respuesta se guarda doce horas. En el plan gratis de Render el
servicio se duerme; si no contesta a tiempo, esa parte queda no disponible (503) y no se guarda nada.
"""

import logging
import os
import threading
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.datos import geojson
from api.errores import ErrorDeContrato

log = logging.getLogger(__name__)
router = APIRouter()

# El servicio despierto responde en milisegundos; dormido tarda casi un minuto en arrancar.
CLIENTE = httpx.Client(timeout=20)
VIDA_GUARDADO = timedelta(hours=12)
PLAZOS_PRONOSTICO = 2
NO_DISPONIBLE = "La predicción no está disponible ahora. Probá más tarde."

# Respuestas guardadas por zona (y una para todas las regiones): (cuándo, respuesta).
_guardado: dict[str, tuple[datetime, dict]] = {}
# Uno para las zonas y otro para el resumen por región, que tarda más: no se traban entre sí.
_candados = {"zona": threading.Lock(), "regiones": threading.Lock()}


def _ahora() -> datetime:
    return datetime.now(UTC)


def _codigos() -> list[str]:
    return [f["properties"]["region"] for f in geojson("regiones")["features"]]


class Zona(BaseModel):
    bbox: Annotated[list[float], Field(min_length=4, max_length=4)] | None = None
    geometry: dict[str, Any] | None = None
    region: str | None = None


def _no_disponible() -> ErrorDeContrato:
    return ErrorDeContrato(503, "fuente_no_disponible", NO_DISPONIBLE)


def _pedir(cuerpo: dict) -> dict:
    url = os.environ.get("PREDICCION_URL", "").strip().rstrip("/")
    token = os.environ.get("PREDICCION_TOKEN", "").strip()
    if not url or not token:
        log.warning("Predicción por zona sin configurar (PREDICCION_URL o PREDICCION_TOKEN)")
        raise _no_disponible()
    try:
        r = CLIENTE.post(f"{url}/prediccion/zona", json=cuerpo, headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as error:
        log.warning("El servicio de predicción no respondió: %s", type(error).__name__)
        raise _no_disponible() from error
    if r.status_code == 404:
        raise ErrorDeContrato(404, "no_existe", "No encontramos esa región.")
    if r.status_code != 200:
        log.warning("El servicio de predicción respondió %s", r.status_code)
        raise _no_disponible()
    return r.json()


def _meses(crudo: dict) -> list[dict]:
    return [
        {
            "month": m["mes"],
            "horizon": m["horizonte"],
            "kind": "forecast" if m["horizonte"] <= PLAZOS_PRONOSTICO else "usual_adjusted",
            "probability": m["probabilidad"],
            "usual_probability": m["probabilidad_habitual"],
            "expected_cells": m["celdas_esperadas"],
            "usual_cells": m["celdas_habituales"],
            "level": m["nivel"],
            "skill_vs_climatology": m["mejora_vs_climatologia"],
        }
        for m in crudo["meses"]
    ]


def _zona(crudo: dict) -> dict:
    return {"cells": crudo["zona"]["celdas"], "no_history": crudo["zona"]["sin_historia"]}


def _guardada(clave: str, candado: str, calcular) -> dict:
    with _candados[candado]:
        guardada = _guardado.get(clave)
        if guardada and _ahora() - guardada[0] <= VIDA_GUARDADO:
            return guardada[1]
        respuesta = calcular()
        _guardado[clave] = (_ahora(), respuesta)
        return respuesta


def zona(cuerpo: dict) -> dict:
    def calcular() -> dict:
        crudo = _pedir(cuerpo)
        return {
            "model": crudo["modelo"],
            "emission": crudo["emision"],
            "zone": _zona(crudo),
            "months": _meses(crudo),
        }

    return _guardada(repr(sorted(cuerpo.items())), "zona", calcular)


def por_region() -> dict:
    def calcular() -> dict:
        regiones, modelo, emision = [], None, None
        for codigo in _codigos():
            crudo = _pedir({"region": codigo})
            modelo, emision = crudo["modelo"], crudo["emision"]
            regiones.append({"region": codigo, "zone": _zona(crudo), "months": _meses(crudo)})
        return {"model": modelo, "emission": emision, "regions": regiones}

    return _guardada("regiones", "regiones", calcular)


@router.post("/forecast/zone", operation_id="postForecastZone", tags=["historico"])
def forecast_zone(cuerpo: Zona) -> dict:
    formas = {k: v for k, v in cuerpo.model_dump().items() if v is not None}
    if len(formas) != 1:
        raise ErrorDeContrato(400, "parametros_invalidos", "Mandá una sola zona: bbox, geometry o region.")
    # El servicio llama `geometria` al polígono.
    return zona({"geometria" if k == "geometry" else k: v for k, v in formas.items()})


@router.get("/regions/forecast", operation_id="getRegionsForecast", tags=["historico"])
def regions_forecast() -> dict:
    return por_region()
