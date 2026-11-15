"""Pruebas de GET /regions/summary y de POST /calendar por región (F4-R1), sin red ni base."""

import threading
import time
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import pytest
from api import regiones
from api.main import app
from fastapi.testclient import TestClient

AHORA = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)
CHUBUT, NEUQUEN, MAR = (-68.5, -44.0), (-70.0, -38.5), (-58.0, -50.0)


def _foco(lugar, dia, hora, frp):
    lon, lat = lugar
    return (lat, lon, datetime(2026, 11, dia, hora, tzinfo=UTC), frp)


FOCOS = [
    _foco(CHUBUT, 12, 18, 10.0),
    _foco(CHUBUT, 14, 3, 5.5),
    _foco(NEUQUEN, 13, 4, 2.0),
    _foco(NEUQUEN, 13, 16, 3.0),
    _foco(NEUQUEN, 14, 10, 1.0),
    _foco(MAR, 13, 5, 50.0),  # fuera de las regiones: no cuenta
]


class _Base:
    def __init__(self, estado, focos):
        self.estado, self.focos, self._sql = estado, focos, ""

    def execute(self, sql, _=None):
        self._sql = sql
        return self

    def fetchone(self):
        return self.estado

    def fetchall(self):
        return self.focos


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.delenv("DATA_MANIFEST_URL", raising=False)
    monkeypatch.setattr(regiones, "_ahora", lambda: AHORA)
    regiones._guardado.clear()
    return TestClient(app)


def _con_base(monkeypatch, estado=(datetime(2026, 11, 14, 11, 30, tzinfo=UTC), None), focos=FOCOS):
    """Base simulada; devuelve la lista de conexiones abiertas, una por cálculo del resumen."""
    abiertas = []

    @contextmanager
    def conectar():
        abiertas.append(1)
        yield _Base(estado, focos)

    monkeypatch.setattr(regiones, "conectar", conectar)
    return abiertas


def _por_region(cuerpo):
    return {f["id"]: f["properties"] for f in cuerpo["features"]}


def test_cuenta_focos_e_intensidad_por_region_y_por_dia(cliente, monkeypatch):
    _con_base(monkeypatch)
    r = cliente.get("/api/v1/regions/summary", params={"hours": 48})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["type"] == "FeatureCollection" and len(cuerpo["features"]) == 39
    assert cuerpo["days"] == ["2026-11-12", "2026-11-13", "2026-11-14"]
    assert cuerpo["live"] == {"available": True, "fetched_at": "2026-11-14T11:30:00Z", "stale": False}
    p = _por_region(cuerpo)
    assert p["AR-U"]["hotspots"] == 2 and p["AR-U"]["frp_mw"] == 15.5
    assert p["AR-U"]["by_day"] == [1, 0, 1] and p["AR-U"]["frp_by_day"] == [10.0, 0.0, 5.5]
    assert p["AR-Q"]["hotspots"] == 3 and p["AR-Q"]["by_day"] == [0, 2, 1]
    assert p["AR-A"]["hotspots"] == 0 and p["AR-A"]["by_day"] == [0, 0, 0]
    assert sum(x["hotspots"] for x in p.values()) == 5  # el foco en el mar no entra


def test_cada_region_trae_nombre_pais_geometria_y_ultimo_mes_del_calendario(cliente, monkeypatch):
    _con_base(monkeypatch)
    cuerpo = cliente.get("/api/v1/regions/summary").json()
    chubut = next(f for f in cuerpo["features"] if f["id"] == "AR-U")
    assert chubut["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    assert chubut["properties"]["name"] == "Chubut" and chubut["properties"]["country"] == "Argentina"
    assert chubut["properties"]["last_month"] == {
        "year": 2026,
        "month": 10,
        "value": 41.4,
        "median": 34.3,
        "percentile": 75.0,
    }
    assert _por_region(cuerpo)["AR-A"]["last_month"] is None  # sin calendario en las muestras


def test_con_firms_atrasado_lo_dice(cliente, monkeypatch):
    _con_base(monkeypatch, estado=(datetime(2026, 11, 14, 8, 0, tzinfo=UTC), "ConnectTimeout"))
    live = cliente.get("/api/v1/regions/summary").json()["live"]
    assert live["available"] is True and live["stale"] is True
    assert "08:00 UTC" in live["message"]


def test_con_la_base_caida_igual_devuelve_las_regiones(cliente, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    r = cliente.get("/api/v1/regions/summary")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["live"]["available"] is False and cuerpo["live"]["message"]
    assert len(cuerpo["features"]) == 39
    assert all(f["properties"]["hotspots"] is None for f in cuerpo["features"])
    assert all(f["properties"]["by_day"] is None for f in cuerpo["features"])


@pytest.mark.parametrize("horas", [0, 121])
def test_horas_fuera_de_rango_dan_400(cliente, horas):
    r = cliente.get("/api/v1/regions/summary", params={"hours": horas})
    assert r.status_code == 400 and r.json()["code"] == "parametros_invalidos"


def test_calendario_por_region(cliente):
    r = cliente.post("/api/v1/calendar", json={"region": "AR-U", "from_year": 2025})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["region"] == "AR-U" and cuerpo["cells"][0]["year"] == 2025


def test_calendario_de_region_desconocida_da_404(cliente):
    r = cliente.post("/api/v1/calendar", json={"region": "XX-Z"})
    assert r.status_code == 404 and r.json()["code"] == "no_existe"


@pytest.mark.parametrize("cuerpo", [{}, {"from_year": 2020}])
def test_calendario_sin_area_ni_region_da_400(cliente, cuerpo):
    r = cliente.post("/api/v1/calendar", json=cuerpo)
    assert r.status_code == 400 and r.json()["code"] == "parametros_invalidos"


# #243: después de cada despliegue el resumen tardó más de un minuto; se guarda y se calcula una sola vez.


def test_dentro_del_minuto_se_reusa_el_resumen_y_despues_se_calcula_de_nuevo(cliente, monkeypatch):
    abiertas = _con_base(monkeypatch)
    primero = cliente.get("/api/v1/regions/summary").json()
    assert cliente.get("/api/v1/regions/summary").json() == primero
    assert len(abiertas) == 1
    monkeypatch.setattr(regiones, "_ahora", lambda: AHORA + timedelta(seconds=61))
    cliente.get("/api/v1/regions/summary")
    assert len(abiertas) == 2


def test_cada_ventana_de_horas_se_guarda_aparte(cliente, monkeypatch):
    abiertas = _con_base(monkeypatch)
    assert cliente.get("/api/v1/regions/summary", params={"hours": 48}).json()["hours"] == 48
    assert cliente.get("/api/v1/regions/summary", params={"hours": 120}).json()["hours"] == 120
    assert len(abiertas) == 2


def test_pedidos_simultaneos_comparten_un_solo_calculo(cliente, monkeypatch):
    calculos = []
    original = regiones._calcular

    def lento(horas):
        calculos.append(horas)
        time.sleep(0.2)
        return original(horas)

    _con_base(monkeypatch)
    monkeypatch.setattr(regiones, "_calcular", lento)
    hilos = [threading.Thread(target=regiones.resumen, args=(120,)) for _ in range(4)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    assert calculos == [120]


def test_al_arrancar_deja_el_resumen_calculado(monkeypatch):
    from api import main

    calculados = []
    monkeypatch.setattr(main, "copiar", lambda: 0)
    monkeypatch.setattr(main.regiones, "resumen", lambda horas=120: calculados.append(horas))
    main._copiar_datos()
    assert calculados == [120]
