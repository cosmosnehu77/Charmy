from datetime import UTC, datetime
from pathlib import Path

import polars as pl
import pytest
from pipeline.firms import COLUMNAS, cargar, convertir, escribir, leer_csv

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


def test_escribe_un_archivo_por_satelite_y_anio_con_todas_las_columnas(tmp_path):
    df = cargar(list(FIX.glob("*.csv")))
    escribir(df, tmp_path / "focos")
    archivo = tmp_path / "focos" / "N20-2019.parquet"
    assert archivo.is_file()
    # Cada archivo se lee solo, sin carpetas Hive: satellite y year van adentro (así los ve DuckDB por HTTPS).
    uno = pl.read_parquet(archivo)
    assert {"satellite", "year"} <= set(uno.columns) and set(uno["satellite"]) == {"N20"}
    assert pl.read_parquet(tmp_path / "focos" / "*.parquet").height == df.height
    with pytest.raises(FileExistsError):
        escribir(df, tmp_path / "focos")


def test_orden_estable():
    rutas = list(FIX.glob("*.csv"))
    assert cargar(rutas).equals(cargar(list(reversed(rutas))))


def test_convertir_por_partes_da_lo_mismo_que_cargar_todo(tmp_path):
    """El histórico completo no entra en memoria: convertir va de a un archivo y de a un satélite-año."""
    rutas = list(FIX.glob("*.csv"))
    escribir(cargar(rutas), tmp_path / "junto")
    convertir([FIX], tmp_path / "partes")  # una carpeta se recorre entera
    nombres = sorted(p.name for p in (tmp_path / "partes").glob("*.parquet"))
    assert nombres == sorted(p.name for p in (tmp_path / "junto").glob("*.parquet"))
    for n in nombres:
        assert pl.read_parquet(tmp_path / "partes" / n).equals(pl.read_parquet(tmp_path / "junto" / n)), n
    assert not (tmp_path / "partes" / ".partes").exists()
