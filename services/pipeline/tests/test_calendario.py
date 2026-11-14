"""Pruebas mínimas de F2-B2 (#32). Sin servicios externos."""

import json
from datetime import UTC, datetime

import polars as pl
from pipeline.armonizacion import calendario, dias_celda_mensuales, main
from pipeline.esquema import ESQUEMAS


def serie_mano(valores):
    """Serie armonizada de una región y un mes (enero), un valor por año desde 2001."""
    n = len(valores)
    return pl.DataFrame(
        {
            "region": ["X"] * n,
            "year": pl.Series(range(2001, 2001 + n), dtype=pl.Int16),
            "month": pl.Series([1] * n, dtype=pl.Int8),
            "source": ["harmonized"] * n,
            "value": valores,
            "lower": valores,
            "upper": valores,
            "origin": ["viirs_medido"] * n,
            "provisional": [False] * n,
        }
    )


def test_anomalia_es_valor_menos_mediana_historica_del_mes():
    # 2001-2003 forman la historia (mediana 20); 2004 es el año en curso y no entra en su propia mediana.
    cal = calendario(serie_mano([10.0, 30.0, 20.0, 50.0])).sort("year")
    assert cal["median"].to_list() == [20.0] * 4
    assert cal["anomaly"].to_list() == [-10.0, 10.0, 0.0, 30.0]


def test_mes_sin_focos_vale_cero_y_no_falta():
    f = pl.DataFrame(
        {
            "satellite": ["N", "N"],
            "acq_datetime": [datetime(2020, 1, 5, tzinfo=UTC), datetime(2020, 3, 5, tzinfo=UTC)],
            "cell_id": ["-45.4_-71.3"] * 2,
        }
    )
    m = dias_celda_mensuales(f, pl.DataFrame({"cell_id": ["-45.4_-71.3"], "region": ["AR-U"]}))
    assert m.sort("month")["value"].to_list() == [1.0, 0.0, 1.0]


def test_region_sin_focos_aparece_con_ceros():
    f = pl.DataFrame(
        {"satellite": ["N"], "acq_datetime": [datetime(2020, 1, 5, tzinfo=UTC)], "cell_id": ["-45.4_-71.3"]}
    )
    celdas = pl.DataFrame({"cell_id": ["-45.4_-71.3"], "region": ["AR-U"]})
    m = dias_celda_mensuales(f, celdas, regiones=["AR-U", "AR-V"])
    assert m.filter(pl.col("region") == "AR-V")["value"].to_list() == [0.0]


def test_area_sin_datos_da_calendario_vacio_con_esquema():
    vacio = serie_mano([]).filter(pl.col("region") == "nada")
    cal = calendario(vacio)
    assert cal.is_empty()
    assert dict(cal.schema) == ESQUEMAS["calendario"]


def test_parquet_publicados_cumplen_el_esquema(tmp_path):
    """Prueba de contrato: lo que escribe el pipeline se lee con el esquema de esquema.md."""
    filas = []
    for anio in range(2010, 2021):
        for mes in (1, 7):
            for sat, desde in (("Aqua", 2010), ("N", 2012), ("N20", 2014)):
                if anio < desde:
                    continue
                for dia in range(
                    1, 2 + (anio + mes) % 3
                ):  # de 1 a 3 días con fuego, para que la recta tenga pendiente
                    filas.append(
                        {
                            "latitude": -45.35,
                            "longitude": -71.25,
                            "acq_datetime": datetime(anio, mes, dia, tzinfo=UTC),
                            "satellite": sat,
                            "instrument": "MODIS" if sat == "Aqua" else "VIIRS",
                            "confidence": "high",
                            "confidence_pct": 90 if sat == "Aqua" else None,
                            "type": 0,
                            "cell_id": "-45.4_-71.3",
                            "year": anio,
                        }
                    )
    focos = tmp_path / "focos"
    pl.DataFrame(filas).with_columns(pl.col("confidence_pct", "type").cast(pl.Int8)).write_parquet(
        focos, partition_by=["satellite", "year"]
    )
    regiones = tmp_path / "regiones.geojson"
    cuadro = [[-72, -46], [-71, -46], [-71, -45], [-72, -45], [-72, -46]]
    regiones.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"region": "AR-U", "nombre": "Chubut", "pais": "Argentina"},
                        "geometry": {"type": "Polygon", "coordinates": [cuadro]},
                    }
                ],
            }
        )
    )
    salida = tmp_path / "pub"
    assert main(["--focos", str(focos), "--regiones", str(regiones), "--out", str(salida)]) == 0
    for tabla in ("serie", "calendario", "metricas"):
        assert dict(pl.read_parquet(salida / f"{tabla}.parquet").schema) == ESQUEMAS[tabla], tabla
    assert (salida / "regiones.geojson").read_text() == regiones.read_text()


def test_muestras_cumplen_el_esquema():
    for tabla in ("serie", "calendario", "metricas"):
        assert dict(pl.read_parquet(f"data/muestras/{tabla}.parquet").schema) == ESQUEMAS[tabla], tabla
