"""Zonas de avisos (D-39): cada una es un punto con radio y tiene su propio grupo de Telegram.

Las zonas viven acá; el id del grupo de cada una va en el secreto TELEGRAM_ZONAS, nunca en el repo.
"""

import json
import logging
import math
from collections.abc import Iterable
from dataclasses import dataclass

log = logging.getLogger(__name__)

RADIO_TIERRA_KM = 6371.0088
KM_POR_GRADO = math.pi * RADIO_TIERRA_KM / 180  # unos 111,2 km por grado de latitud

Rectangulo = tuple[float, float, float, float]  # oeste, sur, este, norte


@dataclass(frozen=True)
class Zona:
    id: str
    nombre: str
    lat: float
    lon: float
    radio_km: float
    pais: str  # ISO 3166-1 alfa-2: decide el número de emergencias y la hora local

    def contiene(self, lat: float, lon: float) -> bool:
        """Distancia por el círculo máximo (haversine) hasta el centro, contra el radio."""
        f1, f2 = math.radians(self.lat), math.radians(lat)
        df, dl = f2 - f1, math.radians(lon - self.lon)
        a = math.sin(df / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
        return 2 * RADIO_TIERRA_KM * math.asin(math.sqrt(a)) <= self.radio_km

    @property
    def bbox(self) -> Rectangulo:
        """El rectángulo que cubre el círculo: lo que se le pide a la API."""
        dlat = self.radio_km / KM_POR_GRADO
        dlon = self.radio_km / (KM_POR_GRADO * math.cos(math.radians(self.lat)))
        return (self.lon - dlon, self.lat - dlat, self.lon + dlon, self.lat + dlat)

    def bbox_param(self) -> str:
        return bbox_param(self.bbox)


def bbox_param(rect: Rectangulo) -> str:
    return ",".join(f"{v:.4f}" for v in rect)


def cubre(zonas: Iterable[Zona]) -> Rectangulo:
    """Un rectángulo que cubre todas las zonas, para pedir /live y /reports una sola vez por corrida."""
    rects = [z.bbox for z in zonas]
    oestes, sures, estes, nortes = zip(*rects, strict=True)
    return (min(oestes), min(sures), max(estes), max(nortes))


# La Comarca Andina conserva el id de siempre: la API guarda los avisos ya mandados con ese id.
ZONA_DEMO = Zona(id="zona-demo", nombre="Comarca Andina", lat=-41.964, lon=-71.533, radio_km=50, pais="AR")
ZONAS = (
    ZONA_DEMO,
    Zona(id="impenetrable", nombre="Impenetrable chaqueño", lat=-25.947, lon=-60.620, radio_km=60, pais="AR"),
    Zona(id="norte-salta", nombre="Norte de Salta", lat=-22.516, lon=-63.801, radio_km=60, pais="AR"),
)


def _grupo(valor: object) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int | str):
        raise ValueError(f"id de grupo inválido: {valor!r}")
    return int(valor)  # ValueError si no es un número


def destinos(zonas_json: str | None, chat_demo: str | None) -> list[tuple[Zona, int]]:
    """A qué grupo va cada zona. TELEGRAM_ZONAS es un JSON {zona: grupo}; sin él, la zona de demostración
    va a TELEGRAM_CHAT_ID. Un JSON mal escrito frena la corrida: mejor un fallo visible que avisos
    perdidos."""
    if not zonas_json:
        if not chat_demo:
            raise ValueError("faltan TELEGRAM_ZONAS y TELEGRAM_CHAT_ID")
        return [(ZONA_DEMO, _grupo(chat_demo))]
    try:
        pedido = json.loads(zonas_json)
    except json.JSONDecodeError as e:
        raise ValueError(f"TELEGRAM_ZONAS no es JSON: {e}") from None
    if not isinstance(pedido, dict):
        raise ValueError("TELEGRAM_ZONAS tiene que ser un objeto {zona: grupo}")
    grupos = {zona: _grupo(grupo) for zona, grupo in pedido.items()}
    for desconocida in sorted(set(grupos) - {z.id for z in ZONAS}):
        log.warning("TELEGRAM_ZONAS nombra una zona que no existe: %s", desconocida)
    return [(z, grupos[z.id]) for z in ZONAS if z.id in grupos]
