"""Qué focos generan aviso: dentro de la zona y no avisados antes (RF-ALE-02)."""

from collections.abc import Iterable

from alertas.modelos import Foco
from alertas.zona import Zona


def nuevos_para_avisar(zona: Zona, focos: Iterable[Foco], ya_avisados: set[str]) -> list[Foco]:
    vistos = set(ya_avisados)
    nuevos = []
    for foco in focos:
        if foco.id in vistos or not zona.contiene(foco.lat, foco.lon):
            continue
        vistos.add(foco.id)
        nuevos.append(foco)
    return nuevos
