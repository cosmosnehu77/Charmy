"""Botones de estado bajo cada aviso (RF-ALE-03). El dato del botón es `e:<alert_id>:<estado>`."""

from typing import Protocol

ESTADOS = {"visto": "Visto", "en_camino": "En camino", "controlado": "Controlado", "falso": "Falso"}

Teclado = list[tuple[str, str]]  # (texto del botón, callback_data)


class Api(Protocol):
    async def actualizar_alerta(self, alert_id: str, status: str) -> bool: ...


def botones(alert_id: str) -> Teclado:
    return [(texto, f"e:{alert_id}:{estado}") for estado, texto in ESTADOS.items()]


async def al_tocar(api: Api, dato: str) -> str | None:
    """Respuesta para quien tocó el botón, o None si el dato no es un botón de estado."""
    prefijo, _, resto = dato.partition(":")
    alert_id, _, estado = resto.rpartition(":")
    if prefijo != "e" or not alert_id or estado not in ESTADOS:
        return None
    if await api.actualizar_alerta(alert_id, estado):
        return f"Listo: quedó como «{ESTADOS[estado]}»."
    return "No pude guardar el estado. Probá de nuevo en un rato."
