"""Pruebas del entrenamiento de charmy-eventos-v1 (R-E7, #361). Números a mano y datos sintéticos, sin red."""

import importlib.util
from pathlib import Path

import numpy as np
import polars as pl
import pytest

CARPETA = Path(__file__).parents[1] / "entrenamiento"


def cargar(nombre: str):
    spec = importlib.util.spec_from_file_location(nombre, CARPETA / f"{nombre}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


m = cargar("02_modelo")
salidas = cargar("03_salidas")


def test_meses_ida_y_vuelta():
    assert m.mes_de(0) == "2012-01"
    assert m.mes_de(m.indice_mes(__import__("datetime").date(2026, 10, 1))) == "2026-10"


def test_auc_ordena_y_empata():
    y = np.array([0, 0, 1, 1], float)
    assert m.auc(y, np.array([0.1, 0.2, 0.8, 0.9])) == 1.0
    assert m.auc(y, np.array([0.9, 0.8, 0.2, 0.1])) == 0.0
    assert m.auc(y, np.full(4, 0.5)) == 0.5


def test_brier_y_perdida_log():
    y = np.array([1.0, 0.0])
    assert m.brier(y, np.array([0.5, 0.5])) == pytest.approx(0.25)
    assert m.perdida_log(y, np.array([0.5, 0.5])) == pytest.approx(np.log(2))


def test_climatologia_usa_solo_anios_anteriores():
    # Una celda, 3 años: el evento de enero vale 1, 0 y 1.
    E = np.zeros((1, 36), np.float32)
    E[0, [0, 24]] = 1
    clim = m.climatologia(E, extra=12)
    assert np.isnan(clim[0, 0])  # el primer enero no tiene años anteriores
    assert clim[0, 12] == 1.0  # enero del año 2: solo el año 1
    assert clim[0, 24] == 0.5  # año 3: promedio de 1 y 0
    assert clim[0, 36] == pytest.approx(2 / 3)  # el mes siguiente al último conocido
    assert clim.shape == (1, 48)


def test_vecinos_promedia_sin_el_centro():
    gi, gj = np.repeat(np.arange(3), 3), np.tile(np.arange(3), 3)
    M = np.zeros((9, 1), np.float32)
    M[4] = 1  # la celda del centro
    v = m.vecinos(M, gi, gj, 1)
    assert v[4, 0] == 0  # el centro no se cuenta a sí mismo
    assert v[0, 0] == pytest.approx(1 / 8)


def test_calibrador_no_decrece_y_aplica():
    p = np.array([0.1, 0.2, 0.3, 0.4])
    y = np.array([0.0, 1.0, 0.0, 1.0])
    cal = m.calibrador(p, y, np.ones(4), cajas=4)
    assert np.all(np.diff(cal["observado"]) >= 0)
    # Cajas: {0,1}→0, {0,2}→1 y {0,3; 0,4}→0,5 (la última junta dos). 1 > 0,5 rompe el orden: se juntan
    # con su peso, (1 + 0,5·2) / 3 = 2/3. La tabla va de 0 a 1 en lo predicho.
    assert cal["observado"] == pytest.approx([0.0, 0.0, 2 / 3, 2 / 3])
    assert cal["predicho"][0] == 0.0 and cal["predicho"][-1] == 1.0
    identidad = {"predicho": [0.0, 1.0], "observado": [0.0, 1.0]}
    assert m.aplicar(identidad, np.array([0.3]))[0] == pytest.approx(0.3)


def test_area_y_kappa():
    grupo = np.array([0, 0, 1, 1, 2, 2, 3, 3])
    p = np.full(8, 0.5)
    assert m.prob_area(p, grupo, 4, 1.0)[0] == pytest.approx(0.75)  # independientes: 1 - 0,5²
    assert m.prob_area(p, grupo, 4, 0.5)[0] == pytest.approx(0.5)
    # La mitad de las áreas tuvo evento: el mejor κ es el que da 0,5 por área.
    y = np.array([1, 0, 1, 0, 0, 0, 0, 0], float)
    assert m.ajustar_kappa(p, y, grupo, 4) == 0.5


def test_top10_y_deteccion():
    y = np.array([1, 0, 0, 0, 0, 0, 0, 0, 0, 1], float)
    p = np.linspace(1, 0, 10)
    assert m.top10(y, p, np.zeros(10)) == (1.0, 0.5)  # marca 1 celda de 10 y acierta
    assert m.deteccion(y, p, 0.5) == (0.5, 0.2)


def sinteticas(T: int, semilla: int):
    rng = np.random.default_rng(semilla)
    C = 16
    lat, lon = np.repeat(np.arange(4) * 0.1 - 30, 4), np.tile(np.arange(4) * 0.1 - 60, 4)
    celdas = pl.DataFrame({"cell_id": [f"{a:.1f}_{b:.1f}" for a, b in zip(lat, lon, strict=True)]})
    celdas = celdas.with_columns(region=pl.Series(["AR-A"] * 8 + ["AR-B"] * 8))
    mats = {k: rng.integers(0, 4, (C, T)).astype(np.float32) for k in ("dias", "focos", "altos", "frp_max")}
    return celdas, lat, lon, mats


def test_variables_no_miran_el_futuro():
    T, t, h = 48, 30, 3
    celdas, lat, lon, mats = sinteticas(T, 0)
    antes = m.Variables(celdas, lat, lon, mats, T, "alto_o_persistente", extra=6).bloque(t, h)
    _, _, _, otro = sinteticas(T, 1)
    for k in mats:  # se cambia todo lo posterior al mes de emisión
        mats[k][:, t + 1 :] = otro[k][:, t + 1 :]
    despues = m.Variables(celdas, lat, lon, mats, T, "alto_o_persistente", extra=6).bloque(t, h)
    assert antes.shape == (16, len(m.Variables.NOMBRES))
    np.testing.assert_array_equal(antes, despues)


def test_nivel_y_kappa_de_un_area():
    assert salidas.nivel(0.05) == "muy baja"
    assert salidas.nivel(0.9) == "muy alta"
    area = {"0.3°": {"kappa": 0.8}, "0.5°": {"kappa": 0.6}, "1.0°": {"kappa": 0.4}, "2.0°": {"kappa": 0.3}}
    metricas = {"area": {"1": area}}
    assert salidas.kappa_de(metricas, 1, 25) == pytest.approx(0.6)  # justo un tamaño probado
    assert salidas.kappa_de(metricas, 1, 10_000) == pytest.approx(0.3)  # más grande: el último κ
