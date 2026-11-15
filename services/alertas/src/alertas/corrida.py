"""Una corrida del servicio de avisos, pensada para una tarea programada (GitHub Actions, cada 5 minutos).

Primero atiende los botones tocados desde la corrida anterior (Telegram los guarda 24 horas) y después avisa
los focos y reportes nuevos. No guarda nada entre corridas: `POST /alerts` dice si un aviso ya se mandó.
"""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from alertas.botones import ESTADOS, Teclado, botones, leer_dato
from alertas.ciclo import Api as ApiAvisos
from alertas.ciclo import avisar
from alertas.zona import Zona

log = logging.getLogger(__name__)

SEPARADOR_ESTADO = "\n\nEstado: "


@dataclass(frozen=True)
class Toque:
    """Un botón tocado en un aviso (callback_query de Telegram). No se contesta: para la corrida siguiente,
    Telegram ya no acepta la respuesta; el estado se ve en el mensaje editado."""

    update_id: int
    dato: str
    chat_id: int
    message_id: int
    texto: str


class Telegram(Protocol):
    async def toques_pendientes(self) -> list[Toque]: ...
    async def editar(self, chat_id: int, message_id: int, texto: str, teclado: Teclado) -> None: ...
    async def confirmar(self, update_id: int) -> None: ...
    async def enviar(
        self, chat_id: int, texto: str, teclado: Teclado, responder_a: int | None = None
    ) -> int | None: ...


class Api(ApiAvisos, Protocol):
    async def actualizar_alerta(self, alert_id: str, status: str) -> bool: ...


def con_estado(texto: str, estado: str) -> str:
    """El texto del aviso con su estado al final; si ya tenía uno, lo reemplaza."""
    return texto.split(SEPARADOR_ESTADO)[0] + SEPARADOR_ESTADO + estado


async def procesar_toques(api: Api, tg: Telegram) -> int:
    """Guarda cada estado con PATCH /alerts y dice cuántos guardó. Si la API falla, ese toque y los siguientes
    esperan."""
    confirmado, guardados = None, 0
    for t in sorted(await tg.toques_pendientes(), key=lambda t: t.update_id):
        leido = leer_dato(t.dato)
        if leido is not None:
            alert_id, estado = leido
            if not await api.actualizar_alerta(alert_id, estado):
                break
            guardados += 1
            try:
                texto = con_estado(t.texto, ESTADOS[estado])
                await tg.editar(t.chat_id, t.message_id, texto, botones(alert_id))
            except Exception as e:  # p. ej. el mensaje ya tenía ese estado: el estado igual quedó guardado
                log.warning("no se pudo actualizar el mensaje de %s: %s", alert_id, e)
        confirmado = t.update_id
    if confirmado is not None:
        await tg.confirmar(confirmado)
    return guardados


async def corrida(api: Api, tg: Telegram, destinos: Sequence[tuple[Zona, int]]) -> None:
    """Una corrida que deja una línea de resumen en el registro (Actions), aunque no haya nada que avisar."""
    guardados = await procesar_toques(api, tg)
    r = await avisar(api, tg.enviar, destinos, {})
    log.info(
        "corrida: zonas %d · botones %d · focos en vivo %d · reportes %d · nuevos en las zonas %d"
        " · avisos mandados %d · envíos fallidos %d · actualizaciones %d",
        len(destinos), guardados, r.focos, r.reportes, r.nuevos, r.mandados, r.fallidos, r.actualizados,
    )
