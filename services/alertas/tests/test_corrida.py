"""Una corrida programada (Actions): botones pendientes y avisos nuevos. Telegram y la API simulados."""

import asyncio
import logging
from datetime import UTC, datetime

from alertas.botones import botones
from alertas.corrida import Toque, con_estado, corrida, procesar_toques
from alertas.modelos import Foco
from alertas.zona import ZONA_DEMO

CHAT = -100123
AVISO = "Foco de calor satelital en tu zona (Comarca Andina)\nDónde: -41.95000, -71.53000"


def toque(update_id: int, dato: str, texto: str = AVISO) -> Toque:
    return Toque(update_id=update_id, dato=dato, chat_id=CHAT, message_id=10 + update_id, texto=texto)


class ApiFalsa:
    def __init__(self, falla_en: set[str] = frozenset(), focos=()):
        self.falla_en = set(falla_en)
        self.focos = list(focos)
        self.parches = []

    async def actualizar_alerta(self, alert_id, status):
        self.parches.append((alert_id, status))
        return alert_id not in self.falla_en

    async def focos_en_vivo(self, zona):
        return self.focos

    async def reportes(self, zona):
        return []

    async def viento(self, lat, lon):
        return None

    async def crear_alerta(self, zone_id, kind, ref_id, celda=None):
        from alertas.modelos import Alerta

        return Alerta(id=f"a-{ref_id}", pendiente=True)

    async def marcar_enviada(self, alert_id, veredicto=None, message_id=None):
        return True


class TelegramFalso:
    def __init__(self, toques=(), falla_editar=False):
        self.toques = list(toques)
        self.falla_editar = falla_editar
        self.enviados, self.editados, self.confirmado = [], [], None
        self.orden = []

    async def toques_pendientes(self):
        self.orden.append("toques")
        return self.toques

    async def editar(self, chat_id, message_id, texto, teclado):
        if self.falla_editar:
            raise RuntimeError("Bad Request: message is not modified")
        self.editados.append((chat_id, message_id, texto, teclado))

    async def confirmar(self, update_id):
        self.confirmado = update_id

    async def enviar(self, chat_id, texto, teclado, responder_a=None):
        self.orden.append("enviar")
        self.enviados.append((chat_id, texto, teclado))
        return 1


def test_un_boton_pendiente_hace_patch_y_el_mensaje_muestra_el_estado():
    api, tg = ApiFalsa(), TelegramFalso([toque(5, botones("a-1")[1][1])])
    asyncio.run(procesar_toques(api, tg))

    assert api.parches == [("a-1", "en_camino")]
    assert tg.editados == [(CHAT, 15, AVISO + "\n\nEstado: En camino", botones("a-1"))]
    assert tg.confirmado == 5


def test_el_estado_nuevo_reemplaza_al_anterior():
    texto = con_estado(AVISO + "\n\nEstado: Visto", "Controlado")
    assert texto == AVISO + "\n\nEstado: Controlado"


def test_si_la_api_falla_el_toque_no_se_confirma_y_se_reintenta_en_la_proxima_corrida():
    toques = [toque(5, botones("a-1")[0][1]), toque(6, botones("a-2")[0][1]), toque(7, botones("a-3")[0][1])]
    api, tg = ApiFalsa(falla_en={"a-2"}), TelegramFalso(toques)
    asyncio.run(procesar_toques(api, tg))

    assert api.parches == [("a-1", "visto"), ("a-2", "visto")]  # a-3 espera a la próxima corrida
    assert tg.confirmado == 5


def test_un_dato_ajeno_se_confirma_sin_llamar_a_la_api():
    api, tg = ApiFalsa(), TelegramFalso([toque(8, "otra:cosa")])
    asyncio.run(procesar_toques(api, tg))
    assert api.parches == [] and tg.editados == []
    assert tg.confirmado == 8


def test_si_telegram_no_deja_editar_el_mensaje_el_estado_igual_queda_guardado():
    api, tg = ApiFalsa(), TelegramFalso([toque(9, botones("a-1")[0][1])], falla_editar=True)
    asyncio.run(procesar_toques(api, tg))
    assert api.parches == [("a-1", "visto")]
    assert tg.confirmado == 9


def test_sin_toques_no_confirma_nada():
    tg = TelegramFalso()
    asyncio.run(procesar_toques(ApiFalsa(), tg))
    assert tg.confirmado is None


def test_la_corrida_procesa_botones_y_despues_avisa_lo_nuevo():
    foco = Foco(id="f1", tipo="foco_satelital", lat=-41.95, lon=-71.53,
                cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC), detalle="muestra",
                veredicto="confirmado", confianza="high")
    api, tg = ApiFalsa(focos=[foco]), TelegramFalso([toque(5, botones("a-1")[0][1])])
    asyncio.run(corrida(api, tg, ZONA_DEMO, CHAT))

    assert tg.orden == ["toques", "enviar"]
    assert tg.enviados[0][2] == botones("a-f1")


def test_la_corrida_deja_una_linea_de_resumen_en_el_registro(caplog):
    foco = Foco(id="f1", tipo="foco_satelital", lat=-41.95, lon=-71.53,
                cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC), detalle="muestra",
                veredicto="confirmado", confianza="high")
    api = ApiFalsa(focos=[foco])
    tg = TelegramFalso([toque(5, botones("a-1")[0][1]), toque(6, "otra:cosa")])
    with caplog.at_level(logging.INFO, logger="alertas.corrida"):
        asyncio.run(corrida(api, tg, ZONA_DEMO, CHAT))

    assert caplog.messages == [
        "corrida: botones 1 · focos en vivo 1 · reportes 0 · nuevos en la zona 1 · avisos mandados 1"
        " · envíos fallidos 0 · actualizaciones 0"
    ]


def test_sin_focos_la_linea_de_resumen_sale_igual(caplog):
    # Si /live falla, el cliente deja el warning y devuelve cero focos: la corrida igual se anota.
    with caplog.at_level(logging.INFO, logger="alertas.corrida"):
        asyncio.run(corrida(ApiFalsa(), TelegramFalso(), ZONA_DEMO, CHAT))

    assert caplog.messages == [
        "corrida: botones 0 · focos en vivo 0 · reportes 0 · nuevos en la zona 0 · avisos mandados 0"
        " · envíos fallidos 0 · actualizaciones 0"
    ]
