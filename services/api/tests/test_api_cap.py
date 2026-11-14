"""Pruebas de GET /cap/{zone_id}.xml sin base ni red: la lectura de Postgres se reemplaza por filas fijas."""

import xml.etree.ElementTree as ET
from datetime import UTC, datetime

import pytest
from api import cap
from api.main import app
from fastapi.testclient import TestClient

NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
CUANDO = datetime(2026, 11, 14, 4, 40, tzinfo=UTC)

# Filas de la consulta: aviso, estado, tipo, id del foco o reporte, lat, lon, hora y datos del detalle.
FILAS = [
    (
        "a-1",
        "nueva",
        "foco_satelital",
        "N20-x",
        -42.1,
        -71.3,
        CUANDO,
        "N20",
        "VIIRS",
        "nominal",
        None,
        "probable",
    ),
    (
        "a-2",
        "visto",
        "reporte_ciudadano",
        "r-1",
        -42.0,
        -71.5,
        CUANDO,
        None,
        None,
        None,
        None,
        "Humo & llamas <cerca>",
    ),
    ("a-3", "falso", "foco_satelital", "N21-y", -42.2, -71.4, CUANDO, "N21", "VIIRS", "high", 30.5, None),
]


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setattr(cap, "_leer_avisos", lambda zona: FILAS)
    return TestClient(app)


def test_feed_de_la_zona_trae_un_info_por_aviso_que_no_es_falso(cliente):
    r = cliente.get("/api/v1/cap/zona-demo.xml")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/cap+xml")
    alerta = ET.fromstring(r.content)
    assert alerta.find("cap:status", NS).text == "Exercise"
    infos = alerta.findall("cap:info", NS)
    assert [i.find("cap:event", NS).text for i in infos] == [
        "Foco de calor satelital",
        "Reporte de un vecino",
    ]
    assert "FRP sin dato" in infos[0].find("cap:description", NS).text
    assert infos[1].find("cap:description", NS).text == "Humo & llamas <cerca>"
    assert "100" in infos[0].find("cap:instruction", NS).text


def test_zona_sin_avisos_da_un_feed_valido_sin_info(cliente, monkeypatch):
    monkeypatch.setattr(cap, "_leer_avisos", lambda zona: [])
    alerta = ET.fromstring(cliente.get("/api/v1/cap/zona-demo.xml").content)
    assert alerta.findall("cap:info", NS) == []


def test_zona_que_no_existe_da_404(cliente):
    r = cliente.get("/api/v1/cap/otra-zona.xml")
    assert r.status_code == 404 and r.json()["code"] == "no_existe"


def test_sin_base_responde_503(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    r = TestClient(app).get("/api/v1/cap/zona-demo.xml")
    assert r.status_code == 503
