# services/api: reglas para los agentes

API REST de Charmy. Dueño: `@BrunoAguinaga0` (carril C). Implementa `packages/contracts/api/openapi.yaml` bajo
`/api/v1`. Si el código y el contrato no coinciden, vale el contrato.

## Comandos

```bash
uv run --package api uvicorn api.main:app --reload --port 8000   # levantar en local
uv run ruff check services/api && uv run ruff format services/api # lint y formato
docker compose --profile api up                                   # API y base en contenedores
uv run pytest services/api                                        # pruebas
```

Docs interactivas en `http://localhost:8000/api/v1/docs`.

## Reglas

- Ninguna clave se lee al importar un módulo: la API tiene que arrancar sin `.env`. Las claves se leen al usarlas.
- Todo error sale como el esquema `Error` del contrato (`{code, message}`) y nunca como HTML. Mensajes cortos, en
  español y en segunda persona.
- `API_URL` y `VITE_API_URL` son la base **con** el prefijo (`https://<host>/api/v1`). La prueba de humo
  (`uv run --package humo python -m humo <URL base>`) corre después de cada despliegue y la API tiene que pasarla.
- FIRMS, Meteomatics, Copernicus y el modelo de lenguaje se consultan solo desde acá o desde el worker, con caché.
- Los datos precalculados salen de `DATA_MANIFEST_URL` (release con `manifest.json`, DuckDB lee los Parquet por
  HTTPS). Sin esa variable se usan las muestras de `data/muestras/`: levantá la API desde la raíz del repo.
- CORS: los orígenes de los frontends publicados van en `CORS_ORIGINS` (separados por coma); localhost se
  permite en cualquier puerto. Métodos GET y POST, cabecera `Content-Type`.
- Las consultas a DuckDB van con parámetros (`?`), nunca armando SQL con lo que manda el usuario.
- Si los datos no se pueden leer, la respuesta es 503 `datos_no_disponibles`, no un 500.
- `/live` lee de Postgres (`DATABASE_URL`) lo que guarda `services/worker`; la API nunca llama a FIRMS.
- `GET /reports`, `POST /alerts` y `PATCH /alerts/{id}` piden `CHARMY_SERVICE_TOKEN` (Bearer); `POST /reports`
  es público. Los reportes no guardan IP ni datos personales (RNF-05). Las tablas llevan RLS activado.
- `services/contexto` (carril B) se monta como router; no se edita desde este carril.
- La imagen se construye desde la **raíz del repo** con `-f services/api/Dockerfile`, porque monta
  `services/contexto`. Lo que entra está en `services/api/Dockerfile.dockerignore`.
- Pruebas: `uv run pytest services/api` desde la raíz (usan `data/muestras/`, sin red ni base).
