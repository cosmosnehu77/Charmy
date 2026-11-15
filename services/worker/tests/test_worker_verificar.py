"""`verificar` de punta a punta con una base falsa: sin Postgres, sin red, fechas fijas (docs/PRUEBAS.md)."""

from datetime import UTC, datetime

import pytest
from worker import verificacion

AHORA = datetime(2026, 11, 15, 14, 0, tzinfo=UTC)
CUANDO = datetime(2026, 11, 15, 5, 0, tzinfo=UTC)


class Resultado:
    def __init__(self, filas):
        self.filas = filas

    def __iter__(self):
        return iter(self.filas)

    def fetchone(self):
        return self.filas[0] if self.filas else None

    def fetchall(self):
        return self.filas


class BaseFalsa:
    """Contesta las consultas de `verificar` y anota el orden de lo que pasa (execute, commit)."""

    def __init__(self, focos, avisos=()):
        self.focos, self.avisos = focos, list(avisos)
        self.pasos, self.guardadas = [], {}

    def execute(self, sql, params=None):
        texto = " ".join(sql.split())
        self.pasos.append("tablas" if texto.startswith("ALTER TABLE") else texto[:30])
        if "FROM focos_vivo" in texto:
            return Resultado(self.focos)
        if "to_regclass" in texto:
            return Resultado([(params[0] == "avisos",)])
        if "FROM avisos" in texto:
            return Resultado(self.avisos)
        return Resultado([])

    def commit(self):
        self.pasos.append("commit")

    def cursor(self):
        base = self

        class Cursor:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def executemany(self, sql, filas):
                for veredicto, _fija, _puntaje, _senales, _evidencia, id_ in filas:
                    base.guardadas[id_] = veredicto

        return Cursor()


def foco(id_, celda, confianza="nominal"):
    return (id_, -42.0, -71.5, CUANDO, "N20", confianza, 5.0, celda)


@pytest.fixture(autouse=True)
def sin_red(monkeypatch):
    class SinRegion:
        def de(self, lon, lat):
            return None

    monkeypatch.setattr(verificacion, "regiones", lambda cliente: SinRegion())
    monkeypatch.setattr(verificacion, "fuentes_fijas", lambda cliente: set())


def test_suelta_el_lock_de_las_tablas_antes_de_pedir_noticias(monkeypatch):
    # ALTER TABLE bloquea focos_vivo entero: si el commit espera a las noticias, /live se traba (#268).
    base = BaseFalsa([foco("f1", "c1")])
    vistos = []

    def noticias(con, ahora, por_provincia, cliente):
        vistos.extend(con.pasos)
        return {}

    monkeypatch.setattr(verificacion, "_noticias", noticias)
    verificacion.verificar(base, AHORA, cliente=None)

    assert vistos[:2] == ["tablas", "commit"]


def test_el_estado_de_la_entidad_vale_para_toda_la_celda_del_aviso(monkeypatch):
    # D-37: un aviso por celda, registrado con una sola detección. "En camino" confirma a todas (#264).
    monkeypatch.setattr(verificacion, "_noticias", lambda *a: {})
    base = BaseFalsa(
        [foco("aviso", "c1"), foco("vecina", "c1", "low"), foco("otra", "c2")],
        avisos=[("aviso", "en_camino")],
    )
    verificacion.verificar(base, AHORA, cliente=None)

    assert base.guardadas == {"aviso": "confirmado", "vecina": "confirmado", "otra": "sin_confirmar"}


def test_un_aviso_falso_descarta_toda_la_celda(monkeypatch):
    monkeypatch.setattr(verificacion, "_noticias", lambda *a: {})
    base = BaseFalsa([foco("aviso", "c1", "high"), foco("vecina", "c1", "high")], avisos=[("aviso", "falso")])
    verificacion.verificar(base, AHORA, cliente=None)

    assert base.guardadas == {"aviso": "sin_confirmar", "vecina": "sin_confirmar"}


def test_si_hay_varios_avisos_en_la_celda_vale_el_ultimo_que_marco_la_entidad(monkeypatch):
    # Antes de D-37 había un aviso por detección: la consulta los trae ordenados por fecha de cambio.
    monkeypatch.setattr(verificacion, "_noticias", lambda *a: {})
    base = BaseFalsa(
        [foco("a", "c1"), foco("b", "c1"), foco("c", "c1")],
        avisos=[("a", "falso"), ("b", "en_camino"), ("c", "nueva")],
    )
    verificacion.verificar(base, AHORA, cliente=None)

    assert base.guardadas["c"] == "confirmado"
    assert base.guardadas["a"] == "sin_confirmar"  # su propio aviso sigue mandando sobre el de la celda
