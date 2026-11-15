"""Una corrida del servicio de avisos: `python -m alertas`. La corre Actions cada 5 minutos (avisos.yml).
Con `--prueba` manda un solo aviso de prueba al grupo y no toca la API (#303).

Variables (en .env o en los secretos de Actions; nunca en el código): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
CHARMY_API_URL (sin /api/v1) y CHARMY_SERVICE_TOKEN.
"""

import asyncio
import logging
import os
import sys
from datetime import UTC, datetime

import httpx
from aiogram import Bot

from alertas.cliente import ClienteCharmy
from alertas.corrida import corrida
from alertas.prueba import prueba
from alertas.telegram import TelegramAiogram
from alertas.zona import ZONA_DEMO

# La API gratis de Render se duerme y tarda en despertar, y /live tarda unos 58 s cuando renueva su caché.
TIEMPO_ESPERA_S = 120


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    for ruidoso in ("httpx", "aiogram"):  # anotan cada pedido; solo interesan los problemas
        logging.getLogger(ruidoso).setLevel(logging.WARNING)
    chat_id = int(os.environ["TELEGRAM_CHAT_ID"])
    if "--prueba" in sys.argv[1:]:
        async with Bot(os.environ["TELEGRAM_BOT_TOKEN"]) as bot:
            await prueba(TelegramAiogram(bot), ZONA_DEMO, chat_id, datetime.now(UTC))
        logging.getLogger("alertas").info("aviso de prueba mandado al grupo")
        return
    base = os.environ.get("CHARMY_API_URL", "http://localhost:8000").rstrip("/") + "/api/v1"
    async with (
        Bot(os.environ["TELEGRAM_BOT_TOKEN"]) as bot,
        httpx.AsyncClient(base_url=base, timeout=TIEMPO_ESPERA_S) as http,
    ):
        api = ClienteCharmy(http, os.environ["CHARMY_SERVICE_TOKEN"])
        await corrida(api, TelegramAiogram(bot), ZONA_DEMO, chat_id)


if __name__ == "__main__":
    asyncio.run(main())
