# Charmy

Charmy armoniza los focos de calor que detectan los satélites MODIS y VIIRS en una sola serie continua y la muestra
como calendario de actividad de quema sobre un mapa 2D y 3D. Una vizcacha de fuego, Charmy, guía al público; el modo
experto sirve a brigadas e investigadores.

Proyecto del equipo de Comodoro Rivadavia para el NASA Space Apps Challenge 2026, desafío
"Harmonization of MODIS and VIIRS Hot Spots".

**Estado:** fase 4, pulido y entrega. La serie armonizada sale del histórico completo de FIRMS (2000 a 2026); el
método, la validación y sus límites están en [`docs/metodologia/`](docs/metodologia/README.md).

## Probarlo

| Pieza | Dirección |
|---|---|
| Landing | <https://charmy.earth> |
| Aplicación (mapa, calendario, modo experto) | <https://app.charmy.earth> |
| Juego | <https://juego.charmy.earth> |
| API (`/api/v1`, contrato en [`openapi.yaml`](packages/contracts/api/openapi.yaml)) | <https://api.charmy.earth/api/v1/health> |

La API corre en un plan gratuito que se duerme: el primer pedido puede tardar cerca de un minuto.

## Qué hay en el repo

| Carpeta | Qué es |
|---|---|
| [`apps/app/`](apps/app/) | La aplicación: mapa 2D y 3D, calendario, filtros y modo experto (Vite + React + MapLibre). |
| [`apps/landing/`](apps/landing/) | La landing (Astro). |
| [`apps/juego/`](apps/juego/) | El juego de Charmy bombero (Vite + Phaser). |
| [`packages/charmy/`](packages/charmy/) | El componente `<Charmy mood outfit size say />`, la única forma de mostrar a Charmy. |
| [`packages/ui/`](packages/ui/) | Colores, tipografías y rampas aptas para daltonismo. |
| [`packages/contracts/api/`](packages/contracts/api/) | Contrato OpenAPI de la API, su mock y la colección de Postman. |
| [`packages/contracts/datos/`](packages/contracts/datos/) | Esquema de los datos (focos, calendario, series, métricas y predicción). |
| [`services/pipeline/`](services/pipeline/) | Carga de FIRMS a Parquet, armonización, calendario y predicción. |
| [`services/api/`](services/api/) | La API (FastAPI + DuckDB sobre los Parquet publicados; Postgres para lo en vivo). |
| [`services/worker/`](services/worker/) | Focos recientes de NOAA-20 y NOAA-21 y su verificación con varias señales (`/live`). |
| [`services/contexto/`](services/contexto/) | Tiempo (Meteomatics) e imagen satelital (Copernicus) de un foco. |
| [`services/alertas/`](services/alertas/) | Avisos por Telegram y feed CAP 1.2 para entidades. |
| [`data/muestras/`](data/muestras/) | Muestras chicas con la forma de los datos reales. Los datos completos se publican fuera del repo. |
| [`infra/`](infra/) | Flujos de GitHub Actions, publicación de los datos y prueba de humo. |

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

En desarrollo la app usa el mock del contrato (`apps/app/.env.development`); levantalo con el comando de abajo.
Para usar la API local o la de producción, poné `VITE_API_URL` (con `/api/v1`) en `apps/app/.env.development.local`.

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

## Uso de inteligencia artificial

- **Datos y armonización:** sin IA. Son reglas fijas y regresiones lineales ([método](docs/metodologia/README.md)).
- **Predicción:** un modelo de aprendizaje automático (LightGBM). Solo se muestra si supera a la climatología en los
  años de prueba (D-10).
- **Verificación de focos en vivo:** un modelo de lenguaje (Gemma, vía NVIDIA) solo etiqueta titulares de noticias.
  El veredicto sale de reglas fijas sobre varias señales, y que no haya noticias nunca convierte un foco en falso (D-09).
- **Desarrollo:** el código y la documentación se escribieron con agentes de programación (Claude Code y otros),
  coordinados por el tablero y revisados por las personas del equipo. Toda funcionalidad entra con sus pruebas
  ([`docs/PRUEBAS.md`](docs/PRUEBAS.md)).

## Secretos

El repo es público desde el primer commit. Las claves (FIRMS, Meteomatics, Copernicus, NVIDIA, Telegram, la base y
los despliegues) viven solo en `.env` local, en la plataforma de la API y en los secretos de GitHub Actions; nunca en
el código, los issues ni el tablero. Al cerrar la fase 4 se revisó todo el historial y no aparece ninguna.

## Datos y créditos

Focos de calor: NASA FIRMS (MODIS y VIIRS). Tiempo: Meteomatics. Imagen: Copernicus Sentinel-2. Condiciones de uso de
cada fuente: [`PLAN.md`](PLAN.md), sección 1.1, y [`docs/metodologia/`](docs/metodologia/README.md).
Charmy no reemplaza a los servicios de emergencia: ante un incendio, llamá al 100 (bomberos, Argentina) o al 132
(bomberos, Chile).

La plantilla de coordinación es [tabla-agentes](https://github.com/cosmosnehu77/tabla-agentes).
