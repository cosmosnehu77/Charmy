"""Feed CAP 1.2 (OASIS) de una zona: un `<alert>` con un `<info>` por aviso (RF-ALE-04).

Función pura: la API la usa en `GET /cap/{zone_id}.xml` con los avisos que tiene guardados. Una zona sin
avisos da un `<alert>` válido sin `<info>`. Los avisos que la entidad marcó como falsos no se publican.
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime

from alertas.mensaje import aviso_emergencias, enlace_mapa, titulo
from alertas.modelos import Foco
from alertas.zona import Zona

NS = "urn:oasis:names:tc:emergency:cap:1.2"
RADIO_KM = 0.5  # un píxel de VIIRS mide 375 m: el círculo cubre el foco sin achicar de más


@dataclass(frozen=True)
class AvisoCap:
    alert_id: str
    foco: Foco
    estado: str  # nueva, visto, en_camino, controlado o falso


def _fecha(momento: datetime) -> str:
    """CAP pide hora con zona como ±hh:mm; UTC se escribe -00:00."""
    return momento.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S-00:00")


def _hijo(padre: ET.Element, nombre: str, texto: str) -> ET.Element:
    el = ET.SubElement(padre, f"{{{NS}}}{nombre}")
    el.text = texto
    return el


def _info(alert: ET.Element, aviso: AvisoCap, zona: Zona) -> None:
    foco = aviso.foco
    info = ET.SubElement(alert, f"{{{NS}}}info")
    for nombre, texto in [
        ("language", "es-AR"),
        ("category", "Fire"),
        ("event", titulo(foco)),
        ("urgency", "Unknown"),
        ("severity", "Unknown"),
        ("certainty", "Possible"),  # un foco satelital o un reporte todavía no confirman un incendio
        ("effective", _fecha(foco.cuando)),
        ("senderName", "Charmy"),
        ("headline", f"{titulo(foco)} en {zona.nombre}"),
        ("description", foco.detalle),
        ("instruction", aviso_emergencias(zona)),
        ("web", enlace_mapa(foco)),
    ]:
        _hijo(info, nombre, texto)
    for clave, valor in [("alert_id", aviso.alert_id), ("estado", aviso.estado)]:
        parametro = ET.SubElement(info, f"{{{NS}}}parameter")
        _hijo(parametro, "valueName", clave)
        _hijo(parametro, "value", valor)
    area = ET.SubElement(info, f"{{{NS}}}area")
    _hijo(area, "areaDesc", zona.nombre)
    _hijo(area, "circle", f"{foco.lat:.5f},{foco.lon:.5f} {RADIO_KM}")


def armar_cap(zona: Zona, avisos: list[AvisoCap], enviado: datetime) -> str:
    ET.register_namespace("", NS)
    alert = ET.Element(f"{{{NS}}}alert")
    for nombre, texto in [
        ("identifier", f"charmy-{zona.id}-{enviado.astimezone(UTC):%Y%m%dT%H%M%SZ}"),
        ("sender", "charmy"),
        ("sent", _fecha(enviado)),
        ("status", "Actual"),
        ("msgType", "Alert"),
        ("scope", "Public"),
        ("note", f"Focos satelitales y reportes de vecinos sin confirmar. {aviso_emergencias(zona)}"),
    ]:
        _hijo(alert, nombre, texto)
    for aviso in avisos:
        if aviso.estado != "falso":
            _info(alert, aviso, zona)
    ET.indent(alert)
    return ET.tostring(alert, encoding="unicode", xml_declaration=True)
