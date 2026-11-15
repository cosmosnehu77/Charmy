"""POST /telegram/webhook (D-41, #353): Telegram avisa acá apenas la entidad toca un botón de un aviso.

Guarda el estado como `PATCH /alerts`, edita el mensaje con "Estado: …" y contesta el toque. Los botones y
el texto los arma `alertas` (services/alertas, carril de avisos), igual que el feed CAP. Solo acepta pedidos
con la cabecera secreta que Telegram manda desde que se registró el webhook (`TELEGRAM_WEBHOOK_SECRET`).
Responde 200 a todo lo que no sea un toque de aviso, para que Telegram no lo reintente.
"""

import hmac
import logging
import os
from typing import Annotated

import httpx
from alertas.botones import ESTADOS, botones, leer_dato
from alertas.corrida import con_estado
from fastapi import APIRouter, Body, Header

from api.avisos import _tablas
from api.base import conectar
from api.datos import DatosNoDisponibles
from api.errores import ErrorDeContrato

log = logging.getLogger(__name__)
router = APIRouter()

ESPERA_TELEGRAM_S = 10


def _guardar(alert_id: str, estado: str) -> bool:
    """El mismo cambio que PATCH /alerts: el estado del aviso y, si viene de un reporte, el del reporte.
    False si el aviso no existe."""
    with conectar() as con:
        _tablas(con)
        fila = con.execute(
            "UPDATE avisos SET status = %s, updated_at = now() WHERE id = %s RETURNING report_id",
            [estado, alert_id],
        ).fetchone()
        if fila is None:
            return False
        if fila[0]:
            con.execute("UPDATE reportes SET status = %s WHERE id = %s", [estado, fila[0]])
        con.commit()
    return True


def _llamar(metodo: str, datos: dict) -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    r = httpx.post(f"https://api.telegram.org/bot{token}/{metodo}", json=datos, timeout=ESPERA_TELEGRAM_S)
    r.raise_for_status()


def _contestar(id_toque: str, texto: str) -> None:
    try:
        _llamar("answerCallbackQuery", {"callback_query_id": id_toque, "text": texto})
    except Exception as e:  # el toque ya se procesó: sin respuesta, Telegram solo deja de mostrar el reloj
        log.warning("no se pudo contestar el toque: %s", type(e).__name__)


@router.post("/telegram/webhook", operation_id="telegramWebhook", tags=["alertas"])
def webhook(
    update: Annotated[dict, Body()],
    secreto: Annotated[str | None, Header(alias="X-Telegram-Bot-Api-Secret-Token")] = None,
) -> dict:
    esperado = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not esperado or not hmac.compare_digest((secreto or "").encode(), esperado.encode()):
        raise ErrorDeContrato(403, "sin_permiso", "Esta ruta es solo para Telegram.")
    toque = update.get("callback_query")
    leido = leer_dato(str(toque.get("data") or "")) if isinstance(toque, dict) else None
    if leido is None:
        return {"ok": True}
    alert_id, estado = leido
    id_toque = str(toque.get("id", ""))
    try:
        existe = _guardar(alert_id, estado)
    except DatosNoDisponibles:
        _contestar(id_toque, "No se pudo guardar: probá de nuevo en un rato")
        return {"ok": True}
    if not existe:
        _contestar(id_toque, "Aviso no encontrado")
        return {"ok": True}
    mensaje = toque.get("message") or {}
    if mensaje.get("text"):  # un mensaje de más de 48 horas llega sin texto: no se puede editar
        teclado = [[{"text": t, "callback_data": d} for t, d in botones(alert_id)]]
        try:
            _llamar("editMessageText", {
                "chat_id": mensaje["chat"]["id"], "message_id": mensaje["message_id"],
                "text": con_estado(mensaje["text"], ESTADOS[estado]),
                "reply_markup": {"inline_keyboard": teclado}, "disable_web_page_preview": True,
            })
        except Exception as e:  # p. ej. el mensaje ya tenía ese estado: el estado igual quedó guardado
            log.warning("no se pudo editar el mensaje del aviso %s: %s", alert_id, type(e).__name__)
    _contestar(id_toque, f"Guardado: {ESTADOS[estado]}")
    return {"ok": True}
