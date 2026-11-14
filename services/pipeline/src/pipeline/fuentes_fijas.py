"""Máscara de fuentes fijas (F3-B1, RF-ARM-05): celdas de 0,1° con calor que no es quema.

Una celda entra si cumple una de dos reglas sobre los focos VIIRS (375 m; MODIS es muy grueso para esto):
- Persistencia: algún punto de 0,01° (~1 km) tiene focos en muchos días, de varios años y de muchos meses
  del año. Una antorcha arde todo el año en el mismo lugar; una quema agrícola se repite, pero en su estación.
- FIRMS ya la marca: la mayoría de sus focos del histórico SP traen type 1, 2 o 3 (volcán, fuente estática
  en tierra o en el mar).

Uso: uv run --package pipeline python -m pipeline.fuentes_fijas --focos data/focos --out data/armonizado
"""

import argparse
import sys
from pathlib import Path

import polars as pl

from pipeline.esquema import ESQUEMAS

VIIRS = ["N", "N20", "N21"]
MIN_DIAS = 30  # días con focos en el mismo punto de ~1 km
MIN_ANIOS = 5  # años distintos con focos en ese punto
MIN_MESES = 6  # meses del año distintos: descarta la quema estacional
MIN_ESTATICO = 0.5  # proporción de focos con type > 0 para aceptar la marca de FIRMS


def mascara(focos: pl.DataFrame | pl.LazyFrame) -> pl.DataFrame:
    """Devuelve las celdas fijas, ordenadas, con el esquema `fuentes_fijas` del contrato."""
    viirs = (
        focos.lazy()
        .filter(pl.col("satellite").is_in(VIIRS))
        .with_columns(dia=pl.col("acq_datetime").dt.date())
    )
    punto = [(pl.col(c) * 100).floor().cast(pl.Int32) for c in ("latitude", "longitude")]
    persistentes = (
        viirs.group_by("cell_id", *punto)
        .agg(
            dias=pl.col("dia").n_unique(),
            anios=pl.col("dia").dt.year().n_unique(),
            meses=pl.col("dia").dt.month().n_unique(),
        )
        .filter(
            (pl.col("dias") >= MIN_DIAS) & (pl.col("anios") >= MIN_ANIOS) & (pl.col("meses") >= MIN_MESES)
        )
        .select("cell_id")
    )
    estaticas = (
        viirs.group_by("cell_id")
        .agg(estatico=(pl.col("type") > 0).mean())
        .filter(pl.col("estatico") >= MIN_ESTATICO)
        .select("cell_id")
    )
    return (
        pl.concat([persistentes, estaticas])
        .unique()
        .sort("cell_id")
        .collect()
        .cast(ESQUEMAS["fuentes_fijas"])
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Máscara de fuentes fijas: focos -> fuentes_fijas.csv")
    p.add_argument("--focos", type=Path, required=True, help="Carpeta de focos de pipeline.firms")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    columnas = ["satellite", "latitude", "longitude", "cell_id", "type", "acq_datetime"]
    m = mascara(pl.scan_parquet(args.focos / "*.parquet").select(columnas))
    args.out.mkdir(parents=True, exist_ok=True)
    m.write_csv(args.out / "fuentes_fijas.csv")
    print(f"{m.height} celdas fijas en {args.out / 'fuentes_fijas.csv'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
