"""Qué focos generan aviso (RF-ALE-02, D-37)."""

from datetime import UTC, datetime, timedelta

from alertas.avisos import nuevos_para_avisar
from alertas.modelos import Foco
from alertas.zona import ZONA_DEMO

T0 = datetime(2026, 11, 14, 4, 55, tzinfo=UTC)


def foco(id_: str, lat: float, lon: float, veredicto="confirmado", confianza="nominal", celda=None,
         minutos=0) -> Foco:
    return Foco(
        id=id_, tipo="foco_satelital", lat=lat, lon=lon, cuando=T0 + timedelta(minutes=minutos),
        detalle="muestra", celda=celda, confianza=confianza, veredicto=veredicto,
    )


DENTRO = foco("a", -41.95, -71.53)
FUERA = foco("b", -36.86, -71.39)


def test_un_foco_fuera_de_la_zona_no_genera_aviso():
    assert nuevos_para_avisar(ZONA_DEMO, [DENTRO, FUERA], set()) == [DENTRO]


def test_el_mismo_foco_no_se_avisa_dos_veces():
    assert nuevos_para_avisar(ZONA_DEMO, [DENTRO], {"a"}) == []


def test_un_foco_repetido_en_la_misma_consulta_sale_una_vez():
    assert nuevos_para_avisar(ZONA_DEMO, [DENTRO, DENTRO], set()) == [DENTRO]


def ids(focos):
    return [f.id for f in focos]


def test_confirmado_se_avisa_con_cualquier_confianza():
    focos = [foco(c, -41.95, -71.53, "confirmado", c, celda=c) for c in ("low", "nominal", "high")]
    assert ids(nuevos_para_avisar(ZONA_DEMO, focos, set())) == ["low", "nominal", "high"]


def test_probable_se_avisa_solo_con_confianza_nominal_o_alta():
    focos = [foco(c, -41.95, -71.53, "probable", c, celda=c) for c in ("low", "nominal", "high")]
    assert ids(nuevos_para_avisar(ZONA_DEMO, focos, set())) == ["nominal", "high"]


def test_sin_veredicto_sin_confirmar_o_fuente_fija_no_se_avisan():
    veredictos = (None, "sin_confirmar", "fuente_fija")
    focos = [foco(str(v), -41.95, -71.53, v, "high", celda=str(v)) for v in veredictos]
    assert nuevos_para_avisar(ZONA_DEMO, focos, set()) == []


def test_varias_detecciones_de_una_celda_dan_un_aviso_con_la_mas_antigua():
    # La más antigua no califica todavía, pero es la que registra el aviso: no cambia entre corridas.
    vieja = foco("vieja", -41.95, -71.53, "sin_confirmar", "low", celda="-42.0_-71.6", minutos=0)
    buena = foco("buena", -41.96, -71.54, "confirmado", "high", celda="-42.0_-71.6", minutos=90)
    otra = foco("otra", -41.97, -71.55, "probable", "nominal", celda="-42.0_-71.6", minutos=200)
    [aviso] = nuevos_para_avisar(ZONA_DEMO, [buena, otra, vieja], set())

    assert aviso.id == "vieja"
    assert (aviso.lat, aviso.lon, aviso.cuando) == (buena.lat, buena.lon, buena.cuando)
    assert aviso.detalle == "muestra · 3 detecciones en la celda"


def test_una_deteccion_nueva_en_una_celda_ya_avisada_no_genera_otro_aviso():
    primera = foco("p", -41.95, -71.53, celda="c1", minutos=0)
    nueva = foco("n", -41.95, -71.53, celda="c1", minutos=120)
    assert nuevos_para_avisar(ZONA_DEMO, [primera, nueva], {"p"}) == []


def test_un_foco_que_sube_a_probable_se_avisa_cuando_sube():
    antes = foco("f", -41.95, -71.53, "sin_confirmar", "nominal", celda="c1")
    despues = foco("f", -41.95, -71.53, "probable", "nominal", celda="c1")
    assert nuevos_para_avisar(ZONA_DEMO, [antes], set()) == []
    assert ids(nuevos_para_avisar(ZONA_DEMO, [despues], set())) == ["f"]


def test_los_reportes_se_avisan_todos():
    reporte = Foco(id="r1", tipo="reporte_ciudadano", lat=-41.95, lon=-71.53, cuando=T0, detalle="humo")
    assert nuevos_para_avisar(ZONA_DEMO, [reporte], set()) == [reporte]
