"""Pruebas de /forecast con una predicción chica escrita en la prueba (sin red)."""

import duckdb
import pytest
from api import prediccion
from api.main import app
from fastapi.testclient import TestClient

COMARCA = "-71.6,-42.8,-71.0,-42.2"


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    ruta = str(tmp_path / "prediccion.parquet")
    duckdb.sql(
        """
        SELECT * FROM (VALUES
            ('-42.5_-71.3', '2026-11', 1::TINYINT, 2.4, 0.5, 5.1, 0.081, 'lightgbm-v1'),
            ('-42.5_-71.3', '2026-12', 2::TINYINT, 1.1, 0.0, 3.0, 0.033, 'lightgbm-v1'),
            ('-42.8_-71.6', '2026-11', 1::TINYINT, 0.7, 0.0, 1.9, 0.081, 'lightgbm-v1'),
            ('-42.5_-71.7', '2026-11', 1::TINYINT, 0.3, 0.0, 0.9, 0.081, 'lightgbm-v1'),
            ('-30.0_-60.0', '2026-11', 1::TINYINT, 9.0, 4.0, 15.0, 0.081, 'lightgbm-v1')
        ) AS t(cell_id, month, horizon, expected_fire_days, p10, p90, skill_vs_climatology, model)
        """
    ).write_parquet(ruta)
    monkeypatch.setattr(prediccion, "archivos", lambda tabla, opcional=False: [ruta])
    return TestClient(app)


def test_forecast_trae_las_celdas_del_area_para_el_plazo_pedido(cliente):
    datos = cliente.get("/api/v1/forecast", params={"bbox": COMARCA}).json()
    assert datos["model"] == "lightgbm-v1" and datos["skill_vs_climatology"] == pytest.approx(0.081)
    # -42.8_-71.6 está en la esquina suroeste del área: entra. -42.5_-71.7 solo toca el borde oeste: no.
    assert [c["cell_id"] for c in datos["cells"]] == ["-42.5_-71.3", "-42.8_-71.6"]
    assert datos["cells"][0] == {
        "cell_id": "-42.5_-71.3",
        "month": "2026-11",
        "expected_fire_days": 2.4,
        "p10": 0.5,
        "p90": 5.1,
    }


def test_forecast_a_dos_meses(cliente):
    datos = cliente.get("/api/v1/forecast", params={"bbox": COMARCA, "months": 2}).json()
    assert [(c["cell_id"], c["month"]) for c in datos["cells"]] == [("-42.5_-71.3", "2026-12")]


def test_forecast_area_sin_celdas_responde_vacio(cliente):
    datos = cliente.get("/api/v1/forecast", params={"bbox": "10,10,11,11"}).json()
    assert datos["cells"] == [] and datos["model"] == "lightgbm-v1"


def test_plazo_que_no_paso_la_compuerta_da_404(cliente):
    r = cliente.get("/api/v1/forecast", params={"bbox": COMARCA, "months": 3})
    assert r.status_code == 404 and r.json()["code"] == "sin_prediccion"


def test_sin_prediccion_publicada_da_404(cliente, monkeypatch):
    monkeypatch.setattr(prediccion, "archivos", lambda tabla, opcional=False: [])
    r = cliente.get("/api/v1/forecast", params={"bbox": COMARCA})
    assert r.status_code == 404 and r.json()["code"] == "sin_prediccion"


@pytest.mark.parametrize("parametros", [{"bbox": COMARCA, "months": 4}, {"bbox": COMARCA, "months": 0}, {}])
def test_forecast_parametros_invalidos_dan_400(cliente, parametros):
    assert cliente.get("/api/v1/forecast", params=parametros).status_code == 400
