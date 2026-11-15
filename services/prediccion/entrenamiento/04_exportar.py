"""Paso 4: arma los archivos que se publican en el Release y que baja services/prediccion (servir.py).

  modelo.json            manifiesto: variables, períodos, métricas, calibración y κ por plazo, y el SHA-256
                         de cada uno de los otros archivos
  modelo-h1..h6.txt      un LightGBM por plazo, en su formato nativo
  entradas-AAAA-MM.npz   las variables de cada celda en el mes de emisión, y lo habitual para cada mes

Uso: uv run --package prediccion python services/prediccion/entrenamiento/04_exportar.py
"""

import hashlib
import importlib.util
import json
import shutil
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
SALIDAS = AQUI / "salidas"
DESTINO = SALIDAS / "release"
NOMBRE = "charmy-eventos-v1"

spec = importlib.util.spec_from_file_location("modelo", AQUI / "02_modelo.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def sha(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def main() -> None:
    DESTINO.mkdir(exist_ok=True)
    metricas = json.loads((SALIDAS / "metricas.json").read_text())
    assert metricas["variables"] == ["sat"], "las métricas guardadas no son las del modelo sin clima"
    celdas, lat, lon, mats, T = mod.cargar()
    V = mod.Variables(
        celdas, lat, lon, mats, T, metricas["evento"], extra=max(mod.HORIZONTES), grupos=("sat",)
    )
    emision = mod.mes_de(T - 1)
    x = np.stack([V.bloque(T - 1, h) for h in mod.HORIZONTES])
    habitual = np.nan_to_num(x[:, :, V.NOMBRES.index("clim_ev")])
    entradas = DESTINO / f"entradas-{emision}.npz"
    np.savez_compressed(
        entradas,
        cell_id=celdas["cell_id"].to_numpy().astype(str),
        lat=np.round(lat + 0.05, 2),  # centro de la celda
        lon=np.round(lon + 0.05, 2),
        region=celdas["region"].to_numpy().astype(str),
        x=x.astype(np.float32),
        habitual=habitual.astype(np.float32),
    )
    horizontes = []
    for h in mod.HORIZONTES:
        archivo = f"modelo-h{h}.txt"
        shutil.copy(SALIDAS / archivo, DESTINO / archivo)
        m, area = metricas["horizontes"][str(h)], metricas["area"][str(h)]
        kappa = {"9": area["0.3°"]["kappa"], "25": area["0.5°"]["kappa"], "100": area["1.0°"]["kappa"]}
        kappa |= {"400": area["2.0°"]["kappa"], "provincia": area["provincia"]["kappa"]}
        horizontes.append(
            {
                "horizonte": h,
                "mes": mod.mes_de(T - 1 + h),
                "archivo": archivo,
                "sha256": sha(DESTINO / archivo),
                "calibracion": json.loads((SALIDAS / f"calibracion-h{h}.json").read_text()),
                "kappa": kappa,
                "mejora_vs_climatologia": m["mejora_brier"],
                "auc": m["auc"],
                "auc_climatologia": m["auc_clim"],
                "top10_captura": m["top10_captura"],
                "top10_captura_climatologia": m["top10_captura_clim"],
                "mejora_por_anio": metricas["por_anio"][str(h)],
            }
        )
    manifiesto = {
        "modelo": NOMBRE,
        "entrenado": "2026-11-15",
        "emision": emision,
        "evento": (
            "al menos un foco VIIRS de confianza alta, o fuego en 2 o más días del mes, en una celda de 0,1°"
        ),
        "unidad": "probabilidad (0 a 1) de al menos un evento en el mes",
        "sensores": (
            "evento: VIIRS S-NPP; variables: S-NPP, NOAA-20, NOAA-21 y MODIS (Terra y Aqua). Sin clima."
        ),
        "datos": "datos-2026-11-14c",
        "entrenamiento": {"objetivos_desde": "2013-03", "objetivos_hasta": emision},
        "prueba": {
            "objetivos": metricas["prueba"],
            "entrenado_hasta": "2023-10",
            "referencia": "climatología por celda y mes del año (compuerta D-10)",
            "metrica": "mejora relativa del Brier frente a la climatología",
        },
        "variables": V.NOMBRES,
        "entradas": {"archivo": entradas.name, "sha256": sha(entradas), "celdas": celdas.height},
        "horizontes": horizontes,
    }
    (DESTINO / "modelo.json").write_text(json.dumps(manifiesto, indent=1, ensure_ascii=False))
    for ruta in sorted(DESTINO.iterdir()):
        print(f"{sha(ruta)}  {ruta.name}  {ruta.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
