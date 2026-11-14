"""GET /forecast: días con fuego esperados por celda para los próximos meses (RF-PRE-01, RF-PRE-02, D-10).

Lee `prediccion.parquet` (packages/contracts/datos/esquema.md). Solo se publican los plazos que superan a la
climatología: si el archivo no está o no trae el plazo pedido, no hay predicción (404 `sin_prediccion`).
"""

from typing import Annotated

from fastapi import APIRouter, Query

from api.datos import archivos, conexion
from api.errores import ErrorDeContrato
from api.hotspots import leer_bbox

router = APIRouter()

SIN_PREDICCION = "Para ese plazo el modelo no supera a lo habitual, así que no mostramos predicción."


@router.get("/forecast", operation_id="getForecast", tags=["historico"])
def pronostico(
    bbox: Annotated[str, Query(description="oeste,sur,este,norte en grados decimales")],
    months: Annotated[int, Query(ge=1, le=3)] = 1,
) -> dict:
    oeste, sur, este, norte = leer_bbox(bbox)
    rutas = archivos("prediccion", opcional=True)
    if not rutas:
        raise ErrorDeContrato(404, "sin_prediccion", SIN_PREDICCION)
    con = conexion()
    modelo, mejora = con.execute(
        "SELECT any_value(model), any_value(skill_vs_climatology)::DOUBLE "
        "FROM read_parquet(?, union_by_name = true) WHERE horizon = ?",
        [rutas, months],
    ).fetchone()
    if modelo is None:
        raise ErrorDeContrato(404, "sin_prediccion", SIN_PREDICCION)
    # cell_id es la esquina suroeste "<lat>_<lon>": la celda toca el bbox si esa esquina está a menos de 0,1°.
    filas = con.execute(
        """
        WITH p AS (
            SELECT *, split_part(cell_id, '_', 1)::DOUBLE AS lat, split_part(cell_id, '_', 2)::DOUBLE AS lon
            FROM read_parquet(?, union_by_name = true)
            WHERE horizon = ?
        )
        SELECT cell_id, month, expected_fire_days::DOUBLE, p10::DOUBLE, p90::DOUBLE FROM p
        WHERE lat > ? - 0.1 AND lat <= ? AND lon > ? - 0.1 AND lon <= ?
        ORDER BY cell_id
        """,
        [rutas, months, sur, norte, oeste, este],
    ).fetchall()
    celdas = [
        {"cell_id": celda, "month": mes, "expected_fire_days": esperado, "p10": p10, "p90": p90}
        for celda, mes, esperado, p10, p90 in filas
    ]
    return {"model": modelo, "skill_vs_climatology": mejora, "cells": celdas}
