"""Medición de la predicción con métricas que no premian predecir cero (R-B1, #220).

El MAE contra la climatología, que usa la compuerta D-10, premia predecir cero: la mayoría de las celdas-mes
no tiene fuego. Esta medición usa la misma tabla, las mismas filas, la misma partición y el mismo LightGBM que
`prediccion.modelo` y suma, por horizonte:

- desvío de Poisson medio: castiga mucho decir casi cero donde hubo fuego;
- detección: una celda-mes es predicha quemada si P(y ≥ 1) = 1 − e^(−μ) ≥ 0,5, es decir μ ≥ ln 2;
- el 10 % de mayor riesgo: qué fracción de esas celdas-mes se quemó y cuántas de las quemadas captura;
- skill del modelo contra la climatología, «siempre cero» y la persistencia (repetir el mes de emisión),
  las mismas referencias de `services/prediccion/comparar.py`.

No cambia lo que se publica: `prediccion.parquet` y `/forecast` siguen con la compuerta D-10.

Uso: uv run --package prediccion python -m prediccion.medicion --entrenamiento data/pub/entrenamiento.parquet
"""

import argparse
import math
import sys
from pathlib import Path

import polars as pl

from prediccion.modelo import HORIZONTES, ajustar, filas, leer_entrenamiento, particion, predecir

EPS = 1e-6  # piso de μ en el desvío: con μ = 0 e y > 0 sería infinito
UMBRAL = math.log(2)  # μ desde el que P(y ≥ 1) ≥ 0,5
FRACCION_TOP = 0.1  # el 10 % de celdas-mes con mayor μ
REFERENCIAS = {"climatologia": pl.col("clim"), "siempre_cero": pl.lit(0.0), "persistencia": pl.col("lag0")}


def desvio_poisson(y: pl.Series, mu: pl.Series) -> float:
    """Desvío de Poisson medio: 2·[y·ln(y/μ) − (y − μ)], con y·ln(y/μ) = 0 si y = 0.

    Donde hubo fuego, μ se recorta a EPS para que «siempre cero» dé un número finito (y muy grande).
    """
    yc, mc = pl.col("y"), pl.col("mu")
    mc = pl.when((yc > 0) & (mc < EPS)).then(EPS).otherwise(mc)
    termino = pl.when(yc > 0).then(yc * (yc / mc).log()).otherwise(0.0)
    d = pl.DataFrame({"y": y, "mu": mu}).select(2 * (termino - (yc - mc)))
    return float(d.to_series().mean())


def deteccion(y: pl.Series, mu: pl.Series) -> dict[str, float | None]:
    """Recall y precisión de «quemada» (y ≥ 1) con μ ≥ ln 2. Precisión nula si no predice ninguna."""
    quemada, predicha = y >= 1, mu >= UMBRAL
    aciertos = (quemada & predicha).sum()
    return {
        "recall": aciertos / quemada.sum() if quemada.sum() else None,
        "precision": aciertos / predicha.sum() if predicha.sum() else None,
    }


def top(claves: pl.DataFrame, y: pl.Series, mu: pl.Series) -> dict[str, float | None]:
    """Precisión y captura en el 10 % de mayor μ. Empates por las claves; nulas si μ es constante."""
    if mu.n_unique() <= 1:
        return {"precision_top": None, "captura_top": None}
    d = claves.with_columns(y=y, mu=mu).sort(
        ["mu", *claves.columns], descending=[True] + [False] * claves.width
    )
    n = max(1, round(FRACCION_TOP * d.height))
    arriba = (d["y"].head(n) >= 1).sum()
    quemadas = (d["y"] >= 1).sum()
    return {"precision_top": arriba / n, "captura_top": arriba / quemadas if quemadas else None}


def prueba_con_referencias(m: pl.DataFrame) -> pl.DataFrame:
    """Las filas de prueba de `prediccion.modelo` con la predicción del LightGBM Poisson (`pred`)."""
    entreno, prueba = particion(filas(m))
    return prueba.with_columns(pred=predecir(ajustar(entreno, "poisson"), prueba))


def medir(prueba: pl.DataFrame) -> pl.DataFrame:
    """Una fila por horizonte y predicción (modelo y referencias), todas sobre las mismas filas."""
    comunes = prueba.filter(pl.col("lag0").is_not_null())
    predicciones = {"modelo": pl.col("pred"), **REFERENCIAS}
    salida = []
    for h in sorted(comunes["horizonte"].unique()):
        p = comunes.filter(pl.col("horizonte") == h).sort("cell_id", "emision")
        claves = p.select("cell_id", "emision")
        for nombre, expr in predicciones.items():
            mu = p.with_columns(mu=expr.cast(pl.Float64))["mu"]
            salida.append(
                {
                    "horizonte": int(h),
                    "prediccion": nombre,
                    "filas": p.height,
                    "descartadas": prueba.filter(pl.col("horizonte") == h).height - p.height,
                    "desvio": desvio_poisson(p["y"], mu),
                    "mae": float((p["y"] - mu).abs().mean()),
                    **deteccion(p["y"], mu),
                    **top(claves, p["y"], mu),
                }
            )
    return pl.DataFrame(salida)


def skill(med: pl.DataFrame) -> pl.DataFrame:
    """1 − métrica del modelo / métrica de la referencia, en desvío y MAE. Nulo si la referencia da 0."""
    modelo = med.filter(pl.col("prediccion") == "modelo").select("horizonte", desvio_m="desvio", mae_m="mae")
    refs = med.filter(pl.col("prediccion") != "modelo").rename({"prediccion": "referencia"})

    def s(m: str, r: str) -> pl.Expr:
        return pl.when(pl.col(r) > 0).then(1 - pl.col(m) / pl.col(r))

    return (
        refs.join(modelo, on="horizonte")
        .select("horizonte", "referencia", skill_desvio=s("desvio_m", "desvio"), skill_mae=s("mae_m", "mae"))
        .sort("horizonte", "referencia")
    )


def _pct(v: float | None) -> str:
    return "—" if v is None else f"{v:+.1%}".replace(".", ",")


def _num(v: float | None, d: int = 3) -> str:
    return "—" if v is None else f"{v:.{d}f}".replace(".", ",")


def informe(med: pl.DataFrame) -> str:
    """Tablas en Markdown: métricas por horizonte y predicción, y skill del modelo contra cada referencia."""
    lineas = [
        "| Plazo | Predicción | Desvío de Poisson | MAE | Recall | Precisión | Precisión 10 % "
        "| Captura 10 % |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in med.sort("horizonte").iter_rows(named=True):
        lineas.append(
            f"| {r['horizonte']} | {r['prediccion']} | {_num(r['desvio'])} | {_num(r['mae'])} | "
            f"{_num(r['recall'], 2)} | {_num(r['precision'], 2)} | {_num(r['precision_top'], 2)} | "
            f"{_num(r['captura_top'], 2)} |"
        )
    s = skill(med)
    lineas += ["", "| Plazo | Contra | Skill en desvío | Skill en MAE |", "|---|---|---|---|"]
    lineas += [
        f"| {r['horizonte']} | {r['referencia']} | {_pct(r['skill_desvio'])} | {_pct(r['skill_mae'])} |"
        for r in s.iter_rows(named=True)
    ]
    filas_ = med.group_by("horizonte").agg(pl.col("filas", "descartadas").first()).sort("horizonte")
    lineas += [
        "",
        "Filas por plazo (las que no tienen persistencia se descartan para todas): "
        + "; ".join(f"{h}: {f} ({d} descartadas)" for h, f, d in filas_.rows())
        + ".",
    ]
    return "\n".join(lineas)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Medición de la predicción con desvío, detección y referencias (R-B1)"
    )
    p.add_argument("--entrenamiento", type=Path, required=True, help="entrenamiento.parquet publicado")
    args = p.parse_args(argv)
    m = leer_entrenamiento(args.entrenamiento)
    prueba = prueba_con_referencias(m)
    desde, hasta = prueba["emision"].min(), prueba["emision"].max()
    print(f"prueba: emisiones {desde:%Y-%m} a {hasta:%Y-%m}, horizontes {HORIZONTES}")
    print(informe(medir(prueba)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
