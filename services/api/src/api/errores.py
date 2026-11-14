"""Errores con el esquema `Error` del contrato: `{code, message}`, nunca HTML."""

from fastapi.responses import JSONResponse


class ErrorDeContrato(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status, self.code, self.message = status, code, message


def respuesta(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"code": code, "message": message}, status_code=status)
