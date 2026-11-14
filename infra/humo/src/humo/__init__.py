"""Prueba de humo de la API de Charmy (F2-A2).

Pide tres cosas a una API ya desplegada y falla si alguna no cumple el contrato
(packages/contracts/api/openapi.yaml):

- /health responde 200 con status "ok";
- /calendar de un área conocida (Comarca Andina) trae al menos un mes válido;
- /hotspots en CSV empieza con el encabezado del contrato.

La URL es la base de la API con su prefijo, la misma que VITE_API_URL:
  uv run --package humo python -m humo https://<host>/api/v1
  uv run --package humo python -m humo http://localhost:4010     # mock de Prism, sin prefijo
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable

ENCABEZADO_CSV = "latitude,longitude,acq_date,acq_time,satellite,instrument,confidence,frp,daynight"

# Comarca Andina: el mismo ejemplo del contrato. Si un día no tiene meses, algo se rompió.
AREA = {
    "type": "Polygon",
    "coordinates": [[[-71.6, -42.2], [-71.0, -42.2], [-71.0, -42.8], [-71.6, -42.8], [-71.6, -42.2]]],
}
BBOX = "-71.6,-42.8,-71.0,-42.2"

# (metodo, url, cuerpo JSON o None, encabezados) -> (estado HTTP, texto). Estado 0: no hubo respuesta.
Http = Callable[[str, str, dict | None, dict | None], tuple[int, str]]


def _http_real(metodo: str, url: str, cuerpo: dict | None = None, encabezados: dict | None = None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    h = {"User-Agent": "charmy-humo", **(encabezados or {})}
    if datos is not None:
        h["Content-Type"] = "application/json"
    pedido = urllib.request.Request(url, data=datos, method=metodo, headers=h)
    try:
        with urllib.request.urlopen(pedido, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return 0, str(e)


def _json(texto: str):
    try:
        return json.loads(texto)
    except ValueError:
        return None


def _health(estado: int, texto: str) -> str | None:
    if estado != 200:
        return f"/health respondió {estado or 'nada'}"
    d = _json(texto)
    if not isinstance(d, dict) or d.get("status") != "ok":
        return f"/health no dice status ok: {texto[:120]!r}"
    return None


def _calendario(estado: int, texto: str) -> str | None:
    if estado != 200:
        return f"/calendar respondió {estado or 'nada'}"
    d = _json(texto)
    celdas = d.get("cells") if isinstance(d, dict) else None
    if not isinstance(celdas, list):
        return "/calendar no trae la lista cells"
    meses = [c for c in celdas if isinstance(c, dict) and c.get("month") in range(1, 13)]
    if not meses:
        return f"/calendar no trae meses válidos para la Comarca Andina ({len(celdas)} celdas)"
    return None


def _csv(estado: int, texto: str) -> str | None:
    if estado != 200:
        return f"/hotspots?format=csv respondió {estado or 'nada'}"
    primera = texto.lstrip("﻿").splitlines()[0].strip() if texto.strip() else ""
    if primera != ENCABEZADO_CSV:
        return f"/hotspots?format=csv no empieza con el encabezado del contrato: {primera[:120]!r}"
    return None


def probar(base: str, http: Http = _http_real) -> list[str]:
    """Devuelve los problemas encontrados; la lista vacía quiere decir que la API está sana."""
    base = base.rstrip("/")
    consulta = urllib.parse.urlencode(
        {"bbox": BBOX, "from": "2025-01-01", "to": "2025-01-31", "format": "csv"}
    )
    pruebas = [
        (_health, http("GET", f"{base}/health", None, {"Accept": "application/json"})),
        (
            _calendario,
            http(
                "POST",
                f"{base}/calendar",
                {"area": AREA, "resolution": "month"},
                {"Accept": "application/json"},
            ),
        ),
        (_csv, http("GET", f"{base}/hotspots?{consulta}", None, {"Accept": "text/csv"})),
    ]
    return [p for p in (revisar(*respuesta) for revisar, respuesta in pruebas) if p]


def main(argv: list[str], http: Http = _http_real) -> int:
    if len(argv) != 1 or argv[0].startswith("-"):
        print("uso: python -m humo <url-base-de-la-api>", file=sys.stderr)
        return 2
    problemas = probar(argv[0], http)
    for p in problemas:
        print(f"FALLA {p}", file=sys.stderr)
    print(f"{3 - len(problemas)} de 3 pruebas bien contra {argv[0]}")
    return 1 if problemas else 0
