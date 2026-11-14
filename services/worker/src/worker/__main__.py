"""Worker de focos recientes.

    uv run --package worker python -m worker            # una vuelta (para un cron)
    uv run --package worker python -m worker --cada 30  # sigue corriendo, una vuelta cada 30 minutos

Necesita DATABASE_URL y FIRMS_MAP_KEY. Ninguna se lee al importar.
"""

import argparse
import os
import sys
import time
from datetime import UTC, datetime

import httpx
import psycopg

from worker.vivo import actualizar


def vuelta(cliente: httpx.Client) -> None:
    url = os.environ.get("DATABASE_URL", "").strip()
    ahora = datetime.now(UTC)
    if not url:
        print(f"{ahora:%Y-%m-%dT%H:%M:%SZ} falta DATABASE_URL", flush=True)
        return
    try:
        with psycopg.connect(url, connect_timeout=15) as con:
            resultado = actualizar(con, ahora, cliente)
    except psycopg.Error as error:
        # El mensaje de psycopg puede traer el host, nunca la contraseña.
        resultado = f"la base no responde: {type(error).__name__}"
    print(f"{ahora:%Y-%m-%dT%H:%M:%SZ} {resultado}", flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worker", description="Focos recientes de FIRMS para /live")
    parser.add_argument("--cada", type=int, metavar="MINUTOS", help="repetir cada tantos minutos")
    args = parser.parse_args(argv)
    with httpx.Client() as cliente:
        vuelta(cliente)
        while args.cada:
            time.sleep(args.cada * 60)
            vuelta(cliente)
    return 0


if __name__ == "__main__":
    sys.exit(main())
