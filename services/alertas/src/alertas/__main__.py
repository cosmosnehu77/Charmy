"""Bot de avisos: `python -m alertas`. Usa polling, así que no necesita dirección pública.

Variables (en .env o en la plataforma; nunca en el código): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
CHARMY_API_URL (sin /api/v1) y CHARMY_SERVICE_TOKEN.
"""

import asyncio
import logging
import os

import httpx
from aiogram import Bot, Dispatcher
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from alertas.botones import Teclado, al_tocar
from alertas.ciclo import avisar
from alertas.cliente import ClienteCharmy
from alertas.zona import ZONA_DEMO

INTERVALO_S = 120

log = logging.getLogger("alertas")


async def vigilar(api: ClienteCharmy, bot: Bot, chat_id: int) -> None:
    async def enviar(chat: int, texto: str, teclado: Teclado) -> None:
        filas = [[InlineKeyboardButton(text=t, callback_data=d) for t, d in teclado]]
        await bot.send_message(chat, texto, reply_markup=InlineKeyboardMarkup(inline_keyboard=filas),
                               disable_web_page_preview=True)

    avisados: set[str] = set()
    while True:
        try:
            await avisar(api, enviar, ZONA_DEMO, chat_id, avisados)
        except Exception:
            log.exception("falló un ciclo de avisos; sigue en el próximo")
        await asyncio.sleep(INTERVALO_S)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    bot = Bot(os.environ["TELEGRAM_BOT_TOKEN"])
    chat_id = int(os.environ["TELEGRAM_CHAT_ID"])
    base = os.environ.get("CHARMY_API_URL", "http://localhost:8000").rstrip("/") + "/api/v1"
    async with httpx.AsyncClient(base_url=base, timeout=15) as http:
        api = ClienteCharmy(http, os.environ["CHARMY_SERVICE_TOKEN"])
        dp = Dispatcher()

        @dp.callback_query()
        async def boton(query: CallbackQuery) -> None:
            respuesta = await al_tocar(api, query.data or "")
            await query.answer(respuesta or "")

        await asyncio.gather(vigilar(api, bot, chat_id), dp.start_polling(bot))


if __name__ == "__main__":
    asyncio.run(main())
