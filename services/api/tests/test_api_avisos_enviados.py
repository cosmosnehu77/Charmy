"""#280: `sent_at` en los avisos y `POST /alerts/{id}/sent`, sin base ni red."""

from datetime import UTC, datetime

import pytest
from api import avisos
from api.main import app
from fastapi.testclient import TestClient

TOKEN = "token-de-prueba"
CREADO = datetime(2026, 11, 14, 4, 45, tzinfo=UTC)


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("CHARMY_SERVICE_TOKEN", TOKEN)
    return TestClient(app)


@pytest.mark.parametrize("cabecera", [None, "Bearer otro-token", TOKEN])
def test_marcar_enviado_sin_el_token_correcto_da_401(cliente, cabecera):
    headers = {"Authorization": cabecera} if cabecera else {}
    r = cliente.post("/api/v1/alerts/a-1/sent", headers=headers)
    assert r.status_code == 401 and r.json()["code"] == "sin_sesion"


def test_marcar_enviado_con_token_y_sin_base_da_503(cliente):
    r = cliente.post("/api/v1/alerts/a-1/sent", headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 503


def test_un_aviso_sin_enviar_sale_con_sent_at_null():
    fila = ("a-1", "zona-demo", "foco_satelital", "h-1", None, "nueva", None, CREADO, None)
    assert avisos._aviso(fila)["sent_at"] is None


def test_un_aviso_enviado_sale_con_la_fecha():
    enviado = datetime(2026, 11, 14, 4, 45, 2, tzinfo=UTC)
    fila = ("a-1", "zona-demo", "foco_satelital", "h-1", None, "nueva", None, CREADO, enviado)
    assert avisos._aviso(fila)["sent_at"] == "2026-11-14T04:45:02Z"


def test_los_avisos_anteriores_a_sent_at_quedan_como_enviados_y_los_nuevos_no():
    # La columna se crea con DEFAULT now() (los avisos que ya existían se dan por enviados, así el bot no los
    # reenvía) y enseguida se le saca el default (un aviso nuevo nace sin enviar).
    sql = " ".join(avisos.TABLAS.split())
    agregar = sql.index("ADD COLUMN IF NOT EXISTS sent_at timestamptz DEFAULT now()")
    sacar = sql.index("ALTER COLUMN sent_at DROP DEFAULT")
    assert agregar < sacar
