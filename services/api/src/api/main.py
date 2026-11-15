"""API de Charmy. Implementa packages/contracts/api/openapi.yaml bajo /api/v1.

Ninguna clave se lee al importar: la API arranca sin .env.
"""

import logging
import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import duckdb
from contexto import imagen, tiempo
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from api import avisos, calendario, cap, hotspots, prediccion, regiones, vivo
from api.datos import DatosNoDisponibles, copiar, version
from api.errores import ErrorDeContrato, respuesta

log = logging.getLogger(__name__)


def _copiar_datos() -> None:
    try:
        log.warning("Copia local de los datos: %s archivos nuevos", copiar())
    except DatosNoDisponibles as error:
        log.warning("Sin copia local de los datos: %s", error)


@asynccontextmanager
async def arranque(_: FastAPI) -> AsyncIterator[None]:
    # La copia baja en segundo plano: la API responde desde el primer momento, leyendo del release.
    threading.Thread(target=_copiar_datos, daemon=True).start()
    yield


app = FastAPI(
    title="Charmy API",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
    lifespan=arranque,
)
# Orígenes de los frontends publicados, separados por coma (CORS_ORIGINS). Localhost se permite en cualquier
# puerto para desarrollo. No es un secreto: se lee al crear la app.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
v1 = APIRouter(prefix="/api/v1")

# Códigos del esquema `Error` del contrato, con mensajes cortos para el público.
ERRORES = {
    404: ("no_existe", "No encontramos lo que buscás."),
    405: ("metodo_no_permitido", "Esta ruta no acepta ese método."),
    500: ("error_interno", "Algo falló de nuestro lado. Probá de nuevo en un rato."),
}


@app.exception_handler(StarletteHTTPException)
async def error_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = ERRORES.get(exc.status_code, ("error", str(exc.detail)))
    return respuesta(exc.status_code, code, message)


@app.exception_handler(ErrorDeContrato)
async def error_de_contrato(_: Request, exc: ErrorDeContrato) -> JSONResponse:
    return respuesta(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def parametros_invalidos(_: Request, exc: RequestValidationError) -> JSONResponse:
    campos = ", ".join(str(e["loc"][-1]) for e in exc.errors())
    return respuesta(400, "parametros_invalidos", f"Revisá estos parámetros: {campos}.")


@app.exception_handler(DatosNoDisponibles)
async def datos_no_disponibles(_: Request, __: DatosNoDisponibles) -> JSONResponse:
    return respuesta(503, "datos_no_disponibles", "Los datos no están disponibles ahora. Probá más tarde.")


@app.exception_handler(duckdb.IOException)
async def lectura_fallida(_: Request, exc: duckdb.IOException) -> JSONResponse:
    # Un Parquet del release que deja de responder a mitad de la consulta.
    log.warning("DuckDB no pudo leer los datos: %s", type(exc).__name__)
    return await datos_no_disponibles(_, DatosNoDisponibles())


@app.exception_handler(Exception)
async def error_inesperado(_: Request, exc: Exception) -> JSONResponse:
    # Nunca texto plano ni detalles internos: el detalle queda en el registro del servidor.
    log.exception("Error inesperado", exc_info=exc)
    return respuesta(500, *ERRORES[500])


@v1.get("/health", operation_id="getHealth", tags=["meta"])
def health() -> dict[str, str]:
    try:
        return {"status": "ok", "data_version": version()}
    except DatosNoDisponibles:
        # La API sigue viva aunque el manifiesto no responda: /health no depende de los datos.
        return {"status": "ok"}


v1.include_router(hotspots.router)
v1.include_router(calendario.router)
v1.include_router(prediccion.router)
v1.include_router(vivo.router)
v1.include_router(regiones.router)
v1.include_router(avisos.router)
v1.include_router(cap.router)
# Contexto del foco (carril B, services/contexto): tiempo con Meteomatics e imagen de Copernicus.
v1.include_router(tiempo.router)
v1.include_router(imagen.router)
app.include_router(v1)
