"""Paso 0: clima mensual de NASA POWER (MERRA-2, grilla de 0,5° × 0,625°) para Argentina y Chile.

Sin clave. La API regional da un parámetro por pedido y cajas de hasta 10°, así que son 12 cajas × 5
parámetros. Cada respuesta se guarda en datos/clima/ y no se vuelve a pedir. El mensual llega hasta
2026-09; octubre de 2026 sale del diario, promediado.

Uso: uv run --package prediccion python services/prediccion/entrenamiento/00_clima.py
"""

import json
import time
import urllib.request
from pathlib import Path

import polars as pl

AQUI = Path(__file__).parent
CACHE = AQUI / "datos" / "clima"
API = "https://power.larc.nasa.gov/api/temporal/{paso}/regional"
PARAMETROS = {
    "PRECTOTCORR": "lluvia",  # mm por día
    "T2M_MAX": "tmax",  # °C, media de las máximas
    "RH2M": "humedad",  # % de humedad relativa
    "WS2M": "viento",  # m/s
    "GWETROOT": "suelo",  # humedad del suelo en la zona de raíces, 0 a 1
}
LATS = [(-56, -46), (-46, -36), (-36, -26), (-26, -17)]
LONS = [(-76, -66), (-66, -56), (-56, -53)]
ANIOS = (1991, 2026)
DIARIO = ("20261001", "20261031")  # el mes que al mensual todavía le falta


def pedir(paso: str, parametro: str, lat: tuple, lon: tuple, desde, hasta) -> dict:
    ruta = CACHE / f"{paso}-{parametro}-{lat[0]}_{lon[0]}.json"
    if ruta.exists():
        return json.loads(ruta.read_text())
    url = (
        f"{API.format(paso=paso)}?parameters={parametro}&community=AG&format=JSON"
        f"&latitude-min={lat[0]}&latitude-max={lat[1]}&longitude-min={lon[0]}&longitude-max={lon[1]}"
        f"&start={desde}&end={hasta}"
    )
    for intento in range(4):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                datos = json.loads(r.read())
            break
        except Exception as e:  # la API a veces corta: se espera y se reintenta
            if intento == 3:
                raise
            print("  reintento:", e)
            time.sleep(20 * (intento + 1))
    if "features" not in datos:
        raise RuntimeError(f"{parametro} {lat} {lon}: {datos.get('messages')}")
    ruta.write_text(json.dumps(datos))
    time.sleep(1)
    return datos


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    tablas = []
    for parametro, nombre in PARAMETROS.items():
        filas = []
        for lat in LATS:
            for lon in LONS:
                print(parametro, lat, lon, flush=True)
                for f in pedir("monthly", parametro, lat, lon, *ANIOS)["features"]:
                    x, y = f["geometry"]["coordinates"][:2]
                    for clave, v in f["properties"]["parameter"][parametro].items():
                        if clave[4:] != "13" and v > -900:  # "13" es el promedio anual; -999 es sin dato
                            filas.append((y, x, f"{clave[:4]}-{clave[4:]}", v))
                for f in pedir("daily", parametro, lat, lon, *DIARIO)["features"]:
                    x, y = f["geometry"]["coordinates"][:2]
                    dias = [v for v in f["properties"]["parameter"][parametro].values() if v > -900]
                    if dias:
                        filas.append((y, x, f"{DIARIO[0][:4]}-{DIARIO[0][4:6]}", sum(dias) / len(dias)))
        t = pl.DataFrame(filas, schema=["lat", "lon", "mes", nombre], orient="row")
        # Las cajas comparten bordes, y si el mensual ya trae el mes del diario, vale el mensual (el primero).
        tablas.append(t.unique(["lat", "lon", "mes"], keep="first"))
    clima = tablas[0]
    for t in tablas[1:]:
        clima = clima.join(t, on=["lat", "lon", "mes"], how="full", coalesce=True)
    clima = clima.sort("lat", "lon", "mes")
    clima.write_parquet(AQUI / "salidas" / "clima.parquet")
    print(
        clima.shape,
        clima["mes"].min(),
        clima["mes"].max(),
        clima.select("lat", "lon").unique().height,
        "puntos",
    )
    print(clima.null_count())


if __name__ == "__main__":
    main()
