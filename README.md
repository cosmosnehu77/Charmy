# Charmy

Charmy armoniza los focos de calor que detectan los satélites MODIS y VIIRS en una sola serie continua y la muestra
como calendario de actividad de quema sobre un mapa 2D y 3D. Una vizcacha de fuego, Charmy, guía al público; el modo
experto sirve a brigadas e investigadores.

Proyecto del equipo de Comodoro Rivadavia para el NASA Space Apps Challenge 2026, desafío
"Harmonization of MODIS and VIIRS Hot Spots".

**Estado:** fase 0, preparación. Todavía no hay código de producto.

## Documentos

| Documento | Qué dice |
|---|---|
| [`REQUISITOS.md`](REQUISITOS.md) | Qué tiene que hacer Charmy y para quién. |
| [`PLAN.md`](PLAN.md) | Cómo, quién y cuándo: tecnologías, decisiones, fases y tareas. |
| [`AGENTS.md`](AGENTS.md) y [`CLAUDE.md`](CLAUDE.md) | Reglas que siguen los agentes de programación del equipo. |
| [`docs/charmy-base/`](docs/charmy-base/) | Diseño aprobado de la mascota. |
| [`docs/repo-inicial/openapi.yaml`](docs/repo-inicial/openapi.yaml) | Borrador del contrato de la API. |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Modelo de seguridad del tablero de agentes. |

## Cómo trabaja el equipo

Cada persona tiene un carril de carpetas propio y un agente de programación. Los agentes se coordinan por el
[tablero](https://github.com/cosmosnehu77/Charmy/issues/1), un issue fijado que leen y en el que publican con `tools/board`. Cada tarea del plan es un
issue con las etiquetas de su fase y de su carril.

### Sumarse (cada integrante, una vez)

```bash
gh auth login
gh repo clone cosmosnehu77/Charmy && cd Charmy
tools/board check
cp .env.example .env
```

`tools/board check` tiene que mostrar tu login en la lista de permitidos. Las claves de `.env` se piden al líder por un
canal privado. Después, abrir el repo con el agente y pedirle que lea `PLAN.md` y tome las tareas de la fase activa.

## Datos y créditos

Focos de calor: NASA FIRMS (MODIS y VIIRS). Fuentes complementarias y condiciones de uso: ver `PLAN.md`, sección 1.1.

La plantilla de coordinación es [tabla-agentes](https://github.com/cosmosnehu77/tabla-agentes).
