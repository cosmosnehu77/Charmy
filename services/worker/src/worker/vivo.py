"""Una vuelta del worker: pide a FIRMS si pasaron 30 minutos y guarda los focos en Postgres para /live.

Tablas (las lee services/api):
- `focos_vivo`: focos de las últimas 120 horas, con las columnas de `focos` y el `id` del contrato.
- `estado_vivo`: una fila con el último intento, la última consulta exitosa y el último error.

RLS activado y sin políticas: Supabase no las expone por su API pública; el worker y la API entran con el
usuario dueño de la base.
"""

from datetime import datetime, timedelta

import httpx
import psycopg

from worker.firms import FUENTES, FirmsNoDisponible, normalizar, pedir
from worker.verificacion import verificar

INTERVALO = timedelta(minutes=30)
VENTANA = timedelta(hours=120)

TABLAS = """
CREATE TABLE IF NOT EXISTS focos_vivo (
    id text PRIMARY KEY,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    acq_datetime timestamptz NOT NULL,
    satellite text NOT NULL,
    instrument text NOT NULL,
    confidence text NOT NULL,
    frp double precision,
    daynight text NOT NULL,
    cell_id text NOT NULL
);
CREATE INDEX IF NOT EXISTS focos_vivo_fecha ON focos_vivo (acq_datetime);
ALTER TABLE focos_vivo ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS estado_vivo (
    id int PRIMARY KEY CHECK (id = 1),
    attempted_at timestamptz NOT NULL,
    fetched_at timestamptz,
    error text
);
ALTER TABLE estado_vivo ENABLE ROW LEVEL SECURITY;
"""

GUARDAR = """
INSERT INTO focos_vivo (id, latitude, longitude, acq_datetime, satellite, instrument, confidence, frp,
                        daynight, cell_id)
VALUES (%(id)s, %(latitude)s, %(longitude)s, %(acq_datetime)s, %(satellite)s, %(instrument)s, %(confidence)s,
        %(frp)s, %(daynight)s, %(cell_id)s)
ON CONFLICT (id) DO UPDATE SET confidence = excluded.confidence, frp = excluded.frp
"""


def _reservar(con: psycopg.Connection, ahora: datetime) -> tuple[bool, datetime | None]:
    """Marca el intento si pasaron 30 minutos del anterior. Devuelve si toca pedir y la última consulta OK.

    Se hace en la base y no en memoria: aunque corran dos workers, FIRMS no recibe más de un pedido cada
    30 minutos.
    """
    fila = con.execute(
        """
        INSERT INTO estado_vivo (id, attempted_at) VALUES (1, %(ahora)s)
        ON CONFLICT (id) DO UPDATE SET attempted_at = excluded.attempted_at
        WHERE estado_vivo.attempted_at <= %(limite)s
        RETURNING fetched_at
        """,
        {"ahora": ahora, "limite": ahora - INTERVALO},
    ).fetchone()
    con.commit()
    return (False, None) if fila is None else (True, fila[0])


def actualizar(con: psycopg.Connection, ahora: datetime, cliente: httpx.Client) -> str:
    """Una vuelta. Devuelve qué pasó, en una línea apta para el registro (sin la clave)."""
    con.execute(TABLAS)
    con.commit()
    toca, ultima = _reservar(con, ahora)
    if not toca:
        return "sin pedir: no pasaron 30 minutos desde el último intento"

    # Lo que falta desde la última consulta exitosa, más un día por el corte de fecha UTC (1 a 5 días).
    dias = 5 if ultima is None else max(1, min(5, (ahora - ultima).days + 2))
    try:
        focos = [f for fuente, sat in FUENTES.items() for f in normalizar(pedir(fuente, dias, cliente), sat)]
    except FirmsNoDisponible as error:
        con.execute("UPDATE estado_vivo SET error = %s WHERE id = 1", [str(error)])
        con.commit()
        # Los reportes y los estados de los avisos cambian aunque FIRMS no responda: se verifica igual.
        verificados = verificar(con, ahora, cliente)
        return f"FIRMS no disponible, /live sigue con la consulta anterior: {error}; {verificados}"

    with con.cursor() as cursor:
        cursor.executemany(GUARDAR, focos)
    con.execute("DELETE FROM focos_vivo WHERE acq_datetime < %s", [ahora - VENTANA])
    con.execute("UPDATE estado_vivo SET fetched_at = %s, error = NULL WHERE id = 1", [ahora])
    con.commit()
    return f"{len(focos)} focos de los últimos {dias} días guardados; {verificar(con, ahora, cliente)}"
