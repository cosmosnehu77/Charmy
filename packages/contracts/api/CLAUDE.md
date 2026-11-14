# packages/contracts/api: reglas para los agentes

Contrato de la API. Dueño: `@BrunoAguinaga0`. Lo consumen los carriles A, D y E. Detalle en `README.md`.

## Comandos

```bash
pnpm --filter @charmy/contracts-api lint       # Redocly: tiene que quedar sin errores
pnpm --filter @charmy/contracts-api build      # tipos en dist/schema.d.ts
pnpm --filter @charmy/contracts-api mock       # Prism en http://localhost:4010
pnpm --filter @charmy/contracts-api coleccion  # regenera postman/charmy.postman_collection.json
```

## Reglas

- `openapi.yaml` es la fuente de verdad. No se escribe a mano lo que se genera (`dist/`, `postman/`).
- Solo el dueño cambia el contrato. Otro carril que necesite un cambio lo pide en el tablero.
- Cada operación lleva `operationId`; cada respuesta 200, un ejemplo `muestra` con valores inventados y marcados.
  Nunca un número de ejemplo que parezca un resultado real (métricas de armonización, conteos).
- En los mapas YAML en línea (`{ ... }`), todo texto con coma va entre comillas: si no, YAML lo parte en otra clave.
- Después de cambiar el YAML se regenera la colección y se suben juntos.
- Todo cambio se anuncia en el tablero al hacer merge, mencionando a quienes lo consumen.
- Prism no es dependencia del paquete: corre con `pnpm dlx` en versión fija, porque trae un script de telemetría.
