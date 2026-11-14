"""Cliente de la API de Charmy (/api/v1). Si algo falla, queda "no disponible" y todo sigue (RNF-14)."""

import logging
from datetime import datetime

import httpx

from alertas.modelos import Foco, Tipo, Viento
from alertas.zona import Zona

log = logging.getLogger(__name__)

SATELITES = {"N20": "NOAA-20", "N21": "NOAA-21"}


def _foco_de_feature(f: dict) -> Foco:
    p = f["properties"]
    lon, lat = f["geometry"]["coordinates"][:2]
    frp = f"{p['frp']:.1f}".replace(".", ",")
    satelite = SATELITES.get(p["satellite"], p["satellite"])
    detalle = f"{p['instrument']} {satelite}, confianza {p['confidence']}, {frp} MW"
    if p.get("verdict"):
        detalle += f", veredicto: {p['verdict']}"
    return Foco(id=f["id"], tipo="foco_satelital", lat=lat, lon=lon,
                cuando=datetime.fromisoformat(p["acq_datetime"]), detalle=detalle)


def _foco_de_reporte(r: dict) -> Foco:
    return Foco(id=r["id"], tipo="reporte_ciudadano", lat=r["lat"], lon=r["lon"],
                cuando=datetime.fromisoformat(r["created_at"]),
                detalle=r.get("description") or "Sin descripción")


class ClienteCharmy:
    """`http` ya trae la base `<CHARMY_API_URL>/api/v1`; `token` es CHARMY_SERVICE_TOKEN."""

    def __init__(self, http: httpx.AsyncClient, token: str):
        self._http = http
        self._auth = {"Authorization": f"Bearer {token}"}

    async def viento(self, lat: float, lon: float) -> Viento | None:
        try:
            r = await self._http.get("/weather", params={"lat": lat, "lon": lon, "hours": 0})
            r.raise_for_status()
            ahora = r.json()["now"]
            return Viento(velocidad_kmh=ahora["wind_speed_ms"] * 3.6, direccion_deg=ahora["wind_dir_deg"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            log.warning("viento no disponible: %s", e)
            return None

    async def focos_en_vivo(self, zona: Zona) -> list[Foco]:
        """Focos de /live en la zona. Las fuentes fijas (industrias, volcanes) no se avisan."""
        try:
            r = await self._http.get("/live", params={"bbox": zona.bbox_param()})
            r.raise_for_status()
            features = r.json()["features"]
            return [_foco_de_feature(f) for f in features if not f["properties"].get("fixed_source")]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            log.warning("/live no disponible: %s", e)
            return []

    async def reportes(self, zona: Zona) -> list[Foco]:
        try:
            r = await self._http.get("/reports", params={"bbox": zona.bbox_param()}, headers=self._auth)
            r.raise_for_status()
            return [_foco_de_reporte(x) for x in r.json()]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            log.warning("/reports no disponible: %s", e)
            return []

    async def crear_alerta(self, zone_id: str, kind: Tipo, ref_id: str) -> tuple[str, bool]:
        """POST /alerts. Devuelve el id y si es nueva (201) o ya existía para ese foco o reporte (200)."""
        campo = "hotspot_id" if kind == "foco_satelital" else "report_id"
        r = await self._http.post("/alerts", json={"zone_id": zone_id, "kind": kind, campo: ref_id},
                                  headers=self._auth)
        r.raise_for_status()
        return r.json()["id"], r.status_code == 201

    async def actualizar_alerta(self, alert_id: str, status: str) -> bool:
        try:
            r = await self._http.patch(f"/alerts/{alert_id}", json={"status": status}, headers=self._auth)
            r.raise_for_status()
            return True
        except httpx.HTTPError as e:
            log.warning("PATCH /alerts/%s falló: %s", alert_id, e)
            return False
