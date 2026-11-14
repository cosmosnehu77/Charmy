"""Tipos de las tablas de packages/contracts/datos/esquema.md, para las pruebas de contrato."""

import polars as pl

_SERIE = {
    "region": pl.String,
    "year": pl.Int16,
    "month": pl.Int8,
    "value": pl.Float64,
    "lower": pl.Float64,
    "upper": pl.Float64,
    "origin": pl.String,
    "provisional": pl.Boolean,
}

ESQUEMAS = {
    "serie": {**_SERIE, "source": pl.String},
    "calendario": {**_SERIE, "median": pl.Float64, "anomaly": pl.Float64, "percentile": pl.Float64},
    "metricas": {
        "region": pl.String,
        "pair": pl.String,
        "r2": pl.Float64,
        "bias": pl.Float64,
        "mae": pl.Float64,
        "n_months": pl.Int32,
        "provisional": pl.Boolean,
    },
    "fuentes_fijas": {"cell_id": pl.String},
    "prediccion": {
        "cell_id": pl.String,
        "month": pl.String,
        "horizon": pl.Int8,
        "expected_fire_days": pl.Float64,
        "p10": pl.Float64,
        "p90": pl.Float64,
        "skill_vs_climatology": pl.Float64,
        "model": pl.String,
    },
}
