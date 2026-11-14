"""Un ciclo de avisos con la API y Telegram simulados: nunca un envío real (docs/PRUEBAS.md)."""

import asyncio
from datetime import UTC, datetime

from alertas.botones import botones
from alertas.ciclo import avisar
from alertas.modelos import Foco, Viento
from alertas.zona import ZONA_DEMO

CHAT = -100123


def foco(id_: str, lat: float = -41.95, lon: float = -71.53, tipo="foco_satelital") -> Foco:
    return Foco(id=id_, tipo=tipo, lat=lat, lon=lon,
                cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC), detalle="muestra")


class ApiFalsa:
    def __init__(self, focos, reportes, viento=None, ya_existentes=()):
        self._focos, self._reportes, self._viento = focos, reportes, viento
        self._ya = set(ya_existentes)
        self.creadas = []

    async def focos_en_vivo(self, zona):
        return self._focos

    async def reportes(self, zona):
        return self._reportes

    async def viento(self, lat, lon):
        return self._viento

    async def crear_alerta(self, zone_id, kind, ref_id):
        self.creadas.append((zone_id, kind, ref_id))
        return f"a-{ref_id}", ref_id not in self._ya


class TelegramFalso:
    def __init__(self):
        self.enviados = []

    async def __call__(self, chat_id, texto, teclado):
        self.enviados.append((chat_id, texto, teclado))


def test_avisa_focos_y_reportes_de_la_zona_con_botones():
    api = ApiFalsa([foco("f1"), foco("lejos", lat=-36.8)], [foco("r1", tipo="reporte_ciudadano")],
                   viento=Viento(20, 0))
    tg = TelegramFalso()
    avisados: set[str] = set()

    asyncio.run(avisar(api, tg, ZONA_DEMO, CHAT, avisados))

    assert api.creadas == [("zona-demo", "foco_satelital", "f1"), ("zona-demo", "reporte_ciudadano", "r1")]
    assert [e[0] for e in tg.enviados] == [CHAT, CHAT]
    assert "Viento: 20 km/h del norte" in tg.enviados[0][1]
    assert tg.enviados[0][2] == botones("a-f1")
    assert avisados == {"f1", "r1"}


def test_sin_viento_el_aviso_sale_igual():
    tg = TelegramFalso()
    asyncio.run(avisar(ApiFalsa([foco("f1")], [], viento=None), tg, ZONA_DEMO, CHAT, set()))
    assert len(tg.enviados) == 1
    assert "Viento: no disponible" in tg.enviados[0][1]


def test_el_mismo_foco_no_se_avisa_en_el_ciclo_siguiente():
    api, tg, avisados = ApiFalsa([foco("f1")], []), TelegramFalso(), set()
    asyncio.run(avisar(api, tg, ZONA_DEMO, CHAT, avisados))
    asyncio.run(avisar(api, tg, ZONA_DEMO, CHAT, avisados))
    assert len(tg.enviados) == 1


def test_una_alerta_que_ya_existia_en_la_api_no_se_reenvia_tras_reiniciar():
    tg = TelegramFalso()
    asyncio.run(avisar(ApiFalsa([foco("f1")], [], ya_existentes={"f1"}), tg, ZONA_DEMO, CHAT, set()))
    assert tg.enviados == []
