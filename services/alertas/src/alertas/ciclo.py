"""Un ciclo de avisos: focos y reportes nuevos de la zona → alerta en la API → mensaje con botones."""

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
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


@dataclass(frozen=True)
class Resumen:
    """Lo que hizo un ciclo, para el registro: focos y reportes leídos, nuevos en la zona, avisos mandados."""

    focos: int
    reportes: int
    nuevos: int
    mandados: int


async def avisar(api: Api, enviar: Enviar, zona: Zona, chat_id: int, avisados: set[str]) -> Resumen:
    focos, reportes = await api.focos_en_vivo(zona), await api.reportes(zona)
    nuevos = nuevos_para_avisar(zona, focos + reportes, avisados)
    mandados = 0
    for foco in nuevos:
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
        mandados += 1
    return Resumen(len(focos), len(reportes), len(nuevos), mandados)
