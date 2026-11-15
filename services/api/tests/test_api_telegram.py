"""POST /telegram/webhook (D-41, #353): un botón del aviso cambia el estado al instante.
Sin base ni red: el guardado y las llamadas a Telegram se reemplazan."""

import pytest
from api import telegram
from api.datos import DatosNoDisponibles
from api.main import app
from fastapi.testclient import TestClient

SECRETO = "secreto-de-prueba"
CABECERA = {"X-Telegram-Bot-Api-Secret-Token": SECRETO}
TEXTO = "Foco de calor satelital en tu zona (Comarca Andina)\nQué: muestra\n\nEstado: Visto"


def toque(dato="e:a-1:en_camino", texto=TEXTO):
    mensaje = {"message_id": 77, "chat": {"id": -100123, "type": "supergroup"}, "date": 0}
    if texto is not None:
        mensaje["text"] = texto
    return {"update_id": 5, "callback_query": {"id": "q-9", "data": dato, "message": mensaje}}


@pytest.fixture
def entorno(monkeypatch):
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", SECRETO)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    guardados, llamadas = [], []
    resultado = {"guardar": True, "editar_falla": False}

    def guardar(alert_id, estado):
        if isinstance(resultado["guardar"], Exception):
            raise resultado["guardar"]
        guardados.append((alert_id, estado))
        return resultado["guardar"]

    def llamar(metodo, datos):
        if metodo == "editMessageText" and resultado["editar_falla"]:
            raise RuntimeError("Bad Request: message is not modified")
        llamadas.append((metodo, datos))

    monkeypatch.setattr(telegram, "_guardar", guardar)
    monkeypatch.setattr(telegram, "_llamar", llamar)
    return TestClient(app), guardados, llamadas, resultado


@pytest.mark.parametrize("cabecera", [{}, {"X-Telegram-Bot-Api-Secret-Token": "otro"}])
def test_sin_la_cabecera_secreta_responde_403_y_no_guarda_nada(entorno, cabecera):
    cliente, guardados, llamadas, _ = entorno
    r = cliente.post("/api/v1/telegram/webhook", json=toque(), headers=cabecera)
    assert r.status_code == 403
    assert guardados == [] and llamadas == []


def test_sin_secreto_configurado_la_ruta_esta_cerrada(entorno, monkeypatch):
    cliente, guardados, _, _ = entorno
    monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET")
    vacia = {"X-Telegram-Bot-Api-Secret-Token": ""}
    r = cliente.post("/api/v1/telegram/webhook", json=toque(), headers=vacia)
    assert r.status_code == 403 and guardados == []


def test_un_toque_guarda_el_estado_edita_el_mensaje_y_contesta(entorno):
    cliente, guardados, llamadas, _ = entorno
    r = cliente.post("/api/v1/telegram/webhook", json=toque(), headers=CABECERA)
    assert r.status_code == 200
    assert guardados == [("a-1", "en_camino")]
    (m1, editar), (m2, contestar) = llamadas
    assert m1 == "editMessageText" and editar["chat_id"] == -100123 and editar["message_id"] == 77
    assert editar["text"].endswith("\n\nEstado: En camino") and editar["text"].count("Estado:") == 1
    assert editar["reply_markup"]["inline_keyboard"][0][1] == {
        "text": "En camino", "callback_data": "e:a-1:en_camino"
    }
    assert m2 == "answerCallbackQuery"
    assert contestar == {"callback_query_id": "q-9", "text": "Guardado: En camino"}


def test_si_no_se_puede_editar_el_estado_igual_queda_guardado(entorno):
    cliente, guardados, llamadas, resultado = entorno
    resultado["editar_falla"] = True
    r = cliente.post("/api/v1/telegram/webhook", json=toque(), headers=CABECERA)
    assert r.status_code == 200 and guardados == [("a-1", "en_camino")]
    assert [m for m, _ in llamadas] == ["answerCallbackQuery"]


def test_un_mensaje_viejo_sin_texto_guarda_y_contesta_sin_editar(entorno):
    cliente, guardados, llamadas, _ = entorno
    cliente.post("/api/v1/telegram/webhook", json=toque(texto=None), headers=CABECERA)
    assert guardados == [("a-1", "en_camino")] and [m for m, _ in llamadas] == ["answerCallbackQuery"]


@pytest.mark.parametrize(
    "update",
    [
        {"update_id": 1, "message": {"message_id": 1, "chat": {"id": 1}, "text": "hola"}},
        toque(dato="otra:cosa"),
        {"update_id": 2},
    ],
)
def test_lo_que_no_es_un_toque_de_aviso_responde_200_sin_hacer_nada(entorno, update):
    cliente, guardados, llamadas, _ = entorno
    r = cliente.post("/api/v1/telegram/webhook", json=update, headers=CABECERA)
    assert r.status_code == 200 and guardados == [] and llamadas == []


def test_un_aviso_que_no_existe_se_contesta_sin_editar(entorno):
    cliente, _, llamadas, resultado = entorno
    resultado["guardar"] = False
    r = cliente.post("/api/v1/telegram/webhook", json=toque(), headers=CABECERA)
    assert r.status_code == 200
    assert llamadas == [("answerCallbackQuery", {"callback_query_id": "q-9", "text": "Aviso no encontrado"})]


def test_sin_base_se_contesta_que_no_se_pudo_guardar(entorno):
    cliente, _, llamadas, resultado = entorno
    resultado["guardar"] = DatosNoDisponibles("Falta DATABASE_URL")
    r = cliente.post("/api/v1/telegram/webhook", json=toque(), headers=CABECERA)
    assert r.status_code == 200
    assert [d["text"] for _, d in llamadas] == ["No se pudo guardar: probá de nuevo en un rato"]
