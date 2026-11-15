"""Noticias como señal (#279): respuestas grabadas del modelo y fallas simuladas, sin red."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from worker import noticias, verificacion
from worker.noticias import NoticiasNoDisponibles, etiquetar

AHORA = datetime(2026, 11, 15, 14, 0, tzinfo=UTC)
TITULARES = [
    {"title": "Brigadistas combaten un incendio forestal en el monte"},
    {"title": "Charla de prevención"},
]


@pytest.fixture(autouse=True)
def clave(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "clave-de-prueba")


def cliente(manejador) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(manejador))


def respuesta_grabada(texto: str) -> dict:
    # Forma de la respuesta de NVIDIA NIM (compatible con OpenAI), con valores de muestra.
    return {"choices": [{"message": {"role": "assistant", "content": texto}}]}


def test_etiqueta_con_una_respuesta_grabada_y_espera_20_s():
    pedidos = []

    def manejador(req):
        pedidos.append(req)
        return httpx.Response(200, json=respuesta_grabada('```json\n["apoya", "sin_informacion"]\n```'))

    assert etiquetar(TITULARES, "Chubut", "Argentina", cliente(manejador)) == ["apoya", "sin_informacion"]
    assert pedidos[0].extensions["timeout"]["read"] == 20
    assert json.loads(pedidos[0].content)["model"] == noticias.MODELO


def test_el_modelo_se_puede_elegir_para_medir():
    pedidos = []

    def manejador(req):
        pedidos.append(json.loads(req.content)["model"])
        return httpx.Response(200, json=respuesta_grabada('["apoya", "sin_informacion"]'))

    etiquetar(TITULARES, "Chubut", "Argentina", cliente(manejador), modelo="google/gemma-3-12b-it")
    assert pedidos == ["google/gemma-3-12b-it"]


@pytest.mark.parametrize(
    "falla",
    [
        lambda req: (_ for _ in ()).throw(httpx.ReadTimeout("tiempo agotado", request=req)),
        lambda req: httpx.Response(429),
        lambda req: httpx.Response(503),
        lambda req: httpx.Response(200, json=respuesta_grabada("no sé")),
    ],
    ids=["tiempo agotado", "429", "5xx", "sin JSON"],
)
def test_una_falla_del_modelo_deja_las_noticias_no_disponibles(falla):
    with pytest.raises(NoticiasNoDisponibles):
        etiquetar(TITULARES, "Chubut", "Argentina", cliente(falla))


class BaseNoticias:
    def __init__(self, guardadas=()):
        self.guardadas, self.insertadas = list(guardadas), []

    def execute(self, sql, params=None):
        if "INSERT INTO noticias_vivo" in sql:
            self.insertadas.append(params[0])
        return self.guardadas if "FROM noticias_vivo" in sql else []


def provincias(n: int) -> dict:
    return {
        f"AR-{i:02d}": {"nombre": f"Provincia {i}", "pais": "Argentina", "focos": 100 - i} for i in range(n)
    }


def test_busca_noticias_de_todas_las_provincias_con_focos(monkeypatch):
    monkeypatch.setattr(verificacion, "buscar", lambda nombre, pais, c: [{"title": f"Incendio en {nombre}"}])
    monkeypatch.setattr(verificacion, "etiquetar", lambda t, nombre, pais, c: ["apoya"])
    base = BaseNoticias()
    resultado = verificacion._noticias(base, AHORA, provincias(20), cliente=None)

    assert len(base.insertadas) == 20
    assert all(items[0]["label"] == "apoya" for items in resultado.values())


def test_con_el_tope_de_tiempo_las_que_faltan_quedan_para_la_proxima_vuelta(monkeypatch, capsys):
    # Cada provincia "tarda" 40 s: con 150 s de tope entran 4, empezando por las de más focos.
    tiempo = [0.0]

    def buscar(nombre, pais, c):
        tiempo[0] += 40
        return [{"title": "x"}]

    monkeypatch.setattr(verificacion, "buscar", buscar)
    monkeypatch.setattr(verificacion, "etiquetar", lambda t, nombre, pais, c: ["apoya"])
    vieja = ("AR-09", AHORA - timedelta(hours=5), [{"title": "vieja", "label": "apoya"}])
    base = BaseNoticias([vieja])
    resultado = verificacion._noticias(base, AHORA, provincias(10), cliente=None, reloj=lambda: tiempo[0])

    assert base.insertadas == ["AR-00", "AR-01", "AR-02", "AR-03"]
    assert resultado["AR-09"] == vieja[2]  # sin tiempo: sigue con lo que tenía
    assert resultado["AR-05"] is None
    assert "6 provincias quedan para la próxima vuelta" in capsys.readouterr().out


def test_una_provincia_con_noticias_frescas_no_vuelve_a_preguntar(monkeypatch):
    monkeypatch.setattr(verificacion, "buscar", lambda *a: pytest.fail("no debía buscar"))
    fresca = ("AR-00", AHORA - timedelta(minutes=30), [{"title": "fresca", "label": "apoya"}])
    resultado = verificacion._noticias(BaseNoticias([fresca]), AHORA, provincias(1), cliente=None)
    assert resultado["AR-00"] == fresca[2]


def test_la_medicion_cuenta_aciertos_fallas_y_tiempos_sin_red():
    from worker import medir_noticias as m

    def manejador(req):
        pedido = json.loads(req.content)["messages"][0]["content"]
        if "Araucanía" in pedido:
            return httpx.Response(503)
        n = pedido.count("\n") - 1  # una línea por titular después del pedido
        return httpx.Response(200, json=respuesta_grabada(json.dumps(["apoya"] * n)))

    r = m.medir("modelo/prueba", cliente(manejador))
    apoyan = sum(e == "apoya" for _, _, filas in m.MUESTRA[:2] for _, e in filas)
    assert (r["aciertos"], r["fallas"], len(r["segundos"])) == (apoyan, 1, 3)
    assert "| `modelo/prueba` |" in m.tabla([r])


def test_una_respuesta_sin_texto_deja_las_noticias_no_disponibles():
    # Un modelo que razona puede gastar los tokens pensando y devolver content null: no puede tirar la vuelta.
    sin_texto = {"choices": [{"message": {"role": "assistant", "content": None}}]}
    with pytest.raises(NoticiasNoDisponibles, match="sin texto"):
        etiquetar(TITULARES, "Chubut", "Argentina", cliente(lambda req: httpx.Response(200, json=sin_texto)))


def test_un_error_http_dice_el_codigo_y_no_la_clave():
    with pytest.raises(NoticiasNoDisponibles) as error:
        etiquetar(TITULARES, "Chubut", "Argentina", cliente(lambda req: httpx.Response(404)))
    assert "404" in str(error.value)
    assert "clave-de-prueba" not in str(error.value)


def test_la_medicion_sigue_con_el_proximo_modelo_si_uno_falla_raro(monkeypatch):
    from worker import medir_noticias as m

    def etiquetar_roto(titulares, provincia, pais, c, modelo, opciones=None):
        if modelo == "roto":
            raise RuntimeError("algo inesperado")
        return ["apoya"] * len(titulares)

    monkeypatch.setattr(m, "etiquetar", etiquetar_roto)
    roto, sano = m.medir("roto", cliente=None), m.medir("sano", cliente=None)
    assert (roto["fallas"], sano["fallas"]) == (3, 0)


def test_las_opciones_del_modelo_van_en_el_pedido():
    pedidos = []

    def manejador(req):
        pedidos.append(json.loads(req.content))
        return httpx.Response(200, json=respuesta_grabada('["apoya", "sin_informacion"]'))

    opciones = {"max_tokens": 1500, "chat_template_kwargs": {"enable_thinking": False}}
    etiquetar(TITULARES, "Chubut", "Argentina", cliente(manejador), modelo="m", opciones=opciones)
    assert pedidos[0]["max_tokens"] == 1500
    assert pedidos[0]["chat_template_kwargs"] == {"enable_thinking": False}
    assert pedidos[0]["temperature"] == 0


def test_una_respuesta_sin_texto_dice_por_que_termino():
    sin_texto = {"choices": [{"message": {"content": None}, "finish_reason": "length"}]}
    with pytest.raises(NoticiasNoDisponibles, match="length"):
        etiquetar(TITULARES, "Chubut", "Argentina", cliente(lambda req: httpx.Response(200, json=sin_texto)))
