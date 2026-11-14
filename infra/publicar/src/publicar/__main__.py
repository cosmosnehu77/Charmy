import argparse
import json
import sys
import urllib.request
from pathlib import Path

from publicar import ErrorPublicacion, publicar, verificar

REPO = "cosmosnehu77/Charmy"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="publicar", description="Publica los datos precalculados como release de GitHub"
    )
    p.add_argument("carpeta", nargs="?", type=Path, help="carpeta con los Parquet y JSON a publicar")
    p.add_argument("--version", help="nombre de la versión, p. ej. datos-2026-11-14")
    p.add_argument("--seco", action="store_true", help="solo muestra qué se publicaría")
    p.add_argument("--verificar", metavar="URL", help="URL de un manifest.json publicado para comprobarlo")
    p.add_argument("--repo", default=REPO)
    a = p.parse_args(argv)
    try:
        if a.verificar:
            with urllib.request.urlopen(a.verificar, timeout=30) as r:
                problemas = verificar(json.load(r))
            for x in problemas:
                print("PROBLEMA", x)
            resumen = f"{len(problemas)} problemas" if problemas else "ok: todos responden por rango"
            print(resumen)
            return 1 if problemas else 0
        if not a.carpeta or not a.version:
            p.error("hace falta la carpeta y --version (o --verificar URL)")
        m = publicar(a.carpeta, a.repo, a.version, seco=a.seco)
    except ErrorPublicacion as e:
        print(f"publicar: {e}", file=sys.stderr)
        return 1
    total = sum(x["bytes"] for x in m["archivos"])
    for x in m["archivos"]:
        print(f"{x['bytes']:>10}  {x['ruta']}")
    accion = "Se publicaría" if a.seco else "Publicada"
    print(f"{accion} {m['version']}: {len(m['archivos'])} archivos, {total} bytes")
    if not a.seco:
        print(f"Manifiesto: https://github.com/{a.repo}/releases/download/{m['version']}/manifest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
