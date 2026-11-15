# Plan por fases — Charmy

> **Qué es este documento.** Dice *cómo*, *quién* y *cuándo* se construye Charmy hasta el MVP.
> El *qué* está en [`REQUISITOS.md`](REQUISITOS.md): cada tarea de este plan apunta a sus IDs.
> Los agentes lo leen al empezar cada sesión y trabajan **solo en la fase activa** (reglas en `AGENTS.md`).
>
> **Documento vivo.** La [tabla de referencia](#1-tabla-de-referencia) refleja lo que se usa *hoy*.
> Si alguien cambia una tecnología, una skill o un componente, se actualiza la tabla y las tareas afectadas
> en el mismo PR (ver [Cómo mantener este plan](#2-cómo-mantener-este-plan)).

**Fase activa:** 4
**Líder:** `@cosmosnehu77`. Hasta que vuelva (probablemente en la fase 4), **líder interino `@daniace`** (D-28).
**Versión:** 2.2 · **Última actualización:** 14 de noviembre de 2026

## Objetivo del proyecto

Una web que armoniza los focos de calor de MODIS y VIIRS en una serie continua desde 2001 y la muestra como
calendario de actividad de quema sobre un mapa 2D y 3D, con anomalías contra la mediana histórica y descarga en CSV.
Charmy, una vizcacha de fuego, guía al público; el modo experto sirve a brigadas e investigadores.

"Terminado" es el [criterio de MVP](REQUISITOS.md#criterio-de-mvp) de `REQUISITOS.md`, entregado en la plataforma de
Space Apps antes del cierre del domingo 15 de noviembre de 2026.

## Equipo y carriles

Cada persona tiene un **carril**: un conjunto de carpetas que solo ella y su agente tocan.
Trabajan **cinco personas con agente**. `@dimidio6` se sumó en la fase 2 y tomó el carril E salvo el componente Charmy
(decisión D-25).

**Líder interino (D-28).** `@cosmosnehu77` se queda sin uso y vuelve probablemente en la fase 4. Mientras
tanto `@daniace` hace todo lo que este plan y `AGENTS.md` le dan al líder: abre y cierra fases, revisa y fusiona los PR
de rutas protegidas, reasigna trabajo y toma las decisiones pendientes. Las tareas de la fase 3 del carril A (servicio
de avisos) pasan a `@dimidio6` con la carpeta `services/alertas/`.

| Carril | Persona | Qué hace | Carpetas propias |
|---|---|---|---|
| **A · Plataforma y avisos** | `@cosmosnehu77` (líder; interino `@daniace`, D-28) | Repo, CI, despliegue, integración. El servicio de avisos de la fase 3 pasa a `@dimidio6` con `services/alertas/` (D-28). | archivos de raíz, `.github/workflows/`, `infra/`, `README.md` |
| **B · Datos** | `@leonelcnr` | Armonización, calendario, validación, fuentes fijas, tiempo e imagen satelital en el foco, predicción con LightGBM hasta que pase a `@dimidio6` (D-31). | `services/pipeline/`, `services/contexto/`, `data/muestras/`, `packages/contracts/datos/`, `docs/metodologia/` |
| **C · Backend** | `@BrunoAguinaga0` | Contrato de la API, API, focos en vivo, verificación, reportes. | `services/api/`, `services/worker/`, `packages/contracts/api/` |
| **D · App** | `@daniace` | Mapa, calendario, modos novato y experto, tokens de diseño. | `apps/app/`, `packages/ui/` |
| **E · Experiencia** | `@dimidio6`, salvo el componente (tabla de abajo) | Componente Charmy, landing, juego. En la fase 3, el servicio de avisos (D-28) y la predicción (D-31). | `packages/charmy/`, `apps/landing/`, `apps/juego/`, `services/alertas/`, `services/prediccion/` |
| **F · Contenido** | persona sin agente | Arte, textos, guion, video, reglas del evento, contacto con entidades. | `docs/entrega/`, `docs/contenido/` |

**Cómo se reparte el carril E** (decisiones D-22 y D-25):

| Parte | Carpeta | Quién | Tareas |
|---|---|---|---|
| Componente Charmy | `packages/charmy/` | `@cosmosnehu77` | F0-E1, F1-E1, F1-E3, F2-E1 |
| Landing | `apps/landing/` | `@dimidio6` (el esqueleto, F1-E2, lo hizo `@BrunoAguinaga0`) | F2-E2, F4-E1, F5-E1 |
| Juego y Charmy completo | `apps/juego/`, y `packages/charmy/` desde la fase 3 | `@dimidio6` | F1-E4, F3-E1, F3-E2, F4-E2, F5-E2 |
| Predicción (D-31) | `services/prediccion/` | `@dimidio6` | F3-E3 |

Tareas abiertas de las fases 1 a 4 al sumarse `@dimidio6`: `@leonelcnr` 7, `@daniace` 7, `@BrunoAguinaga0` 6,
`@dimidio6` 6 y `@cosmosnehu77` 5, que además cierra fases, revisa las rutas protegidas y recorre la integración
cada 6 horas. `@BrunoAguinaga0` queda solo con el backend, que en las fases 2 y 3 es camino crítico.

### Reserva

Las tareas en **reserva** tienen su issue con la etiqueta `reserva` y sin persona asignada. Ninguna es parte del
[criterio de MVP](REQUISITOS.md#criterio-de-mvp) ni bloquea a otra tarea.

- **Hoy no hay tareas en reserva:** las tenía `@dimidio6` y se le asignaron al sumarse (D-25).
- Si una persona deja de participar, el líder pasa sus tareas a la reserva y las ofrece en el tablero.
  Nadie la toma por su cuenta. Lo que quede sin dueño pasa a la hoja de ruta: el juego se muestra como prototipo y
  Charmy queda con sus tres estados animados.

Si nadie toma el carril F, se reparte: los textos de la landing a `@BrunoAguinaga0`, las frases y el arte de Charmy a
`@cosmosnehu77`, y el guion, el video y el envío a `@cosmosnehu77` con `@daniace`.

---

## 1. Tabla de referencia

Lo que se usa hoy. La columna **Dec.** apunta a la decisión que lo justifica ([sección 3](#3-decisiones)).

### 1.1 Tecnologías

| Área | Elección actual | Carril | Aclaraciones y alternativa | Dec. |
|---|---|---|---|---|
| Coordinación | `tabla-agentes`: tablero en un issue fijado, `tools/board`, hooks de Claude Code | todos | Rutas protegidas: `.claude/`, `tools/`, `.github/`, `AGENTS.md`, `PLAN.md`, `CLAUDE.md`. Sumar `REQUISITOS.md` a `CODEOWNERS`. | D-12 |
| Monorepo JS | pnpm workspaces + Turborepo | A | Los globs `apps/*` y `packages/*` suman solas las carpetas nuevas. | D-12 |
| Monorepo Python | uv workspace, un solo lockfile | A | La integración Turborepo↔uv es experimental. Plan B: correr con `uv run` directo. | D-12 |
| CI | GitHub Actions: un flujo `CI` que corre solo lo que cambió y un chequeo final `CI ok` | A | Cada carril solo dispara sus propios chequeos. `CI ok` es el chequeo obligatorio de `main`. | D-23 |
| Pruebas | Vitest y Testing Library (JS); pytest y ruff (Python); respuestas grabadas para las fuentes externas | todos | Reglas en `docs/PRUEBAS.md`. Sin meta de cobertura ni navegador automatizado hasta que una tarea lo pida (YAGNI). Lo visual se revisa en el navegador. | D-23 |
| Despliegue de frontends | Cloudflare Pages (landing, app y juego, los tres estáticos) | A | Alternativa: GitHub Pages. Azure queda como opción posterior al MVP ([fase 5](#fase-5--opción-azure-opcional-después-del-mvp)). | D-05, D-21 |
| Despliegue de servicios | Un contenedor Docker por servicio en Render, Fly o un VPS. Los avisos corren como tarea programada de GitHub Actions, cada 5 minutos | A | Los planes gratuitos se suspenden: despertar antes de la demo. Azure los dejaría siempre encendidos (fase 5). | D-05, D-21, D-30 |
| Datos estáticos | Parquet publicados como **versión (release) de GitHub** con un `manifest.json`, con `infra/publicar` | A, B | Sin cuenta extra. GitHub responde por rangos y DuckDB lee los Parquet directo por HTTPS (probado el 14/11). Las versiones no se pisan. El repo solo guarda muestras chicas (`data/muestras/`). Alternativa: Cloudflare R2. | D-05 |
| Entorno local | Docker Compose | A | `docker compose up` levanta api, worker, alertas y base. | — |
| Datos históricos | Archivo de FIRMS, productos estándar: `MODIS_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_SP`, `VIIRS_NOAA21_SP` | B | Disponibilidad verificada el 14/11 con la clave del equipo: MODIS 2000-11 a 2026-08; S-NPP 2012-01 a 2026-07; NOAA-20 2018-04 a 2026-07; NOAA-21 2023-03 a 2026-07. Lo posterior sale de los productos NRT. FIRMS también expone área quemada (`BA_MODIS`, `BA_VIIRS`), opcional para validar. | D-03 |
| Proceso de datos | Python con Polars, DuckDB y GeoPandas | B | Grilla regular de 0,1°. | D-02 |
| Tiempo y riesgo de incendio | API de Meteomatics, desde `services/contexto` | B | Parámetros probados el 14/11 con la cuenta del equipo: `wind_speed_10m:ms`, `wind_dir_10m:d`, `t_2m:C`, `relative_humidity_2m:p`, `forest_fire_warning:idx` y `fosberg_fire_weather_index:idx`. Un pedido admite varios parámetros, varias horas y un área. **Límites: 1.000 pedidos por día**, 250 por minuto y 10 en paralelo, así que la caché es obligatoria (por celda de 0,1° y por media hora). Tiene histórico desde 1900. **La cuenta vence el 22/11/2026.** Credenciales en `METEOMATICS_USER` y `METEOMATICS_PASSWORD`, solo en el servidor. | D-18 |
| Imagen satelital | Sentinel-2 L2A de Copernicus Data Space por API, desde `services/contexto`: Catalog API para encontrar la escena reciente más despejada y Process API para generar la imagen | B | Entrada con un cliente OAuth (`client_credentials`) creado en el Dashboard de Copernicus; el token se pide a `identity.dataspace.copernicus.eu` y las APIs están en `sh.dataspace.copernicus.eu`. Solo desde el servidor. Cuenta gratuita: 10.000 unidades de proceso y 50.000 pedidos por mes, 300 por minuto. Cada imagen generada se guarda en caché para no gastar cuota dos veces. Dos estilos: color real y falso color, que resalta lo quemado. Las rutas exactas de Catalog y Process se confirman al crear el cliente. | D-19 |
| Estadísticas de referencia | currentwildfires.com | B | Sin API ni licencia visible: solo comparación manual, cita y enlace. No se copian datos. Usa FIRMS, EFFIS, GWIS y filtra antorchas e industria, igual que Charmy. | D-20 |
| Modelo de predicción | LightGBM (vigente); candidato: TimesFM 2.5 | E (D-31) | Solo si supera a la climatología. LightGBM sigue publicado hasta que TimesFM 2.5 (Apache-2.0) lo supere en la compuerta con los mismos años de prueba. TimesFM 3.0 no: sus pesos son de uso no comercial y no productivo, y la app es pública. Alternativa: Prophet por región. | D-10, D-31 |
| API | FastAPI + DuckDB sobre Parquet + httpx | C | OpenAPI automático. | D-05 |
| Base operativa | Postgres (Supabase) para reportes y estados | C | Alternativa: SQLite. El login de Supabase solo hace falta si entra RF-ALE-05. | D-08 |
| Focos en vivo | API de área de FIRMS, fuentes `VIIRS_NOAA20_NRT` y `VIIRS_NOAA21_NRT` | C | S-NPP no publica datos nuevos desde el 2/11/2026. Límite: 5.000 transacciones cada 10 min, de 1 a 5 días por consulta. La clave del equipo ya existe y funciona: va en `FIRMS_MAP_KEY` del `.env` local y de la plataforma, nunca en el repo ni en el tablero. | D-13 |
| Otros satélites (deseable) | Sentinel-3 SLSTR FRP de Copernicus y `GOES_NRT` de FIRMS | C | Señal extra de verificación. Sin tarea en el MVP. La cobertura de GOES sobre la Patagonia está sin confirmar. | D-19 |
| Noticias | Google News RSS | C | Parámetros no oficiales, pueden cambiar. | D-09 |
| Modelo de lenguaje | NVIDIA NIM, API compatible con OpenAI | C | Créditos gratuitos de prototipo, límite a verificar al crear la clave. Alternativa: Claude API. | D-09 |
| Localidades | API Georef de datos.gob.ar | C, D | Para pasar coordenadas a localidad y al revés. | — |
| Contrato de API | OpenAPI 3.1 + mock y colección de Postman | C | Borrador en `docs/repo-inicial/openapi.yaml`. Alternativa de mock: Prism. | D-12 |
| App | Vite + React + TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Zustand | D | — | — |
| Mapa | MapLibre GL JS v5 o superior | D | Un solo motor para 2D y 3D. deck.gl solo si hacen falta hexágonos: sus capas no se apoyan sobre el relieve. | D-06 |
| Relieve y mapa base | Teselas de terreno Terrarium y un estilo vectorial sin clave | D | Se prueba en F0-D1. Candidatos de estilo: OpenFreeMap o Protomaps. | D-06 |
| Dibujo de área | Terra Draw + Turf.js | D | Más el ingreso manual de latitud y longitud. | — |
| Gráficos | Observable Plot | D | Alternativa: ECharts, que trae calendario nativo. | — |
| Rampas de color | YlOrRd para conteos, PuOr o BrBG para anomalías | D | Aptas para daltonismo. | — |
| Landing | Astro + GSAP (ScrollTrigger) | E | Alternativa: Motion. | — |
| Mascota | SVG por capas a partir de `docs/charmy-base/`, animado con Motion o CSS | E | Rive queda como mejora opcional si alguien lo domina. | D-07 |
| Juego | Phaser 4, pixel art 2D | E | Sprites con Pixelorama o LibreSprite, sonidos con jsfxr, mapa con Tiled. | D-11 |
| Mensajería | Bot de Telegram (aiogram) | A | Alternativa: correo. | D-08 |
| Alerta estándar | OASIS CAP 1.2, un feed XML por zona | A | — | D-08 |
| Tipografías y paleta | Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono y la paleta de `docs/charmy-base/Paleta.dc.html` | D, E | Viven como tokens en `packages/ui`. | D-07 |

### 1.2 Skills de los agentes

| Skill | Dónde vive | Quién la usa | Para qué | Aclaraciones |
|---|---|---|---|---|
| `firms-data` | `.claude/skills/firms-data/` (a crear, F1-B3) | todos | Fuentes válidas de FIRMS, campos, límites y filtros de armonización. También Meteomatics y Copernicus: parámetros, cuotas y condiciones de uso de cada fuente. | Evita que cada agente lo vuelva a investigar. |
| `contratos` | `.claude/skills/contratos/` (a crear, F1-C3) | todos | Dónde está el OpenAPI, cómo usar el mock, cómo regenerar tipos, cómo anunciar un cambio. | — |
| `charmy` | `.claude/skills/charmy/` (a crear, F1-E3) | C, D, E | Uso del componente, estados, vestuarios y tono de voz. | — |
| `vite-shadcn-tailwind4` | máquina de cada persona | D, E | Montar shadcn y Tailwind v4 en Vite. | Hoy está instalada solo en la máquina del líder: copiarla al repo o instalarla. |
| `dataviz` | incluida en Claude Code | B, D | Calendario, rampas y gráficos legibles y accesibles. | — |
| `api-engineer` (Postman) | `~/postman/skills/` | A, C | Contrato, mock y pruebas de la API. | Requiere Postman CLI. Hoy está solo en la máquina del líder. |
| `code-review` | incluida | todos | Revisar el diff antes de abrir el PR. | Nivel bajo o medio: es un hackathon. |
| `security-review` | incluida | A | Buscar secretos antes de hacer público el repo (F4-A1). | — |
| `run` | incluida | todos | Levantar la app y comprobar el cambio en vivo. | — |
| `relevo` | `.claude/skills/relevo/` | todos | Dejar, tomar y devolver una tarea cuando una persona se queda sin uso de tokens (D-24). | La parte mecánica la hace `tools/relevo`. |
| `fewer-permission-prompts` | incluida | todos | Menos pedidos de permiso durante el evento. | Toca `.claude/settings.json`, ruta protegida: un solo PR del líder. |

Las skills de `.claude/skills/` son rutas protegidas: cada dueño abre su PR y el líder lo revisa.

### 1.3 Componentes

| Componente | Carpeta | Dueño | Lo consumen | Contrato |
|---|---|---|---|---|
| Landing | `apps/landing/` | `@dimidio6` | público | — |
| App | `apps/app/` | `@daniace` | público | Consume la API y `packages/charmy` |
| Juego | `apps/juego/` | `@dimidio6` | público | Consume `data/muestras/dia-juego.json` |
| Componente Charmy | `packages/charmy/` | `@dimidio6` desde la fase 3 (hasta la 2, `@cosmosnehu77`) | app, landing, juego | `packages/charmy/README.md`: `<Charmy mood outfit size say />` |
| Tokens de diseño | `packages/ui/` | `@daniace` | app, landing, juego | `packages/ui/tokens.css` |
| Contrato de API | `packages/contracts/api/` | `@BrunoAguinaga0` | A, D, E | `openapi.yaml` + mock |
| Esquema de datos | `packages/contracts/datos/` | `@leonelcnr` | C, D, E | `esquema.md` (columnas de Parquet y GeoJSON) |
| Pipeline | `services/pipeline/` | `@leonelcnr` | — | Escribe Parquet según el esquema |
| Muestras | `data/muestras/` | `@leonelcnr` | C, D, E | Mismo esquema que los datos reales |
| API | `services/api/` | `@BrunoAguinaga0` | app, alertas, juego | Implementa el OpenAPI |
| Worker en vivo | `services/worker/` | `@BrunoAguinaga0` | API | — |
| Contexto del foco | `services/contexto/` | `@leonelcnr` | API | Paquete de Python que expone los routers de `/weather` (Meteomatics) y `/imagery` (Copernicus). La API lo monta con una línea: no es un servicio aparte que desplegar. |
| Avisos | `services/alertas/` | `@dimidio6` (D-28) | entidades | Usa solo la API pública y un token de servicio |
| Predicción | `services/prediccion/` | `@dimidio6` (D-31) | API (`/forecast`) | Entrena con la tabla celda×mes del carril B y escribe `prediccion.parquet` según el esquema, solo si pasa la compuerta D-10 |
| Infraestructura | `infra/`, `.github/workflows/`, raíz | `@cosmosnehu77` | todos | `.env.example` |
| Base de Charmy | `docs/charmy-base/` | carril F y `@cosmosnehu77` | E | Fuente del diseño aprobado |

---

## 2. Cómo mantener este plan

**Si cambia una tecnología, una skill o un componente** (por ejemplo, "preferimos ECharts"):

1. Cambiar la fila en la [tabla de referencia](#1-tabla-de-referencia). La elección anterior pasa a la columna de alternativa.
2. Cambiar o agregar la decisión en la [sección 3](#3-decisiones).
3. Ajustar las tareas afectadas en la [sección 5](#5-fases) y, si corresponde, la skill que la documenta. Si cambia una regla de trabajo, actualizar también `CLAUDE.md`.
4. Agregar una línea al [registro de cambios](#9-registro-de-cambios).
5. Al hacer merge, anunciar en el tablero: `[Agente de Nombre] @all cambio en PLAN.md: <qué>, afecta a <carriles>`.

**Si cambia un requisito:** primero se cambia `REQUISITOS.md` y, en el mismo PR, las tareas y la
[cobertura](#6-cobertura-de-requisitos) de este plan.

**Quién:** cualquier persona propone el PR. Como `PLAN.md` es ruta protegida, lo aprueba el líder.

**Para los agentes:** si el código ya no coincide con la tabla, no cambien la tecnología por su cuenta ni sigan como
si nada: avisen en el tablero y propongan el PR que actualiza este documento.

**El estado del día a día vive en los issues**, no acá (decisión D-15). La columna "Estado" se sincroniza al cerrar cada fase.

---

## 3. Decisiones

| ID | Decisión | Motivo | Requisitos |
|---|---|---|---|
| D-01 | El calendario armonizado va primero. Mascota, juego y avisos son diferenciales con tiempo acotado. | Es lo que pide el enunciado y lo que evalúa "Relevancia". | RF-ARM, RF-CAL |
| D-02 | Unidad armonizada: **días-celda con fuego** en una grilla de 0,1°, expresados como "equivalente VIIRS". | Atenúa la diferencia de resolución y evita contar dos veces cuando pasan varios satélites. El conteo crudo queda para el modo experto. | RF-ARM-01 |
| D-03 | Calibración **en cadena**: MODIS → VIIRS S-NPP (solape 2012–2026) y NOAA-20 → S-NPP (solape 2018–2026), por región y mes, validada dejando un año afuera. | S-NPP dejó de publicar datos nuevos; la serie tiene que continuar con NOAA-20 y NOAA-21. | RF-ARM-02, RF-ARM-04 |
| D-04 | Filtros de entrada: solo focos de vegetación (`type = 0`), MODIS con confianza ≥ 30 y VIIRS nominal o alta. | Reduce falsos positivos antes de calibrar. | RF-ARM-01 |
| D-05 | La historia se **precalcula** y se publica como archivos estáticos. La API atiende lo vivo. | La demo no depende de la red ni de un servidor despierto. | RNF-02 |
| D-06 | Un solo motor de mapa con dos perfiles: 3D con relieve y 2D liviano. | Un solo código que mantener. Es lo que ya gustó del prototipo anterior. | RF-MAP-06 |
| D-07 | Charmy parte del diseño **"Charmy · Variantes"**: SVG por capas, 6 estados, 5 vestuarios y su paleta. Se anima con Motion o CSS. | El equipo aprobó ese diseño. Cualquiera lo puede mantener con su agente. | RF-CHA |
| D-08 | Avisos **híbridos**: el público reporta sin cuenta; las entidades reciben Telegram y un feed CAP por zona. En el MVP hay una entidad de demostración con zona precargada; la bandeja web con cuenta queda para después. | Menos fricción y nada de login que construir en 48 horas. | RF-ALE |
| D-09 | Verificación con **varias señales** (satélite, fuente fija, noticias, reportes). El modelo de lenguaje solo etiqueta noticias. | Que no haya noticias no vuelve falso un foco. Cerca de Comodoro, el falso positivo típico son las antorchas de gas. | RF-VIV |
| D-10 | La predicción tiene **compuerta**: solo se muestra si supera a la climatología en una prueba con años no vistos. | Evita mostrar un modelo que no aporta. | RF-PRE |
| D-11 | El juego es 2D en pixel art. El 3D voxel queda fuera. | Alcance de 48 horas. | RF-KID |
| D-12 | **Contratos antes que código.** Cada carril publica en la fase 1 su contrato con un mock o una muestra, y los demás trabajan contra eso. | Permite que varios agentes avancen en paralelo sin esperarse. | RNF-09 |
| D-13 | Solo el worker consulta FIRMS, cada 30 minutos y con caché. El navegador nunca lo hace. | Respeta el límite de la API y protege la clave. | RNF-06 |
| D-14 | El público no tiene cuentas. | Fricción y datos personales innecesarios. | RF-ALE-07 |
| D-15 | El estado diario de las tareas vive en los issues. `PLAN.md` se edita solo cuando cambia el alcance. | `PLAN.md` es ruta protegida: si cada tarea lo tocara, todos los PR pasarían por el líder y habría conflictos. | RNF-09 |
| D-16 | El servicio de avisos es del carril A y entra recién en la fase 3. | El trabajo de plataforma se concentra en las fases 0 y 1; así el carril C no carga con vivo, verificación y avisos a la vez. | RF-ALE |
| D-17 | El MVP cubre Argentina y Chile. | Tamaño de datos manejable y relevancia local. El método no depende de la región. | RF-MAP-08 |
| D-18 | Se usa **Meteomatics** para el tiempo y el riesgo de incendio en el lugar de un foco. Lo implementa el carril B como paquete (`services/contexto`) que la API monta. La versión mínima es el viento dentro del aviso de Telegram. | El evento lo ofrece gratis y agrega contexto útil para quien responde. Va al carril B para no cargar más al backend, y como paquete para no sumar otro servicio que desplegar. | RF-CTX-01, RF-CTX-02 |
| D-19 | Se usa **Copernicus Data Space por API** para mostrar una imagen Sentinel-2 reciente del lugar del foco. La pide el servidor (paquete `services/contexto`, carril B) con las APIs Catalog y Process, la guarda en caché y la app la muestra como capa. Sirve para inspección visual, no como veredicto automático. Otros satélites de fuego quedan como deseables. | El equipo eligió consumirlo por API. Así las credenciales no salen del servidor, la cuota se controla en un solo lugar y la misma vía sirve después para el antes y después. | RF-CTX-03, RF-CTX-05 |
| D-20 | **currentwildfires.com** se usa solo como referencia: comparación manual documentada, con cita y enlace. | No ofrece API ni licencia visible, así que no corresponde copiar ni automatizar la lectura de sus datos. | RF-CTX-06, RNF-13 |
| D-21 | **Azure no entra en el MVP.** Queda como fase 5 opcional, que se abre solo después de entregar y si hay tiempo. | El equipo lo usó poco y configurarlo lleva más tiempo que el despliegue actual. No conviene arriesgar la entrega. | RNF-02, RNF-10 |
| D-22 | El equipo activo es de **cuatro personas con agente**. El carril E se reparte: el componente Charmy lo hace el líder, la landing el carril C, y el juego y el Charmy completo quedan en **reserva** para `@dimidio6` o para quien el líder designe. | `@dimidio6` todavía no participa. La reserva junta lo que no es parte del criterio de MVP y no bloquea a nadie: si no se suma, la entrega no se frena. | RNF-09, RF-KID, RF-CHA |
| D-23 | **Pruebas antes que "terminado" y YAGNI.** Cada issue lleva sus "Pruebas mínimas"; la lógica se escribe con la prueba primero; las fuentes externas se prueban con respuestas grabadas, también cuando fallan; `CI ok` es obligatorio para fusionar. No se construye nada que el issue no pida. | Con cuatro agentes en paralelo, lo que no está probado se rompe en la integración, justo antes de la demo. Y en 48 horas, todo lo que sobra le quita tiempo a lo que se evalúa. | RNF-15, RNF-14, RNF-09 |
| D-24 | **Relevo y lockfiles sin bloqueo.** Al ~90 % de uso de tokens, el agente deja la tarea con `tools/relevo dejar` y otra persona la sigue por un rato, solo en las carpetas de esa tarea, hasta que el dueño vuelve (`AGENTS.md` §7). Los PR abiertos que chocan solo en `uv.lock` o `pnpm-lock.yaml` los pone al día el flujo `al-dia.yml`. | Con un límite de uso por persona y cuatro personas en paralelo, una tarea parada frena a quien depende de ella. Y cada PR que suma un paquete choca en el lockfile con los demás: es mecánico, no tiene por qué esperar a nadie. | RNF-09, RNF-15 |
| D-25 | `@dimidio6` se suma con agente y toma el carril E salvo el componente Charmy: el juego y el Charmy completo, que estaban en reserva, y la landing desde F2-E2. `@BrunoAguinaga0` queda solo con el backend. | Reparte la carga (6–7 tareas abiertas por persona en las fases 1 a 4) y libera al backend, que es camino crítico en las fases 2 y 3. Reemplaza el reparto de D-22. | RNF-09, RF-KID, RF-CHA, RF-LAN |
| D-26 | **Respaldo de Meteomatics.** Todo lo que se lee de Meteomatics se guarda también como copia de respaldo. Si la API falla, agota su cupo o la cuenta vence (22/11/2026), `/weather` responde con esa copia, con su fecha y marcada como copia; solo si no hay copia para el lugar la parte se muestra como no disponible (RNF-14). La copia queda del lado del servidor y no se publica en el repo ni en los releases públicos, salvo que las condiciones de Meteomatics lo permitan. | La cuenta del evento vence una semana después de la entrega y tiene 1.000 pedidos por día: la demo y lo que siga no pueden depender de que responda en vivo. | RF-CTX-01, RNF-13, RNF-14 |
| D-27 | **Cloudflare Pages al carril E.** La cuenta, los proyectos y el primer deploy web de landing, app y juego pasan del líder a `@dimidio6` (F2-E3, sale de F0-A3). Los secretos los carga el líder, porque solo el dueño del repo puede, con los valores que recibe por un canal privado. | Las tres piezas que se publican en Pages son del carril E o las consume; el líder queda con el host de la API y el bot. | RNF-01, RNF-06 |
| D-28 | **Líder interino.** `@cosmosnehu77` se queda sin uso de tokens y vuelve probablemente en la fase 4. `@daniace` es líder interino con todos los poderes del líder (fases, rutas protegidas como dueño de código, reasignaciones y decisiones). F3-A1 y F3-A2 y la carpeta `services/alertas/` pasan a `@dimidio6`, que tenía la menor carga de la fase 3; el bot de Telegram (parte de F0-A3) va con F3-A1. Lo que solo puede hacer el dueño del repo (secretos de Actions, permisos) espera a `@cosmosnehu77`. | Que la implementación no se detenga y la carga quede pareja. | RNF-09 |
| D-29 | **Las pruebas corren en cada commit y cada servicio tiene las suyas.** Un hook `pre-commit` versionado (`.githooks/`, se activa con `pnpm install`) corre las pruebas de los paquetes JS y de los servicios de Python que toca el commit, y rechaza un servicio sin pruebas. El CI falla si un servicio que cambió en el PR no tiene pruebas. Los despliegues (`deploy-api`, `deploy-web`) esperan a que `CI ok` del mismo commit esté en verde: nunca se publica un commit en rojo. Saltear el hook con `--no-verify` no está permitido. | `CI ok` corría `pytest` sobre todos los servicios juntos: `services/api` y `services/worker` cerraron tareas sin una sola prueba y el CI quedó en verde. | RNF-15 |
| D-30 | **Los avisos corren en GitHub Actions.** El servicio de avisos (`services/alertas`) corre una vez cada 5 minutos en `.github/workflows/avisos.yml`, igual que el worker de vivo: guarda los estados de los botones tocados desde la corrida anterior y manda los avisos nuevos. No guarda nada entre corridas: `POST /alerts` dice si un aviso ya se mandó. Los secretos (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CHARMY_SERVICE_TOKEN`) van en Actions. El costo: un botón cambia el estado en la corrida siguiente, no al instante. | Gratis en un repo público y sin otra cuenta. Un Background Worker de Render no tiene plan gratis, el Web Service gratis se duerme, y Cloudflare Containers pide un plan pago. | RF-ALE-02, RF-ALE-03 |
| D-31 | **La predicción pasa a `@dimidio6`.** El código pasa de `services/pipeline/` a `services/prediccion/` (F3-E3) y se prueba TimesFM 2.5 contra LightGBM. LightGBM sigue publicado hasta que TimesFM 2.5 lo supere en la compuerta D-10 con los mismos años de prueba; si no lo supera, queda LightGBM y TimesFM va a la hoja de ruta. TimesFM 3.0 no se usa: sus pesos son de uso no comercial y no productivo. El carril B publica la tabla de entrenamiento celda×mes (F3-B5). El contrato `prediccion` pasa a `@dimidio6`; `/forecast` no cambia de forma sin avisar a `@BrunoAguinaga0`. F3-E3 va después de F3-A1 y F3-A2 y respeta el congelamiento de la fase 3. | Reparte la carga del carril B, que terminó la fase 3, y prueba un modelo preentrenado sin arriesgar lo que ya pasa la compuerta. | RF-PRE-01, RF-PRE-02 |
| D-32 | **Guion y video al final.** El guion, la grabación y las slides (F0-F1 #11, F1-F1 #28, F3-F1 #55, F4-F1 #62) quedan sin dueño y se hacen al final, con la implementación ya refinada. La fase 3 se cierra sin el guion (su criterio pedía la demo según el guion) y se abre la 4. F3-B5 (#169) y F3-E3 (#170) siguen en la fase 4 con las condiciones de D-31. | El equipo prefiere trabajar la implementación y mostrarla pulida; un guion escrito antes se rehace. | RNF-07, RNF-11 |
| D-33 | **Reloj propio para las tareas programadas.** El cron de GitHub nunca disparó en este repo (cero corridas `schedule` de `worker-vivo.yml` y `avisos.yml`, aun con el cron cambiado en #166). `.github/workflows/reloj.yml` corre casi 6 horas, dispara `avisos.yml` cada 5 minutos y `worker-vivo.yml` cada 15 con `workflow_dispatch`, y se relanza solo. Los cron de los dos flujos quedan como respaldo. | `workflow_dispatch` sí anda, no pide secretos nuevos (alcanza `GITHUB_TOKEN`) y es gratis en un repo público. Un Cron Trigger de Cloudflare necesitaría un token de GitHub fuera del repo. | RF-VIV-01, RF-ALE-02 |
| D-34 | **Las tareas de `@dimidio6` pasan a `@daniace`.** `@dimidio6` se quedó sin acceso a internet. Sus tareas abiertas (F3-E3 #170, F4-E1 #60, F4-E2 #61, F5-E1 #68, F5-E2 #69) y sus carpetas (`apps/landing/`, `apps/juego/`, `packages/charmy/`, `services/alertas/`, `services/prediccion/`) pasan a `@daniace`. Cuando `@dimidio6` vuelva, el líder decide en el tablero qué se le devuelve. | Que el pulido de la fase 4 y la predicción no se detengan. | RNF-09 |
| D-35 | **El juego pasa a llamarse Charmy Brigada y se amplía** (propuesta de `@dimidio6`, pendiente de aprobación del líder). El nombre cambia en todas las piezas; los IDs `RF-KID-*` y la carpeta `apps/juego/` no cambian. Excepción al congelamiento de la fase 3: entran RF-KID-04 y RF-KID-06 a RF-KID-12, como tareas de la fase 4 (F4-E4 a F4-E11, F4-B2, F4-C2 y F4-C3). El líder devolvió `apps/juego/` a `@dimidio6` el 15/11 (corrige D-34 solo para el juego; F3-E3 y lo demás siguen con `@daniace`). Condiciones: nada de esto bloquea el envío (F4-X1) ni toca lo ya entregado fuera de `apps/juego/`; cada tarea deja el juego publicable; lo que no llegue pasa a la hoja de ruta, en este orden de caída: F4-E10, F4-E8, F4-E7, F4-E6. El juego pide los datos del día y el viento solo a la API de Charmy (`GET /game/day`), nunca a FIRMS ni a Meteomatics. | El juego hoy es de reflejos y usa poco el dato real: potencia, confianza, hora de pasada, fuentes fijas y viento ya están en los datos y en la API. Un nombre de brigada le habla a los chicos sin restringir la edad. | RF-KID-01, RF-KID-04, RF-KID-06 a RF-KID-12 |

---

## 4. Contratos compartidos

Lo que varios carriles usan. Nadie lo cambia sin anunciarlo en el tablero.

| Contrato | Dónde vive | Dueño | Lo consumen | Estado |
|---|---|---|---|---|
| API REST `/api/v1/*` | `packages/contracts/api/openapi.yaml` | `@BrunoAguinaga0` | A, D, E | borrador (en `docs/repo-inicial/`) |
| Mock y colección de pruebas | `packages/contracts/api/postman/` | `@BrunoAguinaga0` | A, D | pendiente |
| Esquema de focos, serie, calendario y métricas | `packages/contracts/datos/esquema.md` | `@leonelcnr` | C, D, E | pendiente |
| Muestras con ese esquema | `data/muestras/` | `@leonelcnr` | C, D, E | pendiente |
| Componente `<Charmy mood outfit size say />` | `packages/charmy/README.md` | `@cosmosnehu77` | D, E | base en `docs/charmy-base/` |
| Tokens de diseño | `packages/ui/tokens.css` | `@daniace` | D, E | pendiente |
| Manifiesto de datos publicados (`version`, `archivos[ruta, url, bytes, sha256]`) | `infra/README.md` | `@cosmosnehu77` | C | acordado |
| Variables de entorno | `.env.example` | `@cosmosnehu77` | todos | borrador en la carpeta del proyecto |

**Cómo se usan para no esperarse:**

- El carril **D** programa contra el **mock** de la API. Cuando la API real cumple el contrato, solo cambia una URL.
- El carril **C** programa contra las **muestras**. Cuando llegan los datos reales tienen el mismo esquema: solo cambia una ruta.
- Los carriles **D** y **E** importan `packages/charmy` desde la fase 1, cuando ya tiene su API final aunque no esté animado.
- El carril **A** construye los avisos contra el mock: usa solo la API pública.
- El carril **B** implementa `/weather` e `/imagery` como un paquete aparte. El contrato lo define **C** en el OpenAPI; cuando el paquete está listo, C lo monta con una línea.

---

## 5. Fases

Las ventanas horarias son orientativas: hora 0 es el inicio del hackathon, el sábado 14.

| Fase | Ventana | Qué se logra |
|---|---|---|
| **0 · Preparación** | antes de empezar a programar | Repo, tablero, equipo, issues, cuentas y datos pedidos. Nada de código de producto. |
| **1 · Cimientos y contratos** | h 0–4 | Monorepo que despliega y contratos con mocks y muestras. |
| **2 · Núcleo del desafío** | h 4–16 | Calendario armonizado, mapa y CSV funcionando en producción. |
| **3 · Diferenciales** | h 16–34 | Vivo, verificación, avisos, modos, juego. Al cerrar se congelan las funcionalidades. |
| **4 · Pulido y entrega** | h 34–48 | Solo correcciones, documentación, video y envío. **Acá se alcanza el MVP.** |
| **5 · Opción Azure** | después del MVP, si hay tiempo | Pasar el despliegue a Azure en paralelo, sin tocar lo entregado. Opcional. |

**Cómo leer las tablas.** El ID es `F<fase>-<carril><número>`. Dentro de un carril las tareas están en orden de
prioridad: si falta tiempo, se cae la última. "Depende de" lista lo que tiene que estar en `main` antes de empezar;
entre paréntesis, lo que se puede usar mientras tanto. Estados: `pendiente`, `en curso`, `en revisión`, `hecha`, `bloqueada`.

### Fase 0 — Preparación

**Objetivo:** que todos puedan empezar a programar en el minuto uno.
**Criterio de cierre:** las cuatro personas activas pasan `tools/board check`; todos los issues existen con su ID; las claves están cargadas; la descarga del archivo de FIRMS está pedida; `PLAN.md`, `REQUISITOS.md` y el `CLAUDE.md` del proyecto están en `main`.

| Issue | ID | Tarea | Dueño | Carpetas | Depende de | Requisitos | Estado |
|---|---|---|---|---|---|---|---|
| #2 | F0-A1 | Crear el repo desde `tabla-agentes`, proteger `main`, crear, fijar y bloquear el tablero, crear las etiquetas (`board`, `fase-0`…`fase-5`, `carril-a`…`carril-f`, `reserva`) y un issue por cada tarea de este plan | `@cosmosnehu77` | `/`, `.github/` | — | RNF-01, RNF-09 | hecha |
| #3 | F0-A2 | Completar `AGENTS.md` (equipo y dueños según este plan), `board-allowlist` y `CODEOWNERS`; invitar al equipo; subir `PLAN.md`, `REQUISITOS.md`, `docs/charmy-base/` y el OpenAPI borrador | `@cosmosnehu77` | rutas protegidas, `docs/` | F0-A1 | RNF-09 | hecha |
| #4 | F0-A5 | Generar con el agente el `CLAUDE.md` del proyecto: las reglas que todo agente sigue para respetar este plan y los requisitos (contenido detallado abajo) | `@cosmosnehu77` | `CLAUDE.md` | F0-A2 | RNF-09, RNF-06, RNF-13 | hecha |
| #5 | F0-A3 | Crear las cuentas de despliegue y almacenamiento y el bot de mensajería; cargar los secretos en la plataforma | `@cosmosnehu77` | fuera del repo | — | RNF-06, RNF-10 | pendiente |
| #6 | F0-B1 | Clave de FIRMS (**hecho:** obtenida y probada el 14/11) y descarga del archivo histórico de Argentina y Chile: MODIS C6.1 y VIIRS de S-NPP, NOAA-20 y NOAA-21. La descarga se encola y llega por correo | `@leonelcnr` | fuera del repo | — | RF-ARM-01 | en curso |
| #7 | F0-B2 | Cuenta de Meteomatics (**hecho:** activa y probada el 14/11, vence el 22/11) y cuenta de Copernicus Data Space con su cliente OAuth para las APIs (el secreto se muestra una sola vez: guardarlo en el momento) | `@leonelcnr` | fuera del repo | — | RF-CTX-01, RF-CTX-03, RNF-13 | en curso |
| #8 | F0-C1 | Crear la clave del modelo de lenguaje, la base de datos y el host de la API | `@BrunoAguinaga0` | fuera del repo | — | RNF-10 | pendiente |
| #9 | F0-D1 | Probar que el mapa base y el relieve cargan sin clave; anotar en su issue qué se conserva del prototipo anterior | `@daniace` | — | — | RF-MAP-06 | pendiente |
| #10 | F0-E1 | Revisar `docs/charmy-base/` y anotar en su issue qué capas y animaciones faltan para el componente | `@cosmosnehu77` | — | F0-A2 | RF-CHA-01 | pendiente |
| #11 | F0-F1 | Confirmar las reglas del evento (código y arte previos, formato e idioma de la entrega, hora de cierre) y escribir el guion v0 de la demo | sin asignar, al final (D-32) | `docs/entrega/` | — | RNF-11 | al final |
| #12 | F0-X1 | **Cada persona activa:** aceptar la invitación al repo, `gh auth login`, clonar, `tools/board check` y revisar los issues de **su carril**; si algo está mal repartido, avisar en el tablero | todos | — | F0-A2, F0-A5 | RNF-09 | pendiente |
| #13 | F0-A4 | Completar la columna "Issue" de este plan (**hecho** al crear los issues) y abrir la fase 1 en el tablero | `@cosmosnehu77` | `PLAN.md` | F0-X1 | RNF-09 | hecha |

**Issues.** El agente del líder creó un issue por tarea el 14/11: el título empieza con el ID, lleva las etiquetas
`fase-N` y `carril-x` y tiene asignado a su dueño. Las tareas del carril F y las de la reserva no tienen persona
asignada. Una tarea nueva entra primero en este plan y después se crea su issue con la misma forma:

```bash
gh issue create --title "[F1-B1] Carga de FIRMS a Parquet y esquema de datos" --label fase-1 --label carril-b --assignee leonelcnr --body "Ver PLAN.md, tarea F1-B1. Requisitos: RF-ARM-01."
```

**Qué tiene que tener el `CLAUDE.md` (F0-A5).** Lo genera el agente del líder cuando el repo ya tiene `AGENTS.md`,
`PLAN.md` y `REQUISITOS.md`. Conserva la primera línea de la plantilla (`@AGENTS.md`), que carga las reglas del tablero,
y debajo agrega las reglas del proyecto. Es corto y **no copia tablas**: apunta a ellas, para que no existan dos versiones.

| Bloque | Reglas que debe incluir |
|---|---|
| Al empezar cada sesión | Leer la fase activa y las tareas del carril propio en `PLAN.md`. Identificar a la persona con `tools/board whoami`. No trabajar en tareas de otra fase ni de otro carril. |
| Carriles | Tocar solo las carpetas del carril propio. Para tocar otra, pedir el traspaso en el tablero y esperar. Las rutas protegidas solo cambian por PR revisado por el líder. |
| Trazabilidad | Toda rama y todo PR nombran el ID de su tarea (`F2-B1`) y sus requisitos (`RF-ARM-01`). Si hace falta algo que no tiene tarea, no se hace por cuenta propia: se propone el cambio en `REQUISITOS.md` y `PLAN.md`. |
| Tecnologías | Vale la tabla de referencia de `PLAN.md`. No se cambia una tecnología ni se agrega una dependencia que la reemplace sin el PR que actualiza la tabla. |
| Contratos | Se trabaja contra el OpenAPI, el esquema de datos, el componente Charmy y los tokens. Mientras lo real no está, se usan el mock y las muestras. Todo cambio de contrato se anuncia en el tablero. |
| Datos y fuentes | Unidad armonizada y filtros de las decisiones D-02 a D-04. Focos en vivo solo de NOAA-20 y NOAA-21. FIRMS, Meteomatics y Copernicus se consultan solo desde el servidor, con caché y dentro de sus límites. De sitios sin API ni licencia no se leen datos de forma automática. Las muestras y los valores provisorios se marcan como tales. |
| Secretos | Nunca en el repo, el tablero, los issues ni los registros. Van en `.env` local y en la plataforma. Una variable nueva se agrega con su nombre, sin valor, a `.env.example`. |
| Producto | Interfaz en español. Charmy habla corto, en segunda persona y sin alarmismo. Todo aviso aclara que no reemplaza a los servicios de emergencia. La IA no decide sola un veredicto. Si una fuente falla, esa parte se muestra como no disponible y el resto sigue. Colores y tipografías salen de `packages/ui`; las rampas son aptas para daltonismo. |
| Calidad | Antes de abrir el PR, compilar y probar el paquete propio. Commits chicos, nada de `git add -A` ni de force-push. Después del congelamiento de la fase 3, solo correcciones. |
| Documentos vivos | Si un cambio altera una tecnología, un requisito o una regla, se actualizan `PLAN.md`, `REQUISITOS.md` o este `CLAUDE.md` en el mismo PR. Si el código no coincide con los documentos, se avisa en el tablero. |
| Comandos | Cómo instalar, levantar, probar y compilar. Se completa en F1-A1, cuando existe el monorepo. |

Además, cada dueño deja en su tarea de esqueleto de la fase 1 un `CLAUDE.md` propio dentro de su carpeta (por ejemplo
`apps/app/CLAUDE.md`), con los comandos de ese paquete y lo que no hay que tocar. Esos no son ruta protegida: la
protección alcanza solo al `CLAUDE.md` de la raíz.

### Fase 1 — Cimientos y contratos (h 0–4)

**Objetivo:** un monorepo que despliega y contratos que permiten trabajar en paralelo.
**Criterio de cierre:** `main` compila y pasa CI; landing, app y API responden en producción con un "hola" y el juego también; los contratos de la [sección 4](#4-contratos-compartidos) están en estado "acordado" y anunciados en el tablero.

| Issue | ID | Tarea | Dueño | Carpetas | Depende de | Requisitos | Estado |
|---|---|---|---|---|---|---|---|
| #14 | F1-A1 | Raíz del monorepo: workspaces de pnpm y uv, Turborepo, `.env.example`, `docker-compose.yml` base; completar en `CLAUDE.md` los comandos del monorepo | `@cosmosnehu77` | archivos de raíz | — | RNF-01, RNF-08 | pendiente |
| #15 | F1-A2 | CI por carpeta y despliegue automático de landing, app, juego y API | `@cosmosnehu77` | `.github/workflows/`, `infra/` | F1-A1 | RNF-01 | pendiente |
| #92 | F1-A3 | Relevo por límite de uso (`tools/relevo`, skill `relevo`) y lockfiles al día solos en los PR abiertos (`al-dia.yml`) | `@cosmosnehu77` | `tools/`, `.github/workflows/`, `.claude/skills/relevo/` | F2-A3 | RNF-09, RNF-15 | en curso |
| #16 | F1-B1 | Carga de FIRMS a Parquet y esquema de datos | `@leonelcnr` | `services/pipeline/`, `packages/contracts/datos/` | — | RF-ARM-01 | pendiente |
| #17 | F1-B2 | Muestras chicas con el esquema final: focos, serie, calendario, métricas y un día real para el juego. Los valores provisorios van marcados | `@leonelcnr` | `data/muestras/` | — | RNF-09 | pendiente |
| #18 | F1-B3 | Skill `firms-data`: FIRMS, Meteomatics y Copernicus, con las condiciones de uso de cada fuente | `@leonelcnr` | `.claude/skills/firms-data/` | — | RNF-09, RNF-13 | pendiente |
| #19 | F1-C1 | OpenAPI v0 acordado, mock y colección publicados | `@BrunoAguinaga0` | `packages/contracts/api/` | — | RNF-09 | pendiente |
| #20 | F1-C2 | Esqueleto de la API con `/health`, en contenedor | `@BrunoAguinaga0` | `services/api/` | — | RNF-08 | pendiente |
| #21 | F1-C3 | Skill `contratos` | `@BrunoAguinaga0` | `.claude/skills/contratos/` | F1-C1 | RNF-09 | pendiente |
| #22 | F1-D1 | Esqueleto de la app y tokens de diseño tomados de la base de Charmy | `@daniace` | `apps/app/`, `packages/ui/` | — | RNF-12 | pendiente |
| #23 | F1-D2 | Mapa base con los perfiles 2D y 3D | `@daniace` | `apps/app/` | F1-D1 | RF-MAP-06 | pendiente |
| #24 | F1-E1 | Componente Charmy con su API final a partir de `docs/charmy-base/`, todavía sin animar | `@cosmosnehu77` | `packages/charmy/` | — | RF-CHA-01 | pendiente |
| #25 | F1-E2 | Esqueleto de la landing | `@BrunoAguinaga0` | `apps/landing/` | — (importa a Charmy cuando F1-E1 está en `main`) | RF-CHA-04 | pendiente |
| #26 | F1-E3 | Skill `charmy` | `@cosmosnehu77` | `.claude/skills/charmy/` | F1-E1 | RNF-09 | pendiente |
| #27 | F1-E4 | Esqueleto del juego | `@dimidio6` | `apps/juego/` | — (importa a Charmy cuando F1-E1 está en `main`) | RF-CHA-04 | pendiente |
| #28 | F1-F1 | Guion de la demo de 3 minutos y textos de la landing | sin asignar, al final (D-32) | `docs/entrega/`, `docs/contenido/` | — | RF-LAN-01 | al final |

**Independencia en esta fase.** Nadie espera a F1-A1: los workspaces usan globs, así que cada persona crea su carpeta y
el monorepo la toma sola. Ninguna tarea espera a otra persona: la landing arranca sin Charmy y lo importa cuando F1-E1 entra en `main`.

### Fase 2 — Núcleo del desafío (h 4–16)

**Objetivo:** el flujo del enunciado funciona de punta a punta con datos reales.
**Criterio de cierre:** en producción se elige un área y un período, se ve el calendario armonizado con su anomalía y se descarga el CSV. La landing está completa.

| Issue | ID | Tarea | Dueño | Carpetas | Depende de | Requisitos | Estado |
|---|---|---|---|---|---|---|---|
| #29 | F2-A1 | Almacenamiento público de los datos estáticos y script de publicación | `@cosmosnehu77` | `infra/` | F1-A2 | RNF-02 | pendiente |
| #30 | F2-A2 | Prueba de humo del flujo completo en producción, corrida en CI con la colección, y README base | `@cosmosnehu77` | `.github/workflows/`, `README.md` | F1-C1 | RNF-02, RNF-01 | pendiente |
| #84 | F2-A3 | Calidad: CI en un solo flujo con chequeo obligatorio `CI ok`, política de pruebas (`docs/PRUEBAS.md`) y "Pruebas mínimas" en cada issue | `@cosmosnehu77` | `.github/workflows/`, `docs/PRUEBAS.md` | F1-A2 | RNF-15 | en curso |
| #99 | F2-A4 | Sumar a `@dimidio6` (tablero, `AGENTS.md`, este plan) y rebalancear el carril E | `@cosmosnehu77` | rutas protegidas | — | RNF-09 | en curso |
| #31 | F2-B1 | Armonización v1: filtros, días-celda, calibración en cadena y validación dejando un año afuera | `@leonelcnr` | `services/pipeline/` | F1-B1 | RF-ARM-01, RF-ARM-02, RF-ARM-03 | pendiente |
| #32 | F2-B2 | Agregados de calendario, anomalías y métricas de validación; publicación de los Parquet | `@leonelcnr` | `services/pipeline/` | F2-B1, F2-A1 | RF-CAL-01, RF-CAL-02, RF-CAL-03, RF-ARM-04 | pendiente |
| #33 | F2-C1 | `/hotspots` con filtros y salida en CSV | `@BrunoAguinaga0` | `services/api/` | F1-C2 (usa F1-B2) | RF-MAP-05, RF-EXP-01 | pendiente |
| #34 | F2-C2 | `/calendar` y `/harmonization/metrics` | `@BrunoAguinaga0` | `services/api/` | F1-C2 (usa F1-B2; datos reales con F2-B2) | RF-CAL-01, RF-CAL-02, RF-ARM-04 | pendiente |
| #35 | F2-D1 | Selección de área (dibujo y latitud/longitud), fechas y filtros sobre el mapa | `@daniace` | `apps/app/` | F1-D2 (usa el mock de F1-C1) | RF-MAP-01, RF-MAP-02, RF-MAP-04, RF-MAP-05 | pendiente |
| #36 | F2-D2 | Calendario año × mes con anomalía y rampas accesibles; descarga del CSV | `@daniace` | `apps/app/` | F2-D1 | RF-CAL-01, RF-CAL-02, RF-CAL-03, RF-CAL-05, RF-EXP-01 | pendiente |
| #37 | F2-E1 | Charmy: tres estados animados (saluda, explica, alerta), globo de diálogo y movimiento reducido | `@cosmosnehu77` | `packages/charmy/` | F1-E1 | RF-CHA-02, RF-CHA-06 | pendiente |
| #38 | F2-E2 | Landing completa: portada con Charmy, problema, funcionalidades, equipo, créditos y accesos | `@dimidio6` | `apps/landing/` | F1-E2 (textos de F1-F1) | RF-LAN-01, RF-LAN-02, RF-LAN-03, RF-LAN-04 | pendiente |
| #39 | F2-F1 | Frases de Charmy para la app y retoques del arte | carril F | `docs/contenido/`, `docs/charmy-base/` | — | RF-CHA-07 | pendiente |
| #112 | F2-E3 | Cloudflare Pages: cuenta, proyectos `charmy-app`, `charmy-landing` y `charmy-juego` y primer deploy web (D-27) | `@dimidio6` | fuera del repo | F1-A2 | RNF-01 | pendiente |

**Comunicación entre carriles.** B → C: cuando F2-B2 publica, avisa en el tablero la ruta de los datos; C cambia una
variable. C → D: cuando un endpoint cumple el contrato, C lo anuncia y D cambia la URL del mock por la real.
A recorre el flujo en producción y publica lo que esté roto.

### Fase 3 — Diferenciales (h 16–34)

**Objetivo:** lo que distingue a Charmy. Cada tarea tiene una versión mínima que ya suma.
**Criterio de cierre:** la demo completa corre según el guion. **Congelamiento:** después de la hora 34 no entra ninguna funcionalidad nueva.

| Issue | ID | Tarea | Dueño | Carpetas | Depende de | Requisitos | Estado |
|---|---|---|---|---|---|---|---|
| #40 | F3-A1 | Servicio de avisos: bot con una zona de demostración, mensaje por foco o reporte nuevo con el viento en el lugar, botones de estado y aviso de emergencias | `@dimidio6` (D-28) | `services/alertas/` | F1-C1 (usa el mock; datos reales con F3-C1, F3-C2 y F3-B3) | RF-ALE-02, RF-ALE-03, RF-ALE-06, RF-CTX-02 | pendiente |
| #41 | F3-A2 | Feed CAP 1.2 por zona | `@dimidio6` (D-28) | `services/alertas/` | F3-A1 | RF-ALE-04 | pendiente |
| #140 | F3-A3 | Pruebas obligatorias: hook `pre-commit` con las pruebas de lo que cambia CI que exige pruebas en cada servicio que cambia y despliegues que esperan al CI (D-29) | `@daniace` (D-28) | `.githooks/`, `package.json`, `.github/workflows/`, `docs/PRUEBAS.md` | — | RNF-15 | en curso |
| #42 | F3-B1 | Máscara de fuentes fijas publicada como dato | `@leonelcnr` | `services/pipeline/` | F2-B1 | RF-ARM-05 | pendiente |
| #43 | F3-B3 | Tiempo en el foco: paquete con `/weather` sobre Meteomatics, con caché por celda y media hora (el límite es de 1.000 pedidos por día), copia de respaldo de lo leído que se usa si la fuente falla o la cuenta vence (D-26) y respuesta clara si no hay copia | `@leonelcnr` | `services/contexto/` | F1-C1, F0-B2 | RF-CTX-01, RNF-14 | pendiente |
| #44 | F3-B4 | Imagen satelital del foco: `/imagery` sobre las APIs de Copernicus, con búsqueda de la escena reciente más despejada, estilos de color real y falso color, caché de imágenes y respuesta clara si no hay imagen o se agota la cuota | `@leonelcnr` | `services/contexto/` | F3-B3, F0-B2 | RF-CTX-03, RNF-14 | pendiente |
| #45 | F3-B2 | Predicción a 1–3 meses con compuerta contra la climatología | `@leonelcnr` | `services/pipeline/` | F2-B2 | RF-PRE-01, RF-PRE-02 | pendiente |
| #169 | F3-B5 | Tabla de entrenamiento celda×mes publicada como dato para la predicción (D-31) | `@leonelcnr` | `services/pipeline/`, `packages/contracts/datos/` | F3-B2 | RF-PRE-01 | pendiente |
| #46 | F3-C1 | Worker de focos recientes con caché y `/live` | `@BrunoAguinaga0` | `services/worker/`, `services/api/` | F2-C1 | RF-VIV-01 | pendiente |
| #47 | F3-C2 | Reportes ciudadanos y estado de avisos: `POST` y `GET /reports`, `PATCH /alerts/{id}` | `@BrunoAguinaga0` | `services/api/` | F2-C1 | RF-ALE-01, RF-ALE-03, RNF-05 | pendiente |
| #48 | F3-C3 | Verificación: señales, noticias, etiquetado con el modelo de lenguaje y `/live/{id}/evidence` | `@BrunoAguinaga0` | `services/worker/` | F3-C1 (fuentes fijas con F3-B1) | RF-VIV-02, RF-VIV-03, RF-VIV-04 | pendiente |
| #49 | F3-D1 | Modo novato: recorrido de Charmy, lenguaje simple, conclusión por área, búsqueda por localidad | `@daniace` | `apps/app/` | F2-D2, F2-E1 | RF-MOD-01, RF-MOD-03, RF-CHA-05, RF-MAP-03 | pendiente |
| #50 | F3-D2 | Modo experto: selector de serie, panel de validación, atributos originales, descargas extra, reproducción temporal | `@daniace` | `apps/app/` | F2-D2 | RF-MOD-02, RF-ARM-04, RF-EXP-02, RF-MAP-07 | pendiente |
| #51 | F3-D3 | Capa de focos recientes con veredicto y evidencia; formulario de reporte | `@daniace` | `apps/app/` | F2-D1 (usa el mock; datos reales con F3-C1 a C3) | RF-VIV-01, RF-VIV-02, RF-ALE-01, RF-ALE-06 | pendiente |
| #52 | F3-D4 | Panel de contexto del foco: viento, riesgo de incendio e imagen satelital reciente como capa del mapa, con su fecha, nubosidad y atribución | `@daniace` | `apps/app/` | F2-D1 (usa el mock; datos reales con F3-B3 y F3-B4) | RF-CTX-01, RF-CTX-03, RNF-14 | pendiente |
| #53 | F3-E1 | Charmy Brigada (antes Charmy Kids): un nivel jugable con focos de un día real, puntaje, combo y cierre educativo | `@dimidio6` | `apps/juego/` | F1-E4 (usa F1-B2) | RF-KID-01, RF-KID-02, RF-KID-03 | pendiente |
| #54 | F3-E2 | Charmy completo: los seis estados y los cinco vestuarios | `@dimidio6` | `packages/charmy/` | F2-E1 | RF-CHA-02, RF-CHA-03 | pendiente |
| #170 | F3-E3 | Predicción en `services/prediccion/`: TimesFM 2.5 contra LightGBM con la compuerta D-10 y los mismos años de prueba (D-31). Después de F3-A1 y F3-A2 | `@daniace` (D-34) | `services/prediccion/` | F3-B5 | RF-PRE-01, RF-PRE-02 | pendiente |
| #55 | F3-F1 | Grabar la demo y armar las slides | sin asignar, al final (D-32) | `docs/entrega/` | — | RNF-07 | al final |

**Comunicación entre carriles.** El servicio de avisos (A) no comparte base ni código con la API (C): consulta `/live` y
`/reports` y devuelve el estado con `PATCH /alerts/{id}`. La app (D) y los avisos (A) se construyen contra el mock y se
conectan a lo real cuando C lo anuncia. La verificación (C) usa la máscara de fuentes fijas (B) cuando esté publicada;
mientras tanto usa la muestra. El tiempo y la imagen satelital del foco (B) son un paquete en su propia carpeta: cuando está listo, B avisa
en el tablero y C lo monta en la API con una línea. La app (D) consume los dos por la API, primero contra el mock.

**Tope de tiempo.** Si a la hora 28 el juego no es jugable de punta a punta, se muestra como prototipo en la landing.
Si la predicción no supera la compuerta, no se muestra. Si falta tiempo en el carril D, cae primero F3-D4, después
F3-D3, y se conservan F3-D1 y F3-D2. Aunque caiga F3-D4, Meteomatics sigue visible en el aviso de Telegram (F3-A1).
Si falta tiempo en el carril B, el orden es: fuentes fijas, tiempo, imagen y, por último, predicción.

### Fase 4 — Pulido y entrega (h 34–48)

**Objetivo:** estabilidad, documentación y envío temprano. **Al cerrar esta fase se alcanza el MVP.**
**Criterio de cierre:** se cumple el [criterio de MVP](REQUISITOS.md#criterio-de-mvp) y el proyecto está enviado al menos 2 horas antes del cierre.

| Issue | ID | Tarea | Dueño | Carpetas | Depende de | Requisitos | Estado |
|---|---|---|---|---|---|---|---|
| #56 | F4-A1 | README final, declaración de uso de IA y revisión de secretos (el repo es público desde el primer commit) | `@cosmosnehu77` | `README.md`, raíz | fase 3 | RNF-01, RNF-06, RNF-07 | pendiente |
| #57 | F4-B1 | Documento del método: armonización, validación, supuestos y fuentes, con el contraste manual de las cifras contra estadísticas públicas externas | `@leonelcnr` | `docs/metodologia/` | fase 3 | RNF-07, RF-ARM-04, RF-CTX-06, RNF-13 | pendiente |
| #58 | F4-C1 | Datos cacheados para la demo, servicios despiertos y errores claros | `@BrunoAguinaga0` | `services/api/`, `services/worker/` | fase 3 | RNF-02 | pendiente |
| #59 | F4-D1 | Pulido de la app: accesibilidad, ancho de teléfono y textos | `@daniace` | `apps/app/` | fase 3 | RNF-03, RNF-04 | pendiente |
| #60 | F4-E1 | Pulido de la landing; enlaces entre las tres piezas | `@daniace` (D-34) | `apps/landing/` | fase 3 | RF-LAN-04, RNF-12 | pendiente |
| #61 | F4-E2 | Pulido del juego | `@daniace` (D-34) | `apps/juego/` | F3-E1 | RNF-12 | pendiente |
| #183 | F4-E3 | El juego pasa a llamarse Charmy Brigada en todas las piezas; requisitos y tareas de D-35 | `@dimidio6` | `apps/juego/`, y el nombre en `apps/app/`, `apps/landing/`, `packages/charmy/`, `docs/` | — | RF-KID-01, RNF-12 | en revisión |
| — | F4-E4 | Base del juego: una escena por archivo, estado de la partida en un módulo puro, números aleatorios con semilla, grilla de celdas y contorno de la región de fondo | `@dimidio6` (D-35) | `apps/juego/` | F4-E3 | RF-KID-07 | pendiente |
| — | F4-E5 | El dato real en la mecánica: potencia como vida del foco, confianza y verificación, fuentes fijas como trampa, pasadas del satélite | `@dimidio6` (D-35) | `apps/juego/` | F4-E4 (fuentes fijas reales con F4-B2) | RF-KID-06, RF-KID-07 | pendiente |
| — | F4-E6 | Propagación de los focos que se escapan, sesgada por el viento; sin viento, sin sesgo | `@dimidio6` (D-35) | `apps/juego/` | F4-E4 (viento real con F4-C2) | RF-KID-08 | pendiente |
| — | F4-E7 | Agua y lagos, herramientas por vestuario (bombero, piloto, científica, guía), estados de Charmy según la partida, curva de dificultad y castigo suave | `@dimidio6` (D-35) | `apps/juego/` | F4-E5 | RF-KID-09 | pendiente |
| — | F4-E8 | Desafío del día: focos reales de ayer (hora de Argentina) con la fecha como semilla; respaldo en la muestra si la API falla o hay pocos focos | `@dimidio6` (D-35) | `apps/juego/` | F4-E5, F4-C2 (usa el mock) | RF-KID-10, RF-KID-02 | pendiente |
| — | F4-E9 | Modo explorador: sin reloj, sin escapes, con teclado y anuncios para lector de pantalla | `@dimidio6` (D-35) | `apps/juego/` | F4-E5 | RF-KID-11, RNF-04 | pendiente |
| — | F4-E10 | Tabla de puntajes del desafío del día, con "no disponible" si la API no responde | `@dimidio6` (D-35) | `apps/juego/` | F4-E8, F4-C3 (usa el mock) | RF-KID-04 | pendiente |
| — | F4-E11 | Sonido generado con Web Audio, sin archivos ni dependencias nuevas, con silencio recordado | `@dimidio6` (D-35) | `apps/juego/` | F4-E4 | RF-KID-12 | pendiente |
| — | F4-B2 | `fuente_fija` en cada foco de `dia-juego.json` (contrato y muestra) | `@leonelcnr` | `data/muestras/`, `packages/contracts/datos/` | — | RF-KID-06 | pendiente |
| — | F4-C2 | `GET /game/day?date=`: focos de un día con la forma de `dia-juego.json`, `fuente_fija` por foco y el viento del día, con caché | `@BrunoAguinaga0` | `services/api/`, `packages/contracts/api/` | F4-B2 | RF-KID-10, RF-KID-08 | pendiente |
| — | F4-C3 | `GET` y `POST /game/scores`: tabla del desafío del día, apodo filtrado sin datos personales, puntaje validado y límite de pedidos | `@BrunoAguinaga0` | `services/api/`, `packages/contracts/api/` | — | RF-KID-04 | pendiente |
| #62 | F4-F1 | Video o slides finales | sin asignar, al final (D-32) | `docs/entrega/` | F3-F1 | RNF-07, RNF-11 | al final |
| #63 | F4-X1 | Envío en la plataforma de Space Apps | carril F y `@cosmosnehu77` | — | F4-A1, F4-F1 | RNF-01 | pendiente |

### Fase 5 — Opción Azure (opcional, después del MVP)

**Qué es.** Pasar el despliegue a Azure con los créditos que el evento da a los participantes.
**El MVP no depende de esta fase.** Se abre solo si se cumplen las condiciones de abajo (decisión D-21).

**Qué se gana.** Con créditos, la API queda siempre encendida (hoy el riesgo es que el host gratuito se duerma en plena
demo), el worker pasa a ser una tarea programada administrada y todo queda en un solo proveedor.

**Condiciones para abrirla.** Las verifica el líder y las anuncia en el tablero:

1. La fase 4 está cerrada: MVP cumplido y proyecto enviado.
2. Los créditos de Azure están activos en una suscripción del equipo y tienen una alerta de presupuesto.
3. Hay al menos dos personas disponibles, una de ellas la del carril A.

**Reglas para no arriesgar lo entregado.**

- El despliegue actual **no se apaga ni se modifica**. Azure se levanta en paralelo.
- Las direcciones enviadas al jurado no cambian. Si se registró un dominio propio (el evento ofrece uno gratis con GoDaddy), el paso a Azure es un cambio de DNS que se puede revertir.
- Cada pieza se da por migrada solo cuando la prueba de humo de F2-A2 pasa contra su dirección de Azure.
- Si una pieza se traba, se deja en el despliegue actual. Se puede terminar con una mezcla.

**Equivalencias.**

| Pieza | Despliegue del MVP | En Azure | Notas |
|---|---|---|---|
| Landing, app y juego | Cloudflare Pages | **Static Web Apps**, plan gratuito, una por pieza | 100 GB de tráfico al mes, 250 MB por app y 2 dominios propios por app con certificado (verificado el 14/11). Conviene compilar en CI y subir la carpeta ya construida, porque es un monorepo. La app necesita un `staticwebapp.config.json` con la ruta de respaldo. |
| API | Contenedor en Render, Fly o VPS | **Container Apps**, con una réplica mínima | La réplica mínima evita el arranque en frío. Imagen publicada en el registro de contenedores de GitHub, para no sumar otro servicio. Hay que agregar los orígenes nuevos a CORS. |
| Worker de focos recientes | Contenedor con cron | **Tarea programada de Container Apps**, cada 30 minutos | Corre y termina: no ocupa una réplica fija. |
| Avisos (Telegram y CAP) | Contenedor | **Container Apps** | El bot usa *polling*, así que no necesita dirección pública; el feed CAP sí. |
| Parquet estáticos | Cloudflare R2 o GitHub Releases | **Blob Storage**, contenedor de lectura pública | Configurar CORS y caché. Comprobar que acepta pedidos por rango, que es lo que usa DuckDB. |
| Base de reportes | Supabase | **No se migra** | Mover una base en medio del evento no aporta. Azure tiene Postgres administrado con PostGIS si después hiciera falta. |
| Modelo de lenguaje | NVIDIA NIM | **No se migra** | Azure también ofrece modelos, pero cambiarlo no mejora la demo. |
| Secretos | Variables de la plataforma | Secretos de Container Apps y de GitHub Actions | GitHub Actions entra a Azure con identidad federada, sin guardar contraseñas. |

**Tareas.** Etiqueta `fase-5`. El orden recomendado es el de la tabla: primero lo que no puede romper nada.

| Issue | ID | Tarea | Dueño | Carpetas | Depende de | Requisitos | Estado |
|---|---|---|---|---|---|---|---|
| #64 | F5-A1 | Activar los créditos; crear el grupo de recursos en la región más cercana, la alerta de presupuesto, la identidad federada para GitHub Actions, la cuenta de almacenamiento y el entorno de Container Apps | `@cosmosnehu77` | `infra/azure/` | fase 4 | RNF-10, RNF-06 | pendiente |
| #65 | F5-B1 | Publicar los Parquet en Blob Storage con lectura pública, CORS y caché; comprobar los pedidos por rango | `@leonelcnr` | `services/pipeline/` | F5-A1 | RNF-02 | pendiente |
| #66 | F5-A2 | Crear las tres Static Web Apps y sus flujos de despliegue, que compilan en CI y suben la carpeta construida | `@cosmosnehu77` | `.github/workflows/`, `infra/azure/` | F5-A1 | RNF-01 | pendiente |
| #67 | F5-D1 | Configuración de la app para Static Web Apps (ruta de respaldo y cabeceras) y prueba en la dirección nueva | `@daniace` | `apps/app/` | F5-A2 | RNF-03 | pendiente |
| #68 | F5-E1 | Configuración de la landing para Static Web Apps y prueba en la dirección nueva | `@daniace` (D-34) | `apps/landing/` | F5-A2 | RNF-12 | pendiente |
| #69 | F5-E2 | Configuración del juego para Static Web Apps y prueba en la dirección nueva | `@daniace` (D-34) | `apps/juego/` | F5-A2 | RNF-12 | pendiente |
| #70 | F5-C1 | API en Container Apps con una réplica mínima, worker como tarea programada, secretos y CORS para los orígenes nuevos | `@BrunoAguinaga0` | `services/api/`, `services/worker/` | F5-A1, F5-B1 | RNF-02 | pendiente |
| #71 | F5-A3 | Avisos en Container Apps | `@cosmosnehu77` | `services/alertas/` | F5-C1 | RF-ALE-02 | pendiente |
| #72 | F5-A4 | Prueba de humo completa contra Azure, cambio de DNS o de variables, y actualización de la tabla de referencia y de D-21 | `@cosmosnehu77` | `.github/workflows/`, `PLAN.md` | F5-B1, F5-D1, F5-E1, F5-C1 | RNF-02 | pendiente |

**Comunicación entre carriles.** F5-A1 publica en el tablero los nombres de los recursos y las variables. Después,
B, D, E y C trabajan en paralelo, cada uno en su carpeta. Solo F5-A4 cambia a dónde apunta el público.

**Vuelta atrás.** Como nada del despliegue original se apaga, volver es restaurar el DNS o las variables anteriores.

**A confirmar al hacerlo** (no verificado para este plan): las condiciones exactas de los créditos del evento, los
límites del plan de consumo de Container Apps y sus tareas programadas, y en qué regiones está disponible cada servicio.

**Otros recursos de Microsoft que podrían sumarse después:** Planetary Computer tiene el área quemada mensual de MODIS
(MCD64A1), útil para contrastar la armonización. No reemplaza a FIRMS: no encontramos que tenga focos de VIIRS.

---

## 6. Cobertura de requisitos

Qué tareas cubren cada requisito. Si un requisito de `REQUISITOS.md` no aparece acá, no se está haciendo.

| Requisitos | Tareas | Fase de cierre |
|---|---|---|
| RF-ARM-01, 02, 03 | F1-B1, F2-B1 | 2 |
| RF-ARM-04 | F2-B2, F2-C2, F3-D2, F4-B1 | 3 |
| RF-ARM-05 | F3-B1, F3-C3 | 3 |
| RF-CAL-01, 02, 03, 05 | F2-B2, F2-C2, F2-D2 | 2 |
| RF-CAL-04 | sin tarea (deseable) | hoja de ruta |
| RF-MAP-01, 02, 04, 05 | F2-C1, F2-D1 | 2 |
| RF-MAP-03, 07 | F3-D1, F3-D2 | 3 |
| RF-MAP-06 | F0-D1, F1-D2 | 1 |
| RF-MAP-08 | F0-B1 (cobertura); vista global sin tarea | 2 / hoja de ruta |
| RF-EXP-01 | F2-C1, F2-D2 | 2 |
| RF-EXP-02 | F3-D2 | 3 |
| RF-MOD-01, 02, 03 | F3-D1, F3-D2 | 3 |
| RF-CHA-01, 04 | F0-E1, F1-E1, F1-E2, F1-E4 | 1 |
| RF-CHA-02, 03, 06 | F2-E1, F3-E2 | 2 (mínimo) / 3 |
| RF-CHA-05 | F3-D1 | 3 |
| RF-CHA-07 | F2-F1 | 2 |
| RF-LAN-01 a 04 | F1-F1, F2-E2, F4-E1 | 2 |
| RF-VIV-01 a 04 | F3-C1, F3-C3, F3-D3 | 3 |
| RF-ALE-01, 03 | F3-C2, F3-D3, F3-A1 | 3 |
| RF-ALE-02, 04, 06 | F3-A1, F3-A2, F3-D3 | 3 |
| RF-ALE-05 | sin tarea (deseable) | hoja de ruta |
| RF-ALE-07 | cumplido por diseño (D-14) | — |
| RF-PRE-01, 02 | F3-B2, F3-B5, F3-E3 | 3, con compuerta |
| RF-KID-01, 02, 03 | F1-B2, F1-E4, F3-E1, F4-E3 | 3 |
| RF-KID-04 | F4-C3, F4-E10 (D-35) | 4 |
| RF-KID-05 | sin tarea | hoja de ruta |
| RF-KID-06, 07 | F4-B2, F4-E4, F4-E5 (D-35) | 4 |
| RF-KID-08 | F4-C2, F4-E6 (D-35) | 4 |
| RF-KID-09 | F4-E7 (D-35) | 4 |
| RF-KID-10 | F4-C2, F4-E8 (D-35) | 4 |
| RF-KID-11 | F4-E9 (D-35) | 4 |
| RF-KID-12 | F4-E11 (D-35) | 4 |
| RF-CTX-01 | F0-B2, F3-B3, F3-D4 | 3 |
| RF-CTX-02 | F3-A1 | 3 |
| RF-CTX-03 | F0-B2, F3-B4, F3-D4 | 3 |
| RF-CTX-04, 05 | sin tarea (deseables) | hoja de ruta |
| RF-CTX-06 | F4-B1 | 4 |
| RNF-01, 08 | F0-A1, F1-A1, F1-A2, F4-A1 | 4 |
| RNF-02 | F2-A1, F2-A2, F4-C1 | 4 |
| RNF-03, 04 | F1-D2, F2-D2, F4-D1 | 4 |
| RNF-05 | F3-C2 | 3 |
| RNF-06 | F0-A3, F0-A5, F4-A1, D-13 | 4 |
| RNF-07, 11 | F0-F1, F3-F1, F4-A1, F4-B1, F4-F1 | 4 |
| RNF-09 | F0-A1, F0-A2, F0-A5, F0-X1, F1-B2, F1-B3, F1-C1, F1-C3, F1-E3 | 1 |
| RNF-10 | F0-A3, F0-C1 | 0 |
| RNF-12 | F1-D1, F4-E1, F4-E2 | 4 |
| RNF-13 | F0-A5, F0-B2, F1-B3, F4-B1 | 4 |
| RNF-14 | F3-B3, F3-B4, F3-D4 | 3 |
| RNF-15 | F2-A3 y la sección "Pruebas mínimas" de cada issue | todas |

La fase 5 no cubre requisitos nuevos: refuerza RNF-02 y RNF-10 sobre lo ya entregado.

---

## 7. Reglas para no pisarse

- **Una carpeta, un dueño.** Dos tareas de dueños distintos nunca comparten carpeta en la misma fase. Para tocar la carpeta de otra persona se pide el traspaso en el tablero y se espera.
- **Dependencias en `main`.** Una tarea empieza cuando lo de su columna "Depende de" está en `main`. Lo que figura entre paréntesis (mock o muestras) se puede usar desde antes.
- **Contratos anunciados.** Todo cambio en un contrato de la [sección 4](#4-contratos-compartidos) se anuncia en el tablero al hacer merge, mencionando a los carriles que lo consumen.
- **Ramas cortas.** Rama `<issue>-<slug>` desde `main` actualizado, PR con `Closes #N`, merge varias veces por hora. Nada de `git add -A` ni de force-push.
- **Estado en el issue.** Cada dueño mueve su issue. Al terminar las tareas de la fase publica `[Agente de Nombre] @cosmosnehu77 fase N: terminadas #A #B`.
- **Pruebas y YAGNI** (D-23, `docs/PRUEBAS.md`): una tarea termina cuando cada punto de "Pruebas mínimas" de su issue tiene su prueba y el CI está en verde. Ninguna prueba llama a la red. Solo se construye lo que pide el issue.
- **PR siempre contra `main`.** No se apilan PR: un PR fusionado sobre otra rama no llega a `main`.
- **Rama al día con `tools/al-dia`** antes de abrir el PR y cada vez que GitHub marca conflictos. Resuelve solo los choques de lockfiles; los lockfiles nunca se editan a mano.
- **Relevo** (D-24, `AGENTS.md` §7): cerca del 90 % de uso de tokens se deja la tarea con `tools/relevo dejar`; la toma quien confirme el líder, solo en las carpetas de esa tarea, hasta que el dueño vuelve.
- **Reserva.** Las tareas con la etiqueta `reserva` no se toman por cuenta propia: las asigna el líder en el tablero.
- **Solo el líder** cambia la fase activa, y lo anuncia con `@all`. Hasta entonces nadie adelanta tareas de la fase siguiente, salvo que el líder lo indique en el tablero.
- **Integración cada 6 horas.** El líder recorre el flujo en producción y publica lo que esté roto, mencionando al dueño.
- **Rutas protegidas** (`.claude/`, `tools/`, `.github/`, `AGENTS.md`, `PLAN.md`, `CLAUDE.md`, `REQUISITOS.md`): solo por PR revisado por el líder.
- **Secretos:** nunca en el repo ni en el tablero. Van en la plataforma de despliegue y en `.env` local, que está ignorado.

---

## 8. Hoja de ruta después del MVP

| Qué | Requisito | Nota |
|---|---|---|
| Cuentas de entidades, zona dibujada por ellas y bandeja web | RF-ALE-05 | Login por enlace mágico. |
| Vista diaria del calendario | RF-CAL-04 | — |
| Vista global con focos recientes de todo el mundo | RF-MAP-08 | El método no depende de la región. |
| Juego en 3D voxel | RF-KID-05 | — |
| Variables del tiempo en la predicción | RF-PRE-01 | La cuenta de Meteomatics da histórico desde 1900 y pedidos por área, pero con 1.000 pedidos por día y hasta el 22/11. Alternativa abierta: ERA5-Land mensual. |
| Fuente del tiempo después del 22/11/2026 | RF-CTX-01 | La cuenta del evento vence. Hace falta otra cuenta o una fuente abierta; mientras tanto el panel muestra "no disponible" (RNF-14). |
| Imagen de antes y después, y severidad de la quema | RF-CTX-04 | Sentinel-2 con el índice NBR, vía Copernicus. |
| Otros satélites como señal de verificación | RF-CTX-05 | Sentinel-3 SLSTR FRP (Copernicus) y GOES (FIRMS). |
| Despliegue en Azure | RNF-02, RNF-10 | Detallado en la [fase 5](#fase-5--opción-azure-opcional-después-del-mvp). |
| Charmy animado con una máquina de estados (Rive) | RF-CHA-06 | Seguimiento del cursor y transiciones más ricas. |
| Alianzas con el Servicio Provincial de Manejo del Fuego de Chubut y bomberos voluntarios | RF-ALE-02 | Requiere contacto institucional. |

---

## 9. Registro de cambios

| Fecha | Cambio | Secciones tocadas | Quién |
|---|---|---|---|
| 2026-11-13 | Versión inicial a partir del plan técnico y de `REQUISITOS.md` 1.0. Charmy pasa a basarse en "Charmy · Variantes" (D-07). El equipo se organiza en cinco carriles con agente y el servicio de avisos pasa al carril A (D-16). | todas | — |
| 2026-11-14 | Versión 1.1, con `REQUISITOS.md` 1.1. Se suman Meteomatics (D-18), Copernicus (D-19) y currentwildfires como referencia (D-20). Tareas nuevas: F0-B2, F3-B3 y F3-D4; cambian F0-B1, F1-B3, F3-A1 y F4-B1. Componente nuevo `services/contexto/` en el carril B. Azure queda como fase 5 opcional (D-21). Se corrige el solape de NOAA-20 en D-03 con la disponibilidad real de FIRMS. Clave de FIRMS obtenida. | 1, 3, 4, 5, 6, 8 | — |
| 2026-11-14 | Versión 1.2. Copernicus pasa a consumirse por API desde el servidor (D-19): la imagen satelital deja de pedirse desde el navegador, se suma la tarea F3-B4 en el carril B y cambia F3-D4. Cuenta de Meteomatics activa y probada: parámetros confirmados, límite de 1.000 pedidos por día y vencimiento el 22/11. | 1, 3, 4, 5, 6, 8 | — |
| 2026-11-14 | Versión 1.3. Tarea nueva F0-A5: generar el `CLAUDE.md` del proyecto con las reglas para los agentes, con su contenido especificado. F0-X1 pasa a depender de ella. F1-A1 completa los comandos y cada carril suma su `CLAUDE.md` de carpeta. | 2, 5, 6 | — |
| 2026-11-14 | Versión 1.4, con `REQUISITOS.md` 1.3. Equipo activo de cuatro personas, con sus logins; `@dimidio6` todavía no participa. El carril E se reparte (D-22): componente Charmy al líder, landing al carril C, juego y Charmy completo a la reserva. Se parten F1-E2, F4-E1 y F5-E1 y nacen F1-E4, F4-E2 y F5-E2. Los issues los crea el agente del líder y se completa la columna "Issue". Repo, tablero y `CLAUDE.md` creados. | equipo, 1.3, 3, 4, 5, 6, 7 | `@cosmosnehu77` |
| 2026-11-14 | Versión 1.5, con `REQUISITOS.md` 1.4. Política de pruebas y YAGNI (D-23, `docs/PRUEBAS.md`, RNF-15): "Pruebas mínimas" en cada issue, prueba primero en la lógica, nada de red en las pruebas, `CI ok` obligatorio y PR siempre contra `main`. Tarea nueva F2-A3. | 1.1, 3, 5, 6, 7 | `@cosmosnehu77` |
| 2026-11-14 | Datos estáticos: se elige GitHub Releases con manifiesto (`infra/publicar`, F2-A1); R2 queda como alternativa. Contrato nuevo: manifiesto de datos publicados. | 1.1, 4 | `@cosmosnehu77` |
| 2026-11-14 | Versión 1.6. Relevo por límite de uso y lockfiles al día solos (D-24, F1-A3): `tools/relevo`, skill `relevo`, `AGENTS.md` §7 y flujo `al-dia.yml`. `tools/al-dia` ya no corre scripts de instalación. | 1.2, 3, 5, 7 | `@cosmosnehu77` |
| 2026-11-14 | Versión 1.7. Se abre la fase 2. Las tareas de la fase 1 que siguen abiertas (#21, #25, #27, #28) continúan en paralelo: ninguna comparte carpeta con una tarea de otro dueño de la fase 2. | encabezado | `@cosmosnehu77` |
| 2026-11-14 | Versión 1.8. Se suma `@dimidio6` (D-25): carril E salvo el componente Charmy. Recibe la reserva (F1-E4, F3-E1, F3-E2, F4-E2, F5-E2) y la landing de `@BrunoAguinaga0` (F2-E2, F4-E1, F5-E1). Ya no hay tareas en reserva. Tarea F2-A4. | equipo, 1.3, 3, 5 | `@cosmosnehu77` |
| 2026-11-14 | Versión 1.9. Respaldo de lo leído de Meteomatics para cuando la API falle o la cuenta venza (D-26, cambia F3-B3). Cloudflare Pages pasa a `@dimidio6` en la tarea nueva F2-E3 (D-27). | 3, 5 | `@cosmosnehu77` |
| 2026-11-14 | Versión 2.0. Se cierra la fase 2 y se abre la 3. `@daniace` queda como líder interino hasta que vuelva `@cosmosnehu77` (D-28); F3-A1 y F3-A2 pasan a `@dimidio6`. | encabezado, equipo, 3, 5, 10 | `@cosmosnehu77` |
| 2026-11-14 | Versión 2.0.1. Las tablas de carriles y de componentes reflejan D-28: `services/alertas/` y el servicio de avisos pasan a `@dimidio6`; la de componentes también le da `packages/charmy/` desde la fase 3. | equipo, 1.3 | `@daniace` |
| 2026-11-14 | Versión 2.0.2. Pruebas en cada commit y por servicio (D-29, tarea F3-A3). | 3, 5 | `@daniace` |
| 2026-11-14 | Versión 2.0.3. Los avisos corren en GitHub Actions cada 5 minutos (D-30, #150). | 1.1, 3 | `@dimidio6` |
| 2026-11-14 | Versión 2.0.4. La predicción pasa a `@dimidio6` en `services/prediccion/` (D-31): TimesFM 2.5 como candidato y LightGBM vigente. Tareas nuevas F3-B5 y F3-E3. | equipo, 1.1, 1.3, 3, 5, 6 | `@leonelcnr` |
| 2026-11-14 | Versión 2.1. Se cierra la fase 3 y se abre la 4. El guion y el video quedan sin dueño y para el final (D-32). | encabezado, 3, 5, 10 | `@cosmosnehu77` |
| 2026-11-14 | Versión 2.1.1. Reloj propio para worker-vivo y avisos (D-33). | encabezado, 3 | `@cosmosnehu77` |
| 2026-11-14 | Versión 2.1.2. Las tareas y carpetas de `@dimidio6` pasan a `@daniace` (D-34). | encabezado, 3, 5 | `@cosmosnehu77` |
| 2026-11-14 | Versión 2.2, con `REQUISITOS.md` 1.5. El juego pasa a llamarse Charmy Brigada y se amplía (D-35, pendiente de aprobación): tareas nuevas F4-E3 a F4-E11, F4-B2, F4-C2 y F4-C3. La tabla de puntajes sale de la hoja de ruta. | encabezado, 3, 5, 6, 8 | `@dimidio6` |

## 10. Registro de cierres

| Fase | Cerrada el | Notas |
|---|---|---|
| 0 | 2026-11-14 | Abierta la fase 1 por decisión del líder. Siguen abiertas, sin bloquear a nadie: F0-A3 (#5), F0-B1 (#6), F0-B2 (#7), F0-C1 (#8), F0-D1 (#9), F0-F1 (#11) y F0-X1 (#12). F0-E1 (#10) se cierra junto con F1-E1. |
| 1 | 2026-11-14 | Se abrió la fase 2 con F1 en paralelo (v1.7). |
| 2 | 2026-11-14 | Humo 3 de 3 contra producción y las tres piezas en Cloudflare Pages; flujo área → focos → calendario → CSV verificado por `@dimidio6` (#112). Los datos todavía son las muestras (`datos-muestras-2`): los reales llegan con el histórico de FIRMS (#6). Cierra `@cosmosnehu77` antes de pasar el mando (D-28). |
| 3 | 2026-11-14 | Terminadas las tareas de los carriles A a E. Sin guion: el guion y el video quedan para el final (D-32). Siguen en la fase 4 #169 y #170 (D-31). Pendiente: los cron de `worker-vivo.yml` y `avisos.yml` no disparan; se corren a mano. |
| 4 | | |
| 5 (opcional) | | |

---

**Referencias:** plan técnico con fuentes en https://claude.ai/artifact/CvnydKNz3tdZLTwos2RXFa · diseño de la mascota en
https://claude.ai/artifact/Wj82ew58QGwS7F4UWa1E6K · plantilla de coordinación en https://github.com/cosmosnehu77/tabla-agentes.
Si el plan técnico y este documento no coinciden, vale este documento.
