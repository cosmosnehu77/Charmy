"""Telegram con aiogram para una corrida: sin polling continuo, pide los toques pendientes y los confirma."""

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from alertas.botones import Teclado
from alertas.corrida import Toque


def _teclado(teclado: Teclado) -> InlineKeyboardMarkup:
    fila = [InlineKeyboardButton(text=t, callback_data=d) for t, d in teclado]
    return InlineKeyboardMarkup(inline_keyboard=[fila])


class TelegramAiogram:
    def __init__(self, bot: Bot):
        self._bot = bot

    async def enviar(self, chat_id: int, texto: str, teclado: Teclado) -> None:
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
