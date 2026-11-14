"""Corre la comparación real: TimesFM 2.5 contra LightGBM sobre la tabla `entrenamiento` publicada.

Uso (necesita el extra pesado, que trae torch):
uv run --package prediccion --extra timesfm python -m prediccion \
    --entrenamiento entrenamiento.parquet --out salida

Escribe `prediccion.parquet` (modelo timesfm-2.5) solo para los horizontes en que TimesFM le gana a la
climatología y a LightGBM. Si no gana ninguno, no escribe nada y queda la predicción de LightGBM.
"""

import argparse
import json
import sys
from pathlib import Path

from pipeline.prediccion import entrenar_y_validar

from prediccion.comparar import comparar, leer_entrenamiento

PESOS = "google/timesfm-2.5-200m-pytorch"  # Apache-2.0. La 3.0 no: sus pesos son no comerciales (D-31).


def cargar_timesfm():
    """Carga TimesFM 2.5 (baja los pesos la primera vez). Se importa solo acá: las pruebas usan uno falso."""
    import timesfm
    import torch

    torch.set_float32_matmul_precision("high")
    modelo = timesfm.TimesFM_2p5_200M_torch.from_pretrained(PESOS)
    modelo.compile(
        timesfm.ForecastConfig(
            max_context=512,
            max_horizon=128,
            normalize_inputs=True,
            per_core_batch_size=256,
            use_continuous_quantile_head=True,
            force_flip_invariance=True,
            infer_is_positive=True,
            fix_quantile_crossing=True,
        )
    )
    return modelo


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="TimesFM 2.5 contra LightGBM con la compuerta D-10")
    p.add_argument("--entrenamiento", type=Path, required=True, help="entrenamiento.parquet (F3-B5)")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)

    m = leer_entrenamiento(args.entrenamiento)
    print(f"{m['cell_id'].n_unique()} celdas, {m['mes'].min()} a {m['mes'].max()}")
    vigente = entrenar_y_validar(m).mejora
    print("LightGBM, mejora sobre la climatología:", vigente)
    r = comparar(m, cargar_timesfm(), mejora_vigente=vigente)
    print("TimesFM 2.5, mejora sobre la climatología:", r.mejora)

    args.out.mkdir(parents=True, exist_ok=True)
    resumen = {"emisiones_de_prueba": [str(e) for e in r.emisiones], "lightgbm": vigente, "timesfm": r.mejora}
    (args.out / "comparacion.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    if r.prediccion.is_empty():
        print("TimesFM no le gana a LightGBM en ningún horizonte: queda LightGBM (D-31)")
        return 0
    r.prediccion.write_parquet(args.out / "prediccion.parquet")
    horizontes = sorted(set(r.prediccion["horizon"].to_list()))
    print(f"TimesFM gana en los horizontes {horizontes}: {r.prediccion.height} filas en prediccion.parquet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
