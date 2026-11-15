"""GET /cap/{zone_id}.xml: feed CAP 1.2 de los avisos de una zona (RF-ALE-04).

El XML lo arma `alertas.cap` (services/alertas, carril de avisos): la API solo junta los avisos
guardados con su foco (`focos_vivo`) o su reporte (`reportes`). Un aviso cuyo foco ya salió de la
ventana de 120 horas del worker deja de publicarse. Los avisos marcados falsos los descarta `armar_cap`.
"""

from datetime import UTC, datetime

from alertas.cap import AvisoCap, armar_cap
from alertas.cliente import _foco_de_feature, _foco_de_reporte
from alertas.zona import ZONAS as ZONAS_DE_AVISOS
from fastapi import APIRouter, Response

from api.avisos import _fecha, _tablas
from api.base import conectar
from api.errores import ErrorDeContrato
from api.vivo import _feature

router = APIRouter()

ZONAS = {z.id: z for z in ZONAS_DE_AVISOS}  # las mismas zonas que el bot (D-39)
MAXIMO = 100  # los avisos más recientes de la zona


def _leer_avisos(zona: str) -> list[tuple]:
    with conectar() as con:
        _tablas(con)
        return con.execute(
            """
            SELECT a.id, a.status, a.kind, coalesce(a.hotspot_id, a.report_id),
                   coalesce(f.latitude, r.lat), coalesce(f.longitude, r.lon),
                   coalesce(f.acq_datetime, r.created_at),
                   f.satellite, f.instrument, f.confidence, f.frp,
                   coalesce(to_jsonb(f) ->> 'verdict', r.description)
            FROM avisos AS a
            LEFT JOIN focos_vivo AS f ON f.id = a.hotspot_id
            LEFT JOIN reportes AS r ON r.id = a.report_id
            WHERE a.zone_id = %s AND coalesce(f.id, r.id) IS NOT NULL
            ORDER BY a.created_at DESC
            LIMIT %s
            """,
            [zona, MAXIMO],
        ).fetchall()


def _aviso(fila: tuple) -> AvisoCap:
    aviso, estado, tipo, ref, lat, lon, cuando, satelite, instrumento, confianza, frp, texto = fila
    if tipo == "foco_satelital":
        feature = _feature(
            ref, lat, lon, cuando, satelite, instrumento, confianza, frp, None, None, texto, None
        )
        foco = _foco_de_feature(feature)
    else:
        foco = _foco_de_reporte(
            {"id": ref, "lat": lat, "lon": lon, "created_at": _fecha(cuando), "description": texto}
        )
    return AvisoCap(alert_id=aviso, foco=foco, estado=estado)


@router.get("/cap/{zone_id}.xml", operation_id="getCapFeed", tags=["alertas"])
def feed(zone_id: str) -> Response:
    zona = ZONAS.get(zone_id)
    if zona is None:
        raise ErrorDeContrato(404, "no_existe", "No hay una zona con ese identificador.")
    avisos = [_aviso(fila) for fila in _leer_avisos(zone_id)]
    return Response(armar_cap(zona, avisos, datetime.now(UTC)), media_type="application/cap+xml")
