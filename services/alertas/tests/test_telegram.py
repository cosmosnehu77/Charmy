"""Envío a Telegram con un bot falso: nunca la red (docs/PRUEBAS.md)."""

import asyncio

import pytest
from aiogram.exceptions import TelegramNetworkError, TelegramRetryAfter
from aiogram.methods import SendMessage
from alertas.telegram import TelegramAiogram

TECLADO = [("Visto", "a:1:visto")]


class BotFalso:
    def __init__(self, fallas):
        self.fallas = list(fallas)  # una excepción por intento; None = sale bien
        self.intentos = 0

    async def send_message(self, chat_id, texto, **_):
        self.intentos += 1
        falla = self.fallas.pop(0) if self.fallas else None
        if falla:
            raise falla


def retry_after(segundos: int) -> TelegramRetryAfter:
    return TelegramRetryAfter(SendMessage(chat_id=1, text="x"), "Too Many Requests", segundos)


def test_un_429_espera_lo_que_pide_telegram_y_reintenta_una_vez():
    esperas = []

    async def dormir(s):
        esperas.append(s)

    bot = BotFalso([retry_after(7)])
    asyncio.run(TelegramAiogram(bot, dormir=dormir).enviar(1, "hola", TECLADO))
    assert (bot.intentos, esperas) == (2, [7])


def test_la_espera_de_un_429_tiene_tope():
    esperas = []

    async def dormir(s):
        esperas.append(s)

    asyncio.run(TelegramAiogram(BotFalso([retry_after(600)]), dormir=dormir).enviar(1, "hola", TECLADO))
    assert esperas == [30]


def test_si_el_reintento_tambien_falla_el_error_sube():
    async def dormir(s):
        pass

    bot = BotFalso([retry_after(1), retry_after(1)])
    with pytest.raises(TelegramRetryAfter):
        asyncio.run(TelegramAiogram(bot, dormir=dormir).enviar(1, "hola", TECLADO))
    assert bot.intentos == 2


def test_otro_error_no_se_reintenta():
    bot = BotFalso([TelegramNetworkError(SendMessage(chat_id=1, text="x"), "sin red")])
    with pytest.raises(TelegramNetworkError):
        asyncio.run(TelegramAiogram(bot).enviar(1, "hola", TECLADO))
    assert bot.intentos == 1
