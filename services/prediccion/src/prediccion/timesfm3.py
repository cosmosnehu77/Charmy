"""TimesFM 3.0 con la interfaz de la comparación (`Pronosticador`): mediana y cuantiles [media, q10..q90].

La 3.0 viene en el paquete `timesfm3` (dentro de `timesfm` 3.0.2) y se usa con `TimesFM3Forecaster`. Sus pesos
(`google/timesfm-3.0-pytorch`) tienen licencia TimesFM Non-Commercial v1.0: se usan acá para evaluar.
"""

import numpy as np


class Adaptador3:
    """Envuelve un `TimesFM3Forecaster` (o cualquier objeto con su `predict_batch`)."""

    def __init__(self, forecaster):
        self.forecaster = forecaster

    def forecast(self, horizon: int, inputs: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
        salidas = list(
            self.forecaster.predict_batch(
                contexts=list(inputs), horizon=horizon, return_quantiles=True, make_positive=True
            )
        )
        punto = np.stack([np.asarray(s.forecast, dtype=float).reshape(-1)[:horizon] for s in salidas])
        nueve = np.stack([np.asarray(s.quantiles, dtype=float).reshape(-1, 9)[:horizon] for s in salidas])
        # Orden de TimesFM 2.5: posición 0 la mediana (allá, la media), 1..9 los cuantiles 0,1..0,9.
        cuantiles = np.concatenate([punto[:, :, None], nueve], axis=2)
        return punto, cuantiles


def cargar(dispositivo: str | None = None):
    """Carga TimesFM 3.0 (baja los pesos la primera vez). Se importa solo acá: las pruebas usan uno falso."""
    from timesfm3.torch.timesfm3_forecaster import TimesFM3Forecaster

    return Adaptador3(
        TimesFM3Forecaster.from_pretrained(
            "google/timesfm-3.0-pytorch", device=dispositivo, per_core_batch_size=64
        )
    )
