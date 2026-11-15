"""Una corrida del servicio de avisos: `python -m alertas`. La corre Actions cada 5 minutos (avisos.yml).

Variables (en .env o en los secretos de Actions; nunca en el código): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
CHARMY_API_URL (sin /api/v1) y CHARMY_SERVICE_TOKEN.
"""

import asyncio
import logging
import os

import httpx
from aiogram import Bot

from alertas.cliente import ClienteCharmy
from alertas.corrida import corrida
from alertas.telegram import TelegramAiogram
from alertas.zona import ZONA_DEMO

# La API gratis de Render se duerme y tarda en despertar, y /live tarda unos 58 s cuando renueva su caché.
TIEMPO_ESPERA_S = 120


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    for ruidoso in ("httpx", "aiogram"):  # anotan cada pedido; solo interesan los problemas
        logging.getLogger(ruidoso).setLevel(logging.WARNING)
    base = os.environ.get("CHARMY_API_URL", "http://localhost:8000").rstrip("/") + "/api/v1"
    async with (
        Bot(os.environ["TELEGRAM_BOT_TOKEN"]) as bot,
        httpx.AsyncClient(base_url=base, timeout=TIEMPO_ESPERA_S) as http,
    ):
        api = ClienteCharmy(http, os.environ["CHARMY_SERVICE_TOKEN"])
        await corrida(api, TelegramAiogram(bot), ZONA_DEMO, int(os.environ["TELEGRAM_CHAT_ID"]))


if __name__ == "__main__":
    asyncio.run(main())
