"""Un ciclo de avisos: focos y reportes nuevos de la zona → alerta en la API → mensaje con botones."""

import logging
from collections.abc import Awaitable, Callable
from typing import Protocol

import httpx

from alertas.avisos import nuevos_para_avisar
from alertas.botones import Teclado, botones
from alertas.mensaje import armar_mensaje
from alertas.modelos import Foco, Tipo, Viento
from alertas.zona import Zona

log = logging.getLogger(__name__)

Enviar = Callable[[int, str, Teclado], Awaitable[None]]


class Api(Protocol):
    async def focos_en_vivo(self, zona: Zona) -> list[Foco]: ...
    async def reportes(self, zona: Zona) -> list[Foco]: ...
    async def viento(self, lat: float, lon: float) -> Viento | None: ...
    async def crear_alerta(self, zone_id: str, kind: Tipo, ref_id: str) -> tuple[str, bool]: ...


async def avisar(api: Api, enviar: Enviar, zona: Zona, chat_id: int, avisados: set[str]) -> None:
    candidatos = await api.focos_en_vivo(zona) + await api.reportes(zona)
    for foco in nuevos_para_avisar(zona, candidatos, avisados):
        try:
            alert_id, es_nueva = await api.crear_alerta(zona.id, foco.tipo, foco.id)
        except httpx.HTTPError as e:
            log.warning("no se pudo crear la alerta de %s: %s", foco.id, e)
            continue  # se reintenta en el ciclo siguiente
        avisados.add(foco.id)
        if not es_nueva:
            continue  # ya se avisó antes de reiniciar el servicio
        texto = armar_mensaje(foco, zona, await api.viento(foco.lat, foco.lon))
        await enviar(chat_id, texto, botones(alert_id))
