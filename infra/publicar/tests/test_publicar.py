import hashlib
import json

import pytest
from publicar import (
    ErrorPublicacion,
    armar_manifiesto,
    nombre_asset,
    publicar,
    verificar,
)

REPO = "cosmosnehu77/Charmy"


@pytest.fixture
def datos(tmp_path):
    d = tmp_path / "datos"
    (d / "focos" / "satellite=N20" / "year=2026").mkdir(parents=True)
    (d / "calendario.parquet").write_bytes(b"PAR1-calendario")
    (d / "focos" / "satellite=N20" / "year=2026" / "0.parquet").write_bytes(b"PAR1-focos")
    (d / "dia-juego.json").write_text('{"focos": []}')
    (d / ".DS_Store").write_bytes(b"basura")
    (d / "notas.txt").write_text("no se publica")
    return d


class Gh:
    """gh simulado: registra los comandos y responde según lo que exista."""

    def __init__(self, sesion=True, tag_existe=False):
        self.comandos, self.sesion, self.tag_existe = [], sesion, tag_existe

    def __call__(self, args):
        self.comandos.append(args)
        if args[:2] == ["auth", "status"]:
            return 0 if self.sesion else 1
        if args[:2] == ["release", "view"]:
            return 0 if self.tag_existe else 1
        return 0


def test_nombre_asset_aplana_la_ruta():
    plano = "focos--satellite=N20--year=2026--0.parquet"
    assert nombre_asset("focos/satellite=N20/year=2026/0.parquet") == plano


def test_manifiesto_lista_solo_datos_con_hash_y_url(datos):
    m = armar_manifiesto(datos, REPO, "datos-v1")
    rutas = [a["ruta"] for a in m["archivos"]]
    assert rutas == ["calendario.parquet", "dia-juego.json", "focos/satellite=N20/year=2026/0.parquet"]
    cal = m["archivos"][0]
    assert cal["bytes"] == len(b"PAR1-calendario")
    assert cal["sha256"] == hashlib.sha256(b"PAR1-calendario").hexdigest()
    assert cal["url"] == f"https://github.com/{REPO}/releases/download/datos-v1/calendario.parquet"
    assert m["version"] == "datos-v1"


def test_manifiesto_es_determinista(datos):
    assert armar_manifiesto(datos, REPO, "datos-v1") == armar_manifiesto(datos, REPO, "datos-v1")


def test_carpeta_sin_datos_falla(tmp_path):
    with pytest.raises(ErrorPublicacion, match="no hay archivos"):
        armar_manifiesto(tmp_path, REPO, "datos-v1")


def test_nombres_que_chocan_al_aplanar_fallan(tmp_path):
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.json").write_text("{}")
    (tmp_path / "a--b.json").write_text("{}")
    with pytest.raises(ErrorPublicacion, match="mismo nombre"):
        armar_manifiesto(tmp_path, REPO, "datos-v1")


def test_version_invalida_falla(datos):
    with pytest.raises(ErrorPublicacion, match="versión"):
        armar_manifiesto(datos, REPO, "v1; rm -rf /")


def test_prueba_en_seco_no_llama_a_gh(datos, tmp_path):
    gh = Gh()
    m = publicar(datos, REPO, "datos-v1", seco=True, gh=gh, trabajo=tmp_path / "t")
    assert gh.comandos == []
    assert len(m["archivos"]) == 3


def test_publica_release_con_archivos_y_manifiesto(datos, tmp_path):
    gh = Gh()
    publicar(datos, REPO, "datos-v1", gh=gh, trabajo=tmp_path / "t")
    crear = next(c for c in gh.comandos if c[:2] == ["release", "create"])
    assert "datos-v1" in crear and "--repo" in crear and REPO in crear
    subidos = [c for c in gh.comandos if c[:2] == ["release", "upload"]]
    nombres = sorted(a.rsplit("/", 1)[-1] for c in subidos for a in c[3:] if not a.startswith("-"))
    assert "manifest.json" in nombres
    assert "focos--satellite=N20--year=2026--0.parquet" in nombres
    manifiesto = json.loads((tmp_path / "t" / "manifest.json").read_text())
    assert manifiesto["version"] == "datos-v1"


def test_no_pisa_una_version_existente(datos, tmp_path):
    gh = Gh(tag_existe=True)
    with pytest.raises(ErrorPublicacion, match="ya existe"):
        publicar(datos, REPO, "datos-v1", gh=gh, trabajo=tmp_path / "t")
    assert not any(c[:2] in (["release", "create"], ["release", "upload"]) for c in gh.comandos)


def test_sin_sesion_de_gh_falla_claro(datos, tmp_path):
    with pytest.raises(ErrorPublicacion, match="gh auth login"):
        publicar(datos, REPO, "datos-v1", gh=Gh(sesion=False), trabajo=tmp_path / "t")


def test_verificar_pide_por_rango_y_controla_el_tamano(datos):
    m = armar_manifiesto(datos, REPO, "datos-v1")
    pedidos = []

    def http(url, rango):
        pedidos.append((url, rango))
        a = next(a for a in m["archivos"] if a["url"] == url)
        return 206, f"bytes 0-3/{a['bytes']}"

    assert verificar(m, http) == []
    assert all(r == "bytes=0-3" for _, r in pedidos) and len(pedidos) == 3


def test_verificar_informa_lo_que_falla(datos):
    m = armar_manifiesto(datos, REPO, "datos-v1")

    def http(url, rango):
        if url.endswith("calendario.parquet"):
            return 200, None  # ignora el rango: DuckDB no podría leerlo por partes
        if url.endswith("dia-juego.json"):
            return 404, None
        return 206, "bytes 0-3/999"  # tamaño distinto al del manifiesto

    problemas = verificar(m, http)
    assert len(problemas) == 3
    assert any("rango" in p for p in problemas)
    assert any("404" in p for p in problemas)
    assert any("tamaño" in p for p in problemas)
