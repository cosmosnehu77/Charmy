"""Servicio de predicción por zona (#336): ¿qué tan probable es un fuego fuerte en esta zona, en cada mes?

Lo llama solo la API de Charmy, con un token de servicio; el navegador nunca.

- `GET /salud`: 200 con el modelo cargado, 503 si no. Sin token.
- `POST /prediccion/zona`: recibe una zona (`bbox`, `geometria` GeoJSON o `region`) y devuelve, por cada mes
  pronosticado, la probabilidad de al menos un evento en la zona, lo habitual para ese mes y cuántas celdas
  de 0,1° se esperan con evento.

Al arrancar baja el modelo de un Release de GitHub, una sola vez: `MODELO_URL` apunta a `modelo.json` y
`MODELO_SHA256` es su SHA-256. El manifiesto nombra los demás archivos (un LightGBM por plazo y las entradas
del mes de emisión) con su propio SHA-256, y cada uno se verifica antes de usarlo. Si algo falla, el servicio
arranca igual, `/salud` responde 503 y la predicción también.

Las entradas (las variables de cada celda en el mes de emisión) se calculan fuera, en el entrenamiento, porque
necesitan toda la historia de focos; acá solo se evalúa el modelo y se lleva el resultado a la zona.

Variables de entorno: MODELO_URL, MODELO_SHA256, PREDICCION_TOKEN. Se leen al usarlas, no al importar.
"""

import hashlib
import hmac
import io
import json
import logging
import math
import os
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Annotated, Any

import lightgbm as lgb
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, TypeAdapter, model_validator

registro = logging.getLogger("prediccion.servir")

TIEMPO_DESCARGA = 60  # segundos por archivo
MAX_VERTICES = 5000  # de sobra para un área dibujada a mano; frena pedidos abusivos
NIVELES = ((0.10, "muy baja"), (0.30, "baja"), (0.60, "media"), (0.85, "alta"))
BLOQUES = (9, 25, 100, 400)  # celdas de los cuadrados con que se ajustó κ (0,3°, 0,5°, 1° y 2° de lado)


def descargar(url: str) -> bytes:
    if urllib.parse.urlsplit(url).scheme not in ("http", "https"):
        raise ValueError("la URL del modelo tiene que ser http o https")
    with urllib.request.urlopen(url, timeout=TIEMPO_DESCARGA) as r:  # noqa: S310 (esquema comprobado arriba)
        return r.read()


@dataclass
class Plazo:
    horizonte: int
    mes: str
    prob: np.ndarray  # probabilidad calibrada del evento, por celda
    habitual: np.ndarray  # frecuencia histórica del evento en ese mes del año, por celda
    kappa: dict[str, float]
    mejora: float | None


@dataclass
class Modelo:
    nombre: str
    emision: str
    evento: str
    lat: np.ndarray
    lon: np.ndarray
    region: np.ndarray
    plazos: list[Plazo]


def _verificado(datos: bytes, sha256: str, nombre: str) -> bytes:
    if not hmac.compare_digest(hashlib.sha256(datos).hexdigest(), sha256.strip().lower()):
        raise ValueError(f"el SHA-256 de {nombre} no coincide")
    return datos


def cargar(url: str, sha256: str, bajar: Callable[[str], bytes]) -> Modelo:
    """Baja, verifica y evalúa el modelo: deja la probabilidad de cada celda para cada plazo."""
    m = json.loads(_verificado(bajar(url), sha256, "modelo.json"))
    e = m["entradas"]
    datos = _verificado(bajar(urllib.parse.urljoin(url, e["archivo"])), e["sha256"], e["archivo"])
    with np.load(io.BytesIO(datos), allow_pickle=False) as z:
        lat, lon, region = z["lat"].astype(float), z["lon"].astype(float), z["region"].astype(str)
        x, habitual = z["x"], z["habitual"]
    if not m["horizontes"] or x.shape != (len(m["horizontes"]), len(lat), len(m["variables"])):
        raise ValueError("las entradas no tienen la forma que dice el manifiesto")
    plazos = []
    for i, h in enumerate(m["horizontes"]):
        texto = _verificado(bajar(urllib.parse.urljoin(url, h["archivo"])), h["sha256"], h["archivo"])
        arbol = lgb.Booster(model_str=texto.decode())
        cal = h["calibracion"]
        prob = np.interp(arbol.predict(x[i]), cal["predicho"], cal["observado"])
        plazos.append(
            Plazo(
                horizonte=int(h["horizonte"]),
                mes=h["mes"],
                prob=np.clip(prob, 0, 1),
                habitual=np.clip(habitual[i].astype(float), 0, 1),
                kappa={k: float(v) for k, v in h["kappa"].items()},
                mejora=h.get("mejora_vs_climatologia"),
            )
        )
    return Modelo(m["modelo"], m["emision"], m["evento"], lat, lon, region, plazos)


# ---------- la zona ----------


Punto = Annotated[list[float], Field(min_length=2, max_length=3)]
Anillo = Annotated[list[Punto], Field(min_length=4)]
Poligono = Annotated[list[Anillo], Field(min_length=1)]


def _en_rango(lon: float, lat: float) -> None:
    if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
        raise ValueError("coordenadas fuera de rango (van como longitud, latitud en grados)")


class Geometria(BaseModel):
    """Geometría GeoJSON: `Polygon` o `MultiPolygon`, en longitud y latitud (WGS84)."""

    type: str
    coordinates: Any
    _poligonos: list = PrivateAttr(default_factory=list)

    def poligonos(self) -> list[list[list[list[float]]]]:
        return self._poligonos

    @model_validator(mode="after")
    def _validar(self):
        if self.type == "Polygon":
            self._poligonos = [TypeAdapter(Poligono).validate_python(self.coordinates)]
        elif self.type == "MultiPolygon":
            adaptador = TypeAdapter(Annotated[list[Poligono], Field(min_length=1)])
            self._poligonos = adaptador.validate_python(self.coordinates)
        else:
            raise ValueError("la geometría tiene que ser Polygon o MultiPolygon")
        vertices = 0
        for poligono in self._poligonos:
            for anillo in poligono:
                vertices += len(anillo)
                for punto in anillo:
                    _en_rango(punto[0], punto[1])
        if vertices > MAX_VERTICES:
            raise ValueError(f"la geometría tiene más de {MAX_VERTICES} vértices")
        return self


class Zona(BaseModel):
    """La zona a consultar: exactamente una de las tres formas."""

    model_config = ConfigDict(extra="forbid")

    bbox: Annotated[list[float], Field(min_length=4, max_length=4)] | None = Field(
        None, description="[oeste, sur, este, norte] en grados"
    )
    geometria: Geometria | None = Field(
        None, description="Polygon o MultiPolygon GeoJSON (o un Feature que lo traiga)"
    )
    region: Annotated[str, Field(min_length=1, max_length=10)] | None = Field(
        None, description="Código ISO 3166-2 de la provincia o región, p. ej. AR-U"
    )

    @model_validator(mode="before")
    @classmethod
    def _feature(cls, datos):
        # Lo que dibuja un mapa suele llegar como Feature: se toma su geometría.
        if isinstance(datos, dict) and isinstance(datos.get("geometria"), dict):
            g = datos["geometria"]
            if g.get("type") == "Feature":
                datos = datos | {"geometria": g.get("geometry")}
        return datos

    @model_validator(mode="after")
    def _una_sola(self):
        if sum(v is not None for v in (self.bbox, self.geometria, self.region)) != 1:
            raise ValueError("mandá exactamente uno de: bbox, geometria o region")
        if self.bbox is not None:
            oeste, sur, este, norte = self.bbox
            _en_rango(oeste, sur)
            _en_rango(este, norte)
            if oeste >= este or sur >= norte:
                raise ValueError("el bbox va como [oeste, sur, este, norte]")
        return self


def _dentro(lon: np.ndarray, lat: np.ndarray, anillos: list[list[list[float]]]) -> np.ndarray:
    """Qué puntos caen dentro del polígono (regla par-impar sobre todos sus anillos: los huecos restan)."""
    adentro = np.zeros(len(lon), bool)
    for anillo in anillos:
        a = np.asarray(anillo, float)[:, :2]
        x1, y1 = a[:-1, 0][:, None], a[:-1, 1][:, None]
        x2, y2 = a[1:, 0][:, None], a[1:, 1][:, None]
        cruza = (y1 > lat) != (y2 > lat)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_cruce = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
        adentro ^= (np.sum(cruza & (lon < x_cruce), axis=0) % 2).astype(bool)
    return adentro


def celdas_de(zona: Zona, m: Modelo) -> np.ndarray:
    """Las celdas cuyo centro cae en la zona."""
    if zona.region is not None:
        return m.region == zona.region
    if zona.bbox is not None:
        oeste, sur, este, norte = zona.bbox
        return (m.lon >= oeste) & (m.lon <= este) & (m.lat >= sur) & (m.lat <= norte)
    adentro = np.zeros(len(m.lat), bool)
    for poligono in zona.geometria.poligonos():
        adentro |= _dentro(m.lon, m.lat, poligono)
    return adentro


def _kappa(plazo: Plazo, celdas: int, provincia: bool) -> float:
    """Las celdas vecinas se queman juntas, así que no se combinan como si fueran independientes (κ = 1):
    κ < 1 se ajustó con áreas de varios tamaños, y acá se interpola según cuántas celdas tiene la zona."""
    if provincia:
        return plazo.kappa["provincia"]
    return float(np.interp(math.log(max(celdas, 1)), np.log(BLOQUES), [plazo.kappa[str(b)] for b in BLOQUES]))


def _al_menos_uno(p: np.ndarray, kappa: float) -> float:
    return float(1 - np.exp(kappa * np.log1p(-np.clip(p, 0, 1 - 1e-6)).sum()))


def _nivel(p: float) -> str:
    return next((nombre for tope, nombre in NIVELES if p < tope), "muy alta")


def predecir(zona: Zona, m: Modelo) -> dict:
    mias = celdas_de(zona, m)
    n = int(mias.sum())
    meses = []
    for plazo in m.plazos:
        kappa = _kappa(plazo, n, zona.region is not None)
        p, habitual = plazo.prob[mias], plazo.habitual[mias]
        prob = _al_menos_uno(p, kappa)
        meses.append(
            {
                "mes": plazo.mes,
                "horizonte": plazo.horizonte,
                "probabilidad": round(prob, 4),
                "probabilidad_habitual": round(_al_menos_uno(habitual, kappa), 4),
                "celdas_esperadas": round(float(p.sum()), 2),
                "celdas_habituales": round(float(habitual.sum()), 2),
                "celda_mas_alta": round(float(p.max()), 4) if n else 0.0,
                "nivel": _nivel(prob),
                "mejora_vs_climatologia": plazo.mejora,
            }
        )
    return {
        "modelo": m.nombre,
        "emision": m.emision,
        "evento": m.evento,
        # Sin celdas con historia de focos, la zona no se quemó en los años con datos: probabilidad ~0.
        "zona": {"celdas": n, "sin_historia": n == 0},
        "meses": meses,
    }


# ---------- la aplicación ----------


def crear_app(bajar: Callable[[str], bytes] = descargar) -> FastAPI:
    estado: dict[str, Modelo | None] = {"modelo": None}

    @asynccontextmanager
    async def vida(app: FastAPI):
        url, sha256 = os.environ.get("MODELO_URL"), os.environ.get("MODELO_SHA256")
        if not url or not sha256:
            registro.warning("faltan MODELO_URL o MODELO_SHA256: el servicio queda sin modelo")
        else:
            try:
                estado["modelo"] = cargar(url, sha256, bajar)
                registro.info(
                    "modelo %s cargado, %d celdas", estado["modelo"].nombre, len(estado["modelo"].lat)
                )
            except Exception as e:  # cualquier falla deja el servicio arriba y sin modelo (503)
                registro.warning("no se pudo cargar el modelo: %s: %s", type(e).__name__, e)
        yield

    app = FastAPI(title="Charmy · predicción por zona", version="1", lifespan=vida)

    @app.exception_handler(RequestValidationError)
    async def pedido_invalido(_, error: RequestValidationError):
        # Sin el `input` que FastAPI repite por defecto: puede traer NaN, que no entra en un JSON.
        detalle = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in error.errors()]
        return JSONResponse({"detail": detalle}, status_code=422)

    def con_token(authorization: Annotated[str | None, Header()] = None) -> None:
        esperado = os.environ.get("PREDICCION_TOKEN")
        if not esperado:
            raise HTTPException(503, "el servicio no tiene token configurado")
        esquema, _, recibido = (authorization or "").partition(" ")
        if esquema != "Bearer" or not hmac.compare_digest(recibido.strip().encode(), esperado.encode()):
            raise HTTPException(401, "token de servicio inválido", headers={"WWW-Authenticate": "Bearer"})

    @app.get("/salud")
    def salud():
        m = estado["modelo"]
        if m is None:
            return JSONResponse({"estado": "sin_modelo"}, status_code=503)
        return {"estado": "ok", "modelo": m.nombre, "emision": m.emision, "celdas": len(m.lat)}

    @app.post("/prediccion/zona", dependencies=[Depends(con_token)])
    def prediccion_zona(zona: Zona):
        m = estado["modelo"]
        if m is None:
            raise HTTPException(503, "predicción no disponible: el modelo no está cargado")
        if zona.region is not None and zona.region not in m.region:
            raise HTTPException(404, "región desconocida")
        return predecir(zona, m)

    return app


app = crear_app()
