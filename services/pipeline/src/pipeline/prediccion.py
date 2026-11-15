"""Tabla de entrenamiento de la predicción (F3-B5, D-31): días con fuego por celda de 0,1° y mes.

Unidad: días con fuego de S-NPP (la referencia de la armonización), sin las celdas de fuentes fijas y solo en
meses completos. Solo celdas con fuego en al menos MIN_ANIOS años: en las demás lo esperado es casi cero.

El modelo y la compuerta están en `services/prediccion` (`prediccion.modelo`, R-E3 #254), que entrena con
esta tabla publicada.

Uso: uv run --package pipeline python -m pipeline.prediccion --focos data/focos --out data/armonizado
"""

import argparse
import sys
from datetime import date
from pathlib import Path

import polars as pl

from pipeline.armonizacion import filtrar, meses_completos
from pipeline.fuentes_fijas import mascara

MIN_ANIOS = 5  # años con fuego para que una celda tenga predicción
CLAVE = ["cell_id", "mes"]


def mensual(focos: pl.LazyFrame, fijas: list[str]) -> pl.DataFrame:
    """Días con fuego de S-NPP por celda y mes completo, con ceros, en celdas con fuego en MIN_ANIOS años."""
    # shortcut: solo S-NPP, que cubre hasta 10/2026; para emitir después de eso, sumar NOAA-20 convertido.
    snpp = filtrar(focos.filter(pl.col("satellite") == "N"), fijas)
    dias = snpp.select("cell_id", dia=pl.col("acq_datetime").dt.date()).unique()
    conteo = dias.group_by("cell_id", mes=pl.col("dia").dt.truncate("1mo")).agg(
        dias=pl.len().cast(pl.Float64)
    )
    completos = meses_completos(snpp.select("satellite", "acq_datetime")).select(
        mes=pl.date(pl.col("year"), pl.col("month"), 1)
    )
    conteo = conteo.collect().join(completos, on="mes", how="semi")
    celdas = (
        conteo.group_by("cell_id")
        .agg(anios=pl.col("mes").dt.year().n_unique())
        .filter(pl.col("anios") >= MIN_ANIOS)
    )
    grilla = celdas.select("cell_id").join(completos, how="cross")
    return grilla.join(conteo, on=CLAVE, how="left").with_columns(pl.col("dias").fill_null(0.0)).sort(CLAVE)


def meses_descartados(m: pl.DataFrame) -> list[date]:
    """Meses entre el primero y el último de `m` que faltan: `mensual` los descartó por incompletos (R-B2)."""
    todos = pl.date_range(m["mes"].min(), m["mes"].max(), "1mo", eager=True)
    return sorted(set(todos.to_list()) - set(m["mes"].unique().to_list()))


def entrenamiento(m: pl.DataFrame) -> pl.DataFrame:
    """Tabla `entrenamiento` del contrato (F3-B5): la entrada del modelo, para entrenar sin los focos."""
    return m.select(
        "cell_id", month=pl.col("mes").dt.strftime("%Y-%m"), fire_days=pl.col("dias").cast(pl.Int16)
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Tabla de entrenamiento de la predicción: focos -> entrenamiento")
    p.add_argument("--focos", type=Path, required=True, help="Carpeta de focos de pipeline.firms")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    focos = pl.scan_parquet(args.focos / "*.parquet")
    columnas = ["satellite", "latitude", "longitude", "cell_id", "type", "acq_datetime"]
    fijas = mascara(focos.select(columnas))["cell_id"].to_list()
    m = mensual(focos, fijas)
    # Una fuente que se corta no debe pasar en silencio: los meses descartados se ven en la salida (R-B2).
    print(f"último mes completo de S-NPP: {m['mes'].max():%Y-%m}")
    descartados = meses_descartados(m)
    if descartados:
        print("meses incompletos descartados:", ", ".join(f"{d:%Y-%m}" for d in descartados))
    args.out.mkdir(parents=True, exist_ok=True)
    entrenamiento(m).write_parquet(args.out / "entrenamiento.parquet")
    print(
        f"{m.height} filas en {args.out / 'entrenamiento.parquet'}; el modelo se entrena en prediccion.modelo"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
