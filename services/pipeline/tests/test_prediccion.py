"""Pruebas mínimas de F3-B2 (#45). Datos sintéticos con fecha fija: ninguna prueba llama a FIRMS."""

import math
import random
from datetime import date

import polars as pl
from pipeline.esquema import ESQUEMAS
from pipeline.prediccion import entrenar_y_validar, filas, particion


def mensual(persistencia: float, celdas: int = 40, semilla: int = 3) -> pl.DataFrame:
    """Días con fuego por celda y mes, 2012-01 a 2025-12, con estación y una anomalía AR(1) de fuerza dada.

    Con persistencia 0 el mes que viene no depende de los anteriores: lo mejor que se puede hacer es la
    climatología. Con persistencia alta, los últimos meses anticipan el próximo.
    """
    rnd = random.Random(semilla)
    meses = pl.date_range(date(2012, 1, 1), date(2025, 12, 1), "1mo", eager=True).to_list()
    datos = []
    for c in range(celdas):
        nivel, anomalia = rnd.uniform(1, 6), 0.0
        for m in meses:
            anomalia = persistencia * anomalia + rnd.gauss(0, 1)
            estacion = 1 + 0.9 * math.cos(2 * math.pi * (m.month - 9) / 12)
            media = nivel * estacion * math.exp(0.6 * anomalia * (persistencia > 0))
            # Poisson por inversión, con la semilla fija: determinista.
            k, p, u = 0, math.exp(-min(media, 30)), rnd.random()
            s = p
            while u > s and k < 30:
                k += 1
                p *= min(media, 30) / k
                s += p
            datos.append((f"-3{c // 10}.{c % 10}_-60.0", m, float(k)))
    return pl.DataFrame(
        datos, schema={"cell_id": pl.String, "mes": pl.Date, "dias": pl.Float64}, orient="row"
    )


def test_validacion_temporal_sin_fuga():
    f = filas(mensual(0.8, celdas=5))
    entreno, prueba = particion(f)
    # Todo lo de entrenamiento (también el mes que se predice) es anterior a la primera emisión de prueba.
    assert entreno["objetivo"].max() <= prueba["emision"].min()
    assert prueba["emision"].min() == date(2024, 1, 1)
    assert not entreno.is_empty() and not prueba.is_empty()


def test_climatologia_solo_usa_anios_anteriores():
    m = mensual(0.0, celdas=1)
    f = filas(m).filter((pl.col("horizonte") == 1) & (pl.col("objetivo") == date(2016, 3, 1)))
    marzos = m.filter((pl.col("mes").dt.month() == 3) & (pl.col("mes").dt.year() < 2016))["dias"]
    assert f["clim"].item() == marzos.mean()


def test_compuerta_no_publica_si_no_supera_a_la_climatologia():
    resultado = entrenar_y_validar(mensual(0.0))
    assert resultado.prediccion.is_empty()
    assert all(v <= 0.02 for v in resultado.mejora.values())


def test_compuerta_publica_si_supera_a_la_climatologia_y_con_su_incertidumbre():
    resultado = entrenar_y_validar(mensual(0.9))
    p = resultado.prediccion
    assert not p.is_empty()
    assert dict(p.schema) == ESQUEMAS["prediccion"]
    # Solo los horizontes que pasaron la compuerta, y cada uno con su mejora.
    assert set(p["horizon"].unique()) == {h for h, v in resultado.mejora.items() if v > 0.02}
    assert (p["skill_vs_climatology"] > 0.02).all()
    assert ((p["p10"] <= p["expected_fire_days"]) & (p["expected_fire_days"] <= p["p90"])).all()
    assert (p["p10"] >= 0).all()
    # Se emite desde el último mes con datos: los meses que vienen.
    assert set(p["month"]) <= {"2026-01", "2026-02", "2026-03"}


def test_determinismo():
    m = mensual(0.9, celdas=10)
    assert entrenar_y_validar(m).prediccion.equals(entrenar_y_validar(m).prediccion)
