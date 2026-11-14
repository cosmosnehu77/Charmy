"""/imagery (F3-B4, RF-CTX-03): imagen Sentinel-2 L2A del foco con las APIs de Copernicus Data Space.

- Catalog busca la escena más reciente de los últimos 30 días por debajo del umbral de nubes; Process genera
  el PNG de esa escena en color real o falso color. Sirve para mirar, no cambia el veredicto (D-19).
- Cada imagen se guarda en disco con un id que sale de la escena, el área y el estilo: la misma imagen no
  vuelve a gastar cuota de Process. El token OAuth se reutiliza hasta que vence (30 min).
- Sin escena: 404 `sin_imagen`. Cuota agotada o cualquier falla: 503 con el esquema `Error`. Nunca 500.
- `CDSE_CLIENT_ID` y `CDSE_CLIENT_SECRET` se leen al pedir el token y no aparecen en errores ni registros.
"""

import hashlib
import logging
import math
import os
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import FileResponse, JSONResponse

log = logging.getLogger(__name__)

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
SH_URL = "https://sh.dataspace.copernicus.eu/api/v1"
DIAS = 30  # ventana de búsqueda hacia atrás desde `before`
LADO_PX = 512  # 50 km (radio máximo) / 512 px ≈ 100 m por píxel: muy por debajo del tope de 1.500 m
# Ganancia 2,5 para que la reflectancia (0-0,4 en general) se vea; falso color: SWIR, NIR y rojo, donde lo
# quemado sale marrón rojizo y el fuego activo, naranja brillante.
BANDAS = {"color_real": ("B04", "B03", "B02"), "falso_color": ("B12", "B8A", "B04")}
# shortcut: las imágenes viven en el disco del servidor y se pierden si el contenedor se recrea sin volumen;
# solo cuesta volver a gastar cuota de Process.
CACHE = Path("data/cache/imagenes")
CLIENTE = httpx.Client(timeout=30.0)
SIN_IMAGEN = {
    "code": "sin_imagen",
    "message": "No hay una imagen despejada de los últimos 30 días para este lugar.",
}
NO_DISPONIBLE = {
    "code": "fuente_no_disponible",
    "message": "Las imágenes satelitales no están disponibles ahora. El resto de Charmy sigue funcionando.",
}
NO_EXISTE = {"code": "no_existe", "message": "No encontramos esa imagen."}

router = APIRouter()
_token: tuple[str, datetime] | None = None


class FuenteNoDisponible(Exception):
    pass


def _ahora() -> datetime:
    return datetime.now(UTC)


def _evalscript(estilo: str) -> str:
    r, g, b = BANDAS[estilo]
    return f"""//VERSION=3
function setup() {{ return {{ input: ["{r}", "{g}", "{b}", "dataMask"], output: {{ bands: 4 }} }}; }}
function evaluatePixel(s) {{ return [2.5 * s.{r}, 2.5 * s.{g}, 2.5 * s.{b}, s.dataMask]; }}"""


def _pedir(metodo: str, url: str, **kwargs) -> httpx.Response:
    try:
        r = CLIENTE.request(metodo, url, **kwargs)
        r.raise_for_status()
        return r
    except httpx.HTTPError as e:
        # Solo el tipo y el estado: el resto puede traer cabeceras o el cuerpo del pedido.
        estado = getattr(getattr(e, "response", None), "status_code", "")
        raise FuenteNoDisponible(f"{type(e).__name__} {estado}".strip()) from None


def _bearer() -> dict[str, str]:
    global _token
    if _token is None or _token[1] - timedelta(minutes=1) <= _ahora():
        cliente, secreto = os.environ.get("CDSE_CLIENT_ID"), os.environ.get("CDSE_CLIENT_SECRET")
        if not cliente or not secreto:
            raise FuenteNoDisponible("faltan CDSE_CLIENT_ID o CDSE_CLIENT_SECRET")
        datos = {"grant_type": "client_credentials", "client_id": cliente, "client_secret": secreto}
        try:
            cuerpo = _pedir("POST", TOKEN_URL, data=datos).json()
            _token = (cuerpo["access_token"], _ahora() + timedelta(seconds=cuerpo["expires_in"]))
        except (ValueError, KeyError):
            raise FuenteNoDisponible("token ilegible") from None
    return {"Authorization": f"Bearer {_token[0]}"}


def _bbox(lat: float, lon: float, radio_km: float) -> list[float]:
    dlat = radio_km / 111.32
    dlon = radio_km / (111.32 * math.cos(math.radians(lat)))
    return [round(v, 4) for v in (lon - dlon, lat - dlat, lon + dlon, lat + dlat)]


def _escena(bbox: list[float], antes: date, max_nubes: int) -> dict | None:
    """La escena más reciente con nubes por debajo del umbral, o None."""
    desde = antes - timedelta(days=DIAS)
    cuerpo = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": f"{desde}T00:00:00Z/{antes}T23:59:59Z",
        "limit": 100,
        "fields": {"include": ["id", "properties.datetime", "properties.eo:cloud_cover"]},
    }
    try:
        escenas = _pedir("POST", f"{SH_URL}/catalog/1.0.0/search", json=cuerpo, headers=_bearer()).json()[
            "features"
        ]
        despejadas = [e for e in escenas if e["properties"]["eo:cloud_cover"] <= max_nubes]
    except (ValueError, KeyError, TypeError):
        raise FuenteNoDisponible("catálogo ilegible") from None
    # Más reciente primero; el mismo día, la más despejada.
    return max(
        despejadas,
        key=lambda e: (e["properties"]["datetime"][:10], -e["properties"]["eo:cloud_cover"]),
        default=None,
    )


def _generar(ruta: Path, bbox: list[float], dia: str, estilo: str) -> None:
    cuerpo = {
        "input": {
            "bounds": {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"}},
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {"from": f"{dia}T00:00:00Z", "to": f"{dia}T23:59:59Z"},
                        "mosaickingOrder": "leastCC",
                    },
                }
            ],
        },
        "output": {
            "width": LADO_PX,
            "height": LADO_PX,
            "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
        },
        "evalscript": _evalscript(estilo),
    }
    png = _pedir("POST", f"{SH_URL}/process", json=cuerpo, headers=_bearer()).content
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(png)


@router.get("/imagery/latest", operation_id="getLatestImagery", tags=["vivo"])
def latest(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius_km: float = Query(5, ge=1, le=25),
    style: str = Query("color_real", pattern="^(color_real|falso_color)$"),
    before: date | None = None,
    max_cloud_pct: int = Query(30, ge=0, le=100),
):
    bbox = _bbox(lat, lon, radius_km)
    try:
        escena = _escena(bbox, before or _ahora().date(), max_cloud_pct)
        if escena is None:
            return JSONResponse(SIN_IMAGEN, status_code=404)
        acquired_at = escena["properties"]["datetime"]
        image_id = hashlib.sha256(f"{escena['id']}|{bbox}|{style}".encode()).hexdigest()[:16]
        ruta = CACHE / f"{image_id}.png"
        if not ruta.exists():
            _generar(ruta, bbox, acquired_at[:10], style)
    except FuenteNoDisponible as e:
        log.warning("Copernicus no responde: %s", e)
        return JSONResponse(NO_DISPONIBLE, status_code=503)
    return {
        "image_id": image_id,
        "image_url": f"/api/v1/imagery/{image_id}.png",
        "bbox": bbox,
        "acquired_at": acquired_at,
        "cloud_cover_pct": escena["properties"]["eo:cloud_cover"],
        "style": style,
        "source": "Copernicus Sentinel-2 L2A",
        "attribution": f"Contiene datos modificados de Copernicus Sentinel {acquired_at[:4]}",
    }


@router.get("/imagery/{image_id}.png", operation_id="getImageryPng", tags=["vivo"])
def png(image_id: str):
    ruta = CACHE / f"{image_id}.png"
    if not re.fullmatch(r"[0-9a-f]{16}", image_id) or not ruta.exists():
        return JSONResponse(NO_EXISTE, status_code=404)
    return FileResponse(ruta, media_type="image/png")
