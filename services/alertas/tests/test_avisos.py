"""Qué focos generan aviso (RF-ALE-02)."""

from datetime import UTC, datetime

from alertas.avisos import nuevos_para_avisar
from alertas.modelos import Foco
from alertas.zona import ZONA_DEMO


def foco(id_: str, lat: float, lon: float) -> Foco:
    return Foco(
        id=id_, tipo="foco_satelital", lat=lat, lon=lon,
        cuando=datetime(2026, 11, 14, 4, 55, tzinfo=UTC), detalle="muestra",
    )


DENTRO = foco("a", -41.95, -71.53)
FUERA = foco("b", -36.86, -71.39)


def test_un_foco_fuera_de_la_zona_no_genera_aviso():
    assert nuevos_para_avisar(ZONA_DEMO, [DENTRO, FUERA], set()) == [DENTRO]


def test_el_mismo_foco_no_se_avisa_dos_veces():
    assert nuevos_para_avisar(ZONA_DEMO, [DENTRO], {"a"}) == []


def test_un_foco_repetido_en_la_misma_consulta_sale_una_vez():
    assert nuevos_para_avisar(ZONA_DEMO, [DENTRO, DENTRO], set()) == [DENTRO]
