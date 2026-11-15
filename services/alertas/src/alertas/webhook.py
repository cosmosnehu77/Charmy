"""Registra el webhook de Telegram (D-41, #353): desde entonces Telegram le manda cada toque de un botón a la
API (`POST /api/v1/telegram/webhook`), que guarda el estado al instante. Se corre una vez:

    uv run --package alertas python -m alertas --webhook

Con el webhook activo, Telegram ya no entrega los toques por getUpdates: la corrida deja de leerlos cuando
está TELEGRAM_WEBHOOK_SECRET. Los toques pendientes no se pierden: Telegram los manda al webhook.
"""

from typing import Protocol


class Bot(Protocol):
    async def set_webhook(self, **opciones) -> bool: ...


async def registrar(bot: Bot, url_api: str, secreto: str) -> None:
    await bot.set_webhook(
        url=url_api.rstrip("/") + "/api/v1/telegram/webhook",
        secret_token=secreto,
        allowed_updates=["callback_query"],
    )
