"""Pruebas de las señales y del veredicto (D-09): reglas fijas, sin base ni red."""

import pytest
from worker.verificacion import (
    senal_fuente_fija,
    senal_noticias,
    senal_reportes,
    senal_satelite,
    veredicto,
)


def foco(confianza="nominal", frp=5.0):
    return {"confidence": confianza, "frp": frp, "satellite": "N20"}


def test_satelite_suma_pasadas_y_frp_con_tope():
    assert senal_satelite(foco("nominal", 5.0), 1)[0] == 0.5
    assert senal_satelite(foco("high", 20.0), 3)[0] == 1.0
    assert senal_satelite(foco("low", None), 1)[0] == 0.3
    assert "NOAA-20" in senal_satelite(foco(), 1)[1]["title"]


def test_fuente_fija():
    assert senal_fuente_fija("a", None)[1]["label"] == "sin_informacion"
    assert senal_fuente_fija("a", {"a"})[0] == 1.0
    assert senal_fuente_fija("b", {"a"})[0] == 0.0


def test_noticias_sin_datos_o_sin_titulares_no_resta():
    assert senal_noticias(None, "Chubut")[0] == 0.0
    valor, evidencia = senal_noticias([], "Chubut")
    assert valor == 0.0 and "Chubut" in evidencia[0]["title"]


def test_noticias_que_apoyan():
    items = [{"title": f"t{i}", "url": f"u{i}", "label": "apoya"} for i in range(7)] + [
        {"title": "x", "url": "x", "label": "sin_informacion"}
    ]
    valor, evidencia = senal_noticias(items, "Chubut")
    assert valor == 1.0 and len(evidencia) == 5


def test_reportes_y_entidad():
    valor, evidencia, falso = senal_reportes(
        [{"km": 8.0, "status": "visto"}, {"km": 2.0, "status": "sin_verificar"}], None
    )
    assert valor == 0.7 and not falso
    assert evidencia[0]["title"].startswith("Reporte ciudadano a 2 km")
    valor, _, falso = senal_reportes([], "falso")
    assert valor == 0.0 and falso


@pytest.mark.parametrize(
    ("senales", "falso", "esperado"),
    [
        ({"satellite": 1.0, "fixed_source": 0.0, "news": 1.0, "reports": 1.0}, True, "sin_confirmar"),
        ({"satellite": 0.7, "fixed_source": 1.0, "news": 0.0, "reports": 0.0}, False, "fuente_fija"),
        ({"satellite": 0.3, "fixed_source": 1.0, "news": 0.0, "reports": 1.0}, False, "confirmado"),
        ({"satellite": 1.0, "fixed_source": 0.0, "news": 0.5, "reports": 0.0}, False, "confirmado"),
        ({"satellite": 0.7, "fixed_source": 0.0, "news": 0.0, "reports": 0.0}, False, "probable"),
        ({"satellite": 0.5, "fixed_source": 0.0, "news": 0.0, "reports": 0.0}, False, "sin_confirmar"),
    ],
)
def test_veredicto(senales, falso, esperado):
    assert veredicto(senales, falso)[0] == esperado
