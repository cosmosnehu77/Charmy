"""Cliente de la API de Charmy. Siempre con transporte simulado: nunca la red (docs/PRUEBAS.md)."""

import asyncio
import json
from datetime import UTC, datetime

import httpx
import pytest
from alertas.cliente import ClienteCharmy
from alertas.modelos import Viento
from alertas.zona import ZONA_DEMO

TOKEN = "token-de-prueba"


def cliente(manejador) -> ClienteCharmy:
    http = httpx.AsyncClient(transport=httpx.MockTransport(manejador), base_url="http://api.test/api/v1")
    return ClienteCharmy(http, TOKEN)


# Muestra provisoria con la forma de /weather (valores inventados).
WEATHER = {
    "source": "Meteomatics",
    "fetched_at": "2026-11-14T12:00:00Z",
    "now": {"time": "2026-11-14T12:00:00Z", "wind_speed_ms": 8.2, "wind_dir_deg": 270},
    "forecast": [],
}


def test_el_viento_se_pasa_a_kmh():
    def manejador(req: httpx.Request) -> httpx.Response:
        assert req.url.path == "/api/v1/weather"
        assert req.url.params["lat"] == "-41.95"
        return httpx.Response(200, json=WEATHER)

    viento = asyncio.run(cliente(manejador).viento(-41.95, -71.53))
    assert viento == Viento(velocidad_kmh=8.2 * 3.6, direccion_deg=270)


def test_el_viento_tiene_su_propia_espera_corta():
    # El viento es opcional (D-37): no puede comerse los 120 s que se le dan a /live.
    esperas = []

    def manejador(req: httpx.Request) -> httpx.Response:
        esperas.append(req.extensions["timeout"]["read"])
        return httpx.Response(200, json=WEATHER)

    asyncio.run(cliente(manejador).viento(-41.95, -71.53))
    assert esperas == [15]


def test_si_weather_falla_el_viento_queda_no_disponible():
    def con_503(req):
        return httpx.Response(503, json={"code": "datos_no_disponibles", "message": "x"})

    def con_429(req):
        return httpx.Response(429)

    def con_timeout(req):
        raise httpx.ReadTimeout("tiempo agotado", request=req)

    def vacio(req):
        return httpx.Response(200, json={})

    for manejador in (con_503, con_429, con_timeout, vacio):
        assert asyncio.run(cliente(manejador).viento(-41.95, -71.53)) is None


# Muestra provisoria con la forma de /live (valores inventados).
LIVE = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "N20-2026-11-14T04:55:00Z--41.95000--71.53000",
            "geometry": {"type": "Point", "coordinates": [-71.53, -41.95]},
            "properties": {
                "acq_datetime": "2026-11-14T04:55:00Z", "satellite": "N20", "instrument": "VIIRS",
                "confidence": "nominal", "frp": 4.8, "daynight": "N", "fixed_source": False,
                "verdict": "probable", "cell_id": "-42.0_-71.6",
            },
        },
        {
            "type": "Feature",
            "id": "N21-2026-11-14T05:12:00Z--42.10000--71.20000",
            "geometry": {"type": "Point", "coordinates": [-71.2, -42.1]},
            "properties": {
                "acq_datetime": "2026-11-14T05:12:00Z", "satellite": "N21", "instrument": "VIIRS",
                "confidence": "high", "frp": 9.8, "daynight": "N", "fixed_source": True,
                "verdict": "fuente_fija", "cell_id": "-42.2_-71.3",
            },
        },
    ],
}


def test_focos_en_vivo_de_la_zona_sin_fuentes_fijas():
    def manejador(req):
        assert req.url.path == "/api/v1/live"
        assert req.url.params["bbox"] == ZONA_DEMO.bbox_param()
        return httpx.Response(200, json=LIVE)

    focos = asyncio.run(cliente(manejador).focos_en_vivo(ZONA_DEMO))
    assert [f.id for f in focos] == ["N20-2026-11-14T04:55:00Z--41.95000--71.53000"]
    foco = focos[0]
    assert (foco.tipo, foco.lat, foco.lon) == ("foco_satelital", -41.95, -71.53)
    assert foco.cuando == datetime(2026, 11, 14, 4, 55, tzinfo=UTC)
    assert foco.detalle == "VIIRS NOAA-20, confianza nominal, 4,8 MW, veredicto: probable"
    assert (foco.celda, foco.confianza, foco.veredicto) == ("-42.0_-71.6", "nominal", "probable")


def test_un_foco_sin_frp_se_avisa_igual():
    sin_frp = json.loads(json.dumps(LIVE["features"][0]))
    sin_frp["id"] = "N21-sin-frp"
    sin_frp["properties"]["frp"] = None

    def manejador(req):
        return httpx.Response(200, json={**LIVE, "features": [sin_frp, LIVE["features"][0]]})

    focos = asyncio.run(cliente(manejador).focos_en_vivo(ZONA_DEMO))
    assert [f.id for f in focos] == ["N21-sin-frp", LIVE["features"][0]["id"]]
    assert focos[0].detalle == "VIIRS NOAA-20, confianza nominal, FRP sin dato, veredicto: probable"


def test_un_foco_malformado_no_tapa_a_los_demas():
    roto = {"type": "Feature", "id": "roto", "geometry": None, "properties": {}}

    def manejador(req):
        return httpx.Response(200, json={**LIVE, "features": [roto, LIVE["features"][0]]})

    focos = asyncio.run(cliente(manejador).focos_en_vivo(ZONA_DEMO))
    assert [f.id for f in focos] == [LIVE["features"][0]["id"]]


def test_reportes_con_token_de_servicio():
    def manejador(req):
        assert req.url.path == "/api/v1/reports"
        assert req.headers["Authorization"] == f"Bearer {TOKEN}"
        return httpx.Response(200, json=[
            {"id": "muestra-r-0001", "lat": -42.12, "lon": -71.29, "status": "sin_verificar",
             "created_at": "2026-11-14T10:05:00Z", "description": "Columna de humo detrás del cerro"},
            {"id": "muestra-r-0002", "lat": -42.0, "lon": -71.3, "status": "sin_verificar",
             "created_at": "2026-11-14T10:06:00Z"},
        ])

    reportes = asyncio.run(cliente(manejador).reportes(ZONA_DEMO))
    assert [r.tipo for r in reportes] == ["reporte_ciudadano", "reporte_ciudadano"]
    assert reportes[0].detalle == "Columna de humo detrás del cerro"
    assert reportes[1].detalle == "Sin descripción"


def test_si_live_o_reports_fallan_no_hay_focos_y_el_servicio_sigue():
    def con_500(req):
        return httpx.Response(500)

    c = cliente(con_500)
    assert asyncio.run(c.focos_en_vivo(ZONA_DEMO)) == []
    assert asyncio.run(c.reportes(ZONA_DEMO)) == []


def test_crear_alerta_dice_si_es_nueva():
    pedidos = []

    def manejador(req):
        pedidos.append(json.loads(req.content))
        assert req.method == "POST" and req.url.path == "/api/v1/alerts"
        assert req.headers["Authorization"] == f"Bearer {TOKEN}"
        estado = 201 if len(pedidos) == 1 else 200
        return httpx.Response(estado, json={"id": "muestra-a-0001", "zone_id": "zona-demo",
                                            "kind": "reporte_ciudadano", "status": "nueva",
                                            "created_at": "2026-11-14T10:06:00Z"})

    c = cliente(manejador)
    primera = asyncio.run(c.crear_alerta("zona-demo", "reporte_ciudadano", "r-1"))
    segunda = asyncio.run(c.crear_alerta("zona-demo", "reporte_ciudadano", "r-1"))
    assert (primera.id, primera.pendiente, segunda.pendiente) == ("muestra-a-0001", True, False)
    assert pedidos[0] == {"zone_id": "zona-demo", "kind": "reporte_ciudadano", "report_id": "r-1"}


@pytest.mark.parametrize(
    "estado, sent_at, pendiente",
    [
        (201, None, True),  # nuevo
        (200, None, True),  # ya existía pero no salió: se reintenta (#280)
        (200, "2026-11-14T10:06:02Z", False),  # ya salió
    ],
)
def test_crear_alerta_dice_si_falta_mandarlo(estado, sent_at, pendiente):
    aviso = {"id": "a-1", "zone_id": "zona-demo", "kind": "foco_satelital", "status": "nueva",
             "created_at": "2026-11-14T10:06:00Z", "sent_at": sent_at}
    c = cliente(lambda req: httpx.Response(estado, json=aviso))
    alerta = asyncio.run(c.crear_alerta("zona-demo", "foco_satelital", "h-1"))
    assert (alerta.id, alerta.pendiente) == ("a-1", pendiente)


def test_crear_alerta_manda_la_celda_y_lee_veredicto_mensaje_y_anterior():
    pedidos = []
    aviso = {"id": "a-2", "zone_id": "zona-demo", "kind": "foco_satelital", "status": "nueva",
             "created_at": "2026-11-15T10:00:00Z", "sent_at": None, "cell_id": "-42.0_-71.6",
             "sent_verdict": None, "message_id": None,
             "previous": {"id": "a-1", "sent_at": "2026-11-13T12:00:00Z", "message_id": 55}}

    def manejador(req):
        pedidos.append(json.loads(req.content))
        return httpx.Response(201, json=aviso)

    alerta = asyncio.run(cliente(manejador).crear_alerta("zona-demo", "foco_satelital", "h-2", "-42.0_-71.6"))
    assert pedidos[0]["cell_id"] == "-42.0_-71.6"
    assert alerta.anterior.message_id == 55
    assert alerta.anterior.sent_at == datetime(2026, 11, 13, 12, 0, tzinfo=UTC)


def test_crear_alerta_lee_lo_que_se_mando_antes():
    aviso = {"id": "a-1", "zone_id": "zona-demo", "kind": "foco_satelital", "status": "nueva",
             "created_at": "2026-11-15T10:00:00Z", "sent_at": "2026-11-15T10:00:02Z",
             "sent_verdict": "probable", "message_id": 77, "previous": None}
    alerta = asyncio.run(cliente(lambda req: httpx.Response(200, json=aviso))
                         .crear_alerta("zona-demo", "foco_satelital", "h-1"))
    assert (alerta.pendiente, alerta.veredicto_enviado, alerta.message_id, alerta.anterior) == (
        False, "probable", 77, None)


def test_marcar_enviada_manda_veredicto_y_mensaje():
    cuerpos = []

    def manejador(req):
        cuerpos.append(json.loads(req.content) if req.content else None)
        return httpx.Response(200, json={})

    c = cliente(manejador)
    asyncio.run(c.marcar_enviada("a-1", "probable", 901))
    asyncio.run(c.marcar_enviada("a-1", "confirmado"))
    assert cuerpos == [{"verdict": "probable", "message_id": 901}, {"verdict": "confirmado"}]


def test_marcar_enviada_hace_post_con_el_token():
    def manejador(req):
        assert req.method == "POST" and req.url.path == "/api/v1/alerts/a-1/sent"
        assert req.headers["Authorization"] == f"Bearer {TOKEN}"
        return httpx.Response(200, json={})

    assert asyncio.run(cliente(manejador).marcar_enviada("a-1")) is True


def test_marcar_enviada_que_falla_devuelve_false(caplog):
    assert asyncio.run(cliente(lambda req: httpx.Response(503)).marcar_enviada("a-1")) is False
    assert any("a-1" in m for m in caplog.messages)


def test_actualizar_alerta_hace_patch_con_el_estado():
    def manejador(req):
        assert req.method == "PATCH" and req.url.path == "/api/v1/alerts/muestra-a-0001"
        assert req.headers["Authorization"] == f"Bearer {TOKEN}"
        assert json.loads(req.content) == {"status": "en_camino"}
        return httpx.Response(200, json={})

    assert asyncio.run(cliente(manejador).actualizar_alerta("muestra-a-0001", "en_camino")) is True


def test_actualizar_alerta_que_falla_devuelve_false():
    assert asyncio.run(cliente(lambda req: httpx.Response(404)).actualizar_alerta("x", "visto")) is False


def test_la_espera_a_la_api_aguanta_que_live_renueve_su_cache():
    # /live tarda unos 58 s cuando renueva la caché: con 60 s de tope, 6 de 40 corridas se cortaron.
    from alertas.__main__ import TIEMPO_ESPERA_S

    assert TIEMPO_ESPERA_S == 120
