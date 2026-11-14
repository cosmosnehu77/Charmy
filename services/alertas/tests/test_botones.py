"""Botones de estado del aviso (RF-ALE-03). La API va simulada."""

import asyncio

from alertas.botones import al_tocar, botones


class ApiFalsa:
    def __init__(self, responde: bool = True):
        self.responde = responde
        self.parches = []

    async def actualizar_alerta(self, alert_id, status):
        self.parches.append((alert_id, status))
        return self.responde


def test_cada_aviso_trae_los_cuatro_estados():
    teclado = botones("muestra-a-0001")
    assert [t for t, _ in teclado] == ["Visto", "En camino", "Controlado", "Falso"]
    assert all(len(d.encode()) <= 64 for _, d in teclado)  # límite de callback_data de Telegram


def test_tocar_un_boton_llama_a_patch_alerts():
    api = ApiFalsa()
    _, dato = botones("muestra-a-0001")[1]
    respuesta = asyncio.run(al_tocar(api, dato))
    assert api.parches == [("muestra-a-0001", "en_camino")]
    assert respuesta == "Listo: quedó como «En camino»."


def test_si_la_api_falla_lo_dice():
    api = ApiFalsa(responde=False)
    _, dato = botones("a-1")[0]
    assert asyncio.run(al_tocar(api, dato)) == "No pude guardar el estado. Probá de nuevo en un rato."


def test_un_dato_que_no_es_un_boton_nuestro_no_llama_a_la_api():
    api = ApiFalsa()
    assert asyncio.run(al_tocar(api, "otra:cosa")) is None
    assert asyncio.run(al_tocar(api, "e:a-1:borrar")) is None
    assert api.parches == []
