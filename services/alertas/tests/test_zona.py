"""D-39: zonas como punto con radio, y a qué grupo de Telegram va cada una. Sin red."""

import json
import logging

import pytest
from alertas.zona import ZONA_DEMO, ZONAS, Zona, cubre, destinos

BOLSON = Zona(id="b", nombre="El Bolsón", lat=-42.0, lon=-71.5, radio_km=50, pais="AR")
TARTAGAL = Zona(id="t", nombre="Tartagal", lat=-22.5, lon=-63.8, radio_km=60, pais="AR")


def test_un_punto_adentro_del_radio_esta_en_la_zona_y_uno_afuera_no():
    # 1° de latitud son unos 111,2 km: 0,44° = 48,9 km y 0,46° = 51,2 km.
    assert BOLSON.contiene(-42.0 + 0.44, -71.5)
    assert not BOLSON.contiene(-42.0 + 0.46, -71.5)
    assert BOLSON.contiene(-42.0, -71.5)


def test_el_radio_se_mide_en_km_tambien_hacia_el_este():
    # A 42° S un grado de longitud mide menos: 0,6° son unos 49,6 km y 0,62° unos 51,3 km.
    assert BOLSON.contiene(-42.0, -71.5 + 0.6)
    assert not BOLSON.contiene(-42.0, -71.5 + 0.62)


def test_el_rectangulo_de_la_zona_cubre_todo_el_circulo():
    oeste, sur, este, norte = BOLSON.bbox
    assert sur < -42.0 - 0.449 and norte > -42.0 + 0.449
    assert oeste < -71.5 - 0.604 and este > -71.5 + 0.604


def test_un_solo_rectangulo_cubre_todas_las_zonas():
    oeste, sur, este, norte = cubre([BOLSON, TARTAGAL])
    assert (oeste, sur) == BOLSON.bbox[:2]
    assert (este, norte) == TARTAGAL.bbox[2:]


def test_las_zonas_tienen_id_unico_y_la_comarca_conserva_el_id_de_siempre():
    ids = [z.id for z in ZONAS]
    assert len(ids) == len(set(ids))
    assert ZONA_DEMO.id == "zona-demo" and ZONA_DEMO.nombre == "Comarca Andina"
    assert ZONA_DEMO in ZONAS


def test_sin_telegram_zonas_va_todo_a_la_zona_de_demostracion():
    assert destinos(None, "-100123") == [(ZONA_DEMO, -100123)]
    assert destinos("", "-100123") == [(ZONA_DEMO, -100123)]


def test_telegram_zonas_dice_el_grupo_de_cada_zona():
    otra = next(z for z in ZONAS if z.id != ZONA_DEMO.id)
    texto = json.dumps({ZONA_DEMO.id: -100111, otra.id: "-100222"})
    assert destinos(texto, "-100123") == [(ZONA_DEMO, -100111), (otra, -100222)]


def test_una_zona_que_no_existe_da_un_warning_y_no_frena_a_las_demas(caplog):
    with caplog.at_level(logging.WARNING, logger="alertas.zona"):
        resultado = destinos(json.dumps({"no-existe": -1, ZONA_DEMO.id: -100111}), None)
    assert resultado == [(ZONA_DEMO, -100111)]
    assert "no-existe" in caplog.text


@pytest.mark.parametrize("texto", ["no es json", "[1, 2]", '{"zona-demo": "abc"}'])
def test_telegram_zonas_mal_escrito_frena_la_corrida(texto):
    with pytest.raises(ValueError):
        destinos(texto, "-100123")


def test_sin_ningun_grupo_frena_la_corrida():
    with pytest.raises(ValueError):
        destinos(None, None)
