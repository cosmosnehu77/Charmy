"""POST /calendar y GET /harmonization/metrics (RF-CAL-01, RF-CAL-02, RF-ARM-04).

Las tablas `calendario` y `metricas` vienen por región de calibración (packages/contracts/datos/esquema.md).
Un polígono se asigna a la región de `regiones.geojson` con la que comparte más superficie.
"""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, field_validator
from shapely.geometry import shape

from api.datos import archivos, conexion, geojson
from api.errores import ErrorDeContrato

router = APIRouter()

UNIDAD = "dias_celda_con_fuego_equivalente_viirs"
BASE = "mediana del mismo mes en los años anteriores al último"
FUERA_DE_COBERTURA = "Sin datos para esta área: está fuera de la cobertura."
SOLAPAMIENTO = "modis_snpp 2012-01/2026-07; noaa20_snpp 2018-04/2026-07"


class Poligono(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]

    @field_validator("coordinates")
    @classmethod
    def anillo_valido(cls, anillos: list[list[list[float]]]) -> list[list[list[float]]]:
        if not anillos or len(anillos[0]) < 4 or anillos[0][0] != anillos[0][-1]:
            raise ValueError("el anillo exterior necesita al menos 4 puntos y cerrar en el primero")
        for punto in anillos[0]:
            if len(punto) != 2 or not (-180 <= punto[0] <= 180 and -90 <= punto[1] <= 90):
                raise ValueError("cada punto es [longitud, latitud] en grados")
        return anillos


class PedidoCalendario(BaseModel):
    area: Poligono
    from_year: int = 2001
    to_year: int | None = None
    resolution: Literal["month", "day_of_year"] = "month"


def region_de(poligono: Poligono) -> str | None:
    area = shape(poligono.model_dump())
    if not area.is_valid:
        raise ErrorDeContrato(400, "poligono_invalido", "El área se cruza consigo misma. Dibujala de nuevo.")
    mejor, mejor_area = None, 0.0
    for region in geojson("regiones")["features"]:
        geometria = shape(region["geometry"])
        if geometria.intersects(area):
            comun = geometria.intersection(area).area
            if comun > mejor_area:
                mejor, mejor_area = region["properties"]["region"], comun
    return mejor


@router.post("/calendar", operation_id="getCalendar", tags=["historico"])
def calendario(pedido: PedidoCalendario) -> dict:
    if pedido.resolution == "day_of_year":
        raise ErrorDeContrato(
            400, "resolucion_no_disponible", "Por ahora el calendario está disponible solo por mes."
        )
    if pedido.to_year is not None and pedido.to_year < pedido.from_year:
        raise ErrorDeContrato(400, "anios_invalidos", "El año de inicio tiene que ir antes que el de fin.")

    region = region_de(pedido.area)
    if region is None:
        respuesta = {"unit": UNIDAD, "baseline": BASE, "provisional": False}
        return respuesta | {"message": FUERA_DE_COBERTURA, "cells": []}

    consulta = """
        SELECT year, month, value, lower, upper, median, anomaly, percentile, origin, provisional
        FROM read_parquet(?, union_by_name = true)
        WHERE region = ? AND year >= ? AND year <= ?
        ORDER BY year, month
    """
    filas = (
        conexion()
        .execute(consulta, [archivos("calendario"), region, pedido.from_year, pedido.to_year or 9999])
        .fetchall()
    )
    if not filas:
        sin_datos = f"Todavía no hay calendario para la región {region} en esos años."
        respuesta = {"unit": UNIDAD, "baseline": BASE, "region": region, "provisional": False}
        return respuesta | {"message": sin_datos, "cells": []}

    celdas = []
    for anio, mes, valor, inferior, superior, mediana, anomalia, percentil, origen, _ in filas:
        celda = {"year": anio, "month": mes, "value": valor, "median": mediana, "anomaly": anomalia}
        celda["percentile"], celda["origin"] = percentil, origen
        if inferior is not None and superior is not None:
            celda["lower"], celda["upper"] = inferior, superior
        celdas.append(celda)

    provisorio = any(fila[-1] for fila in filas)
    return {"unit": UNIDAD, "baseline": BASE, "region": region, "provisional": provisorio, "cells": celdas}


@router.get("/harmonization/metrics", operation_id="getHarmonizationMetrics", tags=["meta"])
def metricas() -> dict:
    filas = (
        conexion()
        .execute(
            """
            SELECT region, pair, r2, bias, mae, n_months, provisional
            FROM read_parquet(?, union_by_name = true)
            ORDER BY region, pair
            """,
            [archivos("metricas")],
        )
        .fetchall()
    )
    metodo = (
        "calibración en cadena MODIS → VIIRS S-NPP y NOAA-20 → S-NPP por región y mes, "
        "validada dejando un año afuera (D-03)"
    )
    return {
        "method": metodo,
        "overlap": SOLAPAMIENTO,
        "regions": [
            {"region": region, "pair": par, "r2": r2, "bias": sesgo, "mae": mae, "n_months": meses}
            | {"provisional": provisorio}
            for region, par, r2, sesgo, mae, meses, provisorio in filas
        ],
    }
