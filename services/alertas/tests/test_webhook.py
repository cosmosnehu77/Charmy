"""D-41 (#353): registrar el webhook de Telegram y dejar de leer los toques en la corrida. Sin red."""

import asyncio

from alertas.webhook import registrar


def test_registrar_le_pide_a_telegram_el_webhook_con_el_secreto_y_solo_los_toques():
    pedidos = []

    class BotFalso:
        async def set_webhook(self, **opciones):
            pedidos.append(opciones)
            return True

    asyncio.run(registrar(BotFalso(), "https://api.charmy.test/", "s3cr3t"))
    assert pedidos == [{
        "url": "https://api.charmy.test/api/v1/telegram/webhook",
        "secret_token": "s3cr3t",
        "allowed_updates": ["callback_query"],
    }]
