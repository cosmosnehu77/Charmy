"""Pruebas de la predicción por zona y por región (F4-C4, #345) con respuestas grabadas (sin red)."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from api import main, prediccion_zona
from api.main import app
from fastapi.testclient import TestClient

AHORA = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
URL = "https://prediccion.test"
TOKEN = "token-de-prueba"


def _mes(mes, horizonte, probabilidad, esperadas, habituales):
    return {
        "mes": mes,
        "horizonte": horizonte,
        "probabilidad": probabilidad,
        "probabilidad_habitual": 0.2,
        "celdas_esperadas": esperadas,
        "celdas_habituales": habituales,
        "celda_mas_alta": 0.05,
        "nivel": "baja",
        "mejora_vs_climatologia": 0.12,
    }


# Recortada de una respuesta real de POST /prediccion/zona (#341): tres de los seis meses.
GRABADA = {
    "modelo": "charmy-eventos-v1",
    "emision": "2026-10",
    "evento": "al menos un foco VIIRS de confianza alta, o fuego en 2 o más días del mes",
    "zona": {"celdas": 30, "sin_historia": False},
    "meses": [
        _mes("2026-11", 1, 0.0793, 0.16, 0.14),
        _mes("2026-12", 2, 0.2238, 0.49, 0.43),
        _mes("2027-01", 3, 0.31, 0.7, 0.6),
    ],
}


class _Servicio:
    """Hace de servicio de predicción: guarda lo que le piden y responde lo que diga `responder`."""

    def __init__(self):
        self.pedidos: list[httpx.Request] = []
        self.responder = lambda pedido: httpx.Response(200, json=GRABADA)

    def __call__(self, pedido: httpx.Request) -> httpx.Response:
        self.pedidos.append(pedido)
        return self.responder(pedido)

    def cuerpos(self):
        return [json.loads(p.content) for p in self.pedidos]


@pytest.fixture
def servicio(monkeypatch):
    s = _Servicio()
    monkeypatch.setattr(prediccion_zona, "CLIENTE", httpx.Client(transport=httpx.MockTransport(s)))
    monkeypatch.setenv("PREDICCION_URL", URL)
    monkeypatch.setenv("PREDICCION_TOKEN", TOKEN)
    monkeypatch.setattr(prediccion_zona, "_ahora", lambda: AHORA)
    monkeypatch.setattr(prediccion_zona, "_codigos", lambda: ["AR-U", "AR-H"])
    # Sin despertador salvo en sus pruebas: un toque en otro hilo se mezclaría con los pedidos que se cuentan.
    monkeypatch.setattr(prediccion_zona, "_en_segundo_plano", lambda f: None)
    prediccion_zona._guardado.clear()
    return s


@pytest.fixture
def cliente():
    return TestClient(app)


ZONA = "/api/v1/forecast/zone"
ANILLO = [[-71.9, -42.3], [-71.2, -42.3], [-71.2, -41.7], [-71.9, -42.3]]
POLIGONO = {"type": "Polygon", "coordinates": [ANILLO]}


def test_zona_por_bbox_traduce_la_respuesta_y_manda_el_token(cliente, servicio):
    r = cliente.post(ZONA, json={"bbox": [-71.9, -42.3, -71.2, -41.7]})
    assert r.status_code == 200
    assert servicio.cuerpos() == [{"bbox": [-71.9, -42.3, -71.2, -41.7]}]
    pedido = servicio.pedidos[0]
    assert str(pedido.url) == f"{URL}/prediccion/zona"
    assert pedido.headers["authorization"] == f"Bearer {TOKEN}"
    datos = r.json()
    assert datos["model"] == "charmy-eventos-v1" and datos["emission"] == "2026-10"
    assert datos["zone"] == {"cells": 30, "no_history": False}
    assert datos["months"][0] == {
        "month": "2026-11",
        "horizon": 1,
        "kind": "forecast",
        "probability": 0.0793,
        "usual_probability": 0.2,
        "expected_cells": 0.16,
        "usual_cells": 0.14,
        "level": "baja",
        "skill_vs_climatology": 0.12,
    }


def test_uno_y_dos_meses_son_pronostico_y_desde_tres_lo_habitual_ajustado(cliente, servicio):
    datos = cliente.post(ZONA, json={"region": "AR-U"}).json()
    assert [m["kind"] for m in datos["months"]] == ["forecast", "forecast", "usual_adjusted"]


def test_zona_por_poligono_y_por_region(cliente, servicio):
    assert cliente.post(ZONA, json={"geometry": POLIGONO}).status_code == 200
    assert cliente.post(ZONA, json={"region": "AR-U"}).status_code == 200
    assert servicio.cuerpos() == [{"geometria": POLIGONO}, {"region": "AR-U"}]


@pytest.mark.parametrize(
    "cuerpo", [{}, {"bbox": [-72, -43, -71, -42], "region": "AR-U"}, {"bbox": [1, 2, 3]}]
)
def test_ninguna_o_dos_formas_de_zona_dan_400(cliente, servicio, cuerpo):
    r = cliente.post(ZONA, json=cuerpo)
    assert r.status_code == 400 and r.json()["code"] == "parametros_invalidos"
    assert servicio.pedidos == []


def test_region_desconocida_da_404(cliente, servicio):
    servicio.responder = lambda _: httpx.Response(404, json={"detail": "región desconocida"})
    r = cliente.post(ZONA, json={"region": "AR-ZZ"})
    assert r.status_code == 404 and r.json()["code"] == "no_existe"


def _agotado(pedido):
    raise httpx.ReadTimeout("dormido", request=pedido)


@pytest.mark.parametrize(
    "falla",
    [_agotado, lambda _: httpx.Response(502), lambda _: httpx.Response(503), lambda _: httpx.Response(401)],
)
def test_si_el_servicio_falla_da_503_fuente_no_disponible(cliente, servicio, falla):
    servicio.responder = falla
    r = cliente.post(ZONA, json={"region": "AR-U"})
    assert r.status_code == 503 and r.json()["code"] == "fuente_no_disponible"


@pytest.mark.parametrize("variable", ["PREDICCION_URL", "PREDICCION_TOKEN"])
def test_sin_configuracion_da_503_sin_llamar_al_servicio(cliente, servicio, monkeypatch, variable):
    monkeypatch.delenv(variable)
    r = cliente.post(ZONA, json={"region": "AR-U"})
    assert r.status_code == 503 and r.json()["code"] == "fuente_no_disponible"
    assert servicio.pedidos == []


def test_la_misma_zona_se_reusa_y_un_error_no_se_guarda(cliente, servicio):
    servicio.responder = lambda _: httpx.Response(503)
    assert cliente.post(ZONA, json={"region": "AR-U"}).status_code == 503
    servicio.responder = lambda _: httpx.Response(200, json=GRABADA)
    assert cliente.post(ZONA, json={"region": "AR-U"}).status_code == 200
    assert cliente.post(ZONA, json={"region": "AR-U"}).status_code == 200
    assert len(servicio.pedidos) == 2


def test_lo_guardado_vence_a_las_doce_horas(cliente, servicio, monkeypatch):
    cliente.post(ZONA, json={"region": "AR-U"})
    monkeypatch.setattr(prediccion_zona, "_ahora", lambda: AHORA + timedelta(hours=12, seconds=1))
    cliente.post(ZONA, json={"region": "AR-U"})
    assert len(servicio.pedidos) == 2


REGIONES = "/api/v1/regions/forecast"


def test_por_region_pide_cada_una_y_las_devuelve_juntas(cliente, servicio):
    r = cliente.get(REGIONES)
    assert r.status_code == 200
    assert servicio.cuerpos() == [{"region": "AR-U"}, {"region": "AR-H"}]
    datos = r.json()
    assert datos["model"] == "charmy-eventos-v1" and datos["emission"] == "2026-10"
    assert [x["region"] for x in datos["regions"]] == ["AR-U", "AR-H"]
    assert datos["regions"][0]["zone"] == {"cells": 30, "no_history": False}
    assert datos["regions"][0]["months"][1]["expected_cells"] == 0.49


def test_por_region_se_guarda(cliente, servicio):
    cliente.get(REGIONES)
    cliente.get(REGIONES)
    assert len(servicio.pedidos) == 2


def test_por_region_si_una_falla_da_503_y_no_se_guarda(cliente, servicio):
    servicio.responder = lambda p: (
        httpx.Response(503)
        if json.loads(p.content)["region"] == "AR-H"
        else (httpx.Response(200, json=GRABADA))
    )
    r = cliente.get(REGIONES)
    assert r.status_code == 503 and r.json()["code"] == "fuente_no_disponible"
    servicio.responder = lambda _: httpx.Response(200, json=GRABADA)
    assert cliente.get(REGIONES).status_code == 200


def test_al_arrancar_deja_la_prediccion_por_region_calculada(monkeypatch):
    llamadas = []
    monkeypatch.setattr(main, "copiar", lambda: 0)
    monkeypatch.setattr(main.regiones, "resumen", lambda horas=120: None)
    monkeypatch.setattr(main.prediccion_zona, "por_region", lambda: llamadas.append(True))
    main._copiar_datos()
    assert llamadas == [True]


# F4-C5 (#415): al abrir la app, el pedido de /regions/forecast despierta el servicio en segundo plano.


@pytest.fixture
def toques(servicio, monkeypatch):
    """El toque corre en el mismo hilo para poder mirarlo; guarda las URL de /salud que se pidieron."""
    monkeypatch.setattr(prediccion_zona, "_en_segundo_plano", lambda f: f())
    prediccion_zona._ultimo_toque = None
    return lambda: [str(p.url) for p in servicio.pedidos if p.method == "GET"]


def test_pedir_la_prediccion_por_region_toca_salud(cliente, servicio, toques):
    cliente.get(REGIONES)
    assert toques() == [f"{URL}/salud"]
    assert servicio.pedidos[0].headers.get("authorization") is None


def test_el_toque_es_como_mucho_cada_cinco_minutos(cliente, servicio, toques, monkeypatch):
    cliente.get(REGIONES)
    monkeypatch.setattr(prediccion_zona, "_ahora", lambda: AHORA + timedelta(minutes=4))
    cliente.get(REGIONES)
    assert len(toques()) == 1
    monkeypatch.setattr(prediccion_zona, "_ahora", lambda: AHORA + timedelta(minutes=5, seconds=1))
    cliente.get(REGIONES)
    assert len(toques()) == 2


@pytest.mark.parametrize("falla", [_agotado, lambda _: httpx.Response(503)])
def test_si_el_toque_falla_la_respuesta_no_cambia(cliente, servicio, toques, falla):
    servicio.responder = lambda p: falla(p) if p.method == "GET" else httpx.Response(200, json=GRABADA)
    r = cliente.get(REGIONES)
    assert r.status_code == 200 and toques() == [f"{URL}/salud"]


def test_sin_configuracion_no_toca(cliente, servicio, toques, monkeypatch):
    monkeypatch.delenv("PREDICCION_URL")
    cliente.get(REGIONES)
    assert toques() == []


def test_el_toque_no_frena_la_respuesta(cliente, servicio, monkeypatch):
    lanzados = []
    monkeypatch.setattr(prediccion_zona, "_en_segundo_plano", lanzados.append)
    prediccion_zona._ultimo_toque = None
    assert cliente.get(REGIONES).status_code == 200
    assert len(lanzados) == 1 and [p.method for p in servicio.pedidos] == ["POST", "POST"]


def test_la_api_espera_al_servicio_hasta_un_minuto():
    assert prediccion_zona.CLIENTE.timeout.read == 60
