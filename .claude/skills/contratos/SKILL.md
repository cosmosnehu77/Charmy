---
name: contratos
description: Contratos compartidos de Charmy y cómo trabajar contra ellos. Usar cuando se llama a la API de Charmy (/api/v1) desde la app, la landing, el juego o los avisos; cuando se levanta el mock o se generan los tipos; cuando se toca packages/contracts/ o services/api; o cuando un cambio afecta un contrato que otro carril consume.
---

# Contratos

Charmy se construye en paralelo porque cada carril trabaja contra **contratos**, no contra el código de otro
(decisión D-12). La lista completa, con dueños y consumidores, está en `PLAN.md` §4. Esta skill no la copia.

Regla de oro: un contrato lo cambia **solo su dueño**. Si necesitás un cambio, pedilo en el tablero mencionándolo.

## Contrato de la API (`packages/contracts/api/`, dueño `@BrunoAguinaga0`)

`openapi.yaml` es la **fuente de verdad**. La API (`services/api/`) lo implementa bajo `/api/v1`; el mock responde
con sus ejemplos; los tipos y la colección de Postman se generan desde él. Si algo no coincide, vale el YAML.

| Para qué | Comando |
|---|---|
| Levantar el mock (Prism, `http://localhost:4010`) | `pnpm --filter @charmy/contracts-api mock` |
| Revisar el contrato (Redocly, también valida los ejemplos) | `pnpm --filter @charmy/contracts-api lint` |
| Generar los tipos (`dist/schema.d.ts`) | `pnpm --filter @charmy/contracts-api build` |
| Regenerar la colección de Postman | `pnpm --filter @charmy/contracts-api coleccion` |
| Levantar la API real (`http://localhost:8000/api/v1`) | `uv run --package api uvicorn api.main:app --reload` |

### Consumir la API

- **URL base.** `VITE_API_URL` (frontends) y `API_URL` (servicios y CI) son la base **con** el prefijo:
  `https://<host>/api/v1`. El mock sirve las mismas rutas **sin** prefijo: `http://localhost:4010`.
- **Mientras la API real no tiene una ruta, se usa el mock.** Cuando la API la implementa, solo cambia la URL.
- **Tipos en TypeScript**, nunca escritos a mano:

  ```ts
  // package.json: "@charmy/contracts-api": "workspace:*"
  import type { components, paths } from "@charmy/contracts-api";
  type Hotspot = components["schemas"]["Hotspot"];
  ```

- **Errores.** Toda respuesta de error es `{ code, message }` (esquema `Error`). Mostrá `message` al público y usá
  `code` para decidir. Un 503 significa que esa fuente no responde: esa parte se muestra como no disponible y el
  resto sigue funcionando.
- **Ejemplos.** Los ejemplos del contrato son **muestras provisorias**: nunca se presentan como resultados.
- El navegador nunca llama a FIRMS, Meteomatics ni Copernicus: siempre pasa por la API.

### Cambiar el contrato (solo el dueño)

1. Editar `openapi.yaml`. Cada operación lleva `operationId`; cada respuesta 200, un ejemplo `muestra`.
   En los mapas YAML en línea (`{ ... }`), todo texto con coma va entre comillas.
2. `lint` sin errores y `coleccion` regenerada en el mismo commit.
3. Si `openapi.yaml` cambia, el CI corre la prueba de humo contra el mock: un cambio que la rompe se ve en el PR.
4. Al hacer merge, anunciarlo en el tablero mencionando a quienes lo consumen (carriles A, D y E). Decir
   explícitamente si **rompe** algo: saca un campo, cambia un tipo o vuelve obligatorio un campo de un pedido.

## Otros contratos

| Contrato | Dónde | Dueño | Cómo se usa |
|---|---|---|---|
| Esquema de datos | `packages/contracts/datos/esquema.md` | `@leonelcnr` | Columnas de Parquet y GeoJSON. La API lee las muestras de `data/muestras/` con esta forma. |
| Datos publicados | release de GitHub con `manifest.json` (`infra/README.md`) | `@cosmosnehu77` | La API lee `DATA_MANIFEST_URL` y DuckDB abre los Parquet por HTTPS. |
| Componente Charmy | `packages/charmy/README.md` | `@cosmosnehu77` | Ver la skill `charmy`. |
| Tokens de diseño | `packages/ui/README.md` | `@daniace` | `@charmy/ui/tokens.css` o `theme.css`; nada de colores sueltos. |
| Variables de entorno | `.env.example` | `@cosmosnehu77` | Una variable nueva se agrega con su nombre y sin valor. |

Si el código y un contrato no coinciden, no sigas como si nada: avisá en el tablero al dueño del contrato.
