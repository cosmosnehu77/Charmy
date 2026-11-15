"""Corre la comparación real: TimesFM contra LightGBM sobre la tabla `entrenamiento` publicada (R-E2, #253).

Por defecto usa TimesFM 3.0, el candidato de D-31; `--modelo 2.5` queda para comparar.
Uso (necesita el extra pesado, que trae torch):
uv run --package prediccion --extra timesfm python -m prediccion \
    --entrenamiento entrenamiento.parquet --out salida

Escribe `comparacion.json` con la versión usada y, solo para los horizontes en que TimesFM le gana a la
climatología, a LightGBM y a las referencias triviales, `prediccion.parquet`.
Si no gana en ninguno, queda LightGBM.
"""

import argparse
import json
import sys
from pathlib import Path

from prediccion.comparar import comparar, mejora_lightgbm
from prediccion.modelo import leer_entrenamiento

PESOS_2_5 = "google/timesfm-2.5-200m-pytorch"  # Apache-2.0. Los de la 3.0 están en prediccion.timesfm3.


def cargar_timesfm_2_5():
    """Carga TimesFM 2.5 (baja los pesos la primera vez). Se importa solo acá: las pruebas usan uno falso."""
    import timesfm
    import torch

    torch.set_float32_matmul_precision("high")
    modelo = timesfm.TimesFM_2p5_200M_torch.from_pretrained(PESOS_2_5)
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


def cargar(version: str):
    """El modelo de TimesFM de esa versión, con la interfaz de la comparación."""
    if version == "3.0":
        from prediccion import timesfm3

        return timesfm3.cargar()
    return cargar_timesfm_2_5()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="TimesFM contra LightGBM con la compuerta D-10")
    p.add_argument("--entrenamiento", type=Path, required=True, help="entrenamiento.parquet (F3-B5)")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument(
        "--modelo",
        choices=["3.0", "2.5"],
        default="3.0",
        help="Versión de TimesFM (3.0, el candidato de D-31; 2.5 para comparar)",
    )
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
    modelo, nombre = cargar(args.modelo), f"timesfm-{args.modelo}"
    r = comparar(
        m,
        modelo,
        nombre=nombre,
        mejora_vigente=vigente,
        al_avanzar=lambda e: print("emisión", e, flush=True),
        celdas=celdas,
    )
    print(f"{nombre}, mejora sobre la climatología:", r.mejora)
    for referencia, ref in r.referencias.items():
        print(f"Referencia «{referencia}», mejora sobre la climatología:", ref)

    args.out.mkdir(parents=True, exist_ok=True)
    resumen = {
        "modelo": nombre,
        "celdas_prueba": len(celdas) if celdas else todas.len(),
        "emisiones_de_prueba": [str(e) for e in r.emisiones],
        "lightgbm": vigente,
        "timesfm": r.mejora,
        "referencias": r.referencias,
    }
    (args.out / "comparacion.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    if r.prediccion.is_empty():
        print(f"{nombre} no supera a LightGBM y a las referencias en ningún horizonte: queda LightGBM (D-31)")
        return 0
    r.prediccion.write_parquet(args.out / "prediccion.parquet")
    horizontes = sorted(set(r.prediccion["horizon"].to_list()))
    print(f"{nombre} gana en los horizontes {horizontes}: {r.prediccion.height} filas en prediccion.parquet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
