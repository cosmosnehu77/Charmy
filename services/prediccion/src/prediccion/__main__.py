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

from prediccion.comparar import comparar, leer_entrenamiento, mejora_lightgbm

PESOS = "google/timesfm-2.5-200m-pytorch"  # Apache-2.0. La 3.0 no: sus pesos son no comerciales (D-31).


def cargar_timesfm():
    """Carga TimesFM 2.5 (baja los pesos la primera vez). Se importa solo acá: las pruebas usan uno falso."""
    import timesfm
    import torch

    torch.set_float32_matmul_precision("high")
    modelo = timesfm.TimesFM_2p5_200M_torch.from_pretrained(PESOS)
    modelo.compile(
        timesfm.ForecastConfig(
            max_context=192,  # la serie más larga tiene 177 meses: más contexto es relleno
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
    p.add_argument("--modelo", choices=["3.0", "2.5"], default="3.0", help="Versión de TimesFM")
    p.add_argument(
        "--celdas-prueba",
        type=int,
        default=3000,
        help="Celdas al azar (semilla fija) para la prueba; 0 = todas. TimesFM en CPU tarda.",
    )
    args = p.parse_args(argv)

    m = leer_entrenamiento(args.entrenamiento)
    print(f"{m['cell_id'].n_unique()} celdas, {m['mes'].min()} a {m['mes'].max()}")
    todas = m["cell_id"].unique().sort()
    celdas = None
    if 0 < args.celdas_prueba < todas.len():
        celdas = todas.sample(args.celdas_prueba, seed=0).to_list()
        print(f"prueba sobre {len(celdas)} celdas al azar (semilla 0)")
    vigente = mejora_lightgbm(m, celdas)
    print("LightGBM, mejora sobre la climatología:", vigente)
    if args.modelo == "3.0":
        from prediccion import timesfm3

        modelo, nombre = timesfm3.cargar(), "timesfm-3.0"
    else:
        modelo, nombre = cargar_timesfm(), "timesfm-2.5"
    r = comparar(
        m,
        modelo,
        nombre=nombre,
        mejora_vigente=vigente,
        al_avanzar=lambda e: print("emisión", e, flush=True),
        celdas=celdas,
    )
    print(f"{nombre}, mejora sobre la climatología:", r.mejora)
    for nombre, ref in r.referencias.items():
        print(f"Referencia «{nombre}», mejora sobre la climatología:", ref)

    args.out.mkdir(parents=True, exist_ok=True)
    resumen = {
        "celdas_prueba": len(celdas) if celdas else todas.len(),
        "emisiones_de_prueba": [str(e) for e in r.emisiones],
        "lightgbm": vigente,
        "timesfm": r.mejora,
        "referencias": r.referencias,
    }
    (args.out / "comparacion.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    if r.prediccion.is_empty():
        print("TimesFM no supera a LightGBM y a las referencias en ningún horizonte: queda LightGBM (D-31)")
        return 0
    r.prediccion.write_parquet(args.out / "prediccion.parquet")
    horizontes = sorted(set(r.prediccion["horizon"].to_list()))
    print(f"TimesFM gana en los horizontes {horizontes}: {r.prediccion.height} filas en prediccion.parquet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
