"""Una corrida del servicio de avisos: `python -m alertas`. La corre Actions cada 5 minutos (avisos.yml).
Con `--prueba` manda un solo aviso de prueba al grupo y no toca la API (#303).

Variables (en .env o en los secretos de Actions; nunca en el código): TELEGRAM_BOT_TOKEN,
CHARMY_API_URL (sin /api/v1), CHARMY_SERVICE_TOKEN y TELEGRAM_ZONAS, un JSON {zona: grupo} (D-39).
Sin TELEGRAM_ZONAS, la zona de demostración va al grupo de TELEGRAM_CHAT_ID. Con TELEGRAM_WEBHOOK_SECRET, los
botones van por el webhook (D-41) y la corrida no los lee; `--webhook` registra el webhook en Telegram.
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
from alertas.webhook import registrar
from alertas.zona import destinos

# La API gratis de Render se duerme y tarda en despertar, y /live tarda unos 58 s cuando renueva su caché.
TIEMPO_ESPERA_S = 120


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    for ruidoso in ("httpx", "aiogram"):  # anotan cada pedido; solo interesan los problemas
        logging.getLogger(ruidoso).setLevel(logging.WARNING)
    url_api = os.environ.get("CHARMY_API_URL", "http://localhost:8000").rstrip("/")
    secreto = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if "--webhook" in sys.argv[1:]:
        if not secreto:
            raise ValueError("falta TELEGRAM_WEBHOOK_SECRET")
        async with Bot(os.environ["TELEGRAM_BOT_TOKEN"]) as bot:
            await registrar(bot, url_api, secreto)
        logging.getLogger("alertas").info("webhook registrado en %s/api/v1/telegram/webhook", url_api)
        return
    grupos = destinos(os.environ.get("TELEGRAM_ZONAS"), os.environ.get("TELEGRAM_CHAT_ID"))
    if "--prueba" in sys.argv[1:]:
        async with Bot(os.environ["TELEGRAM_BOT_TOKEN"]) as bot:
            await prueba(TelegramAiogram(bot), grupos, datetime.now(UTC))
        logging.getLogger("alertas").info("aviso de prueba mandado a %d grupos", len(grupos))
        return
    base = url_api + "/api/v1"
    async with (
        Bot(os.environ["TELEGRAM_BOT_TOKEN"]) as bot,
        httpx.AsyncClient(base_url=base, timeout=TIEMPO_ESPERA_S) as http,
    ):
        api = ClienteCharmy(http, os.environ["CHARMY_SERVICE_TOKEN"])
        await corrida(api, TelegramAiogram(bot), grupos, leer_toques=not secreto)


if __name__ == "__main__":
    asyncio.run(main())
