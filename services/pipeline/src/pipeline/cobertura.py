"""Cobertura de la ventana de prueba de la predicción, por sensor y en la tabla `entrenamiento` (R-B2, #221).

S-NPP dejó de publicar el 2/11/2026 y la predicción se entrena solo con S-NPP: si los últimos meses están
incompletos, el backtest no es confiable. Este informe dice, por mes:

- por sensor, cuántos días tuvo focos válidos (D-04, sin fuentes fijas) y si el mes es completo con el mismo
  criterio de la armonización (`MIN_COBERTURA`);
- el último día con datos de cada sensor;
- en `entrenamiento`, si el mes está y cuántas celdas tuvieron fuego, contra la mediana del mismo mes en los
  años anteriores. Un mes con menos de `FRACCION_SOSPECHA` de esa mediana se marca sospechoso, sin borrarlo.

Uso: uv run --package pipeline python -m pipeline.cobertura --focos data/focos
     --entrenamiento data/pub/entrenamiento.parquet --desde 2025-01 --hasta 2026-09
"""

import argparse
import sys
from datetime import date
from pathlib import Path

import polars as pl

from pipeline.armonizacion import GRUPOS, filtrar, meses_completos
from pipeline.fuentes_fijas import mascara

FRACCION_SOSPECHA = 0.5  # celdas con fuego por debajo de esta fracción de la mediana histórica del mes
COLUMNAS = ["satellite", "instrument", "confidence", "confidence_pct", "type", "cell_id", "acq_datetime"]


def _meses(desde: date, hasta: date) -> pl.Series:
    return pl.date_range(desde, hasta, "1mo", eager=True).alias("mes")


def por_sensor(focos: pl.DataFrame, desde: date, hasta: date, fijas: list[str] | None = None) -> pl.DataFrame:
    """Por grupo de sensor y mes: días con focos válidos, días del mes y si el mes es completo."""
    validos = filtrar(focos, fijas)
    conteo = (
        validos.select(grupo=pl.col("satellite").replace_strict(GRUPOS), dia=pl.col("acq_datetime").dt.date())
        .unique()
        .group_by("grupo", mes=pl.col("dia").dt.truncate("1mo"))
        .agg(dias=pl.len().cast(pl.Int32))
    )
    completos = meses_completos(validos).select(
        "grupo", mes=pl.date(pl.col("year"), pl.col("month"), 1), completo=pl.lit(True)
    )
    grupos = pl.DataFrame({"grupo": sorted(set(GRUPOS.values()))})
    grilla = grupos.join(_meses(desde, hasta).to_frame(), how="cross")
    return (
        grilla.join(conteo, on=["grupo", "mes"], how="left")
        .join(completos, on=["grupo", "mes"], how="left")
        .with_columns(
            dias=pl.col("dias").fill_null(0),
            dias_mes=pl.col("mes").dt.month_end().dt.day().cast(pl.Int32),
            completo=pl.col("completo").fill_null(False),
        )
        .with_columns(fraccion=(pl.col("dias") / pl.col("dias_mes")).round(3))
        .sort("grupo", "mes")
    )


def ultimo_dia(focos: pl.DataFrame, fijas: list[str] | None = None) -> pl.DataFrame:
    """Último día UTC con algún foco válido, por grupo de sensor (solo los grupos que tienen focos)."""
    return (
        filtrar(focos, fijas)
        .group_by(grupo=pl.col("satellite").replace_strict(GRUPOS))
        .agg(ultimo_dia=pl.col("acq_datetime").max().dt.date())
        .sort("grupo")
    )


def entrenamiento_por_mes(e: pl.DataFrame, desde: date, hasta: date) -> pl.DataFrame:
    """Por mes de la ventana: si está en `entrenamiento`, celdas con fuego, días-celda y su historia."""
    mensual = e.group_by(mes=pl.col("month").str.to_date("%Y-%m")).agg(
        celdas_con_fuego=(pl.col("fire_days") > 0).sum().cast(pl.Int64),
        dias_celda=pl.col("fire_days").cast(pl.Int64).sum(),
    )
    ventana = _meses(desde, hasta).to_frame().join(mensual, on="mes", how="left")
    # Mediana del mismo mes del año en los años anteriores al mes informado.
    previos = ventana.join(mensual, how="cross", suffix="_previo").filter(
        (pl.col("mes_previo").dt.month() == pl.col("mes").dt.month()) & (pl.col("mes_previo") < pl.col("mes"))
    )
    historia = previos.group_by("mes").agg(
        mediana_historica=pl.col("celdas_con_fuego_previo").median(),
        minimo_historico=pl.col("celdas_con_fuego_previo").min(),
    )
    return (
        ventana.join(historia, on="mes", how="left")
        .with_columns(presente=pl.col("celdas_con_fuego").is_not_null())
        .with_columns(
            sospechoso=(
                pl.col("presente")
                & pl.col("mediana_historica").is_not_null()
                & (pl.col("celdas_con_fuego") < FRACCION_SOSPECHA * pl.col("mediana_historica"))
            ).fill_null(False)
        )
        .sort("mes")
    )


def _tabla(df: pl.DataFrame) -> str:
    def celda(v: object) -> str:
        if v is None:
            return "—"
        if isinstance(v, bool):
            return "sí" if v else "no"
        if isinstance(v, date):
            return v.strftime("%Y-%m")
        return str(v)

    lineas = ["| " + " | ".join(df.columns) + " |", "|" + "---|" * len(df.columns)]
    lineas += ["| " + " | ".join(celda(v) for v in fila) + " |" for fila in df.rows()]
    return "\n".join(lineas)


def informe(
    focos: pl.DataFrame, e: pl.DataFrame, desde: date, hasta: date, fijas: list[str] | None = None
) -> str:
    """Informe en Markdown: último día por sensor, cobertura por sensor y mes, y `entrenamiento` por mes."""
    s = por_sensor(focos, desde, hasta, fijas)
    dias = s.pivot(on="grupo", index="mes", values="dias").sort("mes")
    completo = s.with_columns(
        estado=pl.when("completo").then(pl.lit("completo")).otherwise(pl.lit("incompleto"))
    ).pivot(on="grupo", index="mes", values="estado")
    cobertura = dias.join(completo, on="mes", suffix=" estado").sort("mes")
    u = ultimo_dia(focos, fijas)
    t = entrenamiento_por_mes(e, desde, hasta).select(
        "mes", "presente", "celdas_con_fuego", "dias_celda", "mediana_historica", "sospechoso"
    )
    incompletos_snpp = s.filter((pl.col("grupo") == "snpp") & ~pl.col("completo"))["mes"]
    resumen = [
        f"Ventana {desde:%Y-%m} a {hasta:%Y-%m}.",
        "Meses incompletos de S-NPP en la ventana: "
        + (", ".join(m.strftime("%Y-%m") for m in incompletos_snpp) or "ninguno")
        + ".",
        "Meses sospechosos en `entrenamiento`: "
        + (", ".join(m.strftime("%Y-%m") for m in t.filter("sospechoso")["mes"]) or "ninguno")
        + f" (menos del {FRACCION_SOSPECHA:.0%} de la mediana del mismo mes en los años anteriores).",
    ]
    ultimo = ["| grupo | último día con focos |", "|---|---|"] + [
        f"| {g} | {d.isoformat()} |" for g, d in u.rows()
    ]
    return "\n\n".join(
        [
            "\n".join(resumen),
            "\n".join(ultimo),
            "Días con focos válidos por sensor y mes (y si el mes es completo, `MIN_COBERTURA`):",
            _tabla(cobertura),
            "Tabla `entrenamiento` por mes:",
            _tabla(t),
        ]
    )


def _mes(texto: str) -> date:
    anio, mes = texto.split("-")
    return date(int(anio), int(mes), 1)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Cobertura de la ventana de prueba de la predicción (R-B2)")
    p.add_argument("--focos", type=Path, required=True, help="Carpeta de focos de pipeline.firms")
    p.add_argument("--entrenamiento", type=Path, required=True, help="entrenamiento.parquet publicado")
    p.add_argument("--desde", type=_mes, required=True, help="AAAA-MM")
    p.add_argument("--hasta", type=_mes, required=True, help="AAAA-MM")
    args = p.parse_args(argv)
    lazy = pl.scan_parquet(args.focos / "*.parquet")
    fijas = mascara(lazy.select("satellite", "latitude", "longitude", "cell_id", "type", "acq_datetime"))
    focos = lazy.select(COLUMNAS).collect()
    e = pl.read_parquet(args.entrenamiento)
    print(informe(focos, e, args.desde, args.hasta, fijas["cell_id"].to_list()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
