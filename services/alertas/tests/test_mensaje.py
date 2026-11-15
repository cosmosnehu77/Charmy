"""Armado del mensaje de aviso (RF-ALE-02, RF-ALE-06, RF-CTX-02). Datos de muestra, no resultados."""

from datetime import UTC, datetime

from alertas.mensaje import armar_mensaje, punto_cardinal
from alertas.modelos import Foco, Viento
from alertas.zona import ZONA_DEMO, Zona

FOCO = Foco(
    id="N20-2026-11-14T04:55:00Z--41.95000--71.53000",
    tipo="foco_satelital",
    lat=-41.95,
    lon=-71.53,
    cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC),
    detalle="VIIRS NOAA-20, confianza nominal, 4,8 MW",
)


def test_el_mensaje_trae_ubicacion_viento_enlace_y_aviso_de_emergencias():
    texto = armar_mensaje(FOCO, ZONA_DEMO, Viento(velocidad_kmh=29.5, direccion_deg=270))

    assert "Comarca Andina" in texto
    assert "-41.95000, -71.53000" in texto
    assert "Cuándo: 14/11/2026 01:55 (hora de Argentina)" in texto
    assert "VIIRS NOAA-20" in texto
    assert "Viento: 30 km/h del oeste" in texto
    assert "https://www.openstreetmap.org/?mlat=-41.95000&mlon=-71.53000" in texto
    assert "no reemplaza a los servicios de emergencia" in texto
    assert "llamá al 100" in texto


def test_si_no_hay_viento_lo_dice_y_el_mensaje_sale_igual():
    texto = armar_mensaje(FOCO, ZONA_DEMO, None)

    assert "Viento: no disponible" in texto
    assert "llamá al 100" in texto


def test_el_numero_de_emergencias_depende_del_pais_de_la_zona():
    chile = Zona(id="demo-cl", nombre="Araucanía", lat=-38.7, lon=-72.6, radio_km=50, pais="CL")
    assert "llamá al 132" in armar_mensaje(FOCO, chile, None)


def test_un_reporte_ciudadano_se_nombra_como_tal():
    reporte = Foco(
        id="r-1", tipo="reporte_ciudadano", lat=-41.9, lon=-71.5,
        cuando=datetime(2026, 11, 14, 12, 0, tzinfo=UTC), detalle="Humo detrás del cerro",
    )
    texto = armar_mensaje(reporte, ZONA_DEMO, None)
    assert "Reporte de un vecino" in texto
    assert "Humo detrás del cerro" in texto


def test_punto_cardinal_dice_de_donde_viene_el_viento():
    assert punto_cardinal(0) == "norte"
    assert punto_cardinal(44) == "noreste"
    assert punto_cardinal(270) == "oeste"
    assert punto_cardinal(350) == "norte"


def test_en_una_zona_de_chile_la_hora_es_la_de_chile_con_horario_de_verano():
    from dataclasses import replace

    zona_chile = replace(ZONA_DEMO, pais="CL", nombre="Araucanía")
    texto = armar_mensaje(replace(FOCO, cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC)), zona_chile, None)
    assert "Cuándo: 14/11/2026 01:55 (hora de Chile)" in texto  # noviembre: horario de verano, UTC−3
    texto = armar_mensaje(replace(FOCO, cuando=datetime(2026, 7, 14, 4, 55, tzinfo=UTC)), zona_chile, None)
    assert "Cuándo: 14/07/2026 00:55 (hora de Chile)" in texto  # julio: UTC−4
