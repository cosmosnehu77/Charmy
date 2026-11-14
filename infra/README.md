# Infraestructura

Dueño: `@cosmosnehu77` (carril A). Qué se despliega y dónde está en `PLAN.md` §1.1; los flujos, en `.github/workflows/`.

| Flujo | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | Todo PR y todo push a `main` | Detecta qué cambió. JavaScript: tipos, pruebas y compilación **solo** de los paquetes tocados y de los que dependen de ellos. Python: `ruff` y `pytest`. Si cambió el contrato de la API o la prueba de humo, la corre contra el mock. Termina con **`CI ok`**, el chequeo obligatorio para fusionar en `main`. |
| `deploy-web.yml` | `main` con cambios en `apps/` o `packages/`, o a mano | Compila landing, app y juego y los publica en Cloudflare Pages (`charmy-landing`, `charmy-app`, `charmy-juego`). |
| `deploy-api.yml` | `main` con cambios en `services/api/` o `services/contexto/`, o a mano | Avisa a la plataforma de la API con su "deploy hook" espera a que responda `/health` y corre la prueba de humo. |

Cada pieza que todavía no existe se salta sola, así que los flujos se pueden dejar activos desde el primer día.

## Qué hay que cargar en GitHub (Settings → Secrets and variables → Actions)

| Nombre | Tipo | De dónde sale |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secreto | Cloudflare → My Profile → API Tokens, plantilla "Edit Cloudflare Workers" o permiso *Cloudflare Pages: Edit*. |
| `CLOUDFLARE_ACCOUNT_ID` | secreto | Panel de Cloudflare, columna derecha de *Workers & Pages*. |
| `API_DEPLOY_HOOK` | secreto | La plataforma de la API (en Render: Settings → Deploy Hook). |
| `VITE_API_URL` | variable | Dirección pública de la API (o del mock mientras no exista). |
| `API_URL` | variable | La misma dirección, con su prefijo (`https://<host>/api/v1`), para la prueba de vida y la de humo. |

Las claves de FIRMS, Meteomatics, Copernicus, NVIDIA y Telegram **no** van en GitHub: se cargan en la plataforma
de la API y de los avisos, porque solo el servidor las usa (RNF-06).

## Datos publicados (F2-A1)

La historia precalculada no vive en el repo ni en un servidor: se publica como **versión (release) de GitHub**
(decisión D-05). No hace falta ninguna cuenta aparte de la de GitHub.

```bash
uv run --package publicar python -m publicar <carpeta> --version datos-AAAA-MM-DD --seco   # qué se publicaría
uv run --package publicar python -m publicar <carpeta> --version datos-AAAA-MM-DD          # publicar
uv run --package publicar python -m publicar --verificar <URL de manifest.json>            # comprobar
```

- Publica cada `.parquet`, `.json`, `.geojson` y `.csv` de la carpeta, con sus subcarpetas.
- Una versión **no se pisa**: si el nombre existe, falla. Cada publicación es una versión nueva.
- Necesita `gh` con sesión. No usa ni guarda ninguna clave.

**Contrato para quien consume** (la API, carril C): la versión trae un `manifest.json`:

```json
{ "version": "datos-muestras-1", "repo": "cosmosnehu77/Charmy",
  "archivos": [ { "ruta": "focos.parquet", "url": "https://github.com/…/focos.parquet", "bytes": 32435, "sha256": "…" } ] }
```

La API se configura con la URL del manifiesto (`DATA_MANIFEST_URL`). Puede bajar cada `url` y controlar el
`sha256`, o leer los Parquet directo por HTTPS con DuckDB (`read_parquet('<url>')`, probado). Las rutas con
carpetas (`focos/satellite=N20/…`) se publican aplanadas con `--`; la `ruta` del manifiesto es la original.

**Versión publicada hoy:** `datos-muestras-1`, las muestras de `data/muestras/` (provisorias, ver `esquema.md`):
https://github.com/cosmosnehu77/Charmy/releases/download/datos-muestras-1/manifest.json

## Prueba de humo (F2-A2)

`infra/humo` pide tres cosas a una API y falla si alguna no cumple el contrato (`packages/contracts/api/openapi.yaml`):

| Pide | Falla si |
|---|---|
| `GET /health` | no responde 200 con `"status": "ok"` |
| `POST /calendar` con el área de la Comarca Andina | no trae ningún mes válido en `cells` |
| `GET /hotspots?format=csv` | la primera línea no es el encabezado del contrato |

```bash
uv run --package humo python -m humo https://<host>/api/v1     # producción o cualquier despliegue
uv run --package humo python -m humo http://localhost:4010     # mock (pnpm --filter @charmy/contracts-api mock)
```

Sale con 0 si todo está bien y con 1 si algo falla, y lista qué. Sin dependencias: solo la biblioteca estándar.
