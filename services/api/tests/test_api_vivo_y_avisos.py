"""Pruebas de /live, /reports y /alerts sin base ni red: validación, token de servicio, límite y 503."""

import pytest
from api import avisos
from api.main import app
from fastapi.testclient import TestClient

TOKEN = "token-de-prueba"


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("CHARMY_SERVICE_TOKEN", TOKEN)
    avisos._recientes.clear()
    return TestClient(app)


def test_live_sin_base_responde_503(cliente):
    r = cliente.get("/api/v1/live", params={"bbox": "-76,-56,-53,-17"})
    assert r.status_code == 503 and r.json()["code"] == "datos_no_disponibles"


def test_evidence_sin_base_responde_503(cliente):
    assert cliente.get("/api/v1/live/N20-x/evidence").status_code == 503


@pytest.mark.parametrize("horas", [0, 121])
def test_live_horas_fuera_de_rango_dan_400(cliente, horas):
    r = cliente.get("/api/v1/live", params={"bbox": "-76,-56,-53,-17", "hours": horas})
    assert r.status_code == 400 and r.json()["code"] == "parametros_invalidos"


@pytest.mark.parametrize(
    "cuerpo, campo",
    [
        ({"lat": -95, "lon": -71}, "lat"),
        ({"lat": -42, "lon": 190}, "lon"),
        ({"lat": -42, "lon": -71, "email": "alguien@ejemplo.org"}, "email"),
        ({"lat": -42, "lon": -71, "photo_url": "no-es-una-url"}, "photo_url"),
        ({"lat": -42, "lon": -71, "description": "x" * 501}, "description"),
    ],
)
def test_reporte_invalido_o_con_datos_de_mas_da_400(cliente, cuerpo, campo):
    r = cliente.post("/api/v1/reports", json=cuerpo)
    assert r.status_code == 400 and campo in r.json()["message"]


def test_reporte_valido_sin_base_responde_503(cliente):
    r = cliente.post("/api/v1/reports", json={"lat": -42.1, "lon": -71.3, "description": "Humo"})
    assert r.status_code == 503 and r.json()["code"] == "datos_no_disponibles"


def test_el_sexto_reporte_seguido_de_la_misma_conexion_da_429(cliente):
    for _ in range(avisos.LIMITE_REPORTES):
        cliente.post("/api/v1/reports", json={"lat": -42.1, "lon": -71.3})
    r = cliente.post("/api/v1/reports", json={"lat": -42.1, "lon": -71.3})
    assert r.status_code == 429 and r.json()["code"] == "demasiados_reportes"


def test_el_limite_es_por_conexion(cliente):
    for _ in range(avisos.LIMITE_REPORTES):
        cliente.post(
            "/api/v1/reports", json={"lat": -42.1, "lon": -71.3}, headers={"X-Forwarded-For": "10.0.0.1"}
        )
    r = cliente.post(
        "/api/v1/reports", json={"lat": -42.1, "lon": -71.3}, headers={"X-Forwarded-For": "10.0.0.2"}
    )
    assert r.status_code != 429


@pytest.mark.parametrize(
    "metodo, ruta, cuerpo",
    [
        ("get", "/api/v1/reports?bbox=-72,-43,-71,-42", None),
        ("post", "/api/v1/alerts", {"zone_id": "z", "kind": "foco_satelital", "hotspot_id": "h"}),
        ("patch", "/api/v1/alerts/a-1", {"status": "visto"}),
    ],
)
@pytest.mark.parametrize("cabecera", [None, "Bearer otro-token", TOKEN])
def test_rutas_de_servicio_sin_el_token_correcto_dan_401(cliente, metodo, ruta, cuerpo, cabecera):
    headers = {"Authorization": cabecera} if cabecera else {}
    r = (
        getattr(cliente, metodo)(ruta, json=cuerpo, headers=headers)
        if cuerpo
        else cliente.get(ruta, headers=headers)
    )
    assert r.status_code == 401 and r.json()["code"] == "sin_sesion"


def test_sin_token_configurado_nada_queda_abierto(cliente, monkeypatch):
    monkeypatch.delenv("CHARMY_SERVICE_TOKEN")
    r = cliente.get(
        "/api/v1/reports", params={"bbox": "-72,-43,-71,-42"}, headers={"Authorization": "Bearer "}
    )
    assert r.status_code == 401


def test_con_el_token_correcto_y_sin_base_responde_503(cliente):
    r = cliente.get(
        "/api/v1/reports", params={"bbox": "-72,-43,-71,-42"}, headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert r.status_code == 503


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"zone_id": "z", "kind": "foco_satelital"},
        {"zone_id": "z", "kind": "foco_satelital", "report_id": "r-1"},
        {"zone_id": "z", "kind": "reporte_ciudadano", "hotspot_id": "h"},
        {"zone_id": "z", "kind": "otro", "hotspot_id": "h"},
    ],
)
def test_aviso_mal_armado_da_400(cliente, cuerpo):
    r = cliente.post("/api/v1/alerts", json=cuerpo, headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 400 and r.json()["code"] == "parametros_invalidos"


@pytest.mark.parametrize("estado", ["nueva", "apagado", ""])
def test_cambio_a_un_estado_fuera_del_contrato_da_400(cliente, estado):
    r = cliente.patch(
        "/api/v1/alerts/a-1", json={"status": estado}, headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert r.status_code == 400
