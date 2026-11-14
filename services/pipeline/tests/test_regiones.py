import polars as pl
from pipeline.regiones import region_de_celdas


def cuadrado(codigo, o, s, e, n):
    return {
        "type": "Feature",
        "properties": {"region": codigo},
        "geometry": {"type": "Polygon", "coordinates": [[[o, s], [e, s], [e, n], [o, n], [o, s]]]},
    }


def test_celda_va_a_la_region_de_su_centro_y_las_de_afuera_se_descartan():
    regiones = {
        "type": "FeatureCollection",
        "features": [cuadrado("A", -72, -46, -71, -45), cuadrado("B", -71, -46, -70, -45)],
    }
    # -45.4_-71.0 tiene el centro en -70.95: cae en B aunque su esquina toque A.
    celdas = pl.Series(["-45.4_-71.3", "-45.4_-71.0", "-45.4_-71.0", "-30.0_-60.0"])
    r = region_de_celdas(celdas, regiones).sort("cell_id")
    assert r.rows() == [("-45.4_-71.0", "B"), ("-45.4_-71.3", "A")]
