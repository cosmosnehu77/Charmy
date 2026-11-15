"""Cliente de la API de Charmy (/api/v1). Si algo falla, queda "no disponible" y todo sigue (RNF-14)."""

import logging
from datetime import datetime

import httpx

from alertas.modelos import Alerta, Anterior, Foco, Tipo, Viento
from alertas.zona import Rectangulo, bbox_param

log = logging.getLogger(__name__)

SATELITES = {"N20": "NOAA-20", "N21": "NOAA-21"}
ESPERA_VIENTO_S = 15  # el viento es opcional (D-37): si tarda, el aviso sale sin él


def _foco_de_feature(f: dict) -> Foco:
    p = f["properties"]
    lon, lat = f["geometry"]["coordinates"][:2]
    # Un foco NRT puede venir sin FRP (frp: null en el contrato): sigue siendo un foco.
    frp = "FRP sin dato" if p.get("frp") is None else f"{p['frp']:.1f}".replace(".", ",") + " MW"
    satelite = SATELITES.get(p["satellite"], p["satellite"])
    detalle = f"{p['instrument']} {satelite}, confianza {p['confidence']}, {frp}"
    if p.get("verdict"):
        detalle += f", veredicto: {p['verdict']}"
    return Foco(id=f["id"], tipo="foco_satelital", lat=lat, lon=lon,
                cuando=datetime.fromisoformat(p["acq_datetime"]), detalle=detalle,
                celda=p.get("cell_id"), confianza=p["confidence"], veredicto=p.get("verdict"))


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
            r = await self._http.get(
                "/weather", params={"lat": lat, "lon": lon, "hours": 0}, timeout=ESPERA_VIENTO_S
            )
            r.raise_for_status()
            ahora = r.json()["now"]
            return Viento(velocidad_kmh=ahora["wind_speed_ms"] * 3.6, direccion_deg=ahora["wind_dir_deg"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            log.warning("viento no disponible: %s", e)
            return None

    async def focos_en_vivo(self, area: Rectangulo) -> list[Foco]:
        """Focos de /live en el área. Las fuentes fijas (industrias, volcanes) no se avisan."""
        try:
            r = await self._http.get("/live", params={"bbox": bbox_param(area)})
            r.raise_for_status()
            features = r.json()["features"]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            log.warning("/live no disponible: %s", e)
            return []
        focos = []
        for f in features:
            try:
                if not f["properties"].get("fixed_source"):
                    focos.append(_foco_de_feature(f))
            except (KeyError, TypeError, ValueError, AttributeError) as e:  # uno roto no tapa a los demás
                log.warning("foco de /live ilegible (%s): %s", f.get("id") if isinstance(f, dict) else f, e)
        return focos

    async def reportes(self, area: Rectangulo) -> list[Foco]:
        try:
            r = await self._http.get("/reports", params={"bbox": bbox_param(area)}, headers=self._auth)
            r.raise_for_status()
            return [_foco_de_reporte(x) for x in r.json()]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            log.warning("/reports no disponible: %s", e)
            return []

    async def crear_alerta(self, zone_id: str, kind: Tipo, ref_id: str, celda: str | None = None) -> Alerta:
        """POST /alerts. Falta mandarlo si es nuevo (201) o si existía pero `sent_at` es null (#280). Trae
        también qué veredicto se mandó, el id del mensaje y el aviso anterior de la celda (#321). Con una API
        sin esos campos, se comporta como antes."""
        campo = "hotspot_id" if kind == "foco_satelital" else "report_id"
        cuerpo = {"zone_id": zone_id, "kind": kind, campo: ref_id} | ({"cell_id": celda} if celda else {})
        r = await self._http.post("/alerts", json=cuerpo, headers=self._auth)
        r.raise_for_status()
        aviso = r.json()
        previo = aviso.get("previous")
        anterior = None
        if previo:
            enviado = previo.get("sent_at")
            anterior = Anterior(previo["id"], datetime.fromisoformat(enviado) if enviado else None,
                                previo.get("message_id"))
        return Alerta(
            id=aviso["id"],
            pendiente=r.status_code == 201 or ("sent_at" in aviso and aviso["sent_at"] is None),
            veredicto_enviado=aviso.get("sent_verdict"),
            message_id=aviso.get("message_id"),
            anterior=anterior,
        )

    async def marcar_enviada(
        self, alert_id: str, veredicto: str | None = None, message_id: int | None = None
    ) -> bool:
        """POST /alerts/{id}/sent con el veredicto mandado y el id del mensaje. Si falla, el aviso se
        reenvía en la corrida siguiente."""
        cuerpo = {k: v for k, v in (("verdict", veredicto), ("message_id", message_id)) if v is not None}
        try:
            r = await self._http.post(f"/alerts/{alert_id}/sent", json=cuerpo or None, headers=self._auth)
            r.raise_for_status()
            return True
        except httpx.HTTPError as e:
            log.warning("no se pudo marcar enviado el aviso %s (se reenviará): %s", alert_id, e)
            return False

    async def actualizar_alerta(self, alert_id: str, status: str) -> bool:
        try:
            r = await self._http.patch(f"/alerts/{alert_id}", json={"status": status}, headers=self._auth)
            r.raise_for_status()
            return True
        except httpx.HTTPError as e:
            log.warning("PATCH /alerts/%s falló: %s", alert_id, e)
            return False
