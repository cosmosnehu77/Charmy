"""Pruebas mínimas de F3-B3 (#43). Ninguna prueba llama a Meteomatics: se usa un transporte simulado.

`grabado/meteomatics.json` es una respuesta real del 14/11/2026 (Chubut, -45.75, -71.25), sin el usuario.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from contexto import tiempo
from fastapi import FastAPI
from fastapi.testclient import TestClient

GRABADO = json.loads((Path(__file__).parent / "grabado" / "meteomatics.json").read_text())
USUARIO, CLAVE = "usuario-de-prueba-xyz", "clave-de-prueba-123"
AHORA = datetime(2026, 11, 14, 18, 10, tzinfo=UTC)


class Meteomatics:
    """Transporte simulado: cuenta los pedidos y responde lo que se le diga."""

    def __init__(self, responder):
        self.pedidos: list[httpx.Request] = []
        self.responder = responder

    def __call__(self, pedido: httpx.Request) -> httpx.Response:
        self.pedidos.append(pedido)
        return self.responder(pedido)


@pytest.fixture
def entorno(monkeypatch, tmp_path):
    monkeypatch.setenv("METEOMATICS_USER", USUARIO)
    monkeypatch.setenv("METEOMATICS_PASSWORD", CLAVE)
    monkeypatch.setattr(tiempo, "RESPALDO", tmp_path / "respaldo")
    monkeypatch.setattr(tiempo, "_ahora", lambda: AHORA)
    tiempo._cache.clear()

    def usar(responder):
        fuente = Meteomatics(responder)
        monkeypatch.setattr(tiempo, "CLIENTE", httpx.Client(transport=httpx.MockTransport(fuente)))
        app = FastAPI()
        app.include_router(tiempo.router)
        return TestClient(app), fuente

    return usar


def ok(_):
    return httpx.Response(200, json=GRABADO)


def test_devuelve_viento_temperatura_humedad_e_indice_con_sus_unidades(entorno):
    cliente, fuente = entorno(ok)
    r = cliente.get("/weather", params={"lat": -45.71, "lon": -71.22, "hours": 3})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["source"] == "Meteomatics"
    assert cuerpo["fetched_at"] == "2026-11-14T18:10:00Z"
    assert cuerpo["now"] == {
        "time": "2026-11-14T18:00:00Z",
        "wind_speed_ms": 3.1,
        "wind_dir_deg": 54.9,
        "temperature_c": 21.7,
        "relative_humidity_pct": 31.1,
        "fire_risk_index": 0.5,
    }
    assert [p["time"] for p in cuerpo["forecast"]] == [
        "2026-11-14T19:00:00Z",
        "2026-11-14T20:00:00Z",
        "2026-11-14T21:00:00Z",
    ]
    assert "stale" not in cuerpo
    # Un solo pedido con todos los parámetros, en el centro de la celda de 0,1°.
    (pedido,) = fuente.pedidos
    assert "t_2m:C" in pedido.url.path and "-45.75,-71.25" in pedido.url.path


def test_cache_misma_celda_y_media_hora_una_sola_llamada_otra_celda_otra(entorno):
    cliente, fuente = entorno(ok)
    cliente.get("/weather", params={"lat": -45.71, "lon": -71.22})
    cliente.get("/weather", params={"lat": -45.79, "lon": -71.28, "hours": 48})  # misma celda
    assert len(fuente.pedidos) == 1
    cliente.get("/weather", params={"lat": -45.61, "lon": -71.22})  # otra celda
    assert len(fuente.pedidos) == 2


@pytest.mark.parametrize(
    "falla",
    [
        lambda p: (_ for _ in ()).throw(httpx.ReadTimeout("tiempo agotado", request=p)),
        lambda _: httpx.Response(429, text="Too Many Requests"),
        lambda _: httpx.Response(503, text="Service Unavailable"),
        lambda _: httpx.Response(200, text="no es json"),
    ],
    ids=["tiempo_agotado", "429", "5xx", "respuesta_rota"],
)
def test_falla_de_la_fuente_sin_copia_responde_no_disponible_nunca_500(entorno, falla):
    cliente, _ = entorno(falla)
    r = cliente.get("/weather", params={"lat": -45.71, "lon": -71.22})
    assert r.status_code == 503
    assert set(r.json()) == {"code", "message"}


def test_falla_de_la_fuente_con_copia_responde_la_copia_marcada(entorno, monkeypatch):
    cliente, _ = entorno(ok)
    cliente.get("/weather", params={"lat": -45.71, "lon": -71.22})
    tiempo._cache.clear()
    monkeypatch.setattr(tiempo, "_ahora", lambda: datetime(2026, 11, 23, 9, 0, tzinfo=UTC))
    cliente, _ = entorno(lambda _: httpx.Response(401))  # p. ej., la cuenta venció
    r = cliente.get("/weather", params={"lat": -45.72, "lon": -71.21, "hours": 2})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["stale"] is True
    assert cuerpo["fetched_at"] == "2026-11-14T18:10:00Z"
    assert "copia" in cuerpo["message"]
    assert len(cuerpo["forecast"]) == 2


def test_usuario_y_clave_no_aparecen_en_errores_ni_registros(entorno, caplog):
    def falla(p):
        raise httpx.ConnectError(f"no conecta a {p.url}", request=p)

    cliente, fuente = entorno(falla)
    with caplog.at_level(logging.DEBUG):
        r = cliente.get("/weather", params={"lat": -45.71, "lon": -71.22})
    assert fuente.pedidos[0].headers["authorization"].startswith("Basic ")
    for texto in (r.text, caplog.text):
        assert USUARIO not in texto and CLAVE not in texto


def test_sin_credenciales_responde_no_disponible(entorno, monkeypatch):
    cliente, fuente = entorno(ok)
    monkeypatch.delenv("METEOMATICS_USER")
    r = cliente.get("/weather", params={"lat": -45.71, "lon": -71.22})
    assert r.status_code == 503
    assert fuente.pedidos == []
