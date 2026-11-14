"""Zona de una entidad. En el MVP hay una sola, de demostración y precargada (D-08)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Zona:
    id: str
    nombre: str
    bbox: tuple[float, float, float, float]  # oeste, sur, este, norte
    pais: str  # ISO 3166-1 alfa-2: decide el número de emergencias

    def contiene(self, lat: float, lon: float) -> bool:
        oeste, sur, este, norte = self.bbox
        return oeste <= lon <= este and sur <= lat <= norte

    def bbox_param(self) -> str:
        return ",".join(f"{v:g}" for v in self.bbox)


# Zona de demostración: Comarca Andina del Paralelo 42 (Río Negro y Chubut).
ZONA_DEMO = Zona(id="zona-demo", nombre="Comarca Andina", bbox=(-71.9, -42.5, -71.0, -41.6), pais="AR")
