"""Dónde están los Parquet precalculados.

Con `DATA_MANIFEST_URL` se usan los archivos del release publicado (infra/README.md) y DuckDB los lee
por HTTPS. Sin ella, se usan las muestras locales de `data/muestras` (correr desde la raíz del repo).
Nada se lee al importar.
"""

import json
import os
from functools import cache
from pathlib import Path

import duckdb
import httpx

MUESTRAS = Path("data/muestras")


class DatosNoDisponibles(Exception):
    """La fuente de datos no responde o no tiene la tabla pedida."""


@cache
def _manifiesto(url: str) -> tuple[tuple[str, str], ...]:
    try:
        respuesta = httpx.get(url, follow_redirects=True, timeout=20)
        respuesta.raise_for_status()
        archivos = respuesta.json()["archivos"]
    except (httpx.HTTPError, ValueError, KeyError) as error:
        raise DatosNoDisponibles(f"No se pudo leer el manifiesto de datos: {error}") from error
    return tuple((a["ruta"], a["url"]) for a in archivos)


def archivos(tabla: str) -> list[str]:
    """Rutas o URLs de los Parquet de una tabla del esquema (`focos`, `calendario`, ...)."""
    url = os.environ.get("DATA_MANIFEST_URL", "").strip()
    if url:
        encontrados = [
            u
            for ruta, u in _manifiesto(url)
            if ruta == f"{tabla}.parquet" or (ruta.startswith(f"{tabla}/") and ruta.endswith(".parquet"))
        ]
    else:
        carpeta = MUESTRAS
        unico = carpeta / f"{tabla}.parquet"
        partes = sorted(map(str, carpeta.glob(f"{tabla}/**/*.parquet")))
        encontrados = [str(unico)] if unico.exists() else partes
    if not encontrados:
        raise DatosNoDisponibles(f"No hay archivos de la tabla {tabla}")
    return encontrados


@cache
def _geojson(origen: str) -> dict:
    try:
        if origen.startswith("https://"):
            respuesta = httpx.get(origen, follow_redirects=True, timeout=20)
            respuesta.raise_for_status()
            return respuesta.json()
        return json.loads(Path(origen).read_text(encoding="utf-8"))
    except (httpx.HTTPError, OSError, ValueError) as error:
        raise DatosNoDisponibles(f"No se pudo leer {origen}: {error}") from error


def geojson(nombre: str) -> dict:
    """Un GeoJSON de los datos publicados (`regiones`, ...), del manifiesto o de las muestras locales."""
    url = os.environ.get("DATA_MANIFEST_URL", "").strip()
    if url:
        encontrados = [u for ruta, u in _manifiesto(url) if ruta == f"{nombre}.geojson"]
        if not encontrados:
            raise DatosNoDisponibles(f"El manifiesto no tiene {nombre}.geojson")
        return _geojson(encontrados[0])
    return _geojson(str(MUESTRAS / f"{nombre}.geojson"))


def conexion() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    return con
