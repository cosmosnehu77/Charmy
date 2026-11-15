"""Aviso de prueba (#303): manda al grupo un mensaje con el formato real, marcado como prueba y sin botones.

    uv run --package alertas python -m alertas --prueba

No llama a la API ni registra nada: sirve para ver cómo llega un aviso a Telegram sin esperar un foco real.
El foco es de muestra (valores inventados).
"""

from datetime import datetime
from typing import Protocol

from alertas.mensaje import armar_mensaje
from alertas.modelos import Foco
from alertas.zona import Zona

MARCA = "PRUEBA del bot de avisos: no es un incendio real. No hace falta hacer nada."


class Telegram(Protocol):
    async def enviar(self, chat_id: int, texto: str, teclado: list) -> None: ...


def mensaje_de_prueba(zona: Zona, ahora: datetime) -> str:
    oeste, sur, este, norte = zona.bbox
    foco = Foco(
        id="prueba",
        tipo="foco_satelital",
        lat=round((sur + norte) / 2, 5),
        lon=round((oeste + este) / 2, 5),
        cuando=ahora,
        detalle="VIIRS NOAA-20, confianza nominal, 4,8 MW, veredicto: probable · 2 detecciones en la celda",
    )
    return MARCA + "\n\n" + armar_mensaje(foco, zona, None)


async def prueba(tg: Telegram, zona: Zona, chat_id: int, ahora: datetime) -> None:
    await tg.enviar(chat_id, mensaje_de_prueba(zona, ahora), [])  # sin botones: no toca ningún estado
