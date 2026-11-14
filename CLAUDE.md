@AGENTS.md

# Charmy: reglas del proyecto para los agentes

Charmy armoniza los focos de calor de MODIS y VIIRS y los muestra como calendario de quema sobre un mapa 2D y 3D.
`AGENTS.md`, cargado arriba, tiene las reglas del tablero, del flujo de trabajo y de seguridad. Este archivo suma las
reglas propias del proyecto.

Este archivo no copia tablas: apunta a ellas. Qué se construye está en `REQUISITOS.md`; cómo, quién y cuándo, en
`PLAN.md`. Si algo de acá no coincide con esos documentos, valen ellos y se avisa en el tablero.

## Al empezar cada sesión

1. Ejecuta `tools/board whoami` para saber de qué persona eres el agente.
2. Lee en `PLAN.md` la **fase activa** y las tareas de esa fase cuyo dueño es tu persona.
3. Trabaja solo en esas tareas. No adelantes tareas de otra fase ni tomes las de otro carril.
4. Las tareas con la etiqueta `reserva` no tienen dueño: no las tomes, las asigna el líder en el tablero.

## Carriles

- Toca solo las carpetas de tu carril. Están en `PLAN.md` ("Equipo y carriles") y en `AGENTS.md` §6.
- Para tocar una carpeta ajena, pide el traspaso en el tablero mencionando al dueño y espera su respuesta.
- Las rutas protegidas (`.claude/`, `tools/`, `.github/`, `AGENTS.md`, `PLAN.md`, `REQUISITOS.md` y este archivo)
  solo cambian por un PR que revisa el líder.
- Cada carpeta de producto puede tener su propio `CLAUDE.md` con sus comandos. Esos los mantiene el dueño de la carpeta.

## Trazabilidad

- Cada tarea tiene un ID (`F2-B1`) y un issue cuyo título empieza con ese ID.
- La rama es `<issue>-<slug>`. El PR nombra el ID de la tarea y sus requisitos (`RF-ARM-01`) y cierra el issue con `Closes #N`.
- El estado del día a día va en el issue, no en `PLAN.md`.
- Si hace falta algo que no tiene tarea, no lo hagas por tu cuenta: propón el PR que lo agrega a `REQUISITOS.md` y a `PLAN.md`.

## Tecnologías

- Vale la tabla de referencia de `PLAN.md` (§1.1) y las decisiones de la §3.
- No cambies una tecnología ni agregues una dependencia que reemplace a otra sin el PR que actualiza esa tabla.

## Contratos

- Se trabaja contra los contratos de `PLAN.md` §4: el OpenAPI, el esquema de datos, el componente
  `<Charmy mood outfit size say />` y los tokens de diseño.
- Mientras lo real no está, usa el mock de la API y las muestras de `data/muestras/`. Tienen la misma forma que lo real.
- Un contrato lo cambia solo su dueño. Todo cambio se anuncia en el tablero al hacer merge, mencionando a quienes lo consumen.

## Datos y fuentes

- La unidad armonizada y los filtros de entrada son los de las decisiones D-02, D-03 y D-04. No inventes otra métrica.
- Los focos en vivo salen solo de NOAA-20 y NOAA-21. S-NPP no publica datos nuevos desde el 2/11/2026.
- FIRMS, Meteomatics y Copernicus se consultan **solo desde el servidor**, con caché y dentro de sus límites
  (`PLAN.md` §1.1). El navegador nunca llama a esos servicios ni ve sus credenciales.
- De un sitio sin API ni licencia visible no se leen datos de forma automática: solo se lo cita y se lo enlaza.
- Las muestras y los valores provisorios van marcados como tales. Un número de ejemplo nunca se presenta como resultado.
- El repo solo guarda muestras chicas. Los datos completos se publican fuera del repo.

## Secretos

- El repo es **público**: todo lo que entra en un commit, un issue o el tablero lo ve cualquiera.
- Las claves van en `.env` local, que está ignorado, y en la plataforma de despliegue. Nunca en el código, en los
  registros, en los issues ni en el tablero.
- Una variable nueva se agrega a `.env.example` con su nombre y sin valor.
- Las credenciales se pasan entre personas por un canal privado, nunca por GitHub.

## Producto

- La interfaz y los textos van en español.
- Charmy habla corto, en segunda persona y sin alarmismo.
- Todo aviso aclara que Charmy no reemplaza a los servicios de emergencia e indica a qué número llamar.
- La IA no decide sola un veredicto: etiqueta señales, y el veredicto sale de varias señales (D-09).
- Si una fuente externa falla, esa parte se muestra como no disponible y el resto sigue funcionando.
- Colores y tipografías salen de `packages/ui`. Las rampas de color son aptas para daltonismo.
- Charmy se usa siempre por su componente. No se redibuja ni se copia su SVG en otra carpeta.

## Pruebas y YAGNI (obligatorio, detalle en `docs/PRUEBAS.md`)

- **Terminado = probado.** Cada issue tiene una sección "Pruebas mínimas". Cada punto necesita una prueba
  automática que pasa, o una verificación manual anotada en el PR si no se puede automatizar. Sin eso no hay PR.
- **Primero la prueba** en toda lógica (datos, cálculos, filtros, endpoints, mensajes): escríbela, mírala fallar,
  después escribe el código. Un error encontrado es primero una prueba que lo reproduce.
- **Nunca se llama a un servicio externo en una prueba** (FIRMS, Meteomatics, Copernicus, NVIDIA, Google News,
  Telegram). Se usan respuestas grabadas y se prueban también las fallas: tiempo agotado, 429, 5xx.
- **Pruebas deterministas**: fechas fijas, UTC, sin depender del orden ni de la red.
- **YAGNI**: solo lo que pide el issue. Nada de opciones, abstracciones o dependencias sin un uso real hoy.
  Lo que sobra se propone en el tablero o va a la hoja de ruta, no al código.
- **No se fusiona con el CI en rojo.** No se dice "terminado" sin haber corrido las pruebas y leído el resultado.

## Calidad

- Antes de abrir el PR, corre `pnpm check --filter <paquete>` o `uv run --package <servicio> pytest`.
- **Todo PR apunta a `main`.** Nunca se apila un PR sobre otra rama: al fusionarse no llega a `main`.
- Después de fusionar, comprueba que el cambio está en `main`.
- Commits chicos. Nada de `git add -A` ni de force-push.
- Después del congelamiento de la fase 3 solo entran correcciones.

## Documentos vivos

- Si tu cambio altera una tecnología, un requisito o una regla, actualiza `PLAN.md`, `REQUISITOS.md` o este archivo en el mismo PR.
- Si el código ya no coincide con los documentos, no sigas como si nada: avisa en el tablero.

## Comandos

Requisitos: Node 22 o más (`.nvmrc`), pnpm (versión en `package.json`), uv y Docker.

```bash
pnpm install                     # dependencias de JavaScript de todo el monorepo
uv sync                          # dependencias de Python de todos los servicios (un solo uv.lock)
pnpm dev --filter <paquete>      # levantar un paquete, p. ej. --filter @charmy/app
pnpm check --filter <paquete>    # tipos, pruebas y compilación de un paquete y lo que usa
pnpm check                       # lo mismo para todo el monorepo
uv run --package <servicio> pytest   # pruebas de un servicio de Python
uv run ruff check services/<carpeta> # lint de Python
docker compose up                # base de datos local
docker compose --profile todo up # base, API, worker y avisos (cuando existan sus Dockerfile)
```

Cómo se suma una pieza nueva:

- **JavaScript**: una carpeta bajo `apps/` o `packages/` con su `package.json` entra sola. El nombre es `@charmy/<carpeta>`
  y los scripts usan los nombres `dev`, `build`, `lint`, `typecheck` y `test`, para que Turborepo los encuentre.
  Las versiones compartidas (TypeScript 5.9) están en la raíz; el `tsconfig.json` extiende `../../tsconfig.base.json`.
- **Python**: una carpeta bajo `services/` con su `pyproject.toml` entra sola al workspace de uv (Python 3.12).
  Para que Turborepo también la corra, se le puede agregar un `package.json` mínimo cuyos scripts llamen a `uv run`.
- Un paquete del monorepo se usa desde otro con `"@charmy/<nombre>": "workspace:*"`.
- Las dependencias se agregan en el paquete que las usa (`pnpm add <dep> --filter @charmy/<paquete>` o
  `uv add <dep> --package <servicio>`), nunca en la raíz.
