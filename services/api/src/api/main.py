"""API de Charmy. Implementa packages/contracts/api/openapi.yaml bajo /api/v1.

Ninguna clave se lee al importar: la API arranca sin .env.
"""

import os

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from api import avisos, calendario, hotspots, vivo
from api.datos import DatosNoDisponibles, version
from api.errores import ErrorDeContrato, respuesta

app = FastAPI(
    title="Charmy API", version="0.1.0", docs_url="/api/v1/docs", openapi_url="/api/v1/openapi.json"
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


@v1.get("/health", operation_id="getHealth", tags=["meta"])
def health() -> dict[str, str]:
    try:
        return {"status": "ok", "data_version": version()}
    except DatosNoDisponibles:
        # La API sigue viva aunque el manifiesto no responda: /health no depende de los datos.
        return {"status": "ok"}


v1.include_router(hotspots.router)
v1.include_router(calendario.router)
v1.include_router(vivo.router)
v1.include_router(avisos.router)
app.include_router(v1)
