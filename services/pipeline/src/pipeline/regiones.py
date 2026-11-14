"""Regiones de calibración: provincias de Argentina y regiones de Chile, con código ISO 3166-2.

Fuente: Natural Earth, admin 1 a 1:10m (dominio público), simplificada. Se genera una vez:
uv run --package pipeline python -m pipeline.regiones <ne_10m_admin_1_states_provinces.geojson> \
  --out regiones.geojson
"""

import argparse
import json
import sys
from pathlib import Path

import polars as pl
import shapely
from shapely.geometry import box, mapping, shape

PAISES = {"ARG": "Argentina", "CHL": "Chile"}
UNIR = {"AR-C": "AR-B"}  # CABA es más chica que una celda de 0,1°: va con Buenos Aires
CONTINENTE = box(-80, -60, -50, -15)  # deja afuera la Antártida y las islas oceánicas lejanas
TOLERANCIA = 0.01  # grados; ~1 km, de sobra para celdas de 0,1°


def desde_natural_earth(ruta: Path) -> dict:
    datos = json.loads(ruta.read_text())
    grupos: dict[str, dict] = {}
    for f in datos["features"]:
        p = f["properties"]
        if p.get("adm0_a3") not in PAISES:
            continue
        codigo = UNIR.get(p["iso_3166_2"], p["iso_3166_2"])
        g = grupos.setdefault(codigo, {"geoms": [], "nombre": p["name"], "pais": PAISES[p["adm0_a3"]]})
        g["geoms"].append(shape(f["geometry"]))
        if codigo == p["iso_3166_2"]:
            g["nombre"] = p["name"]
    features = []
    for codigo in sorted(grupos):
        g = grupos[codigo]
        geom = shapely.union_all(g["geoms"]).intersection(CONTINENTE).simplify(TOLERANCIA)
        features.append(
            {
                "type": "Feature",
                "id": codigo,
                "properties": {"region": codigo, "nombre": g["nombre"], "pais": g["pais"]},
                "geometry": mapping(shapely.set_precision(geom, 0.0001)),
            }
        )
    return {"type": "FeatureCollection", "features": features}


def region_de_celdas(cell_ids: pl.Series, regiones: dict) -> pl.DataFrame:
    """Asigna cada celda a la región que contiene su centro. Las celdas fuera de toda región quedan afuera."""
    codigos = [f["properties"]["region"] for f in regiones["features"]]
    geoms = [shape(f["geometry"]) for f in regiones["features"]]
    celdas = cell_ids.unique().sort()
    sw = celdas.str.split_exact("_", 1).struct.unnest()
    lat = sw["field_0"].cast(pl.Float64).to_numpy() + 0.05
    lon = sw["field_1"].cast(pl.Float64).to_numpy() + 0.05
    centros = shapely.points(lon, lat)
    idx_centro, idx_region = shapely.STRtree(geoms).query(centros, predicate="within")
    return pl.DataFrame(
        {"cell_id": celdas.gather(idx_centro), "region": [codigos[i] for i in idx_region]},
        schema={"cell_id": pl.String, "region": pl.String},
    ).unique("cell_id", keep="first")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Regiones de calibración desde Natural Earth")
    p.add_argument("natural_earth", type=Path)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    regiones = desde_natural_earth(args.natural_earth)
    args.out.write_text(json.dumps(regiones, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(regiones['features'])} regiones en {args.out} ({args.out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
