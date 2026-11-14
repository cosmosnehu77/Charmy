"""Dónde están los Parquet precalculados.

Con `DATA_MANIFEST_URL` se usan los archivos del release publicado (infra/README.md) y DuckDB los lee
por HTTPS. Sin ella, se usan las muestras locales de `data/muestras` (correr desde la raíz del repo).
Nada se lee al importar.

Copia local (F4-C1, RNF-02): al arrancar, la API baja en segundo plano cada archivo publicado a `data/copia`
y controla su `sha256`. Lo que ya está copiado se lee del disco; si el release deja de responder, el
histórico sigue con la copia y su manifiesto.
"""

import hashlib
import json
import logging
import os
from functools import cache
from pathlib import Path

import duckdb
import httpx

MUESTRAS = Path("data/muestras")
COPIA = Path("data/copia")  # fuera del repo: data/* está ignorado salvo las muestras
CLIENTE = httpx.Client(follow_redirects=True, timeout=20)

log = logging.getLogger(__name__)


class DatosNoDisponibles(Exception):
    """La fuente de datos no responde o no tiene la tabla pedida."""


def _leer(manifiesto: dict) -> tuple[str, tuple[tuple[str, str, str], ...]]:
    return manifiesto["version"], tuple((a["ruta"], a["url"], a["sha256"]) for a in manifiesto["archivos"])


@cache
def _leer_manifiesto(url: str) -> tuple[str, tuple[tuple[str, str, str], ...]]:
    try:
        respuesta = CLIENTE.get(url)
        respuesta.raise_for_status()
        return _leer(respuesta.json())
    except (httpx.HTTPError, ValueError, KeyError) as error:
        copia = COPIA / "manifest.json"
        if copia.exists():
            log.warning("El manifiesto no responde (%s): se usa la copia local", type(error).__name__)
            return _leer(json.loads(copia.read_text(encoding="utf-8")))
        raise DatosNoDisponibles(f"No se pudo leer el manifiesto de datos: {error}") from error


def _manifiesto(url: str) -> list[tuple[str, str]]:
    """(ruta, origen) de cada archivo publicado: la copia local si ya está, si no la URL del release."""
    version, publicados = _leer_manifiesto(url)
    return [
        (ruta, str(COPIA / version / ruta) if (COPIA / version / ruta).exists() else u)
        for ruta, u, _ in publicados
    ]


def _bajar(url: str, sha256: str, destino: Path) -> None:
    parcial = destino.with_name(destino.name + ".parcial")
    suma = hashlib.sha256()
    with CLIENTE.stream("GET", url) as respuesta, parcial.open("wb") as archivo:
        respuesta.raise_for_status()
        for trozo in respuesta.iter_bytes():
            suma.update(trozo)
            archivo.write(trozo)
    if suma.hexdigest() != sha256:
        parcial.unlink()
        raise ValueError("el sha256 no coincide con el manifiesto")
    parcial.replace(destino)


def copiar() -> int:
    """Baja a `COPIA` los archivos publicados que falten y guarda el manifiesto. Devuelve cuántos bajó."""
    url = os.environ.get("DATA_MANIFEST_URL", "").strip()
    if not url:
        return 0
    version, publicados = _leer_manifiesto(url)
    bajados = 0
    for ruta, origen, sha256 in publicados:
        destino = COPIA / version / ruta
        if destino.exists():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        try:
            _bajar(origen, sha256, destino)
            bajados += 1
        except (httpx.HTTPError, OSError, ValueError) as error:
            # Ese archivo se sigue leyendo del release hasta que la API vuelva a arrancar.
            log.warning("No se copió %s: %s", ruta, type(error).__name__)
    manifiesto = {
        "version": version,
        "archivos": [{"ruta": r, "url": u, "sha256": s} for r, u, s in publicados],
    }
    COPIA.mkdir(parents=True, exist_ok=True)
    (COPIA / "manifest.json").write_text(json.dumps(manifiesto), encoding="utf-8")
    return bajados


def version() -> str:
    """Versión de los datos que se sirven: la del manifiesto, o `muestras` si se usan las locales."""
    url = os.environ.get("DATA_MANIFEST_URL", "").strip()
    return _leer_manifiesto(url)[0] if url else "muestras"


def archivos(tabla: str, opcional: bool = False) -> list[str]:
    """Rutas o URLs de los Parquet de una tabla del esquema (`focos`, `calendario`, ...).

    Con `opcional`, una tabla que no se publicó devuelve una lista vacía en vez de 503.
    """
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
    if not encontrados and not opcional:
        raise DatosNoDisponibles(f"No hay archivos de la tabla {tabla}")
    return encontrados


@cache
def _geojson(origen: str) -> dict:
    try:
        if origen.startswith("https://"):
            respuesta = CLIENTE.get(origen)
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


@cache
def _base() -> duckdb.DuckDBPyConnection:
    # Una sola base en memoria para todo el proceso: guarda los metadatos de los Parquet remotos.
    # Abrir los metadatos de decenas de archivos por HTTPS es lo que más tarda en /hotspots.
    con = duckdb.connect()
    con.execute("SET GLOBAL parquet_metadata_cache = true")
    con.execute("SET GLOBAL enable_http_metadata_cache = true")
    return con


def conexion() -> duckdb.DuckDBPyConnection:
    """Un cursor propio por pedido (los pedidos corren en hilos distintos) sobre la base compartida."""
    cursor = _base().cursor()
    cursor.execute("SET TimeZone = 'UTC'")
    cursor.execute("SET enable_progress_bar = false")
    return cursor
