"""La imagen instala solo lo de servir.txt: coincide con pyproject.toml y le alcanza al servidor."""

import ast
import sys
import tomllib
from pathlib import Path

RAIZ = Path(__file__).parents[1]


def requisitos() -> list[str]:
    lineas = (RAIZ / "servir.txt").read_text().splitlines()
    return [x.strip() for x in lineas if x.strip() and not x.startswith("#")]


def test_servir_txt_repite_dependencias_del_pyproject():
    declaradas = tomllib.loads((RAIZ / "pyproject.toml").read_text())["project"]["dependencies"]
    assert set(requisitos()) <= set(declaradas)


def test_el_servidor_solo_importa_lo_que_la_imagen_instala():
    arbol = ast.parse((RAIZ / "src/prediccion/servir.py").read_text())
    importados = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            importados |= {a.name.split(".")[0] for a in nodo.names}
        elif isinstance(nodo, ast.ImportFrom):
            importados.add(nodo.module.split(".")[0])
    # pydantic llega con fastapi.
    permitidos = {r.split(">=")[0] for r in requisitos()} | {"pydantic"} | set(sys.stdlib_module_names)
    assert importados <= permitidos
