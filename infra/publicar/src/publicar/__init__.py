"""Publica los datos precalculados como una versión (release) de GitHub, con un manifest.json.

Contrato para quien consume (la API): leer `manifest.json` de la versión, bajar cada archivo de su
`url`, comprobar `sha256` y dejarlo en `ruta` dentro de su carpeta de datos. Las versiones no se pisan:
cada publicación es nueva.

Uso:
  uv run --package publicar python -m publicar <carpeta> --version datos-AAAA-MM-DD [--seco]
  uv run --package publicar python -m publicar --verificar <url-del-manifest.json>
"""

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path

EXTENSIONES = {".parquet", ".json", ".geojson", ".csv"}
VERSION_RE = re.compile(r"^datos-[A-Za-z0-9._-]+$")


class ErrorPublicacion(Exception):
    pass


def nombre_asset(ruta: str) -> str:
    """Los assets de una release no tienen carpetas: la ruta se aplana con '--'."""
    return ruta.replace("/", "--")


def _sha256(archivo: Path) -> str:
    h = hashlib.sha256()
    with archivo.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def armar_manifiesto(carpeta: Path, repo: str, version: str) -> dict:
    if not VERSION_RE.match(version):
        raise ErrorPublicacion(
            f"versión inválida {version!r}: tiene que empezar con 'datos-' (p. ej. datos-2026-11-14)"
        )
    archivos = sorted(p for p in Path(carpeta).rglob("*") if p.is_file() and p.suffix in EXTENSIONES)
    if not archivos:
        raise ErrorPublicacion(f"no hay archivos de datos en {carpeta} ({', '.join(sorted(EXTENSIONES))})")
    vistos: dict[str, str] = {}
    lista = []
    for p in archivos:
        ruta = p.relative_to(carpeta).as_posix()
        asset = nombre_asset(ruta)
        if asset in vistos:
            raise ErrorPublicacion(
                f"{ruta} y {vistos[asset]} quedan con el mismo nombre al publicarse ({asset})"
            )
        vistos[asset] = ruta
        lista.append(
            {
                "ruta": ruta,
                "url": f"https://github.com/{repo}/releases/download/{version}/{asset}",
                "bytes": p.stat().st_size,
                "sha256": _sha256(p),
            }
        )
    return {"version": version, "repo": repo, "archivos": lista}


Gh = Callable[[list[str]], int]


def _gh_real(args: list[str]) -> int:
    return subprocess.run(["gh", *args], stdout=subprocess.DEVNULL).returncode


def publicar(
    carpeta: Path,
    repo: str,
    version: str,
    *,
    seco: bool = False,
    gh: Gh = _gh_real,
    trabajo: Path | None = None,
) -> dict:
    """Arma el manifiesto y, salvo en seco, crea la release y sube los archivos y el manifiesto."""
    carpeta = Path(carpeta)
    manifiesto = armar_manifiesto(carpeta, repo, version)
    if seco:
        return manifiesto
    if gh(["auth", "status"]) != 0:
        raise ErrorPublicacion(
            "gh no tiene sesión: correr 'gh auth login' (las credenciales nunca van al repo)"
        )
    if gh(["release", "view", version, "--repo", repo]) == 0:
        raise ErrorPublicacion(f"la versión {version} ya existe: las versiones no se pisan, usar una nueva")

    trabajo = Path(trabajo or tempfile.mkdtemp(prefix="publicar-"))
    trabajo.mkdir(parents=True, exist_ok=True)
    subir = []
    for a in manifiesto["archivos"]:
        destino = trabajo / nombre_asset(a["ruta"])
        shutil.copyfile(carpeta / a["ruta"], destino)
        subir.append(str(destino))
    (trabajo / "manifest.json").write_text(json.dumps(manifiesto, indent=1, ensure_ascii=False) + "\n")
    subir.append(str(trabajo / "manifest.json"))

    notas = f"Datos precalculados de Charmy ({len(manifiesto['archivos'])} archivos). Ver manifest.json."
    if gh(["release", "create", version, "--repo", repo, "--title", version, "--notes", notas]) != 0:
        raise ErrorPublicacion(f"no se pudo crear la versión {version}")
    for i in range(0, len(subir), 20):  # de a tandas, para no pasar el largo máximo de un comando
        if gh(["release", "upload", version, *subir[i : i + 20], "--repo", repo]) != 0:
            raise ErrorPublicacion(f"falló la subida de {version}; borrar la versión a medias y reintentar")
    return manifiesto


Http = Callable[[str, str], tuple[int, str | None]]


def _http_real(url: str, rango: str) -> tuple[int, str | None]:
    pedido = urllib.request.Request(url, headers={"Range": rango, "User-Agent": "charmy-publicar"})
    try:
        with urllib.request.urlopen(pedido, timeout=30) as r:
            return r.status, r.headers.get("Content-Range")
    except urllib.error.HTTPError as e:
        return e.code, None


def verificar(manifiesto: dict, http: Http = _http_real) -> list[str]:
    """Pide los primeros bytes de cada archivo. Devuelve los problemas (lista vacía = todo bien).

    Se exige respuesta parcial (206): DuckDB lee Parquet remoto por rangos.
    """
    problemas = []
    for a in manifiesto["archivos"]:
        estado, rango = http(a["url"], "bytes=0-3")
        if estado != 206:
            motivo = "no respeta pedidos por rango" if estado == 200 else f"respondió {estado}"
            problemas.append(f"{a['ruta']}: {motivo}")
        elif not rango or rango.rsplit("/", 1)[-1] != str(a["bytes"]):
            problemas.append(
                f"{a['ruta']}: el tamaño publicado ({rango}) no coincide con el manifiesto ({a['bytes']})"
            )
    return problemas
