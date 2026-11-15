"""#303: aviso de prueba para ver el formato real en el grupo. Telegram simulado: nunca la red."""

import asyncio
from datetime import UTC, datetime

from alertas.prueba import mensaje_de_prueba, prueba
from alertas.telegram import TelegramAiogram
from alertas.zona import ZONA_DEMO

AHORA = datetime(2026, 11, 15, 16, 0, tzinfo=UTC)


def test_el_mensaje_de_prueba_dice_que_es_prueba_y_tiene_el_formato_real():
    texto = mensaje_de_prueba(ZONA_DEMO, AHORA)
    primera = texto.splitlines()[0]
    assert "PRUEBA" in primera and "no es un incendio real" in primera
    assert "Foco de calor satelital en tu zona (Comarca Andina)" in texto
    assert "veredicto: probable · 2 detecciones en la celda" in texto
    assert "Si hay peligro, llamá al 100." in texto  # RF-ALE-06
    assert "15/11/2026 16:00 UTC" in texto


def test_la_prueba_manda_un_solo_mensaje_sin_botones():
    enviados = []

    class TelegramFalso:
        async def enviar(self, chat_id, texto, teclado):
            enviados.append((chat_id, teclado))

    asyncio.run(prueba(TelegramFalso(), ZONA_DEMO, -100123, AHORA))
    assert enviados == [(-100123, [])]


def test_sin_botones_telegram_no_recibe_teclado():
    pedidos = []

    class BotFalso:
        async def send_message(self, chat_id, texto, **opciones):
            pedidos.append(opciones)

    asyncio.run(TelegramAiogram(BotFalso()).enviar(1, "hola", []))
    assert pedidos[0]["reply_markup"] is None
