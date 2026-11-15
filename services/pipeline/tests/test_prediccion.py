"""Pruebas mínimas de F3-B2 (#45) y F3-B5 (#169). Datos sintéticos con fecha fija y sin llamar a FIRMS."""

import math
import random
from datetime import UTC, date, datetime, timedelta

import polars as pl
from pipeline.esquema import ESQUEMAS
from pipeline.prediccion import entrenamiento, entrenar_y_validar, filas, meses_descartados, particion
from pipeline.prediccion import mensual as mensual_snpp


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


# --- F3-B5: tabla de entrenamiento publicada -------------------------------------------------------------

FONDO, MENSUAL, POCOS, FIJA = "-30.0_-60.0", "-31.0_-61.0", "-32.0_-62.0", "-33.0_-63.0"


def _focos_snpp() -> pl.LazyFrame:
    """2015-2020: fondo y fija con fuego diario, otra celda el día 1 de cada mes y otra solo en dos años.

    En junio de 2018 S-NPP ve focos solo hasta el día 9: es un mes incompleto (corte del satélite).
    """
    filas_ = []
    dia = datetime(2015, 1, 1, 3, tzinfo=UTC)
    while dia.year <= 2020:
        corte = dia.year == 2018 and dia.month == 6 and dia.day >= 10
        celdas = [] if corte else [FONDO, FIJA]
        if dia.day == 1:
            celdas.append(MENSUAL)
            if dia.year in (2016, 2017):
                celdas.append(POCOS)
        filas_ += [("N", "VIIRS", "nominal", None, 0, c, dia) for c in celdas]
        dia += timedelta(days=1)
    esquema = {
        "satellite": pl.String,
        "instrument": pl.String,
        "confidence": pl.String,
        "confidence_pct": pl.Int8,
        "type": pl.Int8,
        "cell_id": pl.String,
        "acq_datetime": pl.Datetime("us", "UTC"),
    }
    return pl.DataFrame(filas_, schema=esquema, orient="row").lazy()


def test_tabla_de_entrenamiento_cumple_el_esquema_y_es_la_entrada_del_modelo():
    m = mensual_snpp(_focos_snpp(), [FIJA])
    tabla = entrenamiento(m)
    assert tabla.schema == ESQUEMAS["entrenamiento"]
    # La misma tabla que entrena el modelo, con el mes como texto y los días como entero.
    assert tabla.height == m.height
    assert tabla["fire_days"].cast(pl.Float64).to_list() == m["dias"].to_list()


def test_tabla_de_entrenamiento_sin_meses_incompletos_ni_fuentes_fijas_ni_celdas_con_pocos_anios():
    tabla = entrenamiento(mensual_snpp(_focos_snpp(), [FIJA]))
    assert set(tabla["cell_id"]) == {FONDO, MENSUAL}
    assert "2018-06" not in tabla["month"].to_list()
    assert tabla.filter(pl.col("cell_id") == FONDO).height == 6 * 12 - 1
    assert tabla.filter(pl.col("cell_id") == MENSUAL)["fire_days"].unique().to_list() == [1]


# --- R-B2 (#221): una fuente que se corta se ve en la salida ----------------------------------------------


def test_meses_descartados_nombra_el_mes_incompleto_de_snpp():
    m = mensual_snpp(_focos_snpp(), [FIJA])
    assert meses_descartados(m) == [date(2018, 6, 1)]


def test_meses_descartados_vacio_si_no_falta_ningun_mes():
    assert meses_descartados(mensual(0.0, celdas=2)) == []
