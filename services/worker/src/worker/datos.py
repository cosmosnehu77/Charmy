"""Datos publicados que usa la verificación: regiones y máscara de fuentes fijas.

Con `DATA_MANIFEST_URL` salen del release publicado (infra/README.md); sin ella, de `data/muestras/`
(correr desde la raíz del repo). Si algo falta, se devuelve vacío y la verificación sigue sin esa parte.
"""

import csv
import io
import json
import os
from pathlib import Path

import httpx
from shapely import STRtree
from shapely.geometry import Point, shape

MUESTRAS = Path("data/muestras")


def _leer(nombre: str, cliente: httpx.Client) -> str | None:
    url = os.environ.get("DATA_MANIFEST_URL", "").strip()
    try:
        if not url:
            ruta = MUESTRAS / nombre
            return ruta.read_text(encoding="utf-8") if ruta.exists() else None
        manifiesto = cliente.get(url, follow_redirects=True, timeout=30).json()
        enlaces = [a["url"] for a in manifiesto["archivos"] if a["ruta"] == nombre]
        if not enlaces:
            return None
        respuesta = cliente.get(enlaces[0], follow_redirects=True, timeout=60)
        respuesta.raise_for_status()
        return respuesta.text
    except (httpx.HTTPError, OSError, ValueError, KeyError):
        return None


class Regiones:
    """Región de calibración (ISO 3166-2) y su nombre para cada punto."""

    def __init__(self, geojson: dict | None) -> None:
        features = (geojson or {}).get("features", [])
        self._geometrias = [shape(f["geometry"]) for f in features]
        self._propiedades = [f["properties"] for f in features]
        self._arbol = STRtree(self._geometrias)

    def de(self, lon: float, lat: float) -> tuple[str, str] | None:
        punto = Point(lon, lat)
        for i in self._arbol.query(punto, predicate="intersects"):
            return self._propiedades[i]["region"], self._propiedades[i]["nombre"]
        return None


def regiones(cliente: httpx.Client) -> Regiones:
    texto = _leer("regiones.geojson", cliente)
    return Regiones(json.loads(texto) if texto else None)


def fuentes_fijas(cliente: httpx.Client) -> set[str] | None:
    """Celdas de 0,1° marcadas como fuente fija (F3-B1), o None si la máscara todavía no está publicada."""
    texto = _leer("fuentes_fijas.csv", cliente)
    if texto is None:
        return None
    return {fila["cell_id"] for fila in csv.DictReader(io.StringIO(texto)) if fila.get("cell_id")}
