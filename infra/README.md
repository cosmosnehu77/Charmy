# Infraestructura

Dueño: `@cosmosnehu77` (carril A). Qué se despliega y dónde está en `PLAN.md` §1.1; los flujos, en `.github/workflows/`.

| Flujo | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | Todo PR y todo push a `main` | Detecta qué cambió. JavaScript: tipos, pruebas y compilación **solo** de los paquetes tocados y de los que dependen de ellos. Python: `ruff` y `pytest`. Termina con **`CI ok`**, el chequeo obligatorio para fusionar en `main`. |
| `deploy-web.yml` | `main` con cambios en `apps/` o `packages/`, o a mano | Compila landing, app y juego y los publica en Cloudflare Pages (`charmy-landing`, `charmy-app`, `charmy-juego`). |
| `deploy-api.yml` | `main` con cambios en `services/api/` o `services/contexto/`, o a mano | Avisa a la plataforma de la API con su "deploy hook" y espera a que responda `/health`. |

Cada pieza que todavía no existe se salta sola, así que los flujos se pueden dejar activos desde el primer día.

## Qué hay que cargar en GitHub (Settings → Secrets and variables → Actions)

| Nombre | Tipo | De dónde sale |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secreto | Cloudflare → My Profile → API Tokens, plantilla "Edit Cloudflare Workers" o permiso *Cloudflare Pages: Edit*. |
| `CLOUDFLARE_ACCOUNT_ID` | secreto | Panel de Cloudflare, columna derecha de *Workers & Pages*. |
| `API_DEPLOY_HOOK` | secreto | La plataforma de la API (en Render: Settings → Deploy Hook). |
| `VITE_API_URL` | variable | Dirección pública de la API (o del mock mientras no exista). |
| `API_URL` | variable | La misma dirección, para la prueba de vida. |

Las claves de FIRMS, Meteomatics, Copernicus, NVIDIA y Telegram **no** van en GitHub: se cargan en la plataforma
de la API y de los avisos, porque solo el servidor las usa (RNF-06).
