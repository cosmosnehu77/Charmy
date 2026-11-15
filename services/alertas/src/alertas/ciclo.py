"""Un ciclo de avisos: focos y reportes nuevos de cada zona → alerta en la API → mensaje con botones al grupo
de esa zona (D-39). /live y /reports se piden una sola vez para el rectángulo que cubre todas las zonas."""

import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Protocol

import httpx

from alertas.avisos import nuevos_para_avisar
from alertas.botones import botones
from alertas.mensaje import armar_confirmado, armar_mensaje
from alertas.modelos import Alerta, Foco, Tipo, Viento
from alertas.zona import Rectangulo, Zona, cubre

log = logging.getLogger(__name__)

Enviar = Callable[..., Awaitable[int | None]]  # (chat_id, texto, teclado, responder_a=None) -> id del mensaje


class Api(Protocol):
    async def focos_en_vivo(self, area: Rectangulo) -> list[Foco]: ...
    async def reportes(self, area: Rectangulo) -> list[Foco]: ...
    async def viento(self, lat: float, lon: float) -> Viento | None: ...
    async def crear_alerta(
        self, zone_id: str, kind: Tipo, ref_id: str, celda: str | None = None
    ) -> Alerta: ...
    async def marcar_enviada(
        self, alert_id: str, veredicto: str | None = None, message_id: int | None = None
    ) -> bool: ...


@dataclass(frozen=True)
class Resumen:
    """Lo que hizo un ciclo, para el registro: focos y reportes leídos, nuevos en las zonas, avisos mandados
    y envíos que fallaron."""

    focos: int
    reportes: int
    nuevos: int
    mandados: int
    fallidos: int = 0
    actualizados: int = 0  # avisos que pasaron de probable a confirmado (#321)


async def avisar(
    api: Api, enviar: Enviar, destinos: Sequence[tuple[Zona, int]], avisados: dict[str, set[str]]
) -> Resumen:
    """Avisa en el grupo de cada zona lo nuevo de esa zona. Un foco que cae en dos zonas va a las dos."""
    area = cubre(z for z, _ in destinos)
    focos, reportes = await api.focos_en_vivo(area), await api.reportes(area)
    nuevos = mandados = fallidos = actualizados = 0
    for zona, chat_id in destinos:
        ya = avisados.setdefault(zona.id, set())
        r = await _avisar_zona(api, enviar, zona, chat_id, focos + reportes, ya)
        nuevos, mandados = nuevos + r.nuevos, mandados + r.mandados
        fallidos, actualizados = fallidos + r.fallidos, actualizados + r.actualizados
    return Resumen(len(focos), len(reportes), nuevos, mandados, fallidos, actualizados)


async def _avisar_zona(
    api: Api, enviar: Enviar, zona: Zona, chat_id: int, todo: list[Foco], avisados: set[str]
) -> Resumen:
    nuevos = nuevos_para_avisar(zona, todo, avisados)
    mandados = fallidos = actualizados = 0
    for foco in nuevos:
        try:
            alerta = await api.crear_alerta(zona.id, foco.tipo, foco.id, foco.celda)
        except httpx.HTTPError as e:
            log.warning("no se pudo crear la alerta de %s: %s", foco.id, e)
            continue  # se reintenta en el ciclo siguiente
        avisados.add(foco.id)
        if alerta.pendiente:
            anterior = alerta.anterior
            viento = await api.viento(foco.lat, foco.lon)
            texto = armar_mensaje(foco, zona, viento, anterior.sent_at if anterior else None)
            responder_a = anterior.message_id if anterior else None
            try:
                mensaje = await enviar(chat_id, texto, botones(alerta.id), responder_a)
            except Exception as e:  # uno que falla no frena a los demás (#263); sin marca, se reintenta
                log.warning(
                    "no se pudo mandar el aviso %s (foco %s) a %s: %s", alerta.id, foco.id, zona.id, e
                )
                fallidos += 1
                continue
            await api.marcar_enviada(alerta.id, foco.veredicto, mensaje)  # #280: sin marca, se reintenta
            mandados += 1
        elif alerta.veredicto_enviado == "probable" and foco.veredicto == "confirmado":
            # #321: salió como probable y ahora está confirmado. Va como respuesta al aviso, sin botones.
            try:
                await enviar(chat_id, armar_confirmado(foco, zona), [], alerta.message_id)
            except Exception as e:
                log.warning(
                    "no se pudo mandar la actualización del aviso %s a %s: %s", alerta.id, zona.id, e
                )
                fallidos += 1
                continue
            await api.marcar_enviada(alerta.id, "confirmado")
            actualizados += 1
    return Resumen(0, 0, len(nuevos), mandados, fallidos, actualizados)
