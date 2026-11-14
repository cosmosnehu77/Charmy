"""Carga los CSV de FIRMS (archivo SP o NRT, MODIS o VIIRS) a la tabla `focos` de
packages/contracts/datos/esquema.md, en Parquet particionado por satélite y año.

Uso: uv run --package pipeline python -m pipeline.firms <csv>... --out data/focos
"""

import argparse
import sys
from pathlib import Path

import polars as pl

# Códigos de satélite que usa FIRMS según el producto, llevados al del contrato.
SATELITES = {
    "Terra": "Terra",
    "T": "Terra",
    "Aqua": "Aqua",
    "A": "Aqua",
    "N": "N",
    "N20": "N20",
    "1": "N20",
    "N21": "N21",
    "2": "N21",
}
CONFIANZA_VIIRS = {
    "l": "low",
    "n": "nominal",
    "h": "high",
    "low": "low",
    "nominal": "nominal",
    "high": "high",
}
COLUMNAS = [
    "latitude",
    "longitude",
    "acq_datetime",
    "satellite",
    "instrument",
    "confidence",
    "confidence_pct",
    "brightness",
    "brightness_2",
    "frp",
    "scan",
    "track",
    "daynight",
    "type",
    "version",
    "product",
    "cell_id",
]


def _celda(col: str) -> pl.Expr:
    # Esquina suroeste de la celda de 0,1°; el épsilon evita que -45.4 caiga en -45.5 por redondeo binario.
    return ((pl.col(col) * 10 + 1e-9).floor() / 10).round(1).cast(pl.String)


def leer_csv(ruta: Path) -> pl.DataFrame:
    """Lee un CSV de FIRMS y lo devuelve con las columnas del contrato."""
    df = pl.read_csv(ruta, infer_schema=False)  # todo como texto: acq_time "0012" y versiones no se deforman
    if "bright_ti4" in df.columns:
        instrumento, brillo, brillo2 = "VIIRS", "bright_ti4", "bright_ti5"
    elif "brightness" in df.columns:
        instrumento, brillo, brillo2 = "MODIS", "brightness", "bright_t31"
    else:
        raise ValueError(f"{ruta}: no parece un CSV de FIRMS (falta bright_ti4 o brightness)")

    desconocidos = set(df["satellite"].unique()) - SATELITES.keys()
    if desconocidos:
        raise ValueError(f"{ruta}: satélite desconocido {sorted(desconocidos)}")

    if instrumento == "MODIS":
        pct = pl.col("confidence").cast(pl.Int8)
        confianza = (
            pl.when(pct < 30)
            .then(pl.lit("low"))
            .when(pct < 80)
            .then(pl.lit("nominal"))
            .otherwise(pl.lit("high"))
        )
    else:
        pct = pl.lit(None, dtype=pl.Int8)
        confianza = pl.col("confidence").str.to_lowercase().replace_strict(CONFIANZA_VIIRS)

    tipo = pl.col("type").cast(pl.Int8) if "type" in df.columns else pl.lit(None, dtype=pl.Int8)

    return df.select(
        pl.col("latitude").cast(pl.Float64),
        pl.col("longitude").cast(pl.Float64),
        (pl.col("acq_date") + pl.col("acq_time").str.zfill(4))
        .str.to_datetime("%Y-%m-%d%H%M", time_zone="UTC")
        .alias("acq_datetime"),
        pl.col("satellite").replace_strict(SATELITES),
        pl.lit(instrumento).alias("instrument"),
        confianza.alias("confidence"),
        pct.alias("confidence_pct"),
        pl.col(brillo).cast(pl.Float64).alias("brightness"),
        pl.col(brillo2).cast(pl.Float64).alias("brightness_2"),
        pl.col("frp").cast(pl.Float64),
        pl.col("scan").cast(pl.Float64),
        pl.col("track").cast(pl.Float64),
        pl.col("daynight"),
        tipo.alias("type"),
        pl.col("version"),
        pl.when(pl.col("version").str.contains("NRT"))
        .then(pl.lit("nrt"))
        .otherwise(pl.lit("sp"))
        .alias("product"),
    ).with_columns(cell_id=_celda("latitude") + "_" + _celda("longitude"))


def cargar(rutas: list[Path]) -> pl.DataFrame:
    """Une varios CSV y quita duplicados; si un foco está en SP y en NRT, queda el de SP."""
    df = pl.concat([leer_csv(r) for r in rutas])
    return (
        df.sort("product", descending=True)  # "sp" antes que "nrt"
        .unique(["satellite", "acq_datetime", "latitude", "longitude"], keep="first")
        .sort("acq_datetime", "satellite")
        .select(COLUMNAS)
    )


def escribir(df: pl.DataFrame, salida: Path) -> None:
    """Escribe focos/satellite=<s>/year=<a>/*.parquet. No pisa una carpeta con datos."""
    if salida.exists() and any(salida.iterdir()):
        raise FileExistsError(f"{salida} ya tiene datos: bórrala o elige otra carpeta")
    salida.mkdir(parents=True, exist_ok=True)
    df.with_columns(year=pl.col("acq_datetime").dt.year()).write_parquet(
        salida, partition_by=["satellite", "year"]
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="CSV de FIRMS a Parquet (tabla focos)")
    p.add_argument("csv", nargs="+", type=Path)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    df = cargar(args.csv)
    escribir(df, args.out)
    print(f"{df.height} focos escritos en {args.out}")
    fechas = pl.col("acq_datetime")
    print(df.group_by("satellite").agg(pl.len(), fechas.min().alias("desde"), fechas.max().alias("hasta")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
