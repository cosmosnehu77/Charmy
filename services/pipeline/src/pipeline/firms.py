"""Carga los CSV de FIRMS (archivo SP o NRT, MODIS o VIIRS) a la tabla `focos` de
packages/contracts/datos/esquema.md, en un Parquet por satélite y año.

Uso: uv run --package pipeline python -m pipeline.firms <csv>... --out data/focos
"""

import argparse
import shutil
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


# Grupos de filas chicos: con los focos ordenados por lugar, un bbox lee pocos grupos por HTTPS (#6, API).
FILAS_POR_GRUPO = 15_000


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
    return cargar_partes(pl.concat([leer_csv(r) for r in rutas]))


def cargar_partes(df: pl.DataFrame) -> pl.DataFrame:
    """Quita duplicados (gana SP sobre NRT) y ordena por lugar, con la clave única completa: orden estable."""
    return (
        df.sort("product", descending=True)  # "sp" antes que "nrt"
        .unique(["satellite", "acq_datetime", "latitude", "longitude"], keep="first")
        # Por lugar: la API filtra por bbox y DuckDB saltea los grupos de filas que quedan afuera.
        .sort("latitude", "longitude", "acq_datetime", "satellite")
        .select(COLUMNAS)
    )


def escribir(df: pl.DataFrame, salida: Path) -> None:
    """Escribe focos/<satellite>-<year>.parquet con todas las columnas adentro. No pisa datos."""
    if salida.exists() and any(salida.iterdir()):
        raise FileExistsError(f"{salida} ya tiene datos: bórrala o elige otra carpeta")
    salida.mkdir(parents=True, exist_ok=True)
    con_anio = df.with_columns(year=pl.col("acq_datetime").dt.year())
    for (satelite, anio), parte in con_anio.partition_by("satellite", "year", as_dict=True).items():
        parte.write_parquet(salida / f"{satelite}-{anio}.parquet", row_group_size=FILAS_POR_GRUPO)


def convertir(entradas: list[Path], salida: Path) -> int:
    """Como escribir(cargar(...)) sin tener todo en memoria: el histórico completo no entra en una PC común.

    Reparte cada CSV en partes por satélite y año; después une cada satélite-año, quita duplicados y escribe.
    Las carpetas de `entradas` se recorren enteras. Devuelve la cantidad de focos escritos.
    """
    if salida.exists() and any(salida.iterdir()):
        raise FileExistsError(f"{salida} ya tiene datos: bórrala o elige otra carpeta")
    rutas = sorted(r for e in entradas for r in (e.rglob("*.csv") if e.is_dir() else [e]))
    partes = salida / ".partes"
    for i, ruta in enumerate(rutas):
        df = leer_csv(ruta).with_columns(year=pl.col("acq_datetime").dt.year())
        for (satelite, anio), parte in df.partition_by("satellite", "year", as_dict=True).items():
            carpeta = partes / f"{satelite}-{anio}"
            carpeta.mkdir(parents=True, exist_ok=True)
            parte.drop("year").write_parquet(carpeta / f"{i:06d}.parquet")
    total = 0
    for carpeta in sorted(partes.iterdir()):
        df = cargar_partes(pl.read_parquet(carpeta / "*.parquet"))
        df.with_columns(year=pl.col("acq_datetime").dt.year()).write_parquet(
            salida / f"{carpeta.name}.parquet", row_group_size=FILAS_POR_GRUPO
        )
        total += df.height
    shutil.rmtree(partes)
    return total


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="CSV de FIRMS a Parquet (tabla focos)")
    p.add_argument("csv", nargs="+", type=Path, help="CSV o carpetas con CSV")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    total = convertir(args.csv, args.out)
    print(f"{total} focos escritos en {args.out}")
    resumen = pl.scan_parquet(args.out / "*.parquet").group_by("satellite")
    fechas = pl.col("acq_datetime")
    print(resumen.agg(pl.len(), fechas.min().alias("desde"), fechas.max().alias("hasta")).collect())
    return 0


if __name__ == "__main__":
    sys.exit(main())
