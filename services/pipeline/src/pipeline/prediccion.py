"""Tabla de entrenamiento de la predicción (F3-B5, D-31): días con fuego por celda de 0,1° y mes.

Unidad: días con fuego de S-NPP (la referencia de la armonización), sin las celdas de fuentes fijas y solo en
meses completos. Solo celdas con fuego en al menos MIN_ANIOS años: en las demás lo esperado es casi cero.
Después del último mes completo de S-NPP (dejó de publicar el 2/11/2026) siguen los meses completos de NOAA-20
llevados a S-NPP con la calibración de la armonización (R-B4): cada celda toma el factor de su región y mes.

El modelo y la compuerta están en `services/prediccion` (`prediccion.modelo`, R-E3 #254), que entrena con
esta tabla publicada.

Uso: uv run --package pipeline python -m pipeline.prediccion --focos data/focos \
       --regiones data/muestras/regiones.geojson --out data/armonizado
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import polars as pl

from pipeline.armonizacion import calibrar, convertir, dias_celda_mensuales, filtrar, meses_completos
from pipeline.fuentes_fijas import mascara
from pipeline.regiones import region_de_celdas

MIN_ANIOS = 5  # años con fuego para que una celda tenga predicción
CLAVE = ["cell_id", "mes"]
ANIO_MES = {"year": pl.col("mes").dt.year().cast(pl.Int16), "month": pl.col("mes").dt.month().cast(pl.Int8)}


def _dias(focos: pl.LazyFrame, satelite: str) -> pl.LazyFrame:
    """Días con fuego por celda y mes de un satélite (D-02: un día-celda cuenta una vez)."""
    dias = focos.filter(pl.col("satellite") == satelite).select(
        "cell_id", dia=pl.col("acq_datetime").dt.date()
    )
    return (
        dias.unique()
        .group_by("cell_id", mes=pl.col("dia").dt.truncate("1mo"))
        .agg(dias=pl.len().cast(pl.Float64))
    )


def _noaa20_convertido(
    viirs: pl.LazyFrame, celda_region: pl.DataFrame, completos: pl.DataFrame, meses: pl.DataFrame
) -> pl.DataFrame:
    """Días de NOAA-20 por celda en `meses`, en escala S-NPP con el factor de su región y mes."""
    regional = dias_celda_mensuales(viirs, celda_region)
    regional = regional.join(completos, on=["grupo", "year", "month"], how="semi")
    clave = ["region", "year", "month"]
    n20 = regional.filter(pl.col("grupo") == "noaa20").join(
        meses.select(**ANIO_MES),
        on=["year", "month"],
        how="semi",
    )
    conv = convertir(n20.select(*clave, "value"), calibrar(regional, "noaa20", "snpp"))
    factor = n20.join(conv.select(*clave, conv="value"), on=clave).select(
        *clave, factor=pl.when(pl.col("value") > 0).then(pl.col("conv") / pl.col("value")).otherwise(0.0)
    )
    celdas = _dias(viirs, "N20").collect().join(meses, on="mes", how="semi").join(celda_region, on="cell_id")
    return (
        celdas.with_columns(**ANIO_MES)
        .join(factor, on=clave)
        .select(
            "cell_id",
            "mes",
            dias=(pl.col("dias") * pl.col("factor"))
            .round()
            .clip(upper_bound=pl.col("mes").dt.month_end().dt.day()),
        )
    )


def mensual(focos: pl.LazyFrame, fijas: list[str], celda_region: pl.DataFrame) -> pl.DataFrame:
    """Días con fuego por celda y mes completo, con ceros, en celdas con fuego en MIN_ANIOS años.

    S-NPP medido hasta su último mes completo; después, NOAA-20 llevado a S-NPP. `fuente` dice cuál.
    """
    viirs = filtrar(focos.filter(pl.col("satellite").is_in(["N", "N20"])), fijas)
    completos = meses_completos(viirs.select("satellite", "acq_datetime"))
    mes = pl.date(pl.col("year"), pl.col("month"), 1)
    snpp = completos.filter(pl.col("grupo") == "snpp").select(mes=mes, fuente=pl.lit("snpp"))
    despues = completos.filter((pl.col("grupo") == "noaa20") & (mes > snpp["mes"].max())).select(
        mes=mes, fuente=pl.lit("noaa20_convertido")
    )
    conteo = _dias(viirs, "N").collect().join(snpp, on="mes", how="semi")
    if despues.height:
        conteo = pl.concat([conteo, _noaa20_convertido(viirs, celda_region, completos, despues)])
    meses = pl.concat([snpp, despues])
    celdas = (
        conteo.filter(pl.col("dias") > 0)
        .group_by("cell_id")
        .agg(anios=pl.col("mes").dt.year().n_unique())
        .filter(pl.col("anios") >= MIN_ANIOS)
    )
    grilla = celdas.select("cell_id").join(meses, how="cross")
    return grilla.join(conteo, on=CLAVE, how="left").with_columns(pl.col("dias").fill_null(0.0)).sort(CLAVE)


def meses_descartados(m: pl.DataFrame) -> list[date]:
    """Meses entre el primero y el último de `m` que faltan: `mensual` los descartó por incompletos (R-B2)."""
    todos = pl.date_range(m["mes"].min(), m["mes"].max(), "1mo", eager=True)
    return sorted(set(todos.to_list()) - set(m["mes"].unique().to_list()))


def entrenamiento(m: pl.DataFrame) -> pl.DataFrame:
    """Tabla `entrenamiento` del contrato (F3-B5): la entrada del modelo, para entrenar sin los focos."""
    return m.select(
        "cell_id",
        month=pl.col("mes").dt.strftime("%Y-%m"),
        fire_days=pl.col("dias").cast(pl.Int16),
        source="fuente",
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Tabla de entrenamiento de la predicción: focos -> entrenamiento")
    p.add_argument("--focos", type=Path, required=True, help="Carpeta de focos de pipeline.firms")
    p.add_argument("--regiones", type=Path, required=True, help="regiones.geojson, para convertir NOAA-20")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    focos = pl.scan_parquet(args.focos / "*.parquet")
    columnas = ["satellite", "latitude", "longitude", "cell_id", "type", "acq_datetime"]
    fijas = mascara(focos.select(columnas))["cell_id"].to_list()
    celdas = focos.filter(pl.col("satellite").is_in(["N", "N20"])).select("cell_id").unique().collect()
    m = mensual(focos, fijas, region_de_celdas(celdas["cell_id"], json.loads(args.regiones.read_text())))
    # Una fuente que se corta no debe pasar en silencio: los meses descartados se ven en la salida (R-B2).
    print(f"último mes completo de S-NPP: {m.filter(pl.col('fuente') == 'snpp')['mes'].max():%Y-%m}")
    convertidos = m.filter(pl.col("fuente") == "noaa20_convertido")["mes"]
    if convertidos.len():
        print(f"NOAA-20 llevado a S-NPP de {convertidos.min():%Y-%m} a {convertidos.max():%Y-%m} (R-B4)")
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
