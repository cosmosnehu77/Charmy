"""Pruebas de worker.firms: pedido a FIRMS con respuestas grabadas (sin red) y normalización a `focos`."""

from datetime import UTC, datetime

import httpx
import pytest
from worker.firms import FirmsNoDisponible, normalizar, pedir

CLAVE = "clave-de-prueba-123"
CSV = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,"
    "bright_ti5,frp,daynight\n"
    "-42.51234,-71.45678,330.1,0.4,0.4,2026-11-14,342,N20,VIIRS,h,2.0NRT,290.0,12.5,N\n"
    "-42.50000,-71.40000,320.0,0.4,0.4,2026-11-14,1505,N21,VIIRS,n,2.0NRT,295.0,,D\n"
    "-33.10000,-70.20000,310.0,0.4,0.4,2026-11-14,1505,1,VIIRS,l,2.0NRT,280.0,3.0,D\n"
)


def cliente(manejador) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(manejador))


def test_pedir_sin_clave_falla(monkeypatch):
    monkeypatch.delenv("FIRMS_MAP_KEY", raising=False)
    with pytest.raises(FirmsNoDisponible, match="Falta FIRMS_MAP_KEY"):
        pedir("VIIRS_NOAA20_NRT", 1, cliente(lambda r: httpx.Response(200, text=CSV)))


def test_pedir_devuelve_csv(monkeypatch):
    monkeypatch.setenv("FIRMS_MAP_KEY", CLAVE)
    pedidos = []

    def manejador(pedido):
        pedidos.append(str(pedido.url))
        return httpx.Response(200, text=CSV)

    assert pedir("VIIRS_NOAA21_NRT", 2, cliente(manejador)) == CSV
    assert pedidos[0].endswith("/VIIRS_NOAA21_NRT/-76,-56,-53,-17/2")


@pytest.mark.parametrize(
    ("estado", "texto"),
    [(429, "Exceeding allowed transaction limit"), (500, "error"), (200, f"Invalid MAP_KEY {CLAVE}")],
)
def test_pedir_falla_sin_mostrar_la_clave(monkeypatch, estado, texto):
    monkeypatch.setenv("FIRMS_MAP_KEY", CLAVE)
    with pytest.raises(FirmsNoDisponible) as error:
        pedir("VIIRS_NOAA20_NRT", 1, cliente(lambda r: httpx.Response(estado, text=texto)))
    assert CLAVE not in str(error.value)


def test_pedir_tiempo_agotado(monkeypatch):
    monkeypatch.setenv("FIRMS_MAP_KEY", CLAVE)

    def manejador(pedido):
        raise httpx.ReadTimeout("tiempo agotado", request=pedido)

    with pytest.raises(FirmsNoDisponible, match="ReadTimeout") as error:
        pedir("VIIRS_NOAA20_NRT", 1, cliente(manejador))
    assert CLAVE not in str(error.value)


def test_normalizar_filtra_por_satelite_y_arma_columnas():
    focos = normalizar(CSV, "N20")
    # La tercera fila usa el alias "1" de NOAA-20.
    assert len(focos) == 2
    primero = focos[0]
    assert primero["acq_datetime"] == datetime(2026, 11, 14, 3, 42, tzinfo=UTC)
    assert primero["id"] == "N20-2026-11-14T03:42:00Z--42.51234--71.45678"
    assert primero["confidence"] == "high"
    assert primero["frp"] == 12.5
    assert primero["cell_id"] == "-42.6_-71.5"
    assert focos[1]["confidence"] == "low"


def test_normalizar_frp_vacio_es_none():
    (foco,) = normalizar(CSV, "N21")
    assert foco["frp"] is None
    assert foco["confidence"] == "nominal"
