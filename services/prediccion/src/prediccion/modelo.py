"""Predicción a 1-3 meses con LightGBM (F3-B2, RF-PRE-01/02) y compuerta contra la climatología (D-10).

Pasó de `pipeline.prediccion` a `services/prediccion` con R-E3 (#254, D-31): el carril B publica la tabla
`entrenamiento` (celda × mes, F3-B5) y acá se entrena con ella, sin bajar los focos.

- Variables al emitir en el mes T para T+h: días de T, T-1 y T-2, del mismo mes del año anterior, la
  climatología del mes objetivo y la de T (promedio de ese mes en los años anteriores, sin mirar el futuro),
  el mes del año y el horizonte.
- Modelo: LightGBM Poisson para lo esperado y cuantiles 0,1 y 0,9 para p10 y p90 (PLAN §1.1).
- Compuerta: se entrena con lo anterior a los últimos ANIOS_PRUEBA años y se prueba en ellos. Un horizonte se
  publica solo si mejora el error absoluto medio de la climatología en más de MIN_MEJORA.

Uso: uv run --package prediccion python -m prediccion.modelo --entrenamiento entrenamiento.parquet --out s
"""

import argparse
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import lightgbm as lgb
import polars as pl
from pipeline.esquema import ESQUEMAS

MODELO = "lightgbm-v1"
HORIZONTES = (1, 2, 3)
ANIOS_PRUEBA = 2  # años de emisiones que se guardan para la prueba temporal
MIN_MEJORA = 0.02  # mejora relativa del MAE sobre la climatología para publicar un horizonte
VARIABLES = ["lag0", "lag1", "lag2", "lag12", "clim", "clim0", "mes_objetivo", "horizonte"]
CLAVE = ["cell_id", "mes"]


@dataclass
class Resultado:
    prediccion: pl.DataFrame  # tabla `prediccion` del contrato; vacía si ningún horizonte pasa la compuerta
    mejora: dict[int, float]  # 1 - MAE modelo / MAE climatología, por horizonte, en la prueba temporal


def _correr(mes: pl.Expr, meses: int) -> pl.Expr:
    return mes.dt.offset_by(f"{meses}mo")


def filas(m: pl.DataFrame) -> pl.DataFrame:
    """Una fila por celda, mes de emisión y horizonte. `y` es nulo cuando el mes objetivo todavía no pasó."""
    m = m.sort(CLAVE)
    calendario = [pl.col("cell_id"), pl.col("mes").dt.month()]
    previos = pl.col("dias").cum_count().over(calendario) - 1
    base = m.with_columns(
        # Promedio del mismo mes en los años anteriores (sin el actual).
        clim=pl.when(previos > 0).then((pl.col("dias").cum_sum().over(calendario) - pl.col("dias")) / previos)
    )
    # Para meses objetivo que todavía no pasaron: el promedio de todos los años de ese mes.
    futuro = m.group_by("cell_id", mes_objetivo=pl.col("mes").dt.month()).agg(clim_todo=pl.col("dias").mean())

    def en(col: str, nombre: str, desfase: int) -> pl.DataFrame:
        return base.select("cell_id", pl.col(col).alias(nombre), mes=_correr(pl.col("mes"), desfase))

    emision = base.select(CLAVE).join(en("dias", "lag0", 0), on=CLAVE, how="left")
    for k in (1, 2):
        emision = emision.join(en("dias", f"lag{k}", k), on=CLAVE, how="left")
    emision = emision.join(en("clim", "clim0", 0), on=CLAVE, how="left")

    partes = []
    for h in HORIZONTES:
        p = (
            emision.rename({"mes": "emision"})
            .with_columns(objetivo=_correr(pl.col("emision"), h), horizonte=pl.lit(h, pl.Int8))
            .join(
                base.select("cell_id", objetivo="mes", y="dias", clim="clim"),
                on=["cell_id", "objetivo"],
                how="left",
            )
            .join(
                base.select("cell_id", objetivo=_correr(pl.col("mes"), 12), lag12="dias"),
                on=["cell_id", "objetivo"],
                how="left",
            )
            .with_columns(mes_objetivo=pl.col("objetivo").dt.month())
            .join(futuro, on=["cell_id", "mes_objetivo"], how="left")
            .with_columns(clim=pl.coalesce(pl.col("clim"), pl.when(pl.col("y").is_null()).then("clim_todo")))
            .drop("clim_todo")
        )
        partes.append(p)
    return pl.concat(partes).filter(pl.col("clim").is_not_null()).sort("cell_id", "emision", "horizonte")


def particion(f: pl.DataFrame) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Entrenamiento y prueba temporal: lo de entrenamiento, objetivo incluido, es anterior a la prueba."""
    conocidas = f.filter(pl.col("y").is_not_null())
    ultimo = conocidas["objetivo"].max().year
    inicio = date(ultimo - ANIOS_PRUEBA + 1, 1, 1)
    entreno = conocidas.filter(pl.col("objetivo") <= inicio)
    prueba = conocidas.filter(pl.col("emision") >= inicio)
    return entreno, prueba


def ajustar(datos: pl.DataFrame, objetivo: str, **extra) -> lgb.Booster:
    parametros = {
        "objective": objetivo,
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 50,
        "seed": 0,
        "deterministic": True,
        "force_row_wise": True,
        "verbose": -1,
        **extra,
    }
    conjunto = lgb.Dataset(datos.select(VARIABLES).to_numpy(), datos["y"].to_numpy())
    return lgb.train(parametros, conjunto, num_boost_round=300)


def predecir(modelo: lgb.Booster, datos: pl.DataFrame) -> pl.Series:
    return pl.Series(modelo.predict(datos.select(VARIABLES).to_numpy())).clip(lower_bound=0)


def entrenar_y_validar(m: pl.DataFrame) -> Resultado:
    """`m`: días con fuego por celda y mes (cell_id, mes, dias). Da predicción y mejora por horizonte."""
    f = filas(m)
    entreno, prueba = particion(f)
    prueba = prueba.with_columns(pred=predecir(ajustar(entreno, "poisson"), prueba))
    mejora = {}
    for h in HORIZONTES:
        p = prueba.filter(pl.col("horizonte") == h)
        mae_clim = (p["y"] - p["clim"]).abs().mean()
        mae_modelo = (p["y"] - p["pred"]).abs().mean()
        mejora[h] = round(1 - mae_modelo / mae_clim, 4) if mae_clim else 0.0
    pasan = [h for h, v in mejora.items() if v > MIN_MEJORA]
    if not pasan:
        return Resultado(pl.DataFrame(schema=ESQUEMAS["prediccion"]), mejora)

    # Con la compuerta pasada, el modelo final aprende de todo lo conocido y se emite desde el último mes.
    conocidas = f.filter(pl.col("y").is_not_null())
    futuras = f.filter((pl.col("emision") == m["mes"].max()) & pl.col("horizonte").is_in(pasan))
    esperado = predecir(ajustar(conocidas, "poisson"), futuras)
    q10 = predecir(ajustar(conocidas, "quantile", alpha=0.1), futuras)
    q90 = predecir(ajustar(conocidas, "quantile", alpha=0.9), futuras)
    prediccion = futuras.select(
        "cell_id",
        month=pl.col("objetivo").dt.strftime("%Y-%m"),
        horizon="horizonte",
        expected_fire_days=esperado.round(2),
        # Los cuantiles se ajustan por separado: se ordenan para que siempre p10 <= esperado <= p90.
        p10=pl.min_horizontal(q10, esperado).round(2),
        p90=pl.max_horizontal(q90, esperado).round(2),
        skill_vs_climatology=pl.col("horizonte").replace_strict(mejora, return_dtype=pl.Float64),
        model=pl.lit(MODELO),
    )
    return Resultado(prediccion.cast(ESQUEMAS["prediccion"]).sort("cell_id", "horizon"), mejora)


def leer_entrenamiento(ruta: Path) -> pl.DataFrame:
    """La tabla publicada `entrenamiento` (cell_id, month 'AAAA-MM', fire_days) como (cell_id, mes, dias)."""
    t = pl.read_parquet(ruta)
    return t.select(
        "cell_id",
        mes=pl.col("month").str.to_date("%Y-%m"),
        dias=pl.col("fire_days").cast(pl.Float64),
    ).sort("cell_id", "mes")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Predicción con LightGBM y compuerta: entrenamiento -> prediccion"
    )
    p.add_argument("--entrenamiento", type=Path, required=True, help="entrenamiento.parquet (F3-B5)")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    m = leer_entrenamiento(args.entrenamiento)
    print(f"{m['cell_id'].n_unique()} celdas, {m['mes'].min():%Y-%m} a {m['mes'].max():%Y-%m}")
    resultado = entrenar_y_validar(m)
    print("mejora sobre la climatología por horizonte:", resultado.mejora)
    if resultado.prediccion.is_empty():
        print("ningún horizonte pasa la compuerta (D-10): no se publica predicción")
        return 0
    args.out.mkdir(parents=True, exist_ok=True)
    resultado.prediccion.write_parquet(args.out / "prediccion.parquet")
    print(f"{resultado.prediccion.height} filas en {args.out / 'prediccion.parquet'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
