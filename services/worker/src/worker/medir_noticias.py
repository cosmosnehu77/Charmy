"""Medición de modelos para etiquetar noticias (#279, #391). No es una prueba: llama a NVIDIA NIM de verdad.

    NVIDIA_API_KEY=... uv run --package worker python -m worker.medir_noticias

Corre las muestras de abajo contra cada modelo candidato, igual que en producción (hasta 8 titulares por
pedido, una provincia por pedido), y anota cuánto tarda, cuántas etiquetas acierta y cuántas veces dice
"apoya" sin que corresponda (el error que infla los confirmados). Imprime una tabla en Markdown para el PR.

MUESTRA INVENTADA (`MUESTRA`): los titulares los escribió el equipo para medir y las etiquetas son a mano.
No son noticias reales ni un resultado.

TITULARES REALES (`MUESTRA_REAL`): titulares de Google News tal como los leyó el worker el 15/11/2026, en la
provincia del foco donde aparecieron. Las etiquetas son a mano, con la regla de #391: solo "apoya" el fuego en
vegetación o al aire libre. Sirven para medir, no son un resultado.
"""

import sys
import time

import httpx

from worker.noticias import MODELO, OPCIONES_MODELO, NoticiasNoDisponibles, etiquetar

SIN_RAZONAR = {"chat_template_kwargs": {"enable_thinking": False}}

# (nombre en la tabla, modelo, opciones extra del pedido). El primero es el de producción.
CANDIDATOS = [
    (f"{MODELO} (producción)", MODELO, OPCIONES_MODELO),
    ("nemotron-3.5-lightning sin razonar (anterior)", "nvidia/nemotron-3.5-lightning-30b-a3b", SIN_RAZONAR),
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


# (provincia, país, [(titular, etiqueta esperada)]): titulares reales del 15/11/2026, a mano (#391).
S = "sin_informacion"
MUESTRA_REAL = [
    ("Santa Cruz", "Argentina", [
        # Medios de Bolivia con dominio genérico (#407): Santa Cruz también es un departamento boliviano.
        ("Envían 194 efectivos y cinco medios aéreos para combatir incendio forestal en San José de "
         "Chiquitos - El Potosí", S),
        ("Santa Cruz: Gobierno despliega apoyo aéreo y terrestre para combatir incendio forestal - El "
         "Potosí", S),
        ("Bomberos y militares trabajan para evitar que las llamas lleguen a áreas protegidas en Santa Cruz "
         "- El Potosí", S),
        ("Incendio en Chiquitos supera las 8.000 hectáreas - Correo del Sur", S),
        ("Incendio en una fábrica de colchones : fuerte operativo - NoticiasNQN", S),
    ]),
    ("Los Lagos", "Chile", [
        ("Incendio forestal afecta cerca de ocho hectáreas en Maullín durante jornada de altas temperaturas "
         "en Los Lagos - Diario De Puerto Montt", "apoya"),
        ("Senapred declara Alerta Roja para la comuna de Chonchi por incendio forestal - VLN Radio", "apoya"),
        ("Agricultura y CONAF refuerzan llamado preventivo por calor en Los Lagos - MiradaSurTV", S),
        ("Autoridades llaman a extremar las medidas de prevención de incendios forestales ante altas "
         "temperaturas - El Heraldo Austral", S),
    ]),
    ("Araucanía", "Chile", [
        ("Incendios forestales mantienen bajo Alerta Roja a tres comunas en La Araucanía: hay evacuaciones "
         "- Alerta Noticias Temuco.cl", "apoya"),
        ("Bomberos confirma un fallecido tras voraz incendio que afectó a tres viviendas en Maipú "
         "- 24horas", S),
        ("Incendio tras explosión en Maipú deja un fallecido: Hay tres viviendas afectadas - CNN Chile", S),
        ("CONAF: MINUTA BALANCE INCENDIOS FORESTALES 2021-2022 - Alerta Noticias Temuco.cl", S),
        ("Estonia cerrará los pasos fronterizos con Rusia tras un intento de “sabotaje” en una fábrica de "
         "drones - BioBioChile", S),
    ]),
    ("Santiago del Estero", "Argentina", [
        ("Bomberos sofocaron un nuevo incendio forestal en Las Termas - Nuevo Diario Web", "apoya"),
        ("Embarcación, Salta: un temporal con ráfagas de 130 km/h dejó 150 heridos - Info del Estero", S),
        ("La Banda: un consumidor denunció que encontró una cucaracha en su comida en el mercado - Info del "
         "Estero", S),
        ("Crecida del Paraná: disminuyó la cantidad de animales en las islas y continúa la asistencia a "
         "productores - Telefe Rosario", S),
    ]),
    ("Santa Fe", "Argentina", [
        ("Un incendio afectó una montaña de residuos en el Centro Ambiental de Santa Fe "
         "- Sin Mordaza", "apoya"),
        ("Un incendio destruyó un dormitorio en una vivienda de barrio Santa Rosa de Lima - Radio EME", S),
        ("Explosión en Remedios de Escalada: controlaron el incendio y avanza la investigación - Sol Play "
         "91.5", S),
        ("Incendio en un departamento del centro de Rosario: una mujer fue trasladada al hospital - Cadena 3 "
         "Argentina", S),
        ("Incendio en una lomitería sobre la costanera - El Diario del centro del país", S),
    ]),
    ("Neuquén", "Argentina", [
        ("Incendio en Neuquén: se prendió fuego una colchonería y desplegaron un amplio operativo - Radio "
         "Mitre", S),
        ("Impresionante incendio en una colchonería de Neuquén: una columna de humo negro cubrió el bajo - "
         "ANBariloche", S),
        ("Incendio del Museo Tello: la Provincia anunció acciones judiciales y un operativo especial para "
         "rescatar el patrimonio - Noticias Río Negro", S),
        ("Susto en El Bolsón por un principio de incendio cerca de la Ruta 40 - Flipr.news", S),
    ]),
    ("Chaco", "Argentina", [
        ("Un incendio arrasó un depósito de carbón en Tres Isletas - DataChaco", S),
        ("Incendio consumió 35 toneladas de leña en una planta de alimentos balanceados en Gancedo - NOVA "
         "Chaco", S),
        ("Voraz incendio en un autoservicio de Castelli movilizó a bomberos de cuatro localidades - "
         "www.libertaddigital.com.ar", S),
        ("Incendiaron intencionalmente una casilla precaria en el barrio 7 de Mayo: buscan al responsable - "
         "www.diariopinion.com.ar", S),
        ("Controlaron el incendio tras la explosión en Remedios de Escalada que dejó un muerto y 30 "
         "heridos - Flipr.news", S),
    ]),
    ("Misiones", "Argentina", [
        ("Un desperfecto mecánico provocó el incendio de un automóvil sobre la ruta 14 - Radio Cataratas", S),
        ("Aristóbulo del Valle: un incendio destruyó una vivienda y dejó a su propietario con quemaduras - "
         "Canal Doce Misiones", S),
        ("Metrogas logró obturar el caño dañado y controlar el incendio que dejó un muerto y más de 20 "
         "heridos en Buenos Aires - MisionesOnline", S),
    ]),
    ("Mendoza", "Argentina", [
        ("Arrestaron a la pareja del joven que murió en un incendio en San Carlos - Diario Mendoza", S),
        ("Una mujer intoxicada por monóxido tras incendio en Malargüe - Sitio Andino", S),
        ("Investigan como homicidio el incendio en San Carlos - El Editor Mendoza", S),
    ]),
    ("Jujuy", "Argentina", [
        ("Alerta por incendios forestales: piden evitar quemas y extremar precauciones "
         "- Jujuy Al Momento", S),
        ("#incendio ayuntamiento de Limoges - Somos Jujuy", S),
        ("Explosión e incendio en Remedios de Escalada: confirmaron una muerte, 30 heridos y dos "
         "desaparecidos - La Voz de Jujuy", S),
    ]),
]


def aciertos(esperadas: list[str], obtenidas: list[str]) -> int:
    return sum(e == o for e, o in zip(esperadas, obtenidas, strict=True))


def medir(
    modelo: str, cliente: httpx.Client, opciones: dict | None = None, nombre: str | None = None
) -> dict:
    resultado = {
        "modelo": nombre or modelo,
        "aciertos": 0,
        "total": sum(len(t) for _, _, t in MUESTRA),
        "aciertos_real": 0,
        "total_real": sum(len(t) for _, _, t in MUESTRA_REAL),
        "apoya_de_mas": 0,
        "fallas": 0,
        "segundos": [],
    }
    for clave, muestra in (("aciertos", MUESTRA), ("aciertos_real", MUESTRA_REAL)):
        for provincia, pais, filas in muestra:
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
            esperadas = [e for _, e in filas]
            resultado[clave] += aciertos(esperadas, obtenidas)
            resultado["apoya_de_mas"] += sum(
                o == "apoya" and e != "apoya" for e, o in zip(esperadas, obtenidas, strict=True)
            )
    return resultado


def tabla(resultados: list[dict]) -> str:
    filas = [
        "| Modelo | Aciertos (inventada) | Aciertos (reales) | \"apoya\" de más | Pedidos fallidos "
        "| Segundos por pedido (máx.) |",
        "|---|---|---|---|---|---|",
    ]
    pedidos = len(MUESTRA) + len(MUESTRA_REAL)
    for r in resultados:
        maximo = max(r["segundos"], default=0)
        promedio = sum(r["segundos"]) / len(r["segundos"]) if r["segundos"] else 0
        filas.append(
            f"| `{r['modelo']}` | {r['aciertos']}/{r['total']} | {r['aciertos_real']}/{r['total_real']} "
            f"| {r['apoya_de_mas']} | {r['fallas']}/{pedidos} | {promedio:.1f} ({maximo:.1f}) |"
        )
    return "\n".join(filas)


def main() -> int:
    with httpx.Client() as cliente:
        resultados = [medir(m, cliente, opciones, nombre) for nombre, m, opciones in CANDIDATOS]
    print(tabla(resultados))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
