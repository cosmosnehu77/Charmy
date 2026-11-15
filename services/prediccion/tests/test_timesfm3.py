"""El adaptador de TimesFM 3.0 a la interfaz de la comparación. Pronosticador falso: sin pesos ni red."""

from dataclasses import dataclass

import numpy as np
from prediccion.timesfm3 import Adaptador3


@dataclass
class Salida:
    forecast: np.ndarray
    quantiles: np.ndarray


class Falso3:
    """Imita TimesFM3Forecaster.predict_batch: por serie, mediana (h,) y nueve cuantiles 0,1..0,9 (h, 9)."""

    def __init__(self):
        self.pedidos = []

    def predict_batch(self, contexts, horizon, return_quantiles=False, make_positive=False, **_):
        self.pedidos.append((len(contexts), horizon, return_quantiles, make_positive))
        for c in contexts:
            base = float(c[-1])
            q = np.array([[base + k for k in range(9)] for _ in range(horizon)], dtype=float)
            yield Salida(forecast=q[:, 4], quantiles=q)


def test_traduce_a_mediana_y_cuantiles_con_q10_en_1_y_q90_en_9():
    falso = Falso3()
    punto, cuantiles = Adaptador3(falso).forecast(horizon=3, inputs=[np.array([0, 2.0]), np.array([5.0])])
    assert punto.shape == (2, 3)
    assert cuantiles.shape == (2, 3, 10)
    assert punto[0, 0] == 2.0 + 4  # mediana
    assert cuantiles[0, 0, 1] == 2.0  # q10
    assert cuantiles[1, 2, 9] == 5.0 + 8  # q90
    # Pide cuantiles y valores no negativos (son conteos de días con fuego).
    assert falso.pedidos == [(2, 3, True, True)]
