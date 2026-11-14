from datetime import date
from pathlib import Path

import polars as pl
import pytest
from pipeline.firms import cargar
from pipeline.muestras import calendario, dia_juego, serie_provisoria

FIX = Path(__file__).parent / "fixtures"


def test_calendario_mediana_y_percentil_por_region_y_mes():
    serie = pl.DataFrame(
        {
            "region": ["X"] * 3,
            "year": [2001, 2002, 2003],
            "month": [1, 1, 1],
            "source": ["harmonized"] * 3,
            "value": [10.0, 30.0, 20.0],
        }
    )
    cal = calendario(serie)
    assert cal["median"].to_list() == [20.0, 20.0, 20.0]
    assert cal["percentile"].to_list() == [16.7, 83.3, 50.0]


def test_serie_provisoria_marcada_y_sin_viirs_antes_de_2012():
    s = serie_provisoria()
    assert s["provisional"].all()
    assert s.filter((pl.col("source") == "viirs") & (pl.col("year") < 2012)).is_empty()
    assert s.filter(pl.col("source") == "harmonized")["value"].min() > 0


def test_dia_juego_solo_viirs_del_dia():
    df = cargar(list(FIX.glob("*.csv")))
    j = dia_juego(df, date(2019, 2, 1))
    assert j["provisional"] is False and len(j["focos"]) == 2
    assert j["focos"][0]["hora_utc"] == "00:12"
    with pytest.raises(ValueError):
        dia_juego(df, date(2005, 1, 15))  # ese día solo hay MODIS
