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
    fila = ("a-1", "zona-demo", "foco_satelital", "h-1", None, "nueva", None, CREADO, None, None, None, None)
    assert avisos._aviso(fila)["sent_at"] is None


def test_un_aviso_enviado_sale_con_la_fecha():
    enviado = datetime(2026, 11, 14, 4, 45, 2, tzinfo=UTC)
    fila = ("a-1", "zona-demo", "foco_satelital", "h-1", None, "nueva", None, CREADO, enviado,
            None, None, None)
    assert avisos._aviso(fila)["sent_at"] == "2026-11-14T04:45:02Z"


def test_los_avisos_anteriores_a_sent_at_quedan_como_enviados_y_los_nuevos_no():
    # La columna se crea con DEFAULT now() (los avisos que ya existían se dan por enviados, así el bot no los
    # reenvía) y enseguida se le saca el default (un aviso nuevo nace sin enviar).
    sql = " ".join(avisos.TABLAS.split())
    agregar = sql.index("ADD COLUMN IF NOT EXISTS sent_at timestamptz DEFAULT now()")
    sacar = sql.index("ALTER COLUMN sent_at DROP DEFAULT")
    assert agregar < sacar


# #321: celda, veredicto enviado, id del mensaje y aviso anterior de la celda.


def test_el_aviso_trae_celda_veredicto_enviado_y_mensaje():
    enviado = datetime(2026, 11, 14, 4, 45, 2, tzinfo=UTC)
    fila = ("a-1", "zona-demo", "foco_satelital", "h-1", None, "nueva", None, CREADO, enviado,
            "-42.2_-71.3", "probable", 101)
    aviso = avisos._aviso(fila)
    assert (aviso["cell_id"], aviso["sent_verdict"], aviso["message_id"]) == ("-42.2_-71.3", "probable", 101)


def test_un_aviso_viejo_sale_con_veredicto_y_mensaje_null_y_sin_celda():
    fila = ("a-1", "zona-demo", "foco_satelital", "h-1", None, "nueva", None, CREADO, None, None, None, None)
    aviso = avisos._aviso(fila)
    assert "cell_id" not in aviso and aviso["sent_verdict"] is None and aviso["message_id"] is None


class BaseAnterior:
    def __init__(self, fila):
        self.fila, self.pedidos = fila, []

    def execute(self, sql, params):
        self.pedidos.append((" ".join(sql.split()), params))
        return self

    def fetchone(self):
        return self.fila


def test_el_aviso_anterior_es_el_ultimo_enviado_de_la_celda_en_7_dias():
    enviado = datetime(2026, 11, 12, 4, 45, 2, tzinfo=UTC)
    base = BaseAnterior(("a-0", enviado, 101))
    assert avisos._anterior(base, "zona-demo", "-42.2_-71.3", "a-1") == {
        "id": "a-0", "sent_at": "2026-11-12T04:45:02Z", "message_id": 101}
    sql, params = base.pedidos[0]
    assert "sent_at IS NOT NULL" in sql and "interval '7 days'" in sql and "ORDER BY sent_at DESC" in sql
    assert params == ["zona-demo", "-42.2_-71.3", "a-1"]


def test_sin_celda_o_sin_aviso_anterior_no_hay_previous():
    assert avisos._anterior(BaseAnterior(None), "zona-demo", "-42.2_-71.3", "a-1") is None
    assert avisos._anterior(BaseAnterior(("x", CREADO, 1)), "zona-demo", None, "a-1") is None


def test_crear_aviso_con_celda_es_valido(cliente):
    cuerpo = {"zone_id": "z", "kind": "foco_satelital", "hotspot_id": "h", "cell_id": "-42.2_-71.3"}
    r = cliente.post("/api/v1/alerts", json=cuerpo, headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 503  # pasó la validación; sin base, 503


@pytest.mark.parametrize("cuerpo, esperado", [
    ({"verdict": "probable", "message_id": 101}, 503),
    ({"verdict": "confirmado"}, 503),
    ({"verdict": "quizas"}, 400),
    ({"message_id": "uno"}, 400),
    ({"otra": 1}, 400),
])
def test_marcar_enviado_acepta_veredicto_y_mensaje(cliente, cuerpo, esperado):
    r = cliente.post("/api/v1/alerts/a-1/sent", json=cuerpo, headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == esperado


def test_las_columnas_nuevas_se_agregan_sin_romper_los_avisos_existentes():
    sql = " ".join(avisos.TABLAS.split())
    for columna in ("cell_id text", "sent_verdict text", "message_id bigint"):
        assert f"ADD COLUMN IF NOT EXISTS {columna}" in sql
