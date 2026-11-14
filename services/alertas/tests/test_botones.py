"""Botones de estado del aviso (RF-ALE-03). El PATCH /alerts del toque se prueba en test_corrida.py."""

from alertas.botones import botones, leer_dato


def test_cada_aviso_trae_los_cuatro_estados():
    teclado = botones("muestra-a-0001")
    assert [t for t, _ in teclado] == ["Visto", "En camino", "Controlado", "Falso"]
    assert all(len(d.encode()) <= 64 for _, d in teclado)  # límite de callback_data de Telegram


def test_el_dato_del_boton_dice_alerta_y_estado():
    assert leer_dato(botones("muestra-a-0001")[1][1]) == ("muestra-a-0001", "en_camino")


def test_un_dato_que_no_es_un_boton_nuestro_se_ignora():
    assert leer_dato("otra:cosa") is None
    assert leer_dato("e:a-1:borrar") is None
    assert leer_dato("e::visto") is None
