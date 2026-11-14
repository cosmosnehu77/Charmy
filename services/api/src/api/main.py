"""API de Charmy. Implementa packages/contracts/api/openapi.yaml bajo /api/v1.

Ninguna clave se lee al importar: la API arranca sin .env.
"""

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI(
    title="Charmy API", version="0.1.0", docs_url="/api/v1/docs", openapi_url="/api/v1/openapi.json"
)
v1 = APIRouter(prefix="/api/v1")

# Códigos del esquema `Error` del contrato, con mensajes cortos para el público.
ERRORES = {
    404: ("no_existe", "No encontramos lo que buscás."),
    405: ("metodo_no_permitido", "Esta ruta no acepta ese método."),
}


@app.exception_handler(StarletteHTTPException)
async def error_del_contrato(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = ERRORES.get(exc.status_code, ("error", str(exc.detail)))
    return JSONResponse({"code": code, "message": message}, status_code=exc.status_code)


@v1.get("/health", operation_id="getHealth", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(v1)
