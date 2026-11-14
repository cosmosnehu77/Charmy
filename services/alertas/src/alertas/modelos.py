"""Lo que se avisa: un foco satelital o un reporte ciudadano, y el viento en el lugar."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

Tipo = Literal["foco_satelital", "reporte_ciudadano"]


@dataclass(frozen=True)
class Foco:
    """Un foco de /live o un reporte de /reports, con lo mínimo para armar el aviso."""

    id: str
    tipo: Tipo
    lat: float
    lon: float
    cuando: datetime
    detalle: str


@dataclass(frozen=True)
class Viento:
    velocidad_kmh: float
    direccion_deg: float
