# Contrato de la API (`@charmy/contracts-api`)

Contrato de la API REST `/api/v1` de Charmy en OpenAPI 3.1. Dueño: `@BrunoAguinaga0` (carril C).

**`openapi.yaml` es la fuente de verdad.** La API (`services/api/`) lo implementa; el mock responde con sus ejemplos;
los tipos de TypeScript y la colección de Postman se generan desde él. Si algo no coincide, vale el YAML.

Todos los ejemplos del contrato son **muestras provisorias**: valores inventados con la forma real. Nunca se
presentan como resultados. Se reemplazan por los de `data/muestras/` cuando estén (F1-B2).

## Cómo usarlo

| Para qué | Comando | Resultado |
|---|---|---|
| Levantar el mock | `pnpm --filter @charmy/contracts-api mock` | Prism en `http://localhost:4010`, responde con los ejemplos y valida los pedidos |
| Revisar el contrato | `pnpm --filter @charmy/contracts-api lint` | Redocly: estructura y ejemplos contra sus esquemas |
| Generar los tipos | `pnpm --filter @charmy/contracts-api build` | `dist/schema.d.ts` (openapi-typescript) |
| Regenerar la colección | `pnpm --filter @charmy/contracts-api coleccion` | `postman/charmy.postman_collection.json` |

**Desde la app**, apuntando al mock: `VITE_API_URL=http://localhost:4010`. El mock sirve las rutas sin el prefijo
`/api/v1`; la API real las sirve con él.

**Tipos en TypeScript.** Agregar `"@charmy/contracts-api": "workspace:*"` y:

```ts
import type { components, paths } from "@charmy/contracts-api";

type Hotspot = components["schemas"]["Hotspot"];
type Calendario = paths["/calendar"]["post"]["responses"]["200"]["content"]["application/json"];
```

Funciona bien con `openapi-fetch`, si la app lo quiere usar.

**En Postman**, importar `postman/charmy.postman_collection.json`. La variable `baseUrl` apunta a la API local;
`baseUrl1`, al mock.

## Cómo cambiar el contrato

1. Editar `openapi.yaml`. Cada operación tiene `operationId` y cada respuesta 200 un ejemplo `muestra`.
2. `pnpm --filter @charmy/contracts-api lint` sin errores.
3. `pnpm --filter @charmy/contracts-api coleccion` y subir la colección en el mismo commit.
4. Al hacer merge, anunciarlo en el tablero mencionando a quienes lo consumen (carriles A, D y E). Si el cambio
   rompe algo (saca un campo, lo vuelve obligatorio en un pedido, cambia un tipo), decirlo explícitamente.
