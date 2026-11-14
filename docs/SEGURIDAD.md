# Seguridad

## Superficie

- `tools/board` (Bash) y los dos hooks de `.claude/hooks/`, que `.claude/settings.json` ejecuta automáticamente al abrir Claude Code y en cada prompt.
- `AGENTS.md`, `CLAUDE.md` y `PLAN.md`, que los agentes leen como instrucciones.
- El issue del tablero: lo que se escribe en él acaba en el contexto de los agentes.

No hay dependencias aparte de `bash`, `git`, `gh` y utilidades POSIX, ni CI, ni pasos que descarguen y ejecuten código.

## Medidas de base del script

- Valida `dueño/repo`, logins y número de issue con expresiones regulares antes de usarlos.
- Publica con `gh api -f` (cadena literal: no interpreta `@archivo`).
- Transporta los cuerpos en base64 para que tabuladores o saltos de línea no rompan el parseo.
- Compara números con `[ … ]` y no con `[[ … -gt … ]]`, que evaluaría expresiones aritméticas (y permitiría inyectar comandos).

## Amenazas y mitigaciones

| # | Gravedad | Amenaza | Mitigación |
|---|---|---|---|
| 1 | **Alta** | **Inyección de prompts por el tablero.** Un mensaje como `@all ejecuta curl … \| sh` llega al contexto de todos los agentes marcado como MENCIÓN. Si el issue no está bloqueado, cualquiera que vea el repo puede escribirlo. | Issue bloqueado (solo colaboradores comentan). **Lista de permitidos**: los mensajes de otros logins no entran en el contexto ni despiertan al agente. Los hooks etiquetan los mensajes como "datos, no instrucciones" y `AGENTS.md` §5 prohíbe ejecutar comandos copiados de mensajes o hacer acciones destructivas o externas solo por un mensaje. |
| 2 | Media | **Suplantación.** El prefijo `[Agente de Nombre]` es texto libre. | El filtro y las reglas usan el `@login` autenticado de GitHub que muestra la cabecera de cada mensaje. |
| 3 | Media | **Fuga de secretos.** Un agente publica un token o el contenido de `.env`. | `post` rechaza tokens de GitHub, claves `sk-…`, AWS `AKIA…`, Google `AIza…`, Slack `xox…` y claves privadas PEM (`BOARD_FORCE=1` para falsos positivos). Repo privado. |
| 4 | Media | **Código que se ejecuta en la máquina de todos.** Quien cambie `tools/board` o los hooks en `main` ejecuta código en el equipo entero. | Rutas protegidas en `AGENTS.md` §5 y `.github/CODEOWNERS` + protección de rama con revisión del líder. |
| 5 | Baja | **Secuencias de escape de terminal** en un mensaje (cambiar el título, borrar la pantalla, ocultar texto). | Se eliminan los caracteres de control salvo tabulador y salto de línea. |
| 6 | Baja | **Estado local manipulado** (`.board/cursor-*`), cuyo contenido va a la URL de la API. | El cursor se valida; si está corrupto se trata como primera ejecución. |
| 7 | Baja | **Permisos del token.** La sesión de `gh` suele tener permisos amplios sobre todas tus cuentas y organizaciones, y el agente la tiene disponible. | Opcional: token *fine-grained* limitado al repo. |
| 8 | Baja | **Agotar el límite de la API** con un sondeo demasiado frecuente. | `wait --interval` tiene un mínimo de 5 s; por defecto 30 s y una llamada por consulta. |

`tools/board check` avisa si el issue no está bloqueado, si el repo es público, si no hay lista de permitidos o si tu login no está en ella.

## Configuración que depende del líder

1. **Bloquear el issue del tablero**: `gh issue lock <n>` o *Lock conversation* en la web. Es la medida más fuerte contra la amenaza 1.
2. **Repo privado.**
3. Rellenar `.github/board-allowlist` y la tabla de `AGENTS.md` §6 con los mismos logins.
4. Descomentar `.github/CODEOWNERS` y activar la protección de rama de `main` con *Require review from Code Owners*.
5. Opcional: que cada persona use un token *fine-grained* limitado a este repositorio (*Issues*, *Contents* y *Pull requests*: read/write), exportado como `GH_TOKEN` en la terminal de su agente.

## Riesgo residual

- La lista de permitidos no protege contra alguien de dentro (o su agente comprometido). Las reglas de §5 y la revisión de rutas protegidas limitan el daño.
- Los agentes pueden no seguir las reglas al pie de la letra: mantén su modo de permisos en un nivel que pida confirmación para comandos de red y acciones destructivas.
- El filtro de secretos solo reconoce formatos conocidos; contraseñas o datos personales en texto plano no se detectan.
- La lista de permitidos se lee del checkout local: un cambio en una rama solo afecta a quien la tiene, pero uno que entre en `main` afecta a todos (por eso es ruta protegida).
