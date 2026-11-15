"""Pruebas mínimas de R-B1 (#220): métricas de la predicción. Datos sintéticos calculados a mano, sin red."""

import math
from datetime import date

import polars as pl
import pytest
from pipeline.medicion import UMBRAL, desvio_poisson, deteccion, medir, prueba_con_referencias, skill, top
from test_prediccion import mensual


def test_desvio_de_poisson_con_valores_a_mano():
    # y = μ da 0; y = 0 da 2μ; y = 2, μ = 1 da 2·(2·ln 2 − 1).
    assert desvio_poisson(pl.Series([3.0]), pl.Series([3.0])) == pytest.approx(0)
    assert desvio_poisson(pl.Series([0.0]), pl.Series([0.4])) == pytest.approx(0.8)
    assert desvio_poisson(pl.Series([2.0]), pl.Series([1.0])) == pytest.approx(2 * (2 * math.log(2) - 1))
    # El medio es el promedio por fila.
    assert desvio_poisson(pl.Series([3.0, 0.0]), pl.Series([3.0, 0.4])) == pytest.approx(0.4)


def test_desvio_de_poisson_todo_cero_y_mu_cero_con_fuego():
    assert desvio_poisson(pl.Series([0.0, 0.0]), pl.Series([0.0, 0.0])) == pytest.approx(0)
    # «Siempre cero» con fuego: μ se recorta a 1e-6 y da un número finito y grande, no infinito.
    d = desvio_poisson(pl.Series([1.0]), pl.Series([0.0]))
    assert math.isfinite(d)
    assert d == pytest.approx(2 * (math.log(1 / 1e-6) - 1), rel=1e-6)


def test_umbral_de_deteccion_es_ln2():
    assert pytest.approx(math.log(2)) == UMBRAL
    # Justo en ln 2 cuenta como predicha quemada (P(y ≥ 1) = 0,5); un poco menos, no.
    r = deteccion(pl.Series([1.0, 1.0]), pl.Series([UMBRAL, UMBRAL - 1e-9]))
    assert r == {"recall": 0.5, "precision": 1.0}


def test_deteccion_recall_y_precision_conocidos():
    y = pl.Series([0.0, 0.0, 1.0, 2.0, 3.0, 0.0])
    mu = pl.Series([0.1, 0.9, 0.8, 0.2, 5.0, 0.0])
    # Predichas quemadas: filas 1, 2 y 4. Quemadas: 2, 3 y 4. Aciertos: 2 y 4.
    assert deteccion(y, mu) == {"recall": pytest.approx(2 / 3), "precision": pytest.approx(2 / 3)}


def test_deteccion_sin_predichas_quemadas_da_precision_nula():
    assert deteccion(pl.Series([1.0, 0.0]), pl.Series([0.0, 0.0])) == {"recall": 0.0, "precision": None}


def claves(n: int) -> pl.DataFrame:
    return pl.DataFrame({"cell_id": [f"c{i:02d}" for i in range(n)], "emision": [date(2025, 1, 1)] * n})


def test_top_10_por_ciento_precision_y_captura():
    # 20 filas: el 10 % son 2. Las dos de mayor μ son c00 (quemada) y c01 (no). Hay 4 quemadas.
    y = pl.Series([1.0, 0.0, 1.0, 1.0, 1.0] + [0.0] * 15)
    mu = pl.Series([9.0, 8.0, 0.5, 0.4, 0.3] + [0.1] * 15)
    assert top(claves(20), y, mu) == {"precision_top": 0.5, "captura_top": 0.25}


def test_top_desempata_de_forma_determinista():
    # Todas las μ empatan salvo una: se desempata por cell_id, así c00 entra y c19 no.
    y = pl.Series([1.0] + [0.0] * 19)
    mu = pl.Series([1.0] * 19 + [2.0])
    assert top(claves(20), y, mu) == {"precision_top": 0.5, "captura_top": 1.0}


def test_top_con_prediccion_constante_es_nulo():
    y = pl.Series([1.0] + [0.0] * 19)
    assert top(claves(20), y, pl.Series([0.0] * 20)) == {"precision_top": None, "captura_top": None}


def prueba_chica() -> pl.DataFrame:
    """Dos horizontes, el modelo perfecto; la persistencia falta en una fila del horizonte 2."""
    return pl.DataFrame(
        {
            "cell_id": ["a", "b", "a", "b"],
            "emision": [date(2025, 1, 1)] * 4,
            "horizonte": [1, 1, 2, 2],
            "y": [2.0, 0.0, 1.0, 0.0],
            "pred": [2.0, 0.0, 1.0, 0.0],
            "clim": [1.0, 1.0, 1.0, 1.0],
            "lag0": [2.0, 0.0, None, 0.0],
        }
    )


def test_medir_compara_todo_sobre_las_mismas_filas():
    med = medir(prueba_chica())
    assert set(med["prediccion"]) == {"modelo", "climatologia", "siempre_cero", "persistencia"}
    # La fila sin persistencia se descarta para todos, no solo para la persistencia.
    filas = med.group_by("horizonte").agg(pl.col("filas").unique())
    assert dict(filas.rows()) == {1: [2], 2: [1]}
    modelo = med.filter(pl.col("prediccion") == "modelo").sort("horizonte")
    assert modelo["mae"].to_list() == [0.0, 0.0]
    clim = med.filter((pl.col("prediccion") == "climatologia") & (pl.col("horizonte") == 1))
    assert clim["mae"].item() == pytest.approx(1.0)


def test_skill_del_modelo_contra_cada_referencia():
    s = skill(medir(prueba_chica())).filter(pl.col("horizonte") == 1)
    fila = {r["referencia"]: r for r in s.iter_rows(named=True)}
    assert set(fila) == {"climatologia", "siempre_cero", "persistencia"}
    # Modelo perfecto contra la climatología: skill 1. Contra la persistencia, que también acierta: nulo.
    assert fila["climatologia"]["skill_mae"] == pytest.approx(1.0)
    assert fila["persistencia"]["skill_mae"] is None


def test_prueba_con_referencias_usa_la_particion_de_prediccion():
    from pipeline.prediccion import filas, particion

    m = mensual(0.8, celdas=4)
    p = prueba_con_referencias(m)
    _, esperada = particion(filas(m))
    assert p.height == esperada.height
    assert (
        p.select("cell_id", "emision", "horizonte")
        .sort(pl.all())
        .equals(esperada.select("cell_id", "emision", "horizonte").sort(pl.all()))
    )
    assert {"pred", "clim", "lag0", "y"} <= set(p.columns)
