# Pruebas y YAGNI

Cómo probamos Charmy y cuánto construimos. Vale para todos los carriles y todos los agentes (decisión D-23 de
`PLAN.md`). Las reglas obligatorias están resumidas en `CLAUDE.md`; acá está el detalle.

La idea en una línea: **cada tarea se termina con una prueba que demuestra lo que pide su issue, y no se construye
nada que el issue no pida.**

## 1. Definición de terminado

Una tarea está terminada cuando:

1. Su issue tiene la sección **"Pruebas mínimas"** y cada punto tiene una prueba automática que pasa, o una
   verificación manual escrita en el PR cuando no se puede automatizar (algo visual, una cuenta externa).
2. `pnpm check --filter <paquete>` o `uv run --package <servicio> pytest` pasa en local.
   Además, cada commit corre solo las pruebas de lo que toca (hook `pre-commit`, D-29): las de los paquetes JS que
   cambiaron y de los que dependen de ellos, y las de cada servicio de Python que cambió. Un servicio sin pruebas no
   se puede commitear, y el CI también lo rechaza. El hook se activa con `pnpm install`; no se saltea con `--no-verify`.
3. El CI del PR está en verde. Un PR con el CI en rojo no se fusiona, aunque "ande en local".
4. El PR apunta a `main`. **Nunca se apilan PR** (un PR cuya base es otra rama): al fusionarse, su contenido no
   llega a `main` y hay que rehacerlo.
5. La rama está al día con `main`: se corre `tools/al-dia` antes de abrir el PR y cada vez que GitHub marca
   conflictos, y las pruebas se vuelven a correr después. El script resuelve solo los choques de `pnpm-lock.yaml` y
   `uv.lock`; cualquier otro conflicto lo resuelve el dueño de la rama.
6. Después de fusionar, quien fusiona comprueba que el cambio está en `main` (`git log origin/main`).

## 2. Cómo se escribe una prueba

- **Primero la prueba, después el código** en todo lo que sea lógica: transformaciones de datos, cálculos,
  filtros, manejadores de la API, armado de mensajes. La prueba tiene que fallar antes de escribir el código; si
  pasa de entrada, no prueba nada.
- **Un error encontrado es una prueba nueva**: primero la prueba que lo reproduce, después el arreglo.
- **Se prueba el comportamiento, no la implementación**: entradas y salidas públicas, lo que ve quien usa la
  función, el endpoint o la pantalla. Cambiar el código por dentro no debería romper las pruebas.
- **Determinismo**: fechas fijas (nunca "ahora" sin inyectarlo), UTC, semillas fijas, orden explícito.
- **Nombres que se leen como requisitos**: `test_modis_confianza_menor_a_30_se_descarta`,
  `it("muestra 'no disponible' si el tiempo no responde")`.
- **Fixtures chicos y reales**: unas pocas filas con la forma real, en `tests/fixtures/` o `test/fixtures/`.
  Marcados como muestra. Sin datos personales ni claves.

## 3. Qué se prueba en cada capa

| Capa | Qué se prueba | Herramienta |
|---|---|---|
| Lógica pura | Armonización, calibración, días-celda, calendario, anomalías, filtros D-04, fuentes fijas, puntaje de verificación, armado del aviso y del CAP, claves y vencimiento de caché, puntaje del juego. **Acá va la mayor parte de las pruebas.** | pytest / Vitest |
| Contratos | Las respuestas de la API cumplen `openapi.yaml`; las muestras cumplen `esquema.md`; la app entiende las respuestas del mock. Si alguien cambia un contrato, se rompe una prueba y no la demo. | pytest + validación del OpenAPI / Vitest |
| Fuentes externas | **Nunca se llama a FIRMS, Meteomatics, Copernicus, NVIDIA, Google News ni Telegram en una prueba.** Se usan respuestas grabadas. Se prueban también las fallas: tiempo agotado, 429, 5xx, respuesta vacía → la parte se muestra "no disponible" y el resto sigue (RNF-14). | `httpx.MockTransport`, `respx` / `vi.fn` sobre `fetch` |
| Interfaz | Lo que el usuario ve y hace: textos, roles accesibles, clics, estados de carga, error y vacío. El aviso de emergencias siempre visible. | Testing Library |
| Visual y mapa | Lo que jsdom no puede dibujar (WebGL, animaciones, relieve) se revisa en el navegador y se anota en el PR. | Navegador |
| Punta a punta | Un solo recorrido en producción: área → calendario → CSV (F2-A2). | CI con `curl` o la colección de Postman |

## 4. Qué NO se hace (YAGNI)

Hackathon de 48 horas: cada línea que no sirve a un requisito es tiempo que no va a la demo.

**En el código**

- Solo lo que pide el issue y su requisito. Si hace falta algo más, se propone en el tablero, no se hace "por las dudas".
- Nada de opciones de configuración, parámetros o capas de abstracción sin alguien que las use hoy.
- Tres líneas parecidas son mejores que una abstracción prematura. Se generaliza cuando aparece el tercer uso real.
- Sin dependencias nuevas si lo que ya está elegido en `PLAN.md` §1.1 o la biblioteca estándar alcanza.
- El código muerto, comentado o "para después" se borra. Lo que queda para después va a la hoja de ruta de `PLAN.md`.

**En las pruebas**

- Sin meta de porcentaje de cobertura: se cubre lo que pide el issue y los casos borde de la lógica.
- Sin probar bibliotecas ajenas (MapLibre, Polars, FastAPI): se prueba nuestro uso de ellas.
- Sin *snapshots* de HTML o SVG grandes: se rompen con cualquier cambio y nadie los revisa.
- Sin *mocks* de nuestros propios módulos cuando el real es rápido: se mockea solo la red y el reloj.
- Sin herramientas nuevas de pruebas (navegador automatizado, carga, mutación) hasta que una tarea las necesite.
- Sin pruebas de código que todavía no existe ni de fases futuras.

## 5. Comandos

```bash
pnpm check --filter @charmy/<paquete>        # tipos, pruebas y compilación de un paquete JS
pnpm --filter @charmy/<paquete> test -- --watch
uv run --package <servicio> pytest           # pruebas de un servicio Python
uv run --package <servicio> pytest -k calendario -x
uv run ruff check services/<carpeta>
pnpm check && uv run pytest services         # todo, antes de un PR que toca varias carpetas
pnpm install                                 # activa el hook pre-commit (git config core.hooksPath .githooks)
```

## 6. Revisión de un PR

Quien revisa (o el agente antes de abrir el PR) mira, en este orden:

1. ¿Cada punto de "Pruebas mínimas" del issue tiene su prueba o su verificación anotada?
2. ¿Alguna prueba llama a la red? Si sí, se cambia por una respuesta grabada.
3. ¿Hay algo que el issue no pide? Si sí, se saca del PR.
4. ¿El CI está en verde y el PR apunta a `main`?
