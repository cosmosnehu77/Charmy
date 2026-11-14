"""Cliente de la API de Charmy. Siempre con transporte simulado: nunca la red (docs/PRUEBAS.md)."""

import asyncio
import json
from datetime import UTC, datetime

import httpx
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
                "verdict": "probable",
            },
        },
        {
            "type": "Feature",
            "id": "N21-2026-11-14T05:12:00Z--42.10000--71.20000",
            "geometry": {"type": "Point", "coordinates": [-71.2, -42.1]},
            "properties": {
                "acq_datetime": "2026-11-14T05:12:00Z", "satellite": "N21", "instrument": "VIIRS",
                "confidence": "high", "frp": 9.8, "daynight": "N", "fixed_source": True,
                "verdict": "fuente_fija",
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
    assert asyncio.run(c.crear_alerta("zona-demo", "reporte_ciudadano", "r-1")) == ("muestra-a-0001", True)
    assert asyncio.run(c.crear_alerta("zona-demo", "reporte_ciudadano", "r-1")) == ("muestra-a-0001", False)
    assert pedidos[0] == {"zone_id": "zona-demo", "kind": "reporte_ciudadano", "report_id": "r-1"}


def test_actualizar_alerta_hace_patch_con_el_estado():
    def manejador(req):
        assert req.method == "PATCH" and req.url.path == "/api/v1/alerts/muestra-a-0001"
        assert req.headers["Authorization"] == f"Bearer {TOKEN}"
        assert json.loads(req.content) == {"status": "en_camino"}
        return httpx.Response(200, json={})

    assert asyncio.run(cliente(manejador).actualizar_alerta("muestra-a-0001", "en_camino")) is True


def test_actualizar_alerta_que_falla_devuelve_false():
    assert asyncio.run(cliente(lambda req: httpx.Response(404)).actualizar_alerta("x", "visto")) is False
