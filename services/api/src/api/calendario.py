"""POST /calendar y GET /harmonization/metrics (RF-CAL-01, RF-CAL-02, RF-ARM-04).

Las tablas `calendario` y `metricas` vienen por región de calibración (packages/contracts/datos/esquema.md).
Un polígono se asigna a la región cuya caja se superpone más con la suya.
"""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from api.datos import archivos, conexion
from api.errores import ErrorDeContrato

router = APIRouter()

# PROVISORIO: cajas aproximadas (oeste, sur, este, norte) de las regiones de las muestras, hasta que el
# carril B publique sus geometrías. Chubut (AR-U) y Araucanía (CL-AR).
REGIONES = {
    "AR-U": (-72.2, -46.0, -63.5, -42.0),
    "CL-AR": (-73.7, -39.7, -70.8, -37.5),
}
UNIDAD = "dias_celda_con_fuego_equivalente_viirs"
FUERA_DE_COBERTURA = "Sin datos para esta área: está fuera de la cobertura."
AVISO_PROVISORIO = " (valores provisorios de ejemplo, no son resultados)"


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
    longitudes = [p[0] for p in poligono.coordinates[0]]
    latitudes = [p[1] for p in poligono.coordinates[0]]
    oeste, sur, este, norte = min(longitudes), min(latitudes), max(longitudes), max(latitudes)
    mejor, mejor_area = None, 0.0
    for region, (r_oeste, r_sur, r_este, r_norte) in REGIONES.items():
        ancho = min(este, r_este) - max(oeste, r_oeste)
        alto = min(norte, r_norte) - max(sur, r_sur)
        if ancho > 0 and alto > 0 and ancho * alto > mejor_area:
            mejor, mejor_area = region, ancho * alto
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
        return {"unit": UNIDAD, "baseline": FUERA_DE_COBERTURA, "cells": []}

    consulta = """
        SELECT year, month, value, lower, upper, median, percentile, origin, provisional
        FROM read_parquet(?, union_by_name = true)
        WHERE region = ? AND year >= ? AND year <= ?
        ORDER BY year, month
    """
    filas = (
        conexion()
        .execute(consulta, [archivos("calendario"), region, pedido.from_year, pedido.to_year or 9999])
        .fetchall()
    )

    celdas = []
    for anio, mes, valor, inferior, superior, mediana, percentil, origen, _ in filas:
        celda = {"year": anio, "month": mes, "value": valor, "median": mediana, "percentile": percentil}
        celda["origin"] = origen
        if inferior is not None and superior is not None:
            celda["lower"], celda["upper"] = inferior, superior
        celdas.append(celda)

    provisorio = any(fila[-1] for fila in filas)
    baseline = f"mediana histórica de cada mes, región {region}" + (AVISO_PROVISORIO if provisorio else "")
    return {"unit": UNIDAD, "baseline": baseline, "cells": celdas}


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
    provisorio = any(fila[-1] for fila in filas)
    metodo = (
        "calibración en cadena MODIS → VIIRS S-NPP y NOAA-20 → S-NPP por región y mes, "
        "validada dejando un año afuera (D-03)"
    )
    return {
        "method": metodo + (AVISO_PROVISORIO if provisorio else ""),
        "overlap": "MODIS y S-NPP 2012-2026; NOAA-20 y S-NPP 2018-2026",
        "regions": [
            {"region": f"{region} {par}", "r2": r2, "bias": sesgo, "mae": mae, "n_months": meses}
            for region, par, r2, sesgo, mae, meses, _ in filas
        ],
    }
