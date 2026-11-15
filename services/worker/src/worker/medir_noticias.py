"""Medición de modelos para etiquetar noticias (#279). No es una prueba: llama a NVIDIA NIM de verdad.

    NVIDIA_API_KEY=... uv run --package worker python -m worker.medir_noticias

Corre la muestra de abajo contra cada modelo candidato, igual que en producción (hasta 8 titulares por
pedido, una provincia por pedido), y anota cuánto tarda y cuántas etiquetas acierta. Imprime una tabla en
Markdown para pegar en el PR.

MUESTRA INVENTADA: los titulares los escribió el equipo para medir y las etiquetas son a mano. No son
noticias reales ni un resultado.
"""

import sys
import time

import httpx

from worker.noticias import MODELO, NoticiasNoDisponibles, etiquetar

SIN_RAZONAR = {"chat_template_kwargs": {"enable_thinking": False}}

# (nombre en la tabla, modelo, opciones extra del pedido).
CANDIDATOS = [
    (MODELO, MODELO, {}),
    ("nemotron-3.5-lightning", "nvidia/nemotron-3.5-lightning-30b-a3b", {}),
    ("nemotron-3.5-lightning sin razonar", "nvidia/nemotron-3.5-lightning-30b-a3b", SIN_RAZONAR),
    ("nemotron-3.5-lightning 1500 tokens", "nvidia/nemotron-3.5-lightning-30b-a3b", {"max_tokens": 1500}),
    ("nemotron-3.5-bolt sin razonar", "nvidia/nemotron-3.5-bolt-e4b", SIN_RAZONAR),
    ("gpt-oss-20b", "openai/gpt-oss-20b", {"max_tokens": 1500}),
    ("glm-5.3-flash", "z-ai/glm-5.3-flash", {}),
    ("minimax-m3.1-flash", "minimaxai/minimax-m3.1-flash", {"max_tokens": 1500}),
]

# (provincia, país, [(titular, etiqueta esperada)]) — muestra inventada.
MUESTRA = [
    ("Chubut", "Argentina", [
        ("Brigadistas combaten un incendio forestal cerca de El Hoyo", "apoya"),
        ("El fuego ya consumió 300 hectáreas de bosque nativo en la cordillera", "apoya"),
        ("Bomberos aclararon que la columna de humo era una quema controlada autorizada", "contradice"),
        ("Se incendió una casa en Trelew y no hubo heridos", "sin_informacion"),
        ("Lanzan una campaña de prevención de incendios para el verano", "sin_informacion"),
        ("Vecinos alertaron por humo en el monte y resultó ser una falsa alarma", "contradice"),
        ("Un avión hidrante trabaja sobre el foco activo en el cerro", "apoya"),
        ("La Legislatura aprobó el presupuesto para el servicio de manejo del fuego", "sin_informacion"),
    ]),
    ("Corrientes", "Argentina", [
        ("Arde un pastizal a la vera de la ruta 12 y hay cortes de tránsito", "apoya"),
        ("Controlaron el incendio de campos que afectó a tres establecimientos", "apoya"),
        ("Se registraron lluvias y no hay focos activos en la provincia", "contradice"),
        ("Robo en un comercio del centro de la capital", "sin_informacion"),
        ("Productores reclaman ayuda por la sequía", "sin_informacion"),
        ("Fuego en los esteros: brigadas trabajan desde la madrugada", "apoya"),
        ("Incendio en una vivienda de Goya dejó daños materiales", "sin_informacion"),
        ("Desmienten el incendio en la reserva: era humo de una fábrica", "contradice"),
    ]),
    ("Araucanía", "Chile", [
        ("Conaf combate incendio forestal que afecta 50 hectáreas en Collipulli", "apoya"),
        ("Declaran alerta roja por incendio en la comuna de Angol", "apoya"),
        ("Senapred descartó un incendio forestal tras la denuncia de vecinos", "contradice"),
        ("Accidente de tránsito en la ruta 5 sur deja dos lesionados", "sin_informacion"),
        ("Inician el plan de prevención de incendios en colegios de Temuco", "sin_informacion"),
        ("El incendio en el sector rural ya está controlado tras dos días de trabajo", "apoya"),
        ("Incendio estructural afectó un galpón en Victoria", "sin_informacion"),
        ("Brigadas siguen trabajando en el foco que amenaza viviendas en Traiguén", "apoya"),
    ]),
]


def aciertos(esperadas: list[str], obtenidas: list[str]) -> int:
    return sum(e == o for e, o in zip(esperadas, obtenidas, strict=True))


def medir(
    modelo: str, cliente: httpx.Client, opciones: dict | None = None, nombre: str | None = None
) -> dict:
    total = sum(len(t) for _, _, t in MUESTRA)
    resultado = {"modelo": nombre or modelo, "aciertos": 0, "total": total, "fallas": 0, "segundos": []}
    for provincia, pais, filas in MUESTRA:
        titulares = [{"title": t} for t, _ in filas]
        inicio = time.monotonic()
        try:
            obtenidas = etiquetar(titulares, provincia, pais, cliente, modelo=modelo, opciones=opciones)
        except Exception as error:  # medir: un modelo que falla raro no corta la medición de los demás
            motivo = error if isinstance(error, NoticiasNoDisponibles) else type(error).__name__
            print(f"{nombre or modelo} / {provincia}: {motivo}", file=sys.stderr)
            resultado["fallas"] += 1
            continue
        finally:
            resultado["segundos"].append(time.monotonic() - inicio)
        resultado["aciertos"] += aciertos([e for _, e in filas], obtenidas)
    return resultado


def tabla(resultados: list[dict]) -> str:
    filas = ["| Modelo | Aciertos | Pedidos fallidos | Segundos por pedido (máx.) |", "|---|---|---|---|"]
    for r in resultados:
        maximo = max(r["segundos"], default=0)
        promedio = sum(r["segundos"]) / len(r["segundos"]) if r["segundos"] else 0
        filas.append(
            f"| `{r['modelo']}` | {r['aciertos']}/{r['total']} | {r['fallas']}/{len(MUESTRA)} "
            f"| {promedio:.1f} ({maximo:.1f}) |"
        )
    return "\n".join(filas)


def main() -> int:
    with httpx.Client() as cliente:
        resultados = [medir(m, cliente, opciones, nombre) for nombre, m, opciones in CANDIDATOS]
    print(tabla(resultados))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
