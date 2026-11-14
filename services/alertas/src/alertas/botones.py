"""Botones de estado bajo cada aviso (RF-ALE-03). El dato del botón es `e:<alert_id>:<estado>`."""

ESTADOS = {"visto": "Visto", "en_camino": "En camino", "controlado": "Controlado", "falso": "Falso"}

Teclado = list[tuple[str, str]]  # (texto del botón, callback_data)


def botones(alert_id: str) -> Teclado:
    return [(texto, f"e:{alert_id}:{estado}") for estado, texto in ESTADOS.items()]


def leer_dato(dato: str) -> tuple[str, str] | None:
    """(alert_id, estado) de un botón de estado, o None si el dato no es uno de los nuestros."""
    prefijo, _, resto = dato.partition(":")
    alert_id, _, estado = resto.rpartition(":")
    if prefijo != "e" or not alert_id or estado not in ESTADOS:
        return None
    return alert_id, estado


