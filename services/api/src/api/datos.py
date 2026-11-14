"""Dónde están los Parquet precalculados.

Con `DATA_MANIFEST_URL` se usan los archivos del release publicado (infra/README.md) y DuckDB los lee
por HTTPS. Sin ella, se usan las muestras locales de `data/muestras` (correr desde la raíz del repo).
Nada se lee al importar.
"""

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


def conexion() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    return con
