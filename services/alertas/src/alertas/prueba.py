"""Aviso de prueba (#303): manda a cada grupo (D-39) un mensaje con el formato real, marcado como prueba
y sin botones.

    uv run --package alertas python -m alertas --prueba

No llama a la API ni registra nada: sirve para ver cómo llega un aviso a Telegram sin esperar un foco real.
El foco es de muestra (valores inventados).
"""

import logging
from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from alertas.mensaje import armar_mensaje
from alertas.modelos import Foco
from alertas.zona import Zona

log = logging.getLogger(__name__)

MARCA = "PRUEBA del bot de avisos: no es un incendio real. No hace falta hacer nada."


class Telegram(Protocol):
    async def enviar(self, chat_id: int, texto: str, teclado: list) -> None: ...


def mensaje_de_prueba(zona: Zona, ahora: datetime) -> str:
    foco = Foco(
        id="prueba",
        tipo="foco_satelital",
        lat=round(zona.lat, 5),
        lon=round(zona.lon, 5),
        cuando=ahora,
        detalle="VIIRS NOAA-20, confianza nominal, 4,8 MW, veredicto: probable · 2 detecciones en la celda",
    )
    return MARCA + "\n\n" + armar_mensaje(foco, zona, None)


async def prueba(tg: Telegram, destinos: Sequence[tuple[Zona, int]], ahora: datetime) -> None:
    """Un aviso de prueba por grupo, con el nombre de su zona. Sin botones: no toca ningún estado.
    Un grupo que falla no frena a los demás (#332); al final, si alguno falló, la corrida termina con
    error."""
    fallidos = 0
    for zona, chat_id in destinos:
        try:
            await tg.enviar(chat_id, mensaje_de_prueba(zona, ahora), [])
        except Exception as e:
            log.warning("no se pudo mandar la prueba al grupo de %s: %s", zona.id, e)
            fallidos += 1
    if fallidos:
        raise RuntimeError(f"la prueba falló en {fallidos} de {len(destinos)} grupos")
