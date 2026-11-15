"""Pruebas mínimas de R-B2 (#221): cobertura de la ventana de prueba. Datos sintéticos y sin red."""

from datetime import UTC, date, datetime, timedelta

import polars as pl
from pipeline.cobertura import contra_noaa20, entrenamiento_por_mes, informe, por_sensor, ultimo_dia


def focos(*filas: tuple[str, date]) -> pl.DataFrame:
    """Focos válidos (D-04) de un sensor en una celda y un día, a las 03 UTC."""
    return pl.DataFrame(
        [
            {
                "satellite": sat,
                "instrument": "MODIS" if sat in ("Terra", "Aqua") else "VIIRS",
                "confidence": "nominal",
                "confidence_pct": 80,
                "type": 0,
                "cell_id": "-45.4_-71.3",
                "acq_datetime": datetime(d.year, d.month, d.day, 3, tzinfo=UTC),
            }
            for sat, d in filas
        ],
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


def dias(sat: str, desde: date, hasta: date) -> list[tuple[str, date]]:
    return [(sat, desde + timedelta(n)) for n in range((hasta - desde).days + 1)]


def test_mes_al_que_le_faltan_dias_es_incompleto_y_mes_sin_datos_tambien():
    # S-NPP: enero completo, febrero con 10 días de 28 (se cortó), marzo sin nada.
    f = focos(
        *dias("N", date(2025, 1, 1), date(2025, 1, 31)),
        *dias("N", date(2025, 2, 1), date(2025, 2, 10)),
    )
    c = por_sensor(f, date(2025, 1, 1), date(2025, 3, 1)).filter(pl.col("grupo") == "snpp").sort("mes")
    assert c["mes"].to_list() == [date(2025, 1, 1), date(2025, 2, 1), date(2025, 3, 1)]
    assert c["dias"].to_list() == [31, 10, 0]
    assert c["dias_mes"].to_list() == [31, 28, 31]
    assert c["completo"].to_list() == [True, False, False]


def test_por_sensor_informa_cada_grupo_aunque_no_tenga_focos():
    f = focos(*dias("N20", date(2025, 1, 1), date(2025, 1, 31)))
    c = por_sensor(f, date(2025, 1, 1), date(2025, 1, 1))
    assert sorted(c["grupo"].to_list()) == ["modis", "noaa20", "noaa21", "snpp"]
    assert c.filter(pl.col("grupo") == "noaa20")["completo"].item() is True
    assert c.filter(pl.col("grupo") == "snpp")["dias"].item() == 0


def test_por_sensor_usa_el_filtro_de_la_armonizacion():
    # Un foco de baja confianza no cuenta como día con datos, igual que en pipeline.prediccion (D-04).
    f = focos(*dias("N", date(2025, 1, 1), date(2025, 1, 31))).with_columns(
        confidence=pl.when(pl.col("acq_datetime").dt.day() > 20).then(pl.lit("low")).otherwise("confidence")
    )
    c = por_sensor(f, date(2025, 1, 1), date(2025, 1, 1)).filter(pl.col("grupo") == "snpp")
    assert c["dias"].item() == 20
    assert c["completo"].item() is False


def test_ultimo_dia_por_sensor():
    f = focos(
        *dias("N", date(2026, 10, 1), date(2026, 11, 2)),
        *dias("N20", date(2026, 10, 1), date(2026, 11, 14)),
    )
    u = dict(ultimo_dia(f).rows())
    assert u == {"snpp": date(2026, 11, 2), "noaa20": date(2026, 11, 14)}


def entrenamiento(valores: dict[str, int], celdas: int = 10) -> pl.DataFrame:
    """Tabla `entrenamiento`: en cada mes, `valores[mes]` celdas con un día de fuego y el resto en cero."""
    filas = [(f"c{c}", mes, int(c < n)) for mes, n in valores.items() for c in range(celdas)]
    return pl.DataFrame(
        filas, schema={"cell_id": pl.String, "month": pl.String, "fire_days": pl.Int16}, orient="row"
    )


def test_mes_que_falta_en_entrenamiento_no_esta_y_no_es_cero():
    e = entrenamiento({"2025-01": 2, "2025-02": 6})
    t = entrenamiento_por_mes(e, date(2025, 1, 1), date(2025, 3, 1))
    assert t["presente"].to_list() == [True, True, False]
    assert t["celdas_con_fuego"].to_list() == [2, 6, None]


def test_snpp_que_ve_mucho_menos_que_noaa20_en_las_mismas_celdas_es_sospechoso():
    # Enero: los dos ven los 31 días. Febrero: S-NPP ve 20 de 28 días (razón 0,71): sospechoso.
    # Marzo: S-NPP ve 28 de 31 (razón 0,9): no es sospechoso.
    # Abril: poco fuego en los dos (un año flojo, no un corte): no es sospechoso.
    f = focos(
        *dias("N", date(2025, 1, 1), date(2025, 1, 31)),
        *dias("N20", date(2025, 1, 1), date(2025, 1, 31)),
        *dias("N", date(2025, 2, 1), date(2025, 2, 20)),
        *dias("N20", date(2025, 2, 1), date(2025, 2, 28)),
        *dias("N", date(2025, 3, 1), date(2025, 3, 28)),
        *dias("N20", date(2025, 3, 1), date(2025, 3, 31)),
        *dias("N", date(2025, 4, 1), date(2025, 4, 3)),
        *dias("N20", date(2025, 4, 1), date(2025, 4, 3)),
    )
    r = contra_noaa20(f, ["-45.4_-71.3"], date(2025, 1, 1), date(2025, 5, 1))
    assert r["snpp"].to_list() == [31, 20, 28, 3, 0]
    assert r["noaa20"].to_list() == [31, 28, 31, 3, 0]
    assert r["sospechoso"].to_list() == [False, True, False, False, False]
    # Sin focos de NOAA-20 no hay con qué comparar: la razón queda nula.
    assert r["razon"][-1] is None


def test_contra_noaa20_solo_cuenta_las_celdas_pedidas():
    f = focos(*dias("N20", date(2025, 1, 1), date(2025, 1, 31)))
    r = contra_noaa20(f, ["otra"], date(2025, 1, 1), date(2025, 1, 1))
    assert r["noaa20"].to_list() == [0]


def test_informe_en_markdown_nombra_meses_incompletos_y_ultimo_dia():
    f = focos(
        *dias("N", date(2025, 1, 1), date(2025, 1, 31)),
        *dias("N", date(2025, 2, 1), date(2025, 2, 10)),
    )
    e = entrenamiento({"2025-01": 3})
    texto = informe(f, e, date(2025, 1, 1), date(2025, 2, 1))
    assert "| 2025-02 |" in texto
    assert "snpp" in texto and "2025-02-10" in texto
    assert "incompleto" in texto
