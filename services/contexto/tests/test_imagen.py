"""Pruebas mínimas de F3-B4 (#44). Ninguna prueba llama a Copernicus: se usa un transporte simulado.

`grabado/catalogo.json` es una búsqueda real del Catalog del 14/11/2026 (El Bolsón, 5 km, 30 días) y
`grabado/process.png`, una imagen real de 64×64 del Process. El token no se graba: el de las pruebas es falso.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from contexto import imagen
from fastapi import FastAPI
from fastapi.testclient import TestClient

GRABADO = Path(__file__).parent / "grabado"
CATALOGO = json.loads((GRABADO / "catalogo.json").read_text())
PNG = (GRABADO / "process.png").read_bytes()
SECRETO = "secreto-de-prueba-456"
AHORA = datetime(2026, 11, 14, 18, 30, tzinfo=UTC)
PUNTO = {"lat": -42.1, "lon": -71.3}


class Copernicus:
    """Transporte simulado: cuenta los pedidos por API y responde lo que se le diga."""

    def __init__(self, catalogo=None, process=None, token=None):
        self.pedidos: list[httpx.Request] = []
        self.catalogo = catalogo or (lambda _: httpx.Response(200, json=CATALOGO))
        self.process = process or (
            lambda _: httpx.Response(200, content=PNG, headers={"content-type": "image/png"})
        )
        self.token = token or (
            lambda _: httpx.Response(200, json={"access_token": "tok-1", "expires_in": 1800})
        )

    def __call__(self, pedido: httpx.Request) -> httpx.Response:
        self.pedidos.append(pedido)
        if pedido.url.path.endswith("/token"):
            return self.token(pedido)
        if pedido.url.path.endswith("/search"):
            return self.catalogo(pedido)
        return self.process(pedido)

    def contar(self, fin: str) -> int:
        return sum(p.url.path.endswith(fin) for p in self.pedidos)


@pytest.fixture
def entorno(monkeypatch, tmp_path):
    monkeypatch.setenv("CDSE_CLIENT_ID", "cliente-de-prueba")
    monkeypatch.setenv("CDSE_CLIENT_SECRET", SECRETO)
    monkeypatch.setattr(imagen, "CACHE", tmp_path / "imagenes")
    monkeypatch.setattr(imagen, "_ahora", lambda: AHORA)
    monkeypatch.setattr(imagen, "_token", None)

    def usar(fuente: Copernicus):
        monkeypatch.setattr(imagen, "CLIENTE", httpx.Client(transport=httpx.MockTransport(fuente)))
        app = FastAPI()
        app.include_router(imagen.router)
        return TestClient(app)

    return usar


def test_elige_la_escena_mas_reciente_por_debajo_del_umbral_de_nubes(entorno):
    fuente = Copernicus()
    r = entorno(fuente).get("/imagery/latest", params=PUNTO)
    assert r.status_code == 200
    cuerpo = r.json()
    # La del 10/11 tiene 57 % de nubes: gana el 7/11 y, de las escenas de ese día, la más despejada.
    assert cuerpo["acquired_at"].startswith("2026-11-07")
    assert cuerpo["cloud_cover_pct"] == 0.0
    assert cuerpo["style"] == "color_real"
    assert cuerpo["source"] == "Copernicus Sentinel-2 L2A"
    assert cuerpo["attribution"] == "Contiene datos modificados de Copernicus Sentinel 2026"
    oeste, sur, este, norte = cuerpo["bbox"]
    assert oeste < PUNTO["lon"] < este and sur < PUNTO["lat"] < norte
    assert cuerpo["image_url"] == f"/api/v1/imagery/{cuerpo['image_id']}.png"
    # La imagen se genera para el día de la escena.
    (process,) = [p for p in fuente.pedidos if p.url.path.endswith("/process")]
    rango = json.loads(process.content)["input"]["data"][0]["dataFilter"]["timeRange"]
    assert rango["from"].startswith("2026-11-07")


def test_la_imagen_generada_se_sirve_desde_la_cache(entorno):
    cliente = entorno(Copernicus())
    image_id = cliente.get("/imagery/latest", params=PUNTO).json()["image_id"]
    r = cliente.get(f"/imagery/{image_id}.png")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content == PNG


def test_umbral_mas_permisivo_acepta_la_escena_mas_nueva(entorno):
    r = entorno(Copernicus()).get("/imagery/latest", params={**PUNTO, "max_cloud_pct": 60})
    assert r.json()["acquired_at"].startswith("2026-11-10")
    assert r.json()["cloud_cover_pct"] == 56.72


def test_sin_escena_responde_sin_imagen(entorno):
    vacio = Copernicus(
        catalogo=lambda _: httpx.Response(200, json={"type": "FeatureCollection", "features": []})
    )
    r = entorno(vacio).get("/imagery/latest", params=PUNTO)
    assert r.status_code == 404
    assert r.json()["code"] == "sin_imagen"


@pytest.mark.parametrize(
    "fuente",
    [
        Copernicus(process=lambda _: httpx.Response(429, json={"error": "quota"})),
        Copernicus(catalogo=lambda _: httpx.Response(503)),
        Copernicus(token=lambda _: httpx.Response(401, json={"error": "invalid_client"})),
        Copernicus(catalogo=lambda p: (_ for _ in ()).throw(httpx.ReadTimeout("lento", request=p))),
    ],
    ids=["cuota_agotada", "5xx", "token_rechazado", "tiempo_agotado"],
)
def test_cuota_agotada_o_error_responde_no_disponible_nunca_500(entorno, fuente, caplog):
    r = entorno(fuente).get("/imagery/latest", params=PUNTO)
    assert r.status_code == 503
    assert set(r.json()) == {"code", "message"}
    assert SECRETO not in r.text and SECRETO not in caplog.text


def test_la_cache_evita_una_segunda_llamada_a_process_y_el_token_se_reutiliza(entorno):
    fuente = Copernicus()
    cliente = entorno(fuente)
    primera = cliente.get("/imagery/latest", params=PUNTO).json()
    segunda = cliente.get("/imagery/latest", params=PUNTO).json()
    assert segunda["image_id"] == primera["image_id"]
    assert fuente.contar("/process") == 1
    assert fuente.contar("/token") == 1
    # Otro estilo es otra imagen.
    cliente.get("/imagery/latest", params={**PUNTO, "style": "falso_color"})
    assert fuente.contar("/process") == 2


def test_token_vencido_se_pide_otro(entorno, monkeypatch):
    fuente = Copernicus()
    cliente = entorno(fuente)
    cliente.get("/imagery/latest", params=PUNTO)
    monkeypatch.setattr(imagen, "_ahora", lambda: datetime(2026, 11, 14, 19, 5, tzinfo=UTC))  # 35 min después
    cliente.get("/imagery/latest", params=PUNTO)
    assert fuente.contar("/token") == 2


@pytest.mark.parametrize("image_id", ["no-existe", "..%2F..%2Fetc%2Fpasswd"])
def test_imagen_desconocida_da_404(entorno, image_id):
    # Con el router suelto, una ruta que no matchea da el 404 de FastAPI; montado, la API lo pasa a `Error`.
    assert entorno(Copernicus()).get(f"/imagery/{image_id}.png").status_code == 404
