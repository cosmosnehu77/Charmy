"""Base operativa en Postgres (DATABASE_URL): focos en vivo, reportes y avisos.

La URL se lee al usarla: la API arranca sin `.env`. Si la base no responde, el error es 503
`datos_no_disponibles`.
"""

import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

from api.datos import DatosNoDisponibles


@contextmanager
def conectar() -> Iterator[psycopg.Connection]:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise DatosNoDisponibles("Falta DATABASE_URL")
    try:
        with psycopg.connect(url, connect_timeout=10) as con:
            yield con
    except psycopg.Error as error:
        # Solo el tipo: el mensaje de psycopg puede traer el host de la base.
        raise DatosNoDisponibles(f"La base no responde: {type(error).__name__}") from None
