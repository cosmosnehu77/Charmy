"""Genera las muestras de data/muestras/ con el esquema de packages/contracts/datos/esquema.md.

- focos y dia-juego: focos reales, recortados de los CSV de FIRMS que se le pasan.
- serie, calendario y metricas: valores PROVISORIOS (provisional = true) hasta que exista la armonización
  (F2-B1, F2-B2). Tienen la forma final pero los números son de ejemplo.

Uso: uv run --package pipeline python -m pipeline.muestras <csv>... --out data/muestras --dia 2026-11-12
"""

import argparse
import json
import math
import random
import sys
from datetime import date
from pathlib import Path

import polars as pl

from pipeline.armonizacion import calendario
from pipeline.firms import cargar

# Sur de Argentina y Chile: oeste, sur, este, norte. Con el borde este en -62 no entra ningún otro país.
BBOX = (-76.0, -56.0, -62.0, -35.0)
REGIONES = {"AR-U": 40.0, "CL-AR": 25.0}  # Chubut y Araucanía (ISO 3166-2); valor base de ejemplo
ANIOS = range(2001, 2027)
ULTIMO = (2026, 10)


def recortar(df: pl.DataFrame) -> pl.DataFrame:
    o, s, e, n = BBOX
    return df.filter(pl.col("longitude").is_between(o, e) & pl.col("latitude").is_between(s, n))


def a_geojson(df: pl.DataFrame) -> dict:
    """FeatureCollection con [longitude, latitude] y el resto de las columnas en properties."""
    features = []
    for i, f in enumerate(df.iter_rows(named=True)):
        props = {k: v for k, v in f.items() if k not in ("latitude", "longitude")}
        props["acq_datetime"] = f["acq_datetime"].isoformat().replace("+00:00", "Z")
        features.append(
            {
                "type": "Feature",
                "id": f"{f['satellite']}-{i}",
                "geometry": {"type": "Point", "coordinates": [f["longitude"], f["latitude"]]},
                "properties": props,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def dia_juego(df: pl.DataFrame, dia: date) -> dict:
    """Focos VIIRS de un día real, con lo justo para el juego."""
    d = df.filter((pl.col("acq_datetime").dt.date() == dia) & (pl.col("instrument") == "VIIRS"))
    if d.is_empty():
        raise ValueError(f"No hay focos VIIRS el {dia} dentro del recorte")
    return {
        "fecha": dia.isoformat(),
        "fuente": "NASA FIRMS, VIIRS NOAA-20 y NOAA-21 (NRT)",
        "provisional": False,
        "bbox": list(BBOX),
        "focos": [
            {
                "lat": f["latitude"],
                "lon": f["longitude"],
                "hora_utc": f["acq_datetime"].strftime("%H:%M"),
                "frp": f["frp"],
                "confidence": f["confidence"],
            }
            for f in d.sort("acq_datetime").iter_rows(named=True)
        ],
    }


def serie_provisoria() -> pl.DataFrame:
    """Serie mensual de ejemplo: pico en el verano austral, MODIS hasta 2011 convertido y VIIRS después."""
    rnd = random.Random(16)
    filas = []
    for region, base in REGIONES.items():
        for anio in ANIOS:
            for mes in range(1, 13):
                if (anio, mes) > ULTIMO:
                    break
                estacion = 1 + 0.9 * math.cos(2 * math.pi * (mes - 1.5) / 12)
                viirs = round(base * estacion * rnd.uniform(0.5, 1.6), 1)
                modis = round(viirs / 2.3 * rnd.uniform(0.85, 1.15), 1)  # MODIS ve menos días-celda
                medido = anio >= 2012
                filas.append((region, anio, mes, "modis", modis, modis, modis, "modis_medido"))
                if medido:
                    filas.append((region, anio, mes, "viirs", viirs, viirs, viirs, "viirs_medido"))
                ancho = 0.08 if medido else 0.25
                filas.append(
                    (
                        region,
                        anio,
                        mes,
                        "harmonized",
                        viirs,
                        round(viirs * (1 - ancho), 1),
                        round(viirs * (1 + ancho), 1),
                        "viirs_medido" if medido else "modis_convertido",
                    )
                )
    cols = ["region", "year", "month", "source", "value", "lower", "upper", "origin"]
    return (
        pl.DataFrame(filas, schema=cols, orient="row")
        .with_columns(pl.col("year").cast(pl.Int16), pl.col("month").cast(pl.Int8), provisional=pl.lit(True))
        .sort("region", "source", "year", "month")
    )


def metricas_provisorias() -> pl.DataFrame:
    filas = [
        ("AR-U", "modis_snpp", 0.81, -0.04, 3.2, 174),
        ("AR-U", "noaa20_snpp", 0.93, 0.01, 1.4, 99),
        ("CL-AR", "modis_snpp", 0.76, 0.06, 2.7, 174),
        ("CL-AR", "noaa20_snpp", 0.91, -0.02, 1.1, 99),
    ]
    return pl.DataFrame(
        filas, schema=["region", "pair", "r2", "bias", "mae", "n_months"], orient="row"
    ).with_columns(pl.col("n_months").cast(pl.Int32), provisional=pl.lit(True))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Genera data/muestras")
    p.add_argument("csv", nargs="+", type=Path)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--dia", type=date.fromisoformat, required=True, help="Día real para el juego")
    args = p.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)

    focos = recortar(cargar(args.csv))
    focos.with_columns(year=pl.col("acq_datetime").dt.year()).write_parquet(args.out / "focos.parquet")
    (args.out / "focos.geojson").write_text(json.dumps(a_geojson(focos), ensure_ascii=False))
    (args.out / "dia-juego.json").write_text(
        json.dumps(dia_juego(focos, args.dia), ensure_ascii=False, indent=1)
    )

    serie = serie_provisoria()
    serie.write_parquet(args.out / "serie.parquet")
    calendario(serie).write_parquet(args.out / "calendario.parquet")
    metricas_provisorias().write_parquet(args.out / "metricas.parquet")
    print(f"{focos.height} focos reales; serie, calendario y metricas provisorias en {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
