"""Pruebas mínimas de F2-B1 (#31). Todo con datos sintéticos: ninguna prueba llama a FIRMS."""

import math
import random
from datetime import UTC, datetime

import polars as pl
import pytest
from pipeline.armonizacion import (
    calibrar,
    convertir,
    dias_celda_mensuales,
    filtrar,
    metricas,
    serie,
    validar,
)


def foco(sat="N20", conf="nominal", pct=None, tipo=0, cell="-45.4_-71.3", dia=1, hora=3):
    instrumento = "MODIS" if sat in ("Terra", "Aqua") else "VIIRS"
    return {
        "satellite": sat,
        "instrument": instrumento,
        "confidence": conf,
        "confidence_pct": pct,
        "type": tipo,
        "cell_id": cell,
        "acq_datetime": datetime(2020, 1, dia, hora, tzinfo=UTC),
    }


def focos(*filas):
    return pl.DataFrame(
        list(filas),
        schema={
            "satellite": pl.String,
            "instrument": pl.String,
            "confidence": pl.String,
            "confidence_pct": pl.Int8,
            "type": pl.Int8,
            "cell_id": pl.String,
            "acq_datetime": pl.Datetime("us", "UTC"),
        },
    )


CELDA_REGION = pl.DataFrame({"cell_id": ["-45.4_-71.3", "-45.5_-71.3"], "region": ["AR-U", "AR-U"]})


# --- Filtros D-04 ---------------------------------------------------------------------------------------


def test_filtro_descarta_type_distinto_de_cero():
    df = filtrar(focos(foco(tipo=0), foco(tipo=2), foco(tipo=None)))
    assert df["type"].to_list() == [0, None]  # NRT no trae type: se conserva


def test_filtro_descarta_modis_con_confianza_menor_a_30():
    df = filtrar(focos(foco("Terra", "low", 29), foco("Terra", "nominal", 30)))
    assert df["confidence_pct"].to_list() == [30]


def test_filtro_descarta_viirs_low():
    df = filtrar(focos(foco(conf="low"), foco(conf="nominal"), foco(conf="high")))
    assert df["confidence"].to_list() == ["nominal", "high"]


# --- Días-celda D-02 ------------------------------------------------------------------------------------


def test_dos_focos_misma_celda_y_dia_cuentan_uno():
    m = dias_celda_mensuales(focos(foco(hora=3), foco(hora=15)), CELDA_REGION)
    assert m.filter(pl.col("grupo") == "noaa20")["value"].to_list() == [1]


def test_dos_satelites_misma_celda_y_dia_cuentan_uno():
    m = dias_celda_mensuales(focos(foco("Terra", pct=80), foco("Aqua", pct=80, hora=17)), CELDA_REGION)
    assert m.filter(pl.col("grupo") == "modis")["value"].to_list() == [1]


def test_celdas_y_dias_distintos_suman():
    m = dias_celda_mensuales(focos(foco(), foco(cell="-45.5_-71.3"), foco(dia=2)), CELDA_REGION)
    assert m["value"].to_list() == [3]


# --- Datos sintéticos con relación conocida -------------------------------------------------------------


def sintetico(regiones=("AR-U", "CL-AR"), semilla=7):
    """MODIS = verdad / 2; S-NPP = verdad (2012-01 a 2026-07); NOAA-20 = 1,1 × verdad (desde 2018-04)."""
    rnd = random.Random(semilla)
    filas = []
    for region in regiones:
        for anio in range(2001, 2027):
            for mes in range(1, 13):
                if (anio, mes) > (2026, 10):
                    break
                verdad = (
                    400 * (1 + 0.8 * math.cos(2 * math.pi * (mes - 1.5) / 12)) * rnd.uniform(0.6, 1.4) + 20
                )
                filas.append((region, anio, mes, "modis", verdad / 2))
                if (2012, 1) <= (anio, mes) <= (2026, 7):
                    filas.append((region, anio, mes, "snpp", verdad))
                if (anio, mes) >= (2018, 4):
                    filas.append((region, anio, mes, "noaa20", verdad * 1.1))
    return pl.DataFrame(
        filas, schema=["region", "year", "month", "grupo", "value"], orient="row"
    ).with_columns(pl.col("year").cast(pl.Int16), pl.col("month").cast(pl.Int8))


def test_calibracion_recupera_relacion_conocida():
    m = sintetico()
    coefs = calibrar(m, "modis", "snpp")
    conv = convertir(m.filter(pl.col("grupo") == "modis"), coefs)
    real = m.filter(pl.col("grupo") == "snpp").select("region", "year", "month", obs="value")
    j = conv.join(real, on=["region", "year", "month"])
    assert ((j["value"] / j["obs"] - 1).abs() < 0.01).all()
    assert coefs["b"].is_between(0.99, 1.01).all()


def test_validacion_un_resultado_por_anio_y_no_usa_el_anio_de_prueba():
    m = sintetico()
    v = validar(m, "modis", "snpp")
    assert sorted(v["year"].unique().to_list()) == list(range(2012, 2027))
    # Si el año de prueba entrara al ajuste, romper su S-NPP cambiaría su predicción.
    roto = m.with_columns(
        value=pl.when((pl.col("grupo") == "snpp") & (pl.col("year") == 2015))
        .then(pl.col("value") * 50)
        .otherwise(pl.col("value"))
    )
    pred = v.filter(pl.col("year") == 2015).sort("region", "month")["pred"]
    pred_roto = validar(roto, "modis", "snpp").filter(pl.col("year") == 2015).sort("region", "month")["pred"]
    assert pred.to_list() == pytest.approx(pred_roto.to_list())


def test_serie_sin_saltos_en_los_empalmes():
    m = sintetico()
    s = serie(m).filter(pl.col("source") == "harmonized").sort("region", "year", "month")
    verdad = m.filter(pl.col("grupo") == "modis").select("region", "year", "month", v=pl.col("value") * 2)
    j = s.join(verdad, on=["region", "year", "month"])
    assert ((j["value"] / j["v"] - 1).abs() < 0.02).all()
    origen = dict(zip(zip(j["year"], j["month"], strict=True), j["origin"], strict=True))
    assert origen[(2011, 12)] == "modis_convertido"
    assert origen[(2012, 1)] == "viirs_medido"
    assert origen[(2026, 8)] == "viirs_convertido"
    assert not s["provisional"].any()


def test_convertidos_tienen_incertidumbre_y_medidos_no():
    ruido = 1 + 0.1 * (pl.col("year").cast(pl.Float64) * pl.col("month").cast(pl.Float64)).sin()
    m = sintetico().with_columns(
        value=pl.when(pl.col("grupo") == "modis").then(pl.col("value") * ruido).otherwise(pl.col("value"))
    )
    s = serie(m).filter(pl.col("source") == "harmonized")
    conv = s.filter(pl.col("origin") == "modis_convertido")
    assert (conv["lower"] < conv["value"]).all() and (conv["upper"] > conv["value"]).all()
    med = s.filter(pl.col("origin") == "viirs_medido")
    assert (med["lower"] == med["value"]).all()


def test_metricas_por_region_y_tramo():
    met = metricas(sintetico())
    assert set(zip(met["region"], met["pair"], strict=True)) == {
        ("AR-U", "modis_snpp"),
        ("AR-U", "noaa20_snpp"),
        ("CL-AR", "modis_snpp"),
        ("CL-AR", "noaa20_snpp"),
    }
    assert (met["r2"] > 0.99).all() and not met["provisional"].any()


def test_region_con_pocos_datos_usa_el_ajuste_de_la_region_entera():
    m = sintetico(regiones=("AR-U",)).filter(~((pl.col("grupo") == "snpp") & (pl.col("month") == 3)))
    coefs = calibrar(m, "modis", "snpp")
    assert coefs.filter(pl.col("month") == 3)["nivel"].to_list() == ["region"]


def test_determinismo():
    m = sintetico()
    assert serie(m).equals(serie(m))
    assert metricas(m).equals(metricas(m))
