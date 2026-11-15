"""Pruebas mínimas de #336: el servicio de predicción por zona. Modelo diminuto armado acá, sin red."""

import hashlib
import io
import json
import math
import urllib.error

import lightgbm as lgb
import numpy as np
import pytest
from fastapi.testclient import TestClient
from prediccion import servir

BASE = "https://ejemplo.invalid/modelo-v1/"
TOKEN = "token-de-prueba"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
# Cuatro celdas juntas en Chubut y dos en Córdoba (centros de celdas de 0,1°).
LAT = np.array([-42.05, -42.05, -41.95, -41.95, -31.05, -31.05])
LON = np.array([-71.55, -71.45, -71.55, -71.45, -64.55, -64.45])
REGION = np.array(["AR-U", "AR-U", "AR-U", "AR-U", "AR-X", "AR-X"])
COMARCA = [-71.6, -42.1, -71.4, -41.9]  # contiene las cuatro de Chubut
KAPPA = {"9": 0.5, "25": 0.5, "100": 0.6, "400": 0.6, "provincia": 0.7}


def sha(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def artefactos() -> dict:
    """Un modelo de dos plazos y tres variables, con sus entradas, tal como se publican en el Release."""
    rng = np.random.default_rng(0)
    x_entreno = rng.random((200, 3))
    y = (x_entreno[:, 0] + 0.2 * rng.random(200) > 0.6).astype(float)
    parametros = {
        "objective": "binary",
        "min_data_in_leaf": 5,
        "verbose": -1,
        "seed": 0,
        "deterministic": True,
    }
    archivos, horizontes, esperado = {}, [], {}
    x = rng.random((2, len(LAT), 3)).astype(np.float32)
    habitual = np.round(rng.random((2, len(LAT))) * 0.5, 3).astype(np.float32)
    for i, h in enumerate((1, 2)):
        modelo = lgb.train(parametros, lgb.Dataset(x_entreno, y), num_boost_round=5 + h)
        texto = modelo.model_to_string().encode()
        archivos[f"modelo-h{h}.txt"] = texto
        esperado[h] = modelo.predict(x[i]) / 2  # la calibración de abajo parte la probabilidad a la mitad
        horizontes.append(
            {
                "horizonte": h,
                "mes": f"2026-{10 + h}",
                "archivo": f"modelo-h{h}.txt",
                "sha256": sha(texto),
                "calibracion": {"predicho": [0.0, 1.0], "observado": [0.0, 0.5]},
                "kappa": KAPPA,
                "mejora_vs_climatologia": 0.1,
            }
        )
    entradas = io.BytesIO()
    np.savez(
        entradas,
        cell_id=np.arange(len(LAT)).astype(str),
        lat=LAT,
        lon=LON,
        region=REGION,
        x=x,
        habitual=habitual,
    )
    archivos["entradas.npz"] = entradas.getvalue()
    manifiesto = {
        "modelo": "modelo-de-prueba",
        "emision": "2026-10",
        "evento": "foco de confianza alta, o fuego en 2 o más días del mes",
        "variables": ["a", "b", "c"],
        "entradas": {"archivo": "entradas.npz", "sha256": sha(archivos["entradas.npz"])},
        "horizontes": horizontes,
    }
    archivos["modelo.json"] = json.dumps(manifiesto).encode()
    return {"archivos": archivos, "esperado": esperado, "habitual": habitual}


class Descarga:
    """Reemplaza a la red: devuelve los archivos del Release de prueba y cuenta los pedidos."""

    def __init__(self, archivos: dict, falla: dict | None = None):
        self.archivos, self.falla, self.pedidos = archivos, falla or {}, []

    def __call__(self, url: str) -> bytes:
        self.pedidos.append(url)
        nombre = url.removeprefix(BASE)
        if nombre in self.falla:
            raise self.falla[nombre]
        return self.archivos[nombre]


@pytest.fixture
def modelo():
    return artefactos()


@pytest.fixture
def entorno(monkeypatch, modelo):
    monkeypatch.setenv("MODELO_URL", BASE + "modelo.json")
    monkeypatch.setenv("MODELO_SHA256", sha(modelo["archivos"]["modelo.json"]))
    monkeypatch.setenv("PREDICCION_TOKEN", TOKEN)


def cliente(descarga) -> TestClient:
    return TestClient(servir.crear_app(descarga))


def area(p: np.ndarray, kappa: float) -> float:
    return 1 - math.exp(kappa * float(np.log1p(-p).sum()))


# ---------- /salud ----------


def test_salud_responde_200_con_el_modelo_cargado(entorno, modelo):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.get("/salud")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok", "modelo": "modelo-de-prueba", "emision": "2026-10", "celdas": 6}


def test_salud_responde_503_sin_modelo_url(monkeypatch, modelo):
    monkeypatch.delenv("MODELO_URL", raising=False)
    monkeypatch.delenv("MODELO_SHA256", raising=False)
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.get("/salud")
    assert r.status_code == 503
    assert r.json()["estado"] == "sin_modelo"


@pytest.mark.parametrize(
    "error",
    [
        TimeoutError("tiempo agotado"),
        urllib.error.HTTPError(BASE, 404, "Not Found", None, None),
        urllib.error.HTTPError(BASE, 503, "Service Unavailable", None, None),
        urllib.error.URLError("sin red"),
    ],
)
@pytest.mark.parametrize("archivo", ["modelo.json", "modelo-h2.txt", "entradas.npz"])
def test_si_la_descarga_falla_el_servicio_arranca_y_avisa_503(entorno, modelo, error, archivo):
    with cliente(Descarga(modelo["archivos"], falla={archivo: error})) as c:
        assert c.get("/salud").status_code == 503
        r = c.post("/prediccion/zona", json={"bbox": COMARCA}, headers=AUTH)
    assert r.status_code == 503


def test_si_el_sha256_del_manifiesto_no_coincide_no_se_carga(entorno, modelo, monkeypatch):
    monkeypatch.setenv("MODELO_SHA256", "0" * 64)
    with cliente(Descarga(modelo["archivos"])) as c:
        assert c.get("/salud").status_code == 503


@pytest.mark.parametrize("archivo", ["modelo-h1.txt", "entradas.npz"])
def test_si_el_sha256_de_un_archivo_no_coincide_no_se_carga(entorno, modelo, archivo):
    alterados = modelo["archivos"] | {archivo: modelo["archivos"][archivo] + b" "}
    with cliente(Descarga(alterados)) as c:
        assert c.get("/salud").status_code == 503


def test_un_manifiesto_roto_no_tira_el_servicio(monkeypatch, modelo):
    roto = b'{"modelo": "sin horizontes"}'
    monkeypatch.setenv("MODELO_URL", BASE + "modelo.json")
    monkeypatch.setenv("MODELO_SHA256", sha(roto))
    with cliente(Descarga(modelo["archivos"] | {"modelo.json": roto})) as c:
        assert c.get("/salud").status_code == 503


def test_el_modelo_se_descarga_una_sola_vez(entorno, modelo):
    descarga = Descarga(modelo["archivos"])
    with cliente(descarga) as c:
        for _ in range(3):
            assert c.post("/prediccion/zona", json={"bbox": COMARCA}, headers=AUTH).status_code == 200
            c.get("/salud")
    assert sorted(descarga.pedidos) == sorted(BASE + n for n in modelo["archivos"])


def test_descargar_solo_acepta_http_y_https():
    with pytest.raises(ValueError):
        servir.descargar("file:///etc/passwd")


def test_descargar_de_verdad_con_tiempo_agotado_no_tira_el_servicio(entorno, monkeypatch):
    def agotado(*args, **kwargs):
        raise TimeoutError("tiempo agotado")

    monkeypatch.setattr(servir.urllib.request, "urlopen", agotado)
    with TestClient(servir.crear_app()) as c:
        assert c.get("/salud").status_code == 503


# ---------- /prediccion/zona: quién puede llamar ----------


@pytest.mark.parametrize("cabecera", [None, "Bearer otro-token", TOKEN, f"Basic {TOKEN}"])
def test_sin_token_valido_responde_401(entorno, modelo, cabecera):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post(
            "/prediccion/zona",
            json={"bbox": COMARCA},
            headers={"Authorization": cabecera} if cabecera else {},
        )
    assert r.status_code == 401


def test_sin_token_configurado_nadie_entra(entorno, modelo, monkeypatch):
    monkeypatch.delenv("PREDICCION_TOKEN")
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post("/prediccion/zona", json={"bbox": COMARCA}, headers={"Authorization": "Bearer "})
    assert r.status_code == 503


# ---------- /prediccion/zona: respuestas ----------


def test_zona_por_bbox_da_la_probabilidad_de_cada_mes(entorno, modelo):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post("/prediccion/zona", json={"bbox": COMARCA}, headers=AUTH)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["modelo"] == "modelo-de-prueba"
    assert cuerpo["emision"] == "2026-10"
    assert cuerpo["evento"].startswith("foco de confianza alta")
    assert cuerpo["zona"] == {"celdas": 4, "sin_historia": False}
    assert [m["mes"] for m in cuerpo["meses"]] == ["2026-11", "2026-12"]
    for i, mes in enumerate(cuerpo["meses"]):
        p, hab = modelo["esperado"][i + 1][:4], modelo["habitual"][i][:4]
        assert mes["horizonte"] == i + 1
        assert mes["probabilidad"] == pytest.approx(area(p, 0.5), abs=1e-4)  # 4 celdas: κ de áreas chicas
        assert mes["probabilidad_habitual"] == pytest.approx(area(hab, 0.5), abs=1e-4)
        assert mes["celdas_esperadas"] == pytest.approx(float(p.sum()), abs=1e-2)
        assert mes["celdas_habituales"] == pytest.approx(float(hab.sum()), abs=1e-2)
        assert mes["celda_mas_alta"] == pytest.approx(float(p.max()), abs=1e-4)
        assert mes["mejora_vs_climatologia"] == 0.1
        assert mes["nivel"] in {"muy baja", "baja", "media", "alta", "muy alta"}


def test_un_poligono_dibujado_da_lo_mismo_que_su_bbox(entorno, modelo):
    x0, y0, x1, y1 = COMARCA
    poligono = {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}
    with cliente(Descarga(modelo["archivos"])) as c:
        por_bbox = c.post("/prediccion/zona", json={"bbox": COMARCA}, headers=AUTH).json()
        por_poligono = c.post("/prediccion/zona", json={"geometria": poligono}, headers=AUTH).json()
        como_feature = c.post(
            "/prediccion/zona", json={"geometria": {"type": "Feature", "geometry": poligono}}, headers=AUTH
        ).json()
    assert por_poligono == por_bbox == como_feature


def test_un_poligono_solo_cuenta_las_celdas_cuyo_centro_cae_adentro(entorno, modelo):
    # Triángulo que deja afuera la celda del noreste (-41.95, -71.45) y un hueco que saca la del suroeste.
    triangulo = [[-71.6, -42.1], [-71.35, -42.1], [-71.6, -41.85], [-71.6, -42.1]]
    hueco = [[-71.58, -42.08], [-71.52, -42.08], [-71.52, -42.02], [-71.58, -42.02], [-71.58, -42.08]]
    with cliente(Descarga(modelo["archivos"])) as c:
        sin_hueco = c.post(
            "/prediccion/zona",
            json={"geometria": {"type": "Polygon", "coordinates": [triangulo]}},
            headers=AUTH,
        ).json()
        con_hueco = c.post(
            "/prediccion/zona",
            json={"geometria": {"type": "Polygon", "coordinates": [triangulo, hueco]}},
            headers=AUTH,
        ).json()
        dos_partes = c.post(
            "/prediccion/zona",
            json={
                "geometria": {
                    "type": "MultiPolygon",
                    "coordinates": [
                        [triangulo],
                        [[[-64.6, -31.1], [-64.4, -31.1], [-64.4, -31.0], [-64.6, -31.1]]],
                    ],
                }
            },
            headers=AUTH,
        ).json()
    assert sin_hueco["zona"]["celdas"] == 3
    assert con_hueco["zona"]["celdas"] == 2
    assert dos_partes["zona"]["celdas"] == 4  # las tres del triángulo y una de las de Córdoba


def test_zona_por_provincia_usa_todas_sus_celdas(entorno, modelo):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post("/prediccion/zona", json={"region": "AR-X"}, headers=AUTH)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["zona"] == {"celdas": 2, "sin_historia": False}
    p = modelo["esperado"][1][4:]
    assert cuerpo["meses"][0]["probabilidad"] == pytest.approx(area(p, 0.7), abs=1e-4)  # κ de provincia


def test_una_zona_sin_celdas_con_historia_da_probabilidad_cero(entorno, modelo):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post("/prediccion/zona", json={"bbox": [-70.0, -50.0, -69.0, -49.0]}, headers=AUTH)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["zona"] == {"celdas": 0, "sin_historia": True}
    assert [m["probabilidad"] for m in cuerpo["meses"]] == [0.0, 0.0]
    assert {m["nivel"] for m in cuerpo["meses"]} == {"muy baja"}


def test_una_provincia_desconocida_responde_404(entorno, modelo):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post("/prediccion/zona", json={"region": "AR-ZZ"}, headers=AUTH)
    assert r.status_code == 404


@pytest.mark.parametrize(
    "pedido",
    [
        {},
        {"bbox": COMARCA, "region": "AR-U"},
        {"bbox": [-71.4, -42.1, -71.6, -41.9]},  # oeste y este invertidos
        {"bbox": [-71.6, -42.1, -71.4]},
        {"bbox": [-200, -42.1, -71.4, -41.9]},
        {"bbox": [-71.6, -42.1, -71.4, float("nan")]},
        {"geometria": {"type": "Point", "coordinates": [-71.5, -42.0]}},
        {"geometria": {"type": "Polygon", "coordinates": [[[-71.6, -42.1], [-71.4, -42.1], [-71.6, -42.1]]]}},
        {
            "geometria": {
                "type": "Polygon",
                "coordinates": [[[-71.6, -42.1], [-71.4, 95], [-71.6, -41.9], [-71.6, -42.1]]],
            }
        },
        {"geometria": {"type": "Polygon", "coordinates": "no es una lista"}},
        {"region": ""},
        {"bbox": COMARCA, "otra_cosa": 1},
    ],
)
def test_un_pedido_invalido_responde_422(entorno, modelo, pedido):
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post(
            "/prediccion/zona",
            content=json.dumps(pedido),
            headers=AUTH | {"Content-Type": "application/json"},
        )
    assert r.status_code == 422


def test_un_poligono_con_demasiados_vertices_responde_422(entorno, modelo):
    anillo = [[-71.6 + 1e-6 * i, -42.1] for i in range(servir.MAX_VERTICES + 1)] + [
        [-71.5, -41.9],
        [-71.6, -42.1],
    ]
    with cliente(Descarga(modelo["archivos"])) as c:
        r = c.post(
            "/prediccion/zona", json={"geometria": {"type": "Polygon", "coordinates": [anillo]}}, headers=AUTH
        )
    assert r.status_code == 422
