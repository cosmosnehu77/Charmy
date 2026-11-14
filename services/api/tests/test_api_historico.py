"""Pruebas de /hotspots, /calendar, /harmonization/metrics y /health con las muestras (sin red).

Corren desde la raíz del repo, como el CI (`uv run pytest services infra`).
"""

from datetime import date

import pytest
from api import hotspots
from api.hotspots import podar
from api.main import app
from fastapi.testclient import TestClient

TODO = {"bbox": "-76,-56,-53,-21"}
COMARCA = {
    "type": "Polygon",
    "coordinates": [[[-71.6, -42.2], [-71.0, -42.2], [-71.0, -42.8], [-71.6, -42.8], [-71.6, -42.2]]],
}


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.delenv("DATA_MANIFEST_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return TestClient(app)


def test_health_dice_que_usa_las_muestras(cliente):
    assert cliente.get("/api/v1/health").json() == {"status": "ok", "data_version": "muestras"}


def test_hotspots_geojson_con_id_y_celda(cliente):
    r = cliente.get("/api/v1/hotspots", params=TODO)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/geo+json"
    datos = r.json()
    assert datos["type"] == "FeatureCollection" and "truncated" not in datos
    foco = datos["features"][0]
    lon, lat = foco["geometry"]["coordinates"]
    assert (
        foco["id"]
        == f"{foco['properties']['satellite']}-{foco['properties']['acq_datetime']}-{lat:.5f}-{lon:.5f}"
    )
    assert set(foco["properties"]) >= {
        "acq_datetime",
        "satellite",
        "instrument",
        "confidence",
        "frp",
        "cell_id",
    }


def test_hotspots_filtra_por_sensor(cliente):
    modis = cliente.get("/api/v1/hotspots", params=TODO | {"source": "modis"}).json()["features"]
    viirs = cliente.get("/api/v1/hotspots", params=TODO | {"source": "viirs"}).json()["features"]
    assert modis and {f["properties"]["instrument"] for f in modis} == {"MODIS"}
    assert viirs and {f["properties"]["instrument"] for f in viirs} == {"VIIRS"}


def test_hotspots_con_mas_focos_que_el_tope_corta_y_dice_el_total(cliente, monkeypatch):
    total = len(cliente.get("/api/v1/hotspots", params=TODO).json()["features"])
    monkeypatch.setattr(hotspots, "TOPE", 10)
    datos = cliente.get("/api/v1/hotspots", params=TODO).json()
    assert len(datos["features"]) == 10
    assert datos["truncated"] is True and datos["total"] == total


def test_hotspots_csv_trae_todos_con_el_encabezado_del_contrato(cliente, monkeypatch):
    monkeypatch.setattr(hotspots, "TOPE", 10)
    r = cliente.get("/api/v1/hotspots", params=TODO | {"format": "csv"})
    lineas = r.text.splitlines()
    assert lineas[0] == ",".join(hotspots.ENCABEZADO_CSV)
    assert len(lineas) - 1 > 10


@pytest.mark.parametrize(
    "parametros, codigo",
    [
        ({"bbox": "nada"}, "bbox_invalido"),
        ({"bbox": "-60,-30,-70,-20"}, "bbox_invalido"),
        (TODO | {"from": "2026-02-01", "to": "2026-01-01"}, "fechas_invalidas"),
        (TODO | {"source": "goes"}, "parametros_invalidos"),
    ],
)
def test_hotspots_parametros_invalidos_dan_400(cliente, parametros, codigo):
    r = cliente.get("/api/v1/hotspots", params=parametros)
    assert r.status_code == 400 and r.json()["code"] == codigo


def test_podar_lee_solo_los_anios_y_satelites_pedidos():
    rutas = [
        "https://x/focos--N20-2024.parquet",
        "https://x/focos--N20-2026.parquet",
        "https://x/focos--Terra-2026.parquet",
        "focos/Aqua-2010.parquet",
        "data/muestras/focos.parquet",
    ]
    assert podar(rutas, date(2025, 1, 1), date(2026, 11, 14), "viirs") == [
        "https://x/focos--N20-2026.parquet",
        "data/muestras/focos.parquet",
    ]
    assert podar(rutas, None, date(2011, 1, 1), "modis") == [
        "focos/Aqua-2010.parquet",
        "data/muestras/focos.parquet",
    ]
    assert podar(rutas, None, None, "harmonized") == rutas


def test_hotspots_sin_archivos_del_periodo_responde_vacio(cliente, monkeypatch):
    monkeypatch.setattr(hotspots, "archivos", lambda _: ["https://x/focos--N20-2024.parquet"])
    datos = cliente.get("/api/v1/hotspots", params=TODO | {"from": "2030-01-01"}).json()
    assert datos["features"] == []


def test_calendar_de_la_comarca_trae_celdas_marcadas_como_ejemplo(cliente):
    datos = cliente.post("/api/v1/calendar", json={"area": COMARCA}).json()
    assert datos["region"] == "AR-U" and datos["provisional"] is True and "message" not in datos
    celda = datos["cells"][0]
    assert set(celda) >= {"year", "month", "value", "median", "anomaly", "percentile", "origin"}


def test_calendar_fuera_de_cobertura_explica_por_que_viene_vacio(cliente):
    lejos = {"type": "Polygon", "coordinates": [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]}
    datos = cliente.post("/api/v1/calendar", json={"area": lejos}).json()
    assert datos["cells"] == [] and "cobertura" in datos["message"] and datos["provisional"] is False


@pytest.mark.parametrize(
    "cuerpo, codigo",
    [
        ({"area": COMARCA, "resolution": "day_of_year"}, "resolucion_no_disponible"),
        ({"area": COMARCA, "from_year": 2020, "to_year": 2010}, "anios_invalidos"),
        (
            {"area": {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]}},
            "poligono_invalido",
        ),
        ({"area": {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [0, 0]]]}}, "parametros_invalidos"),
    ],
)
def test_calendar_pedidos_invalidos_dan_400(cliente, cuerpo, codigo):
    r = cliente.post("/api/v1/calendar", json=cuerpo)
    assert r.status_code == 400 and r.json()["code"] == codigo


def test_metricas_por_region_y_tramo(cliente):
    datos = cliente.get("/api/v1/harmonization/metrics").json()
    fila = datos["regions"][0]
    assert fila["region"] == "AR-U" and fila["pair"] in {"modis_snpp", "noaa20_snpp"}
    assert fila["provisional"] is True


def test_ruta_inexistente_responde_con_el_esquema_error(cliente):
    r = cliente.get("/api/v1/no-existe")
    assert r.status_code == 404 and r.json() == {
        "code": "no_existe",
        "message": "No encontramos lo que buscás.",
    }
