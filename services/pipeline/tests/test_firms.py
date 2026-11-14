from datetime import UTC, datetime
from pathlib import Path

import polars as pl
import pytest
from pipeline.firms import COLUMNAS, cargar, escribir, leer_csv

FIX = Path(__file__).parent / "fixtures"


def test_modis_normaliza_confianza_y_celda():
    df = leer_csv(FIX / "modis_sp.csv")
    fila = df.row(0, named=True)
    assert fila["acq_datetime"] == datetime(2005, 1, 15, 3, 12, tzinfo=UTC)
    assert fila["instrument"] == "MODIS" and fila["satellite"] == "Terra"
    assert fila["confidence"] == "high" and fila["confidence_pct"] == 85
    assert fila["cell_id"] == "-45.4_-71.3"
    assert df["confidence"].to_list() == ["high", "low"]
    assert df["product"].to_list() == ["sp", "sp"]


def test_viirs_satelite_codigo_numerico_y_celda_en_borde():
    df = leer_csv(FIX / "viirs_noaa20_sp.csv")
    assert df["satellite"].to_list() == ["N20", "N20"]
    assert df["confidence"].to_list() == ["nominal", "high"]
    assert df["confidence_pct"].null_count() == 2
    assert df["cell_id"][0] == "-45.4_-71.3"  # -45.4 exacto no cae en -45.5


def test_nrt_sin_type_y_dedup_prefiere_sp():
    df = cargar([FIX / "viirs_noaa20_nrt.csv", FIX / "viirs_noaa20_sp.csv", FIX / "modis_sp.csv"])
    assert df.columns == COLUMNAS
    assert df.height == 5  # 6 filas, una repetida entre SP y NRT
    rep = df.filter(pl.col("acq_datetime") == datetime(2019, 2, 1, 0, 12, tzinfo=UTC))
    assert rep["product"].to_list() == ["sp"] and rep["type"].to_list() == [0]
    assert df.filter(pl.col("product") == "nrt")["type"].null_count() == 1


def test_satelite_desconocido_falla(tmp_path):
    csv = (FIX / "viirs_noaa20_sp.csv").read_text().replace("N20,", "X9,", 1)
    (tmp_path / "x.csv").write_text(csv)
    with pytest.raises(ValueError, match="X9"):
        leer_csv(tmp_path / "x.csv")


def test_escribe_particionado_y_no_pisa(tmp_path):
    df = cargar(list(FIX.glob("*.csv")))
    escribir(df, tmp_path / "focos")
    assert (tmp_path / "focos" / "satellite=N20" / "year=2019").is_dir()
    leido = pl.read_parquet(tmp_path / "focos", hive_partitioning=True)
    assert leido.height == df.height
    with pytest.raises(FileExistsError):
        escribir(df, tmp_path / "focos")
