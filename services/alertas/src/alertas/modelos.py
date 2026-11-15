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
    # Solo los focos satelitales: celda de 0,1° (cell_id), confianza y veredicto de la verificación (D-09).
    celda: str | None = None
    confianza: str | None = None
    veredicto: str | None = None


@dataclass(frozen=True)
class Viento:
    velocidad_kmh: float
    direccion_deg: float
