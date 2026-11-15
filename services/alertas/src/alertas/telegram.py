"""Telegram con aiogram para una corrida: sin polling continuo, pide los toques pendientes y los confirma."""

import asyncio

from aiogram import Bot
from aiogram.exceptions import TelegramRetryAfter
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from alertas.botones import Teclado
from alertas.corrida import Toque


def _teclado(teclado: Teclado) -> InlineKeyboardMarkup | None:
    if not teclado:
        return None  # un aviso de prueba va sin botones (#303)
    fila = [InlineKeyboardButton(text=t, callback_data=d) for t, d in teclado]
    return InlineKeyboardMarkup(inline_keyboard=[fila])


ESPERA_MAXIMA_429_S = 30  # la corrida tiene tope de 10 minutos: no se espera más que esto por un 429


class TelegramAiogram:
    def __init__(self, bot: Bot, dormir=asyncio.sleep):
        self._bot = bot
        self._dormir = dormir

    async def enviar(self, chat_id: int, texto: str, teclado: Teclado) -> None:
        """Si Telegram pide esperar (429), espera y reintenta una vez. Cualquier otro error sube."""
        try:
            await self._mandar(chat_id, texto, teclado)
        except TelegramRetryAfter as e:
            await self._dormir(min(e.retry_after, ESPERA_MAXIMA_429_S))
            await self._mandar(chat_id, texto, teclado)

    async def _mandar(self, chat_id: int, texto: str, teclado: Teclado) -> None:
        await self._bot.send_message(chat_id, texto, reply_markup=_teclado(teclado),
                                     disable_web_page_preview=True)

    async def toques_pendientes(self) -> list[Toque]:
        updates = await self._bot.get_updates(timeout=0, allowed_updates=["callback_query"])
        toques = []
        for u in updates:
            q = u.callback_query
            # Un mensaje de más de 48 horas llega como inaccesible: sin texto no se puede editar.
            if q and isinstance(q.message, Message) and q.message.text:
                toques.append(Toque(u.update_id, q.data or "", q.message.chat.id, q.message.message_id,
                                    q.message.text))
        return toques

    async def editar(self, chat_id: int, message_id: int, texto: str, teclado: Teclado) -> None:
        await self._bot.edit_message_text(texto, chat_id=chat_id, message_id=message_id,
                                          reply_markup=_teclado(teclado), disable_web_page_preview=True)

    async def confirmar(self, update_id: int) -> None:
        """Telegram da por leídos los updates anteriores al offset pedido."""
        await self._bot.get_updates(offset=update_id + 1, timeout=0, limit=1)
