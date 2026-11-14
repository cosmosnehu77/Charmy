import json
from pathlib import Path

import pytest
from humo import ENCABEZADO_CSV, main, probar

OPENAPI = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "api" / "openapi.yaml"

SANO = {
    "/health": (200, json.dumps({"status": "ok", "data_version": "muestra"})),
    "/calendar": (
        200,
        json.dumps(
            {
                "unit": "dias_celda_con_fuego_equivalente_viirs",
                "baseline": "mediana 2001-2025 por mes",
                "cells": [
                    {
                        "year": 2025,
                        "month": 1,
                        "value": 22.0,
                        "median": 4.0,
                        "percentile": 99,
                        "origin": "viirs_medido",
                    }
                ],
            }
        ),
    ),
    "/hotspots": (200, ENCABEZADO_CSV + "\n-42.905,-71.312,2025-01-18,1824,N20,VIIRS,n,12.4,D\n"),
}


class Http:
    """HTTP simulado: responde por ruta y registra los pedidos."""

    def __init__(self, **cambios):
        self.respuestas = {**SANO, **{f"/{k}": v for k, v in cambios.items()}}
        self.pedidos = []

    def __call__(self, metodo, url, cuerpo=None, encabezados=None):
        self.pedidos.append((metodo, url, cuerpo, encabezados or {}))
        ruta = "/" + url.split("?")[0].rsplit("/", 1)[-1]
        return self.respuestas[ruta]


def test_api_sana_no_tiene_problemas():
    assert probar("https://api.ejemplo.test/api/v1", Http()) == []


def test_pide_las_tres_rutas_bajo_la_base_sin_doble_barra():
    http = Http()
    probar("https://api.ejemplo.test/api/v1/", http)
    urls = [p[1] for p in http.pedidos]
    assert urls[0] == "https://api.ejemplo.test/api/v1/health"
    assert urls[1] == "https://api.ejemplo.test/api/v1/calendar"
    assert urls[2].startswith("https://api.ejemplo.test/api/v1/hotspots?")
    assert "format=csv" in urls[2] and "bbox=" in urls[2]
    metodo, _, cuerpo, _ = http.pedidos[1]
    assert metodo == "POST" and cuerpo["area"]["type"] == "Polygon"


@pytest.mark.parametrize(
    "health",
    [
        (200, json.dumps({"status": "degradado"})),
        (500, "error interno"),
        (200, "<html>no es JSON</html>"),
        (0, "tiempo agotado"),
    ],
)
def test_health_que_no_da_ok_es_un_problema(health):
    problemas = probar("http://x", Http(health=health))
    assert len(problemas) == 1 and problemas[0].startswith("/health")


@pytest.mark.parametrize(
    "calendario",
    [
        (200, json.dumps({"unit": "u", "baseline": "b", "cells": []})),
        (200, json.dumps({"unit": "u", "baseline": "b", "cells": [{"year": 2025, "month": 13}]})),
        (200, json.dumps({"unit": "u", "baseline": "b"})),
        (429, "demasiados pedidos"),
        (503, "no disponible"),
    ],
)
def test_calendario_sin_meses_es_un_problema(calendario):
    problemas = probar("http://x", Http(calendar=calendario))
    assert len(problemas) == 1 and problemas[0].startswith("/calendar")


@pytest.mark.parametrize(
    "csv",
    [
        (200, "lat,lon,fecha\n1,2,3\n"),
        (200, ""),
        (400, "bbox inválido"),
    ],
)
def test_csv_sin_el_encabezado_del_contrato_es_un_problema(csv):
    problemas = probar("http://x", Http(hotspots=csv))
    assert len(problemas) == 1 and problemas[0].startswith("/hotspots")


def test_csv_con_bom_y_fin_de_linea_windows_se_acepta():
    csv = (200, "﻿" + ENCABEZADO_CSV + "\r\n1,2\r\n")
    assert probar("http://x", Http(hotspots=csv)) == []


def test_el_encabezado_es_el_del_contrato():
    assert ENCABEZADO_CSV in OPENAPI.read_text(encoding="utf-8")


def test_main_devuelve_1_y_lista_los_problemas(capsys):
    codigo = main(["http://x"], http=Http(health=(500, "")))
    salida = capsys.readouterr()
    assert codigo == 1 and "/health" in salida.err


def test_main_devuelve_0_si_todo_esta_bien(capsys):
    assert main(["http://x"], http=Http()) == 0
    assert "3 de 3" in capsys.readouterr().out
