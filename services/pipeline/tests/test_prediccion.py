"""Pruebas mínimas de F3-B5 (#169) y R-B2 (#221). Datos sintéticos con fecha fija y sin llamar a FIRMS.

Las del modelo y la compuerta pasaron a services/prediccion/tests/test_modelo.py (R-E3, #254).
"""

from datetime import UTC, date, datetime, timedelta

import polars as pl
from pipeline.esquema import ESQUEMAS
from pipeline.prediccion import entrenamiento, meses_descartados
from pipeline.prediccion import mensual as mensual_snpp

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
    meses = pl.date_range(date(2015, 1, 1), date(2016, 12, 1), "1mo", eager=True)
    m = pl.DataFrame({"cell_id": FONDO, "mes": meses, "dias": 1.0})
    assert meses_descartados(m) == []
