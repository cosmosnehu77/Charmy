"""Paso 1: de los focos armonizados a una tabla celda × mes con el evento a predecir.

Entrada: datos/focos--<satélite>-<año>.parquet de la versión de datos publicada: VIIRS (S-NPP, NOAA-20,
NOAA-21) y MODIS (Terra y Aqua, juntos). Sale una tabla por sensor.
Filtros: los de la armonización (D-04: vegetación, VIIRS nominal o alta) y sin celdas de fuentes fijas.

Por celda de 0,1° y mes deja:
  dias      días distintos con al menos un foco
  focos     cantidad de focos
  altos     focos de confianza alta
  frp_max   potencia radiativa máxima (MW)
  pico      máximo de focos en un mismo día (un racimo de píxeles)

Uso: uv run --package prediccion python services/prediccion/entrenamiento/01_tabla.py
"""

import json
from pathlib import Path

import polars as pl
from pipeline.armonizacion import filtrar
from pipeline.regiones import region_de_celdas

AQUI = Path(__file__).parent
DATOS = AQUI / "datos"
SALIDAS = AQUI / "salidas"
COLUMNAS = ["cell_id", "acq_datetime", "confidence", "instrument", "confidence_pct", "type", "frp"]


GRUPOS = {"N": ["N"], "N20": ["N20"], "N21": ["N21"], "MODIS": ["Terra", "Aqua"]}  # Terra y Aqua van juntos


def mensual(satelites: list[str], fijas: list[str]) -> pl.DataFrame:
    rutas = [r for s in satelites for r in DATOS.glob(f"focos--{s}-*.parquet")]
    partes = []
    for anio in sorted({r.stem[-4:] for r in rutas}):  # un año por vez: poca memoria
        del_anio = [pl.read_parquet(r, columns=COLUMNAS) for r in rutas if r.stem.endswith(anio)]
        f = filtrar(pl.concat(del_anio), fijas)
        por_dia = f.group_by("cell_id", dia=pl.col("acq_datetime").dt.date()).agg(
            focos=pl.len(), altos=(pl.col("confidence") == "high").sum(), frp_max=pl.col("frp").max()
        )
        partes.append(
            por_dia.group_by("cell_id", mes=pl.col("dia").dt.truncate("1mo")).agg(
                dias=pl.len().cast(pl.Int16),
                focos=pl.col("focos").sum().cast(pl.Int32),
                altos=pl.col("altos").sum().cast(pl.Int32),
                frp_max=pl.col("frp_max").max().cast(pl.Float32),
                pico=pl.col("focos").max().cast(pl.Int32),
            )
        )
    return pl.concat(partes).sort("cell_id", "mes")


def main() -> None:
    SALIDAS.mkdir(exist_ok=True)
    fijas = pl.read_csv(DATOS / "fuentes_fijas.csv")["cell_id"].to_list()
    regiones = json.loads((DATOS / "regiones.geojson").read_text())
    for satelite, miembros in GRUPOS.items():
        m = mensual(miembros, fijas)
        # Solo celdas cuyo centro cae en una provincia de Argentina o región de Chile.
        m = m.join(region_de_celdas(m["cell_id"], regiones), on="cell_id")
        m.write_parquet(SALIDAS / f"mensual-{satelite}.parquet")
        print(satelite, m.shape, m["cell_id"].n_unique(), "celdas", m["mes"].min(), m["mes"].max())


if __name__ == "__main__":
    main()
