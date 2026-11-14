from datetime import date
from pathlib import Path

import polars as pl
import pytest
from pipeline.firms import cargar
from pipeline.muestras import dia_juego, serie_provisoria

FIX = Path(__file__).parent / "fixtures"


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
