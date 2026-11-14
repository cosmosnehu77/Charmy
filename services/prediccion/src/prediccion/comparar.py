"""TimesFM 2.5 contra LightGBM con la compuerta D-10 (F3-E3, D-31).

Usa la misma tabla (`entrenamiento`, celda × mes de S-NPP sin fuentes fijas) y la misma partición temporal
que `pipeline.prediccion` (LightGBM): se prueba en las emisiones de los últimos años, con contextos que
terminan en el mes de emisión. TimesFM es preentrenado (zero-shot): no se entrena, solo se le da la historia
de cada celda.

Un horizonte se publica con TimesFM solo si supera a la climatología en más de MIN_MEJORA **y** supera a
LightGBM en la misma prueba. Si no, queda LightGBM (que publica `pipeline.prediccion`).
"""

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Protocol

import numpy as np
import polars as pl
from pipeline.esquema import ESQUEMAS
from pipeline.prediccion import HORIZONTES, MIN_MEJORA, filas, particion

MODELO = "timesfm-2.5"


class Pronosticador(Protocol):
    """La interfaz de `timesfm.TimesFM_2p5_200M_torch` que se usa: mediana y cuantiles [media, q10..q90]."""

    def forecast(self, horizon: int, inputs: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]: ...


@dataclass
class Resultado:
    prediccion: pl.DataFrame  # tabla `prediccion`; vacía si TimesFM no le gana a la climatología y a LightGBM
    mejora: dict[int, float]  # 1 - MAE TimesFM / MAE climatología, por horizonte
    mejora_vigente: dict[int, float]  # la de LightGBM, con la que se compara
    emisiones: list[date]  # meses de emisión de la prueba


def leer_entrenamiento(ruta: Path) -> pl.DataFrame:
    """La tabla publicada `entrenamiento` (cell_id, month 'AAAA-MM', fire_days) como (cell_id, mes, dias)."""
    t = pl.read_parquet(ruta)
    return t.select(
        "cell_id",
        mes=pl.col("month").str.to_date("%Y-%m"),
        dias=pl.col("fire_days").cast(pl.Float64),
    ).sort("cell_id", "mes")


def _pronosticar(modelo: Pronosticador, m: pl.DataFrame, emision: date) -> pl.DataFrame:
    """Pronóstico de todas las celdas emitido en `emision`, con la historia hasta ese mes inclusive."""
    hasta = m.filter(pl.col("mes") <= emision).sort("cell_id", "mes")
    series = hasta.group_by("cell_id", maintain_order=True).agg(pl.col("dias"))
    entradas = [np.asarray(s, dtype=np.float32) for s in series["dias"].to_list()]
    punto, cuantiles = modelo.forecast(horizon=max(HORIZONTES), inputs=entradas)
    filas_ = []
    for i, celda in enumerate(series["cell_id"].to_list()):
        for h in HORIZONTES:
            filas_.append(
                (
                    celda,
                    emision,
                    h,
                    float(punto[i, h - 1]),
                    float(cuantiles[i, h - 1, 1]),
                    float(cuantiles[i, h - 1, 9]),
                )
            )
    return pl.DataFrame(
        filas_,
        schema={
            "cell_id": pl.String,
            "emision": pl.Date,
            "horizonte": pl.Int8,
            "pred": pl.Float64,
            "q10": pl.Float64,
            "q90": pl.Float64,
        },
        orient="row",
    ).with_columns(pl.col("pred", "q10", "q90").clip(lower_bound=0))


def comparar(m: pl.DataFrame, modelo: Pronosticador, mejora_vigente: dict[int, float]) -> Resultado:
    """`m`: días con fuego por celda y mes. `mejora_vigente`: la de LightGBM en la misma prueba."""
    f = filas(m)
    _, prueba = particion(f)
    emisiones = sorted(set(prueba["emision"].to_list()))
    pronosticos = pl.concat([_pronosticar(modelo, m, e) for e in emisiones])
    p = prueba.join(pronosticos, on=["cell_id", "emision", "horizonte"], how="inner")

    mejora = {}
    for h in HORIZONTES:
        ph = p.filter(pl.col("horizonte") == h)
        mae_clim = (ph["y"] - ph["clim"]).abs().mean()
        mae_tfm = (ph["y"] - ph["pred"]).abs().mean()
        mejora[h] = round(1 - mae_tfm / mae_clim, 4) if mae_clim else 0.0
    ganan = [h for h in HORIZONTES if mejora[h] > MIN_MEJORA and mejora[h] > mejora_vigente.get(h, 0.0)]
    vacia = pl.DataFrame(schema=ESQUEMAS["prediccion"])
    if not ganan:
        return Resultado(vacia, mejora, mejora_vigente, emisiones)

    # Se emite desde el último mes conocido, con toda la historia.
    ultimo = m["mes"].max()
    futuro = _pronosticar(modelo, m, ultimo).filter(pl.col("horizonte").is_in(ganan))
    prediccion = futuro.select(
        "cell_id",
        month=pl.col("emision").dt.offset_by(pl.format("{}mo", pl.col("horizonte"))).dt.strftime("%Y-%m"),
        horizon="horizonte",
        expected_fire_days=pl.col("pred").round(2),
        # Los cuantiles de TimesFM vienen ordenados; igual se acota para que p10 <= esperado <= p90.
        p10=pl.min_horizontal("q10", "pred").round(2),
        p90=pl.max_horizontal("q90", "pred").round(2),
        skill_vs_climatology=pl.col("horizonte").replace_strict(mejora, return_dtype=pl.Float64),
        model=pl.lit(MODELO),
    )
    return Resultado(
        prediccion.cast(ESQUEMAS["prediccion"]).sort("cell_id", "horizon"), mejora, mejora_vigente, emisiones
    )
