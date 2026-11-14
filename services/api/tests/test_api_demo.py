"""Demo resistente (F4-C1, RNF-02): con las fuentes caídas, la API responde con lo que guardó y lo dice.

Sin red: el release se simula con las muestras de `data/muestras/` detrás de un `httpx.MockTransport`.
"""

import hashlib
import json
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

import duckdb
import httpx
import pytest
from api import datos, hotspots, vivo
from api.main import ERRORES, app
from contexto import tiempo
from fastapi.testclient import TestClient

MANIFIESTO = "https://datos.test/manifest.json"
PUBLICADOS = ["focos.parquet", "calendario.parquet", "metricas.parquet", "regiones.geojson"]
COMARCA = {
    "type": "Polygon",
    "coordinates": [[[-71.6, -42.2], [-71.0, -42.2], [-71.0, -42.8], [-71.6, -42.8], [-71.6, -42.2]]],
}


def _release(sha_roto: str | None = None) -> httpx.MockTransport:
    """El release publicado: un manifiesto y sus archivos, tomados de las muestras."""
    contenidos = {r: (datos.MUESTRAS / r).read_bytes() for r in PUBLICADOS}
    manifiesto = {
        "version": "datos-prueba",
        "archivos": [
            {
                "ruta": r,
                "url": f"https://datos.test/{r}",
                "bytes": len(c),
                "sha256": "0" * 64 if r == sha_roto else hashlib.sha256(c).hexdigest(),
            }
            for r, c in contenidos.items()
        ],
    }

    def responder(pedido: httpx.Request) -> httpx.Response:
        nombre = pedido.url.path.lstrip("/")
        if nombre == "manifest.json":
            return httpx.Response(200, json=manifiesto)
        return httpx.Response(200, content=contenidos[nombre])

    return httpx.MockTransport(responder)


def _caido(_: httpx.Request) -> httpx.Response:
    raise httpx.ConnectTimeout("sin red")


@pytest.fixture
def entorno(monkeypatch, tmp_path):
    """Release simulado y copia local en una carpeta temporal. Devuelve cómo cambiar el release."""
    monkeypatch.setenv("DATA_MANIFEST_URL", MANIFIESTO)
    monkeypatch.setattr(datos, "COPIA", tmp_path / "copia")

    def release(transporte: httpx.MockTransport) -> None:
        monkeypatch.setattr(datos, "CLIENTE", httpx.Client(transport=transporte))
        # Como un proceso nuevo: nada en memoria de la consulta anterior.
        datos._leer_manifiesto.cache_clear()
        datos._geojson.cache_clear()

    yield release
    datos._leer_manifiesto.cache_clear()
    datos._geojson.cache_clear()


def test_la_copia_guarda_cada_archivo_publicado_y_el_manifiesto(entorno):
    entorno(_release())
    assert datos.copiar() == len(PUBLICADOS)
    carpeta = datos.COPIA / "datos-prueba"
    for ruta in PUBLICADOS:
        assert (carpeta / ruta).read_bytes() == (datos.MUESTRAS / ruta).read_bytes()
    assert (datos.COPIA / "manifest.json").exists()
    # Una segunda vuelta no baja de nuevo lo que ya está.
    assert datos.copiar() == 0


def test_archivo_con_sha_distinto_no_se_guarda_y_se_sigue_leyendo_del_release(entorno):
    entorno(_release(sha_roto="focos.parquet"))
    assert datos.copiar() == len(PUBLICADOS) - 1
    assert not (datos.COPIA / "datos-prueba" / "focos.parquet").exists()
    assert datos.archivos("focos") == ["https://datos.test/focos.parquet"]
    assert datos.archivos("calendario") == [str(datos.COPIA / "datos-prueba" / "calendario.parquet")]


def test_con_el_release_caido_el_historico_sale_de_la_copia_local(entorno):
    entorno(_release())
    datos.copiar()
    entorno(httpx.MockTransport(_caido))
    cliente = TestClient(app)

    assert cliente.get("/api/v1/health").json() == {"status": "ok", "data_version": "datos-prueba"}
    r = cliente.get("/api/v1/hotspots", params={"bbox": "-76,-56,-53,-21"})
    assert r.status_code == 200 and r.json()["features"]
    r = cliente.post("/api/v1/calendar", json={"area": COMARCA})
    assert r.status_code == 200 and r.json()["cells"]
    assert cliente.get("/api/v1/harmonization/metrics").status_code == 200


def test_con_el_release_caido_y_sin_copia_responde_503_del_contrato(entorno):
    entorno(httpx.MockTransport(_caido))
    r = TestClient(app).get("/api/v1/hotspots", params={"bbox": "-76,-56,-53,-21"})
    assert r.status_code == 503 and r.json()["code"] == "datos_no_disponibles"


class _BaseFalsa:
    """Postgres con lo que dejó el worker: la última consulta buena a FIRMS y el error de la siguiente."""

    def __init__(self, estado, filas):
        self.estado, self.filas = estado, filas

    def execute(self, *_):
        return self

    def fetchone(self):
        return self.estado

    def fetchall(self):
        return self.filas


def test_live_con_firms_caido_sirve_la_ultima_consulta_y_lo_dice(monkeypatch):
    consultado = datetime.now(UTC) - timedelta(hours=3)
    fila = ("N20-x", -42.5, -71.3, consultado, "N20", "VIIRS", "nominal", 3.2, "D", "-42.5_-71.4", None, None)
    base = _BaseFalsa((consultado, "ConnectTimeout"), [fila])

    @contextmanager
    def conectar():
        yield base

    monkeypatch.setattr(vivo, "conectar", conectar)
    r = TestClient(app).get("/api/v1/live", params={"bbox": "-76,-56,-53,-21"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["stale"] is True and len(cuerpo["features"]) == 1
    assert cuerpo["fetched_at"] == f"{consultado:%Y-%m-%dT%H:%M:%SZ}"
    assert "última consulta a FIRMS" in cuerpo["message"]


def test_weather_con_meteomatics_caido_sirve_la_copia_y_lo_dice(monkeypatch, tmp_path):
    respaldo = tmp_path / "meteomatics"
    respaldo.mkdir()
    punto = {"time": "2026-11-14T18:00:00Z", "temperature_c": 21.0}
    copia = {"fetched_at": "2026-11-14T18:10:00Z", "puntos": [punto, punto]}
    (respaldo / "-42.5_-71.4.json").write_text(json.dumps(copia))
    monkeypatch.setattr(tiempo, "RESPALDO", respaldo)
    monkeypatch.setattr(tiempo, "CLIENTE", httpx.Client(transport=httpx.MockTransport(_caido)))
    monkeypatch.setenv("METEOMATICS_USER", "u")
    monkeypatch.setenv("METEOMATICS_PASSWORD", "p")
    tiempo._cache.clear()

    r = TestClient(app).get("/api/v1/weather", params={"lat": -42.45, "lon": -71.35, "hours": 1})
    assert r.status_code == 200
    assert r.json()["stale"] is True and "copia" in r.json()["message"]


def test_error_de_lectura_de_duckdb_es_503_del_contrato(monkeypatch):
    monkeypatch.delenv("DATA_MANIFEST_URL", raising=False)

    def falla():
        raise duckdb.HTTPException("HTTP GET error: 502")

    monkeypatch.setattr(hotspots, "conexion", falla)
    r = TestClient(app).get("/api/v1/hotspots", params={"bbox": "-76,-56,-53,-21"})
    assert r.status_code == 503 and r.json()["code"] == "datos_no_disponibles"


def test_error_inesperado_sale_con_el_esquema_error_y_sin_detalles(monkeypatch):
    monkeypatch.delenv("DATA_MANIFEST_URL", raising=False)

    def falla():
        raise RuntimeError("detalle interno /ruta/secreta")

    monkeypatch.setattr(hotspots, "conexion", falla)
    r = TestClient(app, raise_server_exceptions=False).get(
        "/api/v1/hotspots", params={"bbox": "-76,-56,-53,-21"}
    )
    assert r.status_code == 500
    assert r.json() == {"code": "error_interno", "message": ERRORES[500][1]}


def test_la_copia_queda_fuera_del_repo():
    # data/* está ignorado salvo data/muestras: la copia no puede terminar en un commit.
    assert datos.COPIA.parts[0] == "data" and "muestras" not in datos.COPIA.parts
    assert Path(".gitignore").read_text().splitlines().count("data/*") == 1
