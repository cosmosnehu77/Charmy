"""Pruebas mínimas de F3-E3 (#170). Datos sintéticos y un modelo falso: sin bajar pesos ni llamar a la red."""

import math
import random
from datetime import date

import numpy as np
import polars as pl
from pipeline.esquema import ESQUEMAS
from prediccion.comparar import MODELO, comparar, mejora_lightgbm
from prediccion.modelo import entrenar_y_validar, filas, particion


def mensual(tendencia: float, celdas: int = 12, semilla: int = 5) -> pl.DataFrame:
    """Días con fuego por celda y mes, 2012-01 a 2025-12: estación más una tendencia por año."""
    rnd = random.Random(semilla)
    meses = pl.date_range(date(2012, 1, 1), date(2025, 12, 1), "1mo", eager=True).to_list()
    datos = []
    for c in range(celdas):
        nivel = rnd.uniform(2, 6)
        for m in meses:
            estacion = 1 + 0.8 * math.cos(2 * math.pi * (m.month - 9) / 12)
            valor = nivel * estacion + tendencia * (m.year - 2012) + rnd.uniform(-0.3, 0.3)
            datos.append((f"-4{c // 10}.{c % 10}_-70.0", m, max(0.0, round(valor, 1))))
    return pl.DataFrame(
        datos, schema={"cell_id": pl.String, "mes": pl.Date, "dias": pl.Float64}, orient="row"
    )


class Persistencia:
    """Modelo falso con la interfaz de TimesFM: repite el último valor. Guarda lo que recibió."""

    def __init__(self, escala: float = 0.2):
        self.escala = escala
        self.contextos: list[np.ndarray] = []

    def forecast(self, horizon: int, inputs: list[np.ndarray]):
        self.contextos.extend(inputs)
        ultimo = np.array([x[-1] for x in inputs], dtype=float)[:, None].repeat(horizon, axis=1)
        q = np.stack([ultimo * (1 + self.escala * (k - 5) / 5) for k in range(10)], axis=2)
        return ultimo, q


class Estacional:
    """Modelo falso que repite el valor de hace 12 meses más la tendencia: le gana a la climatología."""

    def __init__(self, tendencia: float):
        self.tendencia = tendencia

    def forecast(self, horizon: int, inputs: list[np.ndarray]):
        punto = np.array([[x[-12 + h - 1] + self.tendencia for h in range(1, horizon + 1)] for x in inputs])
        q = np.stack([punto * (0.8 + 0.04 * k) for k in range(10)], axis=2)
        return punto, q


def test_no_publica_si_no_supera_a_la_climatologia():
    # Sin tendencia, repetir el último mes es peor que la climatología en una serie estacional.
    r = comparar(mensual(0.0), Persistencia(), mejora_vigente={1: 0.0, 2: 0.0, 3: 0.0})
    assert all(v <= 0.02 for v in r.mejora.values())
    assert r.prediccion.is_empty()


def test_no_reemplaza_a_lightgbm_si_no_lo_supera():
    m = mensual(1.0)
    r = comparar(m, Estacional(1.0), mejora_vigente={1: 0.99, 2: 0.99, 3: 0.99})
    assert any(v > 0.02 for v in r.mejora.values())  # sí le gana a la climatología...
    assert r.prediccion.is_empty()  # ...pero no a LightGBM: queda LightGBM


def test_publica_los_horizontes_que_superan_a_climatologia_y_lightgbm():
    m = mensual(1.0)
    r = comparar(m, Estacional(1.0), mejora_vigente={1: 0.0, 2: 0.99, 3: 0.0})
    assert set(r.prediccion["horizon"].to_list()) == {1, 3}
    assert dict(r.prediccion.schema) == ESQUEMAS["prediccion"]
    assert (r.prediccion["model"] == MODELO).all()
    # Incertidumbre ordenada: p10 <= esperado <= p90 (RF-PRE-02).
    assert (r.prediccion["p10"] <= r.prediccion["expected_fire_days"]).all()
    assert (r.prediccion["expected_fire_days"] <= r.prediccion["p90"]).all()
    # Se emite desde el último mes conocido.
    assert set(r.prediccion["month"].to_list()) == {"2026-01", "2026-03"}


def test_validacion_temporal_sin_fuga_y_con_los_mismos_anios_que_lightgbm():
    m = mensual(0.5, celdas=3)
    modelo = Persistencia()
    r = comparar(m, modelo, mejora_vigente={1: 0.0, 2: 0.0, 3: 0.0})
    # Mismas emisiones de prueba que la partición de prediccion.modelo (LightGBM).
    _, prueba = particion(filas(m))
    assert r.emisiones == sorted(set(prueba["emision"].to_list()))
    # Cada contexto termina en su mes de emisión: nunca ve el mes que predice.
    porcelda = len(r.emisiones)
    for i, emision in enumerate(r.emisiones):
        meses_hasta = m.filter(pl.col("mes") <= emision)["mes"].n_unique()
        assert len(modelo.contextos[i * 3]) == meses_hasta
    assert len(modelo.contextos) >= porcelda * 3


def test_con_muestra_de_celdas_solo_evalua_esas_y_emite_para_todas():
    m = mensual(1.0, celdas=6)
    todas = sorted(set(m["cell_id"].to_list()))
    muestra = todas[:2]
    modelo = Estacional(1.0)
    contextos: list[int] = []
    original = modelo.forecast

    def contar(horizon, inputs):
        contextos.append(len(inputs))
        return original(horizon, inputs)

    modelo.forecast = contar
    r = comparar(m, modelo, mejora_vigente={1: 0.0, 2: 0.0, 3: 0.0}, celdas=muestra)
    # En la prueba, solo las celdas de la muestra; la emisión final, para todas.
    assert contextos[:-1] == [2] * len(r.emisiones)
    assert contextos[-1] == 6
    assert set(r.prediccion["cell_id"].to_list()) == set(todas)


def test_lightgbm_se_mide_con_la_misma_prueba():
    m = mensual(1.0, celdas=6)
    todas = sorted(set(m["cell_id"].to_list()))
    # Con todas las celdas coincide con la mejora que publica prediccion.modelo.
    assert mejora_lightgbm(m) == entrenar_y_validar(m).mejora
    # Con una muestra, devuelve los tres horizontes medidos solo sobre esas celdas.
    parcial = mejora_lightgbm(m, celdas=todas[:3])
    assert set(parcial) == {1, 2, 3}


class Cero:
    """Modelo falso que siempre dice cero: con conteos casi siempre en cero «gana» en MAE."""

    def forecast(self, horizon: int, inputs: list[np.ndarray]):
        punto = np.zeros((len(inputs), horizon))
        return punto, np.zeros((len(inputs), horizon, 10))


def ralo(celdas: int = 8, semilla: int = 2) -> pl.DataFrame:
    """Días con fuego casi siempre en cero y un mes de fuego cada tanto, como casi todas las celdas."""
    rnd = random.Random(semilla)
    meses = pl.date_range(date(2012, 1, 1), date(2025, 12, 1), "1mo", eager=True).to_list()
    datos = [
        (f"-4{c}.0_-70.0", m, float(rnd.choice([3, 5, 8])) if rnd.random() < 0.1 else 0.0)
        for c in range(celdas)
        for m in meses
    ]
    return pl.DataFrame(
        datos, schema={"cell_id": pl.String, "mes": pl.Date, "dias": pl.Float64}, orient="row"
    )


def test_no_publica_un_modelo_que_no_supera_a_decir_siempre_cero():
    m = ralo()
    r = comparar(m, Cero(), mejora_vigente={1: 0.0, 2: 0.0, 3: 0.0})
    # Le gana a la climatología (con MAE, decir cero rinde cuando casi todo es cero)...
    assert all(v > 0.02 for v in r.mejora.values())
    # ...pero no a la referencia «siempre cero», que es él mismo: no se publica.
    assert r.referencias["cero"] == r.mejora
    assert r.prediccion.is_empty()
