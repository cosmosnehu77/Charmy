# Charmy

Charmy armoniza los focos de calor que detectan los satélites MODIS y VIIRS en una sola serie continua y la muestra
como calendario de actividad de quema sobre un mapa 2D y 3D. Una vizcacha de fuego, Charmy, guía al público; el modo
experto sirve a brigadas e investigadores.

Proyecto del equipo de Comodoro Rivadavia para el NASA Space Apps Challenge 2026, desafío
"Harmonization of MODIS and VIIRS Hot Spots".

**Estado:** fases 1 y 2, cimientos y núcleo. Los datos y los números que se ven hoy son **muestras provisorias**,
no resultados.

## Qué hay en el repo

| Carpeta | Qué es |
|---|---|
| [`apps/app/`](apps/app/) | La aplicación: mapa 2D y 3D, calendario y filtros (Vite + React + MapLibre). |
| [`packages/charmy/`](packages/charmy/) | El componente `<Charmy mood outfit size say />`, la única forma de mostrar a Charmy. |
| [`packages/ui/`](packages/ui/) | Colores, tipografías y rampas aptas para daltonismo. |
| [`packages/contracts/api/`](packages/contracts/api/) | Contrato OpenAPI de la API, su mock y la colección de Postman. |
| [`packages/contracts/datos/`](packages/contracts/datos/) | Esquema de los datos (focos, calendario, series y métricas). |
| [`services/pipeline/`](services/pipeline/) | Carga de FIRMS a Parquet y armonización. |
| [`data/muestras/`](data/muestras/) | Muestras chicas con la forma de los datos reales. Los datos completos se publican fuera del repo. |
| [`infra/`](infra/) | Despliegue, publicación de los datos y prueba de humo. |

Las piezas que faltan (API, worker, avisos, landing y juego) se suman en sus fases; ver [`PLAN.md`](PLAN.md).

## Documentos

| Documento | Qué dice |
|---|---|
| [`REQUISITOS.md`](REQUISITOS.md) | Qué tiene que hacer Charmy y para quién. |
| [`PLAN.md`](PLAN.md) | Cómo, quién y cuándo: tecnologías, decisiones, fases y tareas. |
| [`AGENTS.md`](AGENTS.md) y [`CLAUDE.md`](CLAUDE.md) | Reglas que siguen los agentes de programación del equipo. |
| [`docs/PRUEBAS.md`](docs/PRUEBAS.md) | Cuándo una tarea está terminada: pruebas y YAGNI. |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Modelo de seguridad del tablero de agentes. |
| [`docs/charmy-base/`](docs/charmy-base/) | Diseño aprobado de la mascota. |

## Correrlo en local

Requisitos: Node 22 o más, pnpm, uv y Docker.

```bash
pnpm install
uv sync --all-packages
cp .env.example .env
```

```bash
pnpm dev --filter @charmy/app
```

Sin `VITE_API_URL`, la app usa las muestras de `data/muestras/`. Para usar el mock del contrato:

```bash
pnpm --filter @charmy/contracts-api mock
```

```bash
pnpm check
```

```bash
uv run pytest services infra
```

## Datos

Los datos precalculados se publican como versiones (releases) de GitHub con un `manifest.json` que lista cada archivo
con su tamaño y su `sha256`; ver [`infra/README.md`](infra/README.md). Las versiones no se pisan.

## Prueba de humo

Comprueba que una API desplegada responde lo que dice el contrato: `/health` da `ok`, `/calendar` de la Comarca Andina
trae meses y el CSV de `/hotspots` tiene el encabezado de FIRMS. Corre en el CI contra el mock y después de cada
despliegue contra producción. A mano, contra cualquier URL (la base con su prefijo, como `VITE_API_URL`):

```bash
uv run --package humo python -m humo https://<host>/api/v1
```

## Cómo trabaja el equipo

Cada persona tiene un carril de carpetas propio y un agente de programación. Los agentes se coordinan por el
[tablero](https://github.com/cosmosnehu77/Charmy/issues/1), un issue fijado que leen y en el que publican con
`tools/board`. Cada tarea del plan es un issue con las etiquetas de su fase y de su carril. Todo PR apunta a `main` y
necesita el chequeo "CI ok".

### Sumarse (cada integrante, una vez)

```bash
gh auth login
gh repo clone cosmosnehu77/Charmy && cd Charmy
tools/board check
cp .env.example .env
```

`tools/board check` tiene que mostrar tu login en la lista de permitidos. Las claves de `.env` se piden al líder por un
canal privado y nunca se suben al repo. Después, abrir el repo con el agente y pedirle que lea `PLAN.md` y tome las
tareas de la fase activa.

## Datos y créditos

Focos de calor: NASA FIRMS (MODIS y VIIRS). Fuentes complementarias y condiciones de uso: ver `PLAN.md`, sección 1.1.
Charmy no reemplaza a los servicios de emergencia.

La plantilla de coordinación es [tabla-agentes](https://github.com/cosmosnehu77/tabla-agentes).
