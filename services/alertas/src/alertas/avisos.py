"""Qué se avisa (RF-ALE-02, D-37).

Un foco satelital se avisa si su veredicto es confirmado, o probable con confianza nominal o alta. Un incendio
se avisa una vez por celda de 0,1°: el aviso lo registra la detección más antigua de la celda, que no cambia
entre corridas mientras siga en /live (48 horas). Los reportes ciudadanos se avisan todos.
"""

from collections.abc import Iterable
from dataclasses import replace

from alertas.modelos import Foco
from alertas.zona import Zona


def califica(foco: Foco) -> bool:
    return foco.veredicto == "confirmado" or (
        foco.veredicto == "probable" and foco.confianza in ("nominal", "high")
    )


def _por_celda(celda: list[Foco]) -> Foco | None:
    """El aviso de una celda: el id de la detección más antigua y los datos de la mejor que califica."""
    validos = [f for f in celda if califica(f)]
    if not validos:
        return None
    registro = min(celda, key=lambda f: (f.cuando, f.id))
    mejor = max(validos, key=lambda f: (f.veredicto == "confirmado", f.cuando))
    detalle = mejor.detalle + (f" · {len(celda)} detecciones en la celda" if len(celda) > 1 else "")
    return replace(mejor, id=registro.id, detalle=detalle)


def nuevos_para_avisar(zona: Zona, focos: Iterable[Foco], ya_avisados: set[str]) -> list[Foco]:
    celdas: dict[str, dict[str, Foco]] = {}
    for foco in focos:
        if zona.contiene(foco.lat, foco.lon):
            clave = foco.celda if foco.tipo == "foco_satelital" and foco.celda else f"id:{foco.id}"
            celdas.setdefault(clave, {}).setdefault(foco.id, foco)
    nuevos = []
    for grupo in celdas.values():
        unicos = list(grupo.values())
        aviso = unicos[0] if unicos[0].tipo == "reporte_ciudadano" else _por_celda(unicos)
        if aviso is not None and aviso.id not in ya_avisados:
            nuevos.append(aviso)
    return nuevos
