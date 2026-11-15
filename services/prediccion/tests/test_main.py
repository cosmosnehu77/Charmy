"""El comando de la comparación (R-E2, #253): TimesFM 3.0 por defecto y la versión anotada en la salida.

Modelo falso y LightGBM reemplazado: sin bajar pesos ni llamar a la red.
"""

import json

import polars as pl
import pytest
from prediccion import __main__ as comando
from test_comparar import Estacional, mensual


@pytest.fixture
def entrenamiento(tmp_path):
    """La tabla `entrenamiento` publicada (cell_id, month, fire_days) con datos sintéticos."""
    ruta = tmp_path / "entrenamiento.parquet"
    mensual(1.0, celdas=6).select(
        "cell_id",
        month=pl.col("mes").dt.strftime("%Y-%m"),
        fire_days=pl.col("dias").round().cast(pl.Int16),
    ).write_parquet(ruta)
    return ruta


@pytest.fixture
def cargados(monkeypatch):
    """Reemplaza la carga de TimesFM por un modelo falso y anota qué versión se pidió."""
    pedidas: list[str] = []

    def cargar(version: str):
        pedidas.append(version)
        return Estacional(1.0)

    monkeypatch.setattr(comando, "cargar", cargar)
    # LightGBM sin mejora: así el modelo falso le gana y se puede ver qué escribe.
    monkeypatch.setattr(comando, "mejora_lightgbm", lambda m, celdas=None: {1: 0.0, 2: 0.0, 3: 0.0})
    return pedidas


def test_sin_modelo_usa_timesfm_3_0(entrenamiento, tmp_path, cargados):
    comando.main(["--entrenamiento", str(entrenamiento), "--out", str(tmp_path / "salida")])
    assert cargados == ["3.0"]


def test_la_2_5_queda_como_opcion(entrenamiento, tmp_path, cargados):
    salida = tmp_path / "salida"
    comando.main(["--entrenamiento", str(entrenamiento), "--out", str(salida), "--modelo", "2.5"])
    assert cargados == ["2.5"]
    assert json.loads((salida / "comparacion.json").read_text())["modelo"] == "timesfm-2.5"


def test_la_comparacion_anota_la_version_y_la_3_0_publica_si_gana(entrenamiento, tmp_path, cargados):
    salida = tmp_path / "salida"
    comando.main(["--entrenamiento", str(entrenamiento), "--out", str(salida), "--celdas-prueba", "0"])
    resumen = json.loads((salida / "comparacion.json").read_text())
    assert resumen["modelo"] == "timesfm-3.0"
    prediccion = pl.read_parquet(salida / "prediccion.parquet")
    assert not prediccion.is_empty()
    assert (prediccion["model"] == "timesfm-3.0").all()
