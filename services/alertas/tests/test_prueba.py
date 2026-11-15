"""#303: aviso de prueba para ver el formato real en el grupo. Telegram simulado: nunca la red."""

import asyncio
import logging
from datetime import UTC, datetime

import pytest
from alertas.prueba import mensaje_de_prueba, prueba
from alertas.telegram import TelegramAiogram
from alertas.zona import ZONA_DEMO, ZONAS

AHORA = datetime(2026, 11, 15, 16, 0, tzinfo=UTC)


def test_el_mensaje_de_prueba_dice_que_es_prueba_y_tiene_el_formato_real():
    texto = mensaje_de_prueba(ZONA_DEMO, AHORA)
    primera = texto.splitlines()[0]
    assert "PRUEBA" in primera and "no es un incendio real" in primera
    assert "Foco de calor satelital en tu zona (Comarca Andina)" in texto
    assert "veredicto: probable · 2 detecciones en la celda" in texto
    assert texto.endswith(  # RF-ALE-06
        "Aviso automático por satélite: confirmalo en el terreno. "
        "Charmy no reemplaza a los servicios de emergencia (100)."
    )
    assert "15/11/2026 13:00 (hora de Argentina)" in texto


def test_la_prueba_manda_un_mensaje_sin_botones_a_cada_grupo_con_su_zona():
    enviados = []

    class TelegramFalso:
        async def enviar(self, chat_id, texto, teclado, responder_a=None):
            enviados.append((chat_id, texto.split("(")[1].split(")")[0], teclado))

    norte = ZONAS[2]
    asyncio.run(prueba(TelegramFalso(), [(ZONA_DEMO, -100123), (norte, -100456)], AHORA))
    assert enviados == [(-100123, "Comarca Andina", []), (-100456, norte.nombre, [])]


def test_sin_botones_telegram_no_recibe_teclado():
    pedidos = []

    class BotFalso:
        async def send_message(self, chat_id, texto, **opciones):
            pedidos.append(opciones)

            class Mensaje:
                message_id = 1

            return Mensaje()

    asyncio.run(TelegramAiogram(BotFalso()).enviar(1, "hola", []))
    assert pedidos[0]["reply_markup"] is None


def test_si_un_grupo_falla_la_prueba_sigue_con_los_demas_y_dice_cual(caplog):
    enviados = []

    class TelegramFalso:
        async def enviar(self, chat_id, texto, teclado, responder_a=None):
            if chat_id == -1:
                raise RuntimeError("Bad Request: chat not found")
            enviados.append(chat_id)

    norte = ZONAS[2]
    with caplog.at_level(logging.WARNING, logger="alertas.prueba"):
        with pytest.raises(RuntimeError, match="1 de 2"):
            asyncio.run(prueba(TelegramFalso(), [(ZONA_DEMO, -1), (norte, -100456)], AHORA))
    assert enviados == [-100456]
    assert "zona-demo" in caplog.text and "chat not found" in caplog.text
