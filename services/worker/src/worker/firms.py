"""Focos recientes de FIRMS: VIIRS NOAA-20 y NOAA-21 NRT, normalizados a las columnas de `focos` (esquema.md).

La clave de FIRMS va dentro de la URL: nunca se registra ni se muestra. Todo error sale sin ella.
S-NPP no publica datos nuevos desde el 2/11/2026, así que no se pide.
"""

import csv
import io
import math
import os
from datetime import UTC, datetime

import httpx

# Fuente de FIRMS → código de satélite del contrato. Algunos archivos usan 1 y 2 para NOAA-20 y NOAA-21.
FUENTES = {"VIIRS_NOAA20_NRT": "N20", "VIIRS_NOAA21_NRT": "N21"}
ALIAS = {"N20": "N20", "1": "N20", "N21": "N21", "2": "N21"}
# Argentina y Chile continentales: oeste,sur,este,norte.
COBERTURA = "-76,-56,-53,-17"
URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{clave}/{fuente}/{area}/{dias}"
CONFIANZA = {"l": "low", "n": "nominal", "h": "high", "low": "low", "nominal": "nominal", "high": "high"}


class FirmsNoDisponible(Exception):
    """FIRMS no respondió, rechazó el pedido o falta la clave. El mensaje nunca incluye la clave."""


def pedir(fuente: str, dias: int, cliente: httpx.Client) -> str:
    """CSV de una fuente NRT para la cobertura, de los últimos `dias` días (1 a 5)."""
    clave = os.environ.get("FIRMS_MAP_KEY", "").strip()
    if not clave:
        raise FirmsNoDisponible("Falta FIRMS_MAP_KEY")
    url = URL.format(clave=clave, fuente=fuente, area=COBERTURA, dias=dias)
    try:
        respuesta = cliente.get(url, headers={"User-Agent": "charmy-worker/0.1"}, timeout=60)
        texto = respuesta.text
    except httpx.HTTPError as error:
        raise FirmsNoDisponible(f"{fuente}: {type(error).__name__}".replace(clave, "***")) from None
    # Con cupo agotado o clave inválida FIRMS devuelve un mensaje en texto, a veces con estado 200.
    if respuesta.status_code != 200 or not texto.startswith("latitude"):
        detalle = texto.strip()[:200].replace(clave, "***")
        raise FirmsNoDisponible(f"{fuente}: HTTP {respuesta.status_code} {detalle}")
    return texto


def _celda(valor: float) -> str:
    # Esquina suroeste de la celda de 0,1°, como pipeline.firms (el épsilon evita el redondeo binario).
    return f"{math.floor(valor * 10 + 1e-9) / 10:.1f}"


def normalizar(texto: str, satelite: str) -> list[dict]:
    """Filas del CSV de FIRMS de un satélite, con las columnas de `focos` y el `id` del contrato."""
    focos = []
    for fila in csv.DictReader(io.StringIO(texto)):
        # Los CSV públicos de 24 h no traen `instrument`; la API de área sí.
        if fila.get("instrument", "VIIRS") != "VIIRS" or ALIAS.get(fila.get("satellite", "")) != satelite:
            continue
        lat, lon = float(fila["latitude"]), float(fila["longitude"])
        hora = fila["acq_time"].zfill(4)
        cuando = datetime.strptime(f"{fila['acq_date']} {hora}", "%Y-%m-%d %H%M").replace(tzinfo=UTC)
        focos.append(
            {
                "id": f"{satelite}-{cuando:%Y-%m-%dT%H:%M:%SZ}-{lat:.5f}-{lon:.5f}",
                "latitude": lat,
                "longitude": lon,
                "acq_datetime": cuando,
                "satellite": satelite,
                "instrument": "VIIRS",
                "confidence": CONFIANZA[fila["confidence"].strip().lower()],
                "frp": float(fila["frp"]) if fila.get("frp") else None,
                "daynight": fila["daynight"],
                "cell_id": f"{_celda(lat)}_{_celda(lon)}",
            }
        )
    return focos
