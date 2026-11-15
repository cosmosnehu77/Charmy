"""Un ciclo de avisos con la API y Telegram simulados: nunca un envío real (docs/PRUEBAS.md)."""

import asyncio
from datetime import UTC, datetime

from alertas.botones import botones
from alertas.ciclo import avisar
from alertas.modelos import Alerta, Anterior, Foco, Viento
from alertas.zona import ZONA_DEMO, Zona

CHAT = -100123


def foco(id_: str, lat: float = -41.95, lon: float = -71.53, tipo="foco_satelital") -> Foco:
    satelital = tipo == "foco_satelital"
    return Foco(id=id_, tipo=tipo, lat=lat, lon=lon,
                cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC), detalle="muestra",
                veredicto="confirmado" if satelital else None, confianza="nominal" if satelital else None)


class ApiFalsa:
    def __init__(self, focos, reportes, viento=None, ya_existentes=(), extras=None):
        self._focos, self._reportes, self._viento = focos, reportes, viento
        self._ya = set(ya_existentes)  # ya registrados y enviados
        self.extras = extras or {}  # ref_id -> campos de Alerta que devuelve la API (#321)
        self.creadas, self.marcadas, self.marcas, self.pedidos = [], [], [], []

    async def marcar_enviada(self, alert_id, veredicto=None, message_id=None):
        self.marcadas.append(alert_id)
        self.marcas.append((alert_id, veredicto, message_id))
        self._ya.add(alert_id.removeprefix("a-"))
        return True

    async def focos_en_vivo(self, area):
        self.pedidos.append(("live", area))
        return self._focos

    async def reportes(self, area):
        self.pedidos.append(("reports", area))
        return self._reportes

    async def viento(self, lat, lon):
        return self._viento

    async def crear_alerta(self, zone_id, kind, ref_id, celda=None):
        self.creadas.append((zone_id, kind, ref_id))
        clave = ref_id if zone_id == "zona-demo" else f"{zone_id}-{ref_id}"  # la API registra por zona
        return Alerta(id=f"a-{clave}", pendiente=clave not in self._ya, **self.extras.get(ref_id, {}))


class TelegramFalso:
    def __init__(self, fallan=()):
        self.enviados, self.respuestas = [], []
        self.fallan = set(fallan)  # ids de focos cuyo aviso falla al enviarse

    async def __call__(self, chat_id, texto, teclado, responder_a=None):
        if any(f"a-{i}" in str(teclado) for i in self.fallan):
            raise RuntimeError("Telegram no responde")
        self.enviados.append((chat_id, texto, teclado))
        self.respuestas.append(responder_a)
        return 900 + len(self.enviados)  # id del mensaje en Telegram


def test_avisa_focos_y_reportes_de_la_zona_con_botones():
    api = ApiFalsa([foco("f1"), foco("lejos", lat=-36.8)], [foco("r1", tipo="reporte_ciudadano")],
                   viento=Viento(20, 0))
    tg = TelegramFalso()
    avisados: dict[str, set[str]] = {}

    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], avisados))

    assert api.creadas == [("zona-demo", "foco_satelital", "f1"), ("zona-demo", "reporte_ciudadano", "r1")]
    assert [e[0] for e in tg.enviados] == [CHAT, CHAT]
    assert "Viento: 20 km/h del norte" in tg.enviados[0][1]
    assert tg.enviados[0][2] == botones("a-f1")
    assert avisados == {"zona-demo": {"f1", "r1"}}


def test_sin_viento_el_aviso_sale_igual():
    tg = TelegramFalso()
    asyncio.run(avisar(ApiFalsa([foco("f1")], [], viento=None), tg, [(ZONA_DEMO, CHAT)], {}))
    assert len(tg.enviados) == 1
    assert "Viento: no disponible" in tg.enviados[0][1]


def test_el_mismo_foco_no_se_avisa_en_el_ciclo_siguiente():
    api, tg, avisados = ApiFalsa([foco("f1")], []), TelegramFalso(), {}
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], avisados))
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], avisados))
    assert len(tg.enviados) == 1


def test_una_alerta_que_ya_existia_en_la_api_no_se_reenvia_tras_reiniciar():
    tg = TelegramFalso()
    asyncio.run(avisar(ApiFalsa([foco("f1")], [], ya_existentes={"f1"}), tg, [(ZONA_DEMO, CHAT)], {}))
    assert tg.enviados == []


def test_avisar_devuelve_cuantos_reviso_y_cuantos_mando():
    # f1 y r1 son nuevos en la zona; "lejos" queda afuera; f2 ya se había avisado antes (la API lo dice).
    api = ApiFalsa([foco("f1"), foco("lejos", lat=-36.8), foco("f2")], [foco("r1", tipo="reporte_ciudadano")],
                   ya_existentes={"f2"})
    resumen = asyncio.run(avisar(api, TelegramFalso(), [(ZONA_DEMO, CHAT)], {}))

    r = resumen
    assert (r.focos, r.reportes, r.nuevos, r.mandados, r.fallidos) == (3, 1, 3, 2, 0)


def test_un_envio_que_falla_no_frena_los_siguientes_y_queda_en_el_registro(caplog):
    api = ApiFalsa([foco("f1", lat=-41.95), foco("f2", lat=-42.2)], [])
    tg = TelegramFalso(fallan={"f1"})
    resumen = asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], {}))

    assert [e[2] for e in tg.enviados] == [botones("a-f2")]
    assert (resumen.mandados, resumen.fallidos) == (1, 1)
    assert any("a-f1" in m and "no se pudo mandar" in m for m in caplog.messages)


def test_un_aviso_mandado_queda_marcado_como_enviado():
    api, tg = ApiFalsa([foco("f1")], []), TelegramFalso()
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], {}))
    assert api.marcadas == ["a-f1"]


def test_un_envio_fallido_no_se_marca_y_sale_en_la_corrida_siguiente():
    # #280: el aviso queda registrado sin enviar; la corrida siguiente lo reintenta.
    api = ApiFalsa([foco("f1")], [])
    asyncio.run(avisar(api, TelegramFalso(fallan={"f1"}), [(ZONA_DEMO, CHAT)], {}))
    assert api.marcadas == []

    tg = TelegramFalso()
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], {}))
    assert [e[2] for e in tg.enviados] == [botones("a-f1")]
    assert api.marcadas == ["a-f1"]


def test_un_aviso_se_marca_con_su_veredicto_y_el_id_del_mensaje():
    api = ApiFalsa([foco("f1")], [])
    asyncio.run(avisar(api, TelegramFalso(), [(ZONA_DEMO, CHAT)], {}))
    assert api.marcas == [("a-f1", "confirmado", 901)]


def test_un_foco_que_paso_a_confirmado_manda_una_actualizacion_como_respuesta():
    # #321: el aviso salió como probable (mensaje 77) y ahora la celda está confirmada.
    api = ApiFalsa([foco("f1")], [], ya_existentes={"f1"},
                   extras={"f1": {"veredicto_enviado": "probable", "message_id": 77}})
    tg = TelegramFalso()
    resumen = asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], {}))

    assert len(tg.enviados) == 1 and tg.respuestas == [77]
    texto = tg.enviados[0][1]
    assert "ahora está confirmado" in texto and "servicios de emergencia (100)." in texto
    assert tg.enviados[0][2] == []  # sin botones: los del aviso original siguen valiendo
    assert api.marcas == [("a-f1", "confirmado", None)]
    assert (resumen.mandados, resumen.actualizados) == (0, 1)


def test_la_actualizacion_a_confirmado_sale_una_sola_vez():
    api = ApiFalsa([foco("f1")], [], ya_existentes={"f1"},
                   extras={"f1": {"veredicto_enviado": "confirmado", "message_id": 77}})
    tg = TelegramFalso()
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], {}))
    assert tg.enviados == []


def test_un_incendio_que_sigue_activo_responde_al_aviso_anterior():
    # #321: la celda ya se avisó (mensaje 55, el 13/11 a las 09:00 hora de Argentina).
    anterior = Anterior(id="a-viejo", sent_at=datetime(2026, 11, 13, 12, 0, tzinfo=UTC), message_id=55)
    api = ApiFalsa([foco("f1")], [], extras={"f1": {"anterior": anterior}})
    tg = TelegramFalso()
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT)], {}))

    assert tg.respuestas == [55]
    assert tg.enviados[0][1].startswith("Sigue activo el incendio que te avisamos el 13/11/2026 09:00")
    assert tg.enviados[0][2] == botones("a-f1")  # el aviso nuevo trae sus botones


# D-39: varias zonas, cada una con su grupo.
NORTE = Zona(id="norte", nombre="Norte", lat=-22.5, lon=-63.8, radio_km=60, pais="AR")
CHAT_NORTE = -100999


def test_cada_grupo_recibe_solo_lo_de_su_zona_y_la_api_se_consulta_una_vez():
    api = ApiFalsa([foco("sur"), foco("norte", lat=-22.5, lon=-63.8), foco("nada", lat=-31.0, lon=-64.0)], [])
    tg = TelegramFalso()
    resumen = asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT), (NORTE, CHAT_NORTE)], {}))

    assert [(chat, "a-sur" in str(t)) for chat, _, t in tg.enviados] == [(CHAT, True), (CHAT_NORTE, False)]
    assert "a-norte" in str(tg.enviados[1][2])
    assert [z for z, _, _ in api.creadas] == ["zona-demo", "norte"]
    assert [p for p, _ in api.pedidos] == ["live", "reports"]
    assert resumen.focos == 3 and resumen.nuevos == 2 and resumen.mandados == 2


def test_un_foco_en_dos_zonas_se_avisa_en_las_dos():
    vecina = Zona(id="vecina", nombre="Vecina", lat=-42.0, lon=-71.2, radio_km=50, pais="AR")
    api, tg = ApiFalsa([foco("f1")], []), TelegramFalso()
    asyncio.run(avisar(api, tg, [(ZONA_DEMO, CHAT), (vecina, CHAT_NORTE)], {}))

    assert [chat for chat, _, _ in tg.enviados] == [CHAT, CHAT_NORTE]
    assert "(Vecina)" in tg.enviados[1][1]
    assert [(z, ref) for z, _, ref in api.creadas] == [("zona-demo", "f1"), ("vecina", "f1")]
