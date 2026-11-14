"""Feed CAP 1.2 por zona (RF-ALE-04). Se valida contra el XSD oficial de OASIS (fixtures/CAP-v1.2.xsd)."""

from datetime import UTC, datetime
from pathlib import Path

from alertas.cap import AvisoCap, armar_cap
from alertas.modelos import Foco
from alertas.zona import ZONA_DEMO
from lxml import etree

XSD = etree.XMLSchema(etree.parse(str(Path(__file__).parent / "fixtures" / "CAP-v1.2.xsd")))
NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
ENVIADO = datetime(2026, 11, 14, 21, 0, tzinfo=UTC)

FOCO = Foco(id="N20-2026-11-14T04:55:00Z--41.95000--71.53000", tipo="foco_satelital", lat=-41.95, lon=-71.53,
            cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC),
            detalle="VIIRS NOAA-20, confianza nominal, 4,8 MW")
REPORTE = Foco(id="r-1", tipo="reporte_ciudadano", lat=-41.9, lon=-71.5,
               cuando=datetime(2026, 11, 14, 12, 0, tzinfo=UTC), detalle="Humo detrás del cerro")


def leer(xml: str) -> etree._Element:
    raiz = etree.fromstring(xml.encode())
    XSD.assertValid(raiz)  # falla con el detalle del error si no cumple CAP 1.2
    return raiz


def test_el_feed_valida_contra_cap_1_2_y_trae_un_info_por_aviso():
    avisos = [AvisoCap("a-1", FOCO, "nueva"), AvisoCap("a-2", REPORTE, "en_camino")]
    raiz = leer(armar_cap(ZONA_DEMO, avisos, ENVIADO))

    assert raiz.findtext("cap:sent", namespaces=NS) == "2026-11-14T21:00:00-00:00"
    infos = raiz.findall("cap:info", NS)
    assert [i.findtext("cap:event", namespaces=NS) for i in infos] == ["Foco de calor satelital",
                                                                       "Reporte de un vecino"]
    assert infos[0].findtext("cap:category", namespaces=NS) == "Fire"
    assert infos[0].findtext("cap:area/cap:circle", namespaces=NS) == "-41.95000,-71.53000 0.5"
    assert infos[0].findtext("cap:area/cap:areaDesc", namespaces=NS) == "Comarca Andina"
    assert "llamá al 100" in infos[0].findtext("cap:instruction", namespaces=NS)
    assert infos[1].findtext("cap:parameter[cap:valueName='estado']/cap:value", namespaces=NS) == "en_camino"


def test_una_zona_sin_avisos_devuelve_un_feed_valido_y_vacio():
    raiz = leer(armar_cap(ZONA_DEMO, [], ENVIADO))
    assert raiz.findall("cap:info", NS) == []
    assert raiz.findtext("cap:identifier", namespaces=NS) == "charmy-zona-demo-20261114T210000Z"


RARO = 'Humo <b>negro</b> & "denso" en Ñirihuau'


def test_los_textos_con_caracteres_especiales_quedan_escapados():
    raro = Foco(id="r-2", tipo="reporte_ciudadano", lat=-41.9, lon=-71.5,
                cuando=datetime(2026, 11, 14, 12, 0, tzinfo=UTC), detalle=RARO)
    xml = armar_cap(ZONA_DEMO, [AvisoCap("a-3", raro, "nueva")], ENVIADO)

    assert "<b>" not in xml and "&lt;b&gt;" in xml and "&amp;" in xml
    raiz = leer(xml)
    assert RARO in raiz.findtext("cap:info/cap:description", namespaces=NS)


def test_un_aviso_marcado_falso_no_se_publica():
    raiz = leer(armar_cap(ZONA_DEMO, [AvisoCap("a-1", FOCO, "falso")], ENVIADO))
    assert raiz.findall("cap:info", NS) == []
