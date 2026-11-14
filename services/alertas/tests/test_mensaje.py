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
    assert "14/11/2026 04:55 UTC" in texto
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
    chile = Zona(id="demo-cl", nombre="Araucanía", bbox=(-73.0, -39.0, -71.0, -37.5), pais="CL")
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
