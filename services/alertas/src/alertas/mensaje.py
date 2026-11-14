"""Armado del texto del aviso. Función pura (RF-ALE-02, RF-ALE-06, RF-CTX-02)."""

from alertas.modelos import Foco, Viento
from alertas.zona import Zona

# Bomberos en Argentina y en Chile.
EMERGENCIAS = {"AR": "100", "CL": "132"}

PUNTOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"]


def punto_cardinal(grados: float) -> str:
    """De dónde viene el viento, en ocho puntos (la dirección meteorológica es de origen)."""
    return PUNTOS[round(grados % 360 / 45) % 8]


def titulo(foco: Foco) -> str:
    return "Foco de calor satelital" if foco.tipo == "foco_satelital" else "Reporte de un vecino"


def enlace_mapa(foco: Foco) -> str:
    return f"https://www.openstreetmap.org/?mlat={foco.lat:.5f}&mlon={foco.lon:.5f}#map=13/{foco.lat:.5f}/{foco.lon:.5f}"


def aviso_emergencias(zona: Zona) -> str:
    numero = EMERGENCIAS.get(zona.pais, "112")
    return f"Charmy no reemplaza a los servicios de emergencia. Si hay peligro, llamá al {numero}."


def armar_mensaje(foco: Foco, zona: Zona, viento: Viento | None) -> str:
    coords = f"{foco.lat:.5f}, {foco.lon:.5f}"
    if viento is None:
        linea_viento = "Viento: no disponible"
    else:
        linea_viento = f"Viento: {viento.velocidad_kmh:.0f} km/h del {punto_cardinal(viento.direccion_deg)}"
    return "\n".join(
        [
            f"{titulo(foco)} en tu zona ({zona.nombre})",
            f"Dónde: {coords}",
            f"Cuándo: {foco.cuando.strftime('%d/%m/%Y %H:%M')} UTC",
            f"Qué: {foco.detalle}",
            linea_viento,
            f"Mapa: {enlace_mapa(foco)}",
            "",
            aviso_emergencias(zona),
        ]
    )
