"""Reportes ciudadanos y avisos a entidades (RF-ALE-01, RF-ALE-03, RNF-05).

- `POST /reports` es público y sin cuenta. No guarda IP ni datos personales: solo lo que trae el cuerpo.
  El límite por conexión se cuenta solo en memoria y se olvida a los 10 minutos.
- `GET /reports`, `POST /alerts` y `PATCH /alerts/{id}` piden el token de servicio (`CHARMY_SERVICE_TOKEN`),
  que comparten la API y el servicio de avisos. La bandeja web con cuenta queda para después del MVP (D-08).
"""

import hmac
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated, Literal

import psycopg
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, model_validator

from api.base import conectar
from api.errores import ErrorDeContrato
from api.hotspots import leer_bbox

router = APIRouter()

LIMITE_REPORTES, VENTANA_REPORTES = 5, 600  # 5 reportes cada 10 minutos por conexión
_recientes: dict[str, deque[float]] = defaultdict(deque)

# Las tablas tienen RLS activado y sin políticas: Supabase no las expone por su API pública.
# La API entra con el usuario dueño de la base, que no pasa por RLS.
TABLAS = """
CREATE TABLE IF NOT EXISTS reportes (
    id text PRIMARY KEY,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    description text,
    photo_url text,
    status text NOT NULL DEFAULT 'sin_verificar',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reportes_fecha ON reportes (created_at);
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS avisos (
    id text PRIMARY KEY,
    zone_id text NOT NULL,
    kind text NOT NULL,
    hotspot_id text,
    report_id text,
    status text NOT NULL DEFAULT 'nueva',
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS avisos_unico
    ON avisos (zone_id, kind, coalesce(hotspot_id, ''), coalesce(report_id, ''));
ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
"""
_tablas_listas = False


def _tablas(con: psycopg.Connection) -> None:
    global _tablas_listas
    if not _tablas_listas:
        con.execute(TABLAS)
        con.commit()
        _tablas_listas = True


def _exigir_token(authorization: str | None) -> None:
    esperado = os.environ.get("CHARMY_SERVICE_TOKEN", "").strip()
    recibido = (authorization or "").removeprefix("Bearer ").strip()
    if not esperado or not hmac.compare_digest(recibido.encode(), esperado.encode()):
        raise ErrorDeContrato(401, "sin_sesion", "Falta el token de servicio o no es válido.")


def _fecha(valor: datetime) -> str:
    return f"{valor.astimezone(UTC):%Y-%m-%dT%H:%M:%SZ}"


class Reporte(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    description: str | None = Field(default=None, max_length=500)
    photo_url: AnyHttpUrl | None = None
    captcha_token: str | None = None


def _conexion_de(request: Request) -> str:
    # Detrás del proxy de la plataforma, la conexión real es la primera de X-Forwarded-For.
    reenviada = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return reenviada or (request.client.host if request.client else "")


def _dentro_del_limite(conexion: str) -> bool:
    ahora = time.monotonic()
    marcas = _recientes[conexion]
    while marcas and ahora - marcas[0] > VENTANA_REPORTES:
        marcas.popleft()
    if len(marcas) >= LIMITE_REPORTES:
        return False
    marcas.append(ahora)
    return True


@router.post("/reports", operation_id="createReport", tags=["alertas"], status_code=201)
def crear_reporte(reporte: Reporte, request: Request) -> dict:
    if not _dentro_del_limite(_conexion_de(request)):
        raise ErrorDeContrato(
            429, "demasiados_reportes", "Mandaste varios reportes seguidos. Probá de nuevo en unos minutos."
        )
    id_ = f"r-{uuid.uuid4().hex[:12]}"
    foto = str(reporte.photo_url) if reporte.photo_url else None
    with conectar() as con:
        _tablas(con)
        con.execute(
            "INSERT INTO reportes (id, lat, lon, description, photo_url) VALUES (%s, %s, %s, %s, %s)",
            [id_, reporte.lat, reporte.lon, reporte.description, foto],
        )
        con.commit()
    return {"id": id_, "status": "sin_verificar"}


@router.get("/reports", operation_id="listReports", tags=["alertas"])
def listar_reportes(
    bbox: Annotated[str, Query(description="oeste,sur,este,norte en grados decimales")],
    since: datetime | None = None,
    authorization: Annotated[str | None, Header()] = None,
) -> list[dict]:
    _exigir_token(authorization)
    oeste, sur, este, norte = leer_bbox(bbox)
    with conectar() as con:
        _tablas(con)
        filas = con.execute(
            """
            SELECT id, lat, lon, description, photo_url, status, created_at FROM reportes
            WHERE lon BETWEEN %s AND %s AND lat BETWEEN %s AND %s AND created_at > %s
            ORDER BY created_at, id
            """,
            [oeste, este, sur, norte, since or datetime(1970, 1, 1, tzinfo=UTC)],
        ).fetchall()
    reportes = []
    for id_, lat, lon, descripcion, foto, estado, creado in filas:
        reporte = {"id": id_, "lat": lat, "lon": lon, "status": estado, "created_at": _fecha(creado)}
        reporte |= {k: v for k, v in (("description", descripcion), ("photo_url", foto)) if v is not None}
        reportes.append(reporte)
    return reportes


class NuevoAviso(BaseModel):
    model_config = ConfigDict(extra="forbid")
    zone_id: str = Field(min_length=1)
    kind: Literal["foco_satelital", "reporte_ciudadano"]
    hotspot_id: str | None = None
    report_id: str | None = None

    @model_validator(mode="after")
    def origen_segun_tipo(self) -> "NuevoAviso":
        if self.kind == "foco_satelital" and (not self.hotspot_id or self.report_id):
            raise ValueError("un aviso de foco lleva hotspot_id y no report_id")
        if self.kind == "reporte_ciudadano" and (not self.report_id or self.hotspot_id):
            raise ValueError("un aviso de reporte lleva report_id y no hotspot_id")
        return self


class CambioDeEstado(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["visto", "en_camino", "controlado", "falso"]
    note: str | None = Field(default=None, max_length=500)


COLUMNAS_AVISO = "id, zone_id, kind, hotspot_id, report_id, status, note, created_at"


def _aviso(fila: tuple) -> dict:
    id_, zona, tipo, foco, reporte, estado, nota, creado = fila
    aviso = {"id": id_, "zone_id": zona, "kind": tipo, "status": estado, "created_at": _fecha(creado)}
    opcionales = (("hotspot_id", foco), ("report_id", reporte), ("note", nota))
    return aviso | {k: v for k, v in opcionales if v is not None}


@router.post("/alerts", operation_id="createAlert", tags=["alertas"])
def crear_aviso(aviso: NuevoAviso, authorization: Annotated[str | None, Header()] = None) -> JSONResponse:
    _exigir_token(authorization)
    with conectar() as con:
        _tablas(con)
        nueva = con.execute(
            f"""
            INSERT INTO avisos (id, zone_id, kind, hotspot_id, report_id) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING RETURNING {COLUMNAS_AVISO}
            """,
            [f"a-{uuid.uuid4().hex[:12]}", aviso.zone_id, aviso.kind, aviso.hotspot_id, aviso.report_id],
        ).fetchone()
        fila = (
            nueva
            or con.execute(
                f"""
            SELECT {COLUMNAS_AVISO} FROM avisos
            WHERE zone_id = %s AND kind = %s
              AND coalesce(hotspot_id, '') = %s AND coalesce(report_id, '') = %s
            """,
                [aviso.zone_id, aviso.kind, aviso.hotspot_id or "", aviso.report_id or ""],
            ).fetchone()
        )
        con.commit()
    return JSONResponse(_aviso(fila), status_code=201 if nueva else 200)


@router.patch("/alerts/{alert_id}", operation_id="updateAlert", tags=["alertas"])
def cambiar_estado(
    alert_id: str, cambio: CambioDeEstado, authorization: Annotated[str | None, Header()] = None
) -> dict:
    _exigir_token(authorization)
    with conectar() as con:
        _tablas(con)
        fila = con.execute(
            f"""
            UPDATE avisos SET status = %s, note = %s, updated_at = now() WHERE id = %s
            RETURNING {COLUMNAS_AVISO}
            """,
            [cambio.status, cambio.note, alert_id],
        ).fetchone()
        if fila is None:
            raise ErrorDeContrato(404, "no_existe", "No encontramos ese aviso.")
        # El estado que marca la entidad es una señal para la verificación del reporte (RF-ALE-03).
        if fila[4]:
            con.execute("UPDATE reportes SET status = %s WHERE id = %s", [cambio.status, fila[4]])
        con.commit()
    return _aviso(fila)
