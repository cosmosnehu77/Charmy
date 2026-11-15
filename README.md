<div align="center">

<img src="docs/charmy/base-saluda.svg" alt="Charmy, la vizcacha de fuego, saludando" width="140">

# Charmy

**Más de veinte años de focos de calor vistos desde el espacio, en un solo mapa.**

Charmy une los focos de calor de MODIS y VIIRS en una sola serie continua desde 2001 y la muestra como calendario de
quema sobre un mapa 2D y 3D de Argentina y Chile. Una vizcacha de fuego guía al público; el modo experto sirve a
brigadas e investigadores.

[**Abrir la app**](https://app.charmy.earth) · [Landing](https://charmy.earth) · [Jugar a Charmy Brigada](https://juego.charmy.earth) · [API](https://api.charmy.earth/api/v1/health) · [Método](docs/metodologia/README.md)

NASA Space Apps Challenge 2026 · Desafío *Harmonization of MODIS and VIIRS Hot Spots* · Comodoro Rivadavia, Argentina

**Español** · [English](README.en.md)

</div>

![La landing de Charmy: «Cuando nuestro sur está en peligro», con los focos de calor sobre el Cono Sur](docs/capturas/es/landing.jpg)

## El problema

Los satélites cambian, pero el fuego hay que poder compararlo año contra año. MODIS observa desde el 2000 con píxeles de
1 km; VIIRS, desde 2012, con píxeles de 375 m. VIIRS ve muchos más focos, así que una serie que pasa de un sensor al
otro parece mostrar más fuego aunque no lo haya. Sin armonizar, el sensor de origen cambia la lectura de tendencias y
anomalías.

## Lo que hace Charmy

- **Una sola serie, de 2001 a hoy.** 17,5 millones de focos de cinco satélites llevados a una misma escala, con el
  intervalo de confianza de cada mes convertido y el sensor del que salió.
- **Un calendario de quema** por mes y por año, para cualquier provincia, localidad, rectángulo o polígono que dibujes,
  con la anomalía contra la mediana histórica y una vista de estadísticas: cada año, la temporada, el último año contra
  los anteriores y de qué sensor sale cada mes.
- **Un mapa 3D** de 39 provincias y regiones de Argentina y Chile en el que la altura es el fuego: focos, intensidad,
  anomalía, predicción y focos en vivo.
- **Focos en vivo** de NOAA-20 y NOAA-21, verificados con varias señales (confianza del satélite, fuentes fijas,
  noticias y reportes de la gente), con el tiempo y la imagen Sentinel-2 del lugar como contexto.
- **Predicción de uno a seis meses**: la probabilidad de fuego de cada cuadrado de 11 km, por provincia o para el área
  que dibujes. Se publica solo porque le gana a la climatología en meses que el modelo no vio.
- **Avisos** en tres canales de Telegram ([Comarca Andina](https://t.me/+29kxDW2TpcVlMDY5),
  [Norte de Salta](https://t.me/+ABJdg2Zmsko4OTcx) e [Impenetrable chaqueño](https://t.me/+5kIYhu5NmCthMmVh)), un feed
  CAP 1.2 para entidades y reportes de foco sin crear cuenta.
- **Descarga en CSV** con el mismo encabezado de FIRMS.
- **Charmy Brigada**, un juego para aprender cómo se detecta y se combate un foco.
- En **español e inglés**, con tema claro y oscuro y rampas de color aptas para daltonismo.

## Charmy, la vizcacha de fuego

Charmy acompaña cada parte del producto y se viste para cada trabajo: saluda en la landing, guía los recorridos, se
pone la bata para el modo experto, el casco para los avisos y las antiparras para el avión hidrante del juego. Habla
corto, en segunda persona y sin alarmismo, y siempre recuerda a qué número llamar.

<table>
  <tr>
    <td align="center"><img src="docs/charmy/base-saluda.svg" width="120" alt="Charmy saludando"><br><sub><b>Base</b><br>la landing</sub></td>
    <td align="center"><img src="docs/charmy/guia-explica.svg" width="120" alt="Charmy de guía explicando"><br><sub><b>Guía</b><br>los recorridos</sub></td>
    <td align="center"><img src="docs/charmy/cientifica-explica.svg" width="120" alt="Charmy de científica explicando"><br><sub><b>Científica</b><br>el modo experto</sub></td>
    <td align="center"><img src="docs/charmy/bombero-alerta.svg" width="120" alt="Charmy de bombero en alerta"><br><sub><b>Bombero</b><br>los avisos y el juego</sub></td>
    <td align="center"><img src="docs/charmy/piloto-festeja.svg" width="120" alt="Charmy de piloto festejando"><br><sub><b>Piloto</b><br>el avión hidrante</sub></td>
  </tr>
</table>

Y cambia de ánimo según lo que pasa en la pantalla:

<table>
  <tr>
    <td align="center"><img src="docs/charmy/base-idle.svg" width="88" alt="Charmy esperando"><br><sub>espera</sub></td>
    <td align="center"><img src="docs/charmy/base-saluda.svg" width="88" alt="Charmy saludando"><br><sub>saluda</sub></td>
    <td align="center"><img src="docs/charmy/base-explica.svg" width="88" alt="Charmy explicando"><br><sub>explica</sub></td>
    <td align="center"><img src="docs/charmy/base-pensando.svg" width="88" alt="Charmy pensando"><br><sub>piensa</sub></td>
    <td align="center"><img src="docs/charmy/base-alerta.svg" width="88" alt="Charmy en alerta"><br><sub>alerta</sub></td>
    <td align="center"><img src="docs/charmy/base-festeja.svg" width="88" alt="Charmy festejando"><br><sub>festeja</sub></td>
  </tr>
</table>

Todas estas imágenes las dibuja el mismo componente que usa la app ([`packages/charmy/`](packages/charmy/)): un solo
dibujo, cinco vestuarios y seis estados, sin copias hechas a mano.

## Recorrido

### El mapa: la altura es el fuego

Cada provincia sube según los días de fuego del último mes cerrado. El ranking de la izquierda y la leyenda de la
derecha explican lo que se ve; Charmy ofrece un recorrido guiado en cada pestaña.

![Mapa 3D de Argentina y Chile: el norte sube en rojo con más fuego, la Patagonia queda baja](docs/capturas/es/app.jpg)

### La ficha de cada provincia

Tocás una provincia y Charmy la resume: fuego del mes, intensidad en megavatios, comparación con lo normal, el último
mes día por día, su puesto entre las 39 regiones y la temporada típica.

![Ficha de Santa Fe: 339 días de fuego en octubre, 2.619 MW, bastante por debajo de lo normal (740 es lo habitual en octubre) y el último mes día por día](docs/capturas/es/ficha.jpg)

### El modo experto y el calendario de quema

Elegís un área (rectángulo, polígono, localidad o punto), las fechas y los filtros de sensor y confianza. Charmy
agrupa los focos sobre el mapa en 3D (o en 2D, más liviano), que se inclina y se gira como cualquier mapa, y arma el
calendario de quema mes por mes:

- **Anomalía** y **Cantidad**: la grilla de años y meses, con colores aptos para daltonismo y el valor en cada casilla.
- **Estadísticas**: el total del período, el mes pico, el año con más fuego, los meses sobre lo normal y sin fuego, el
  último año contra los anteriores hasta el mismo mes, el total de cada año, la temporada y de qué sensor sale cada mes.
- El calendario se **minimiza** a una barra con el total y el mes pico cuando querés ver el mapa entero.

Se descargan los focos en CSV y GeoJSON y el calendario en CSV o como imagen. La pestaña *Lugar* trae el tiempo, la
imagen satelital y la predicción del área; *Validación* muestra qué tan bien funciona la armonización en esa región.

![Modo experto en El Bolsón: focos agrupados sobre el mapa en 3D y calendario de quema de 2022 a 2026 con anomalías](docs/capturas/es/experto.jpg)

### Predicción contra lo habitual

La altura son los cuadrados de 11 km que el modelo espera con fuego el mes que viene; el color dice si es más o menos
que lo habitual para ese mes. Cada provincia trae los próximos seis meses: los dos primeros como pronóstico y del
tercero al sexto como lo habitual ajustado, porque a ese plazo el modelo no siempre le gana a la climatología.

![Mapa de predicción: provincias en violeta (menos que lo habitual), claro (lo de siempre) y naranja (más)](docs/capturas/es/prediccion.jpg)

### En vivo

Los focos de las últimas 6, 24 o 48 horas, por satélite, agrupados sobre el mapa 3D, donde cada provincia sube según
sus focos, con los controles para acercar, alejar, mirar al norte y pasar a 2D. Cada uno trae su intensidad y su estado
de verificación: confirmado, probable, sin confirmar o probable fuente fija.

![Pestaña En vivo: 1.015 focos en las últimas 48 horas agrupados sobre el mapa 3D, provincias con más focos y estados de verificación](docs/capturas/es/vivo.jpg)

### Charmy Brigada

Un juego corto sobre una maqueta 3D de Sudamérica. Pasa el satélite, aparecen focos, y hay que verificarlos y
apagarlos con agua, aviones, cortafuegos y brigadas, mirando el viento y recargando en lagos y represas.

<p>
  <img src="docs/capturas/es/juego.jpg" alt="Pantalla de inicio de Charmy Brigada: Charmy bombero junto a las llamas" width="49%">
  <img src="docs/capturas/es/juego-partida.jpg" alt="Una partida de Charmy Brigada: focos sobre la maqueta 3D, tanque de agua, viento y la pasada de NOAA-20" width="49%">
</p>

## Por qué podés confiar en los números

### Un método simple y medido

Charmy cuenta **días de fuego** (días-celda con fuego): una celda de 0,1° (unos 11 km) que tuvo al menos un foco en un
día cuenta 1.
Así no importa cuántos píxeles ni cuántas pasadas de satélite vieron ese fuego, y la diferencia de resolución entre
sensores se achica. Lo que queda se corrige con una recta en escala logarítmica, aprendida región por región y mes por
mes en los años en que los sensores coinciden.

Antes de contar se sacan las **fuentes fijas** (370 celdas de industria y antorchas de gas) y los focos de baja
confianza. Ningún paso usa IA: son reglas fijas y regresiones que cualquiera puede revisar.

### Validación cruzada

Para cada año de solape se calibra sin ese año y se predicen sus meses:

| Conversión | r² (mediana entre regiones) | Sesgo relativo | Error medio absoluto |
|---|---|---|---|
| MODIS → VIIRS S-NPP | **0,90** | −4,6 % | 10,5 días de fuego por mes |
| NOAA-20 → VIIRS S-NPP | **0,94** | −0,7 % | 7,3 días de fuego por mes |

### Contra los incendios que todos recordamos

| Evento documentado | Qué muestra Charmy |
|---|---|
| Corrientes, enero y febrero de 2022 (934.238 ha según el INTA) | Unas 10 y 6 veces la mediana de esos meses. Puestos 10 y 9 entre 310 meses |
| Delta del Paraná, agosto de 2020 | 4,8 veces la mediana: el segundo mes más alto de Entre Ríos |
| Chile, febrero de 2023 (428.343 ha según CONAF) | El mes más alto de Biobío en toda la serie |
| Chile, temporada 2023-2024 (83 % menos superficie según CONAF) | La temporada más baja de Chile en la serie: puesto 24 de 24 |

Charmy mide actividad de quema, no hectáreas, y lo dice: un incendio enorme y continuo puede sumar menos días de fuego que
muchas quemas agrícolas chicas. Los límites del método están escritos en [`docs/metodologia/`](docs/metodologia/README.md).

### Una predicción que tuvo que ganarse el lugar

Ningún modelo se publica si no le gana a la climatología (la frecuencia histórica de cada lugar en cada mes) en meses
que no vio al entrenar (D-10).

La app muestra **`charmy-eventos-v1`**: la probabilidad de que cada cuadrado de 0,1° tenga un evento de fuego en un mes,
de uno a seis meses adelante, con un LightGBM por plazo y calibración isotónica. Usa solo la historia de focos de los
cinco satélites; el clima de NASA POWER se probó y no aportó, así que quedó afuera. En 24 meses nunca vistos (noviembre
de 2024 a octubre de 2026):

| Plazo | AUC del modelo | AUC de la climatología | Mejora del error (Brier) | Peor año |
|---|---|---|---|---|
| 1 mes | **0,92** | 0,86 | **13 %** | 9 % |
| 2 meses | **0,92** | 0,86 | **12 %** | −1 % |
| 3 a 6 meses | 0,91 | 0,86 | 8 % a 10 % | −4 % a −7 % |

A tres meses o más hubo años peores que la climatología, así que esos plazos se muestran como lo habitual ajustado y
no como pronóstico. El modelo corre como servicio aparte y lo llama solo la API, con un token (D-40). Detalle en
[`services/prediccion/entrenamiento/`](services/prediccion/entrenamiento/REPORTE.md).

La API también publica una serie por región con LightGBM y cuantiles p10–p90 (`/forecast`): a un mes, el desvío de
Poisson baja **35 %** contra la climatología. TimesFM 2.5 y 3.0 se probaron y no se publican: mejoraban el error medio
prediciendo casi siempre cero.

### En vivo, sin que la IA decida sola

Cada foco en vivo se cruza con varias señales: la confianza del satélite, si cae en una fuente fija, las noticias de
su provincia y los reportes de la gente cerca. Un modelo de lenguaje (Nemotron 3.5 Bolt, de NVIDIA) solo etiqueta
titulares, y una noticia apoya un foco solo si habla de fuego en vegetación o al aire libre en esa provincia: casas,
autos o explosiones no cuentan. Medido con titulares reales, acertó 36 de 36. El veredicto sale de reglas fijas sobre
todas las señales, y la falta de noticias nunca convierte un foco en falso (D-09).
Para entender el lugar, Charmy suma el viento, la humedad y el riesgo de incendio de Meteomatics y la imagen
Sentinel-2 más despejada de Copernicus.
Si una fuente se cae, esa parte se muestra como no disponible y el resto sigue andando.

## Cómo está hecho

```mermaid
flowchart LR
  FIRMS[(NASA FIRMS<br/>MODIS y VIIRS)] --> P[pipeline<br/>Polars · DuckDB]
  P -- Parquet en releases --> API[API<br/>FastAPI · DuckDB]
  FIRMS -- NOAA-20 y NOAA-21 --> W[worker<br/>en vivo y verificación]
  W --> DB[(Postgres)]
  DB --> API
  CTX[contexto<br/>Meteomatics · Copernicus] --> API
  PRED[predicción<br/>charmy-eventos-v1 · LightGBM] --> API
  API --> APP[app<br/>React · MapLibre]
  API --> AL[avisos<br/>Telegram · CAP 1.2]
  LAND[landing<br/>Astro · GSAP] --> APP
  JUEGO[juego<br/>PixiJS]
```

| Capa | Tecnologías |
|---|---|
| Datos | Python 3.12, Polars, DuckDB, GeoPandas, Parquet publicado en releases de GitHub con `manifest.json` y `sha256` |
| API | FastAPI, DuckDB sobre Parquet por HTTPS, Postgres (Supabase), contrato OpenAPI 3.1 con mock y colección de Postman |
| App | Vite, React, TypeScript, Tailwind v4, TanStack Query, Zustand, MapLibre GL, Terra Draw, Turf, Observable Plot |
| Landing y juego | Astro, GSAP, Lenis; PixiJS 8 con sonidos de Web Audio |
| Predicción | `charmy-eventos-v1`: un LightGBM por plazo con calibración isotónica, en un servicio FastAPI aparte en Render; LightGBM con cuantiles p10–p90 por región |
| Avisos | Bot de Telegram (aiogram) con un canal por zona y feed OASIS CAP 1.2 |
| Plataforma | Monorepo pnpm + Turborepo y uv, GitHub Actions, Cloudflare Pages, Docker en Render |

Las claves de FIRMS, Meteomatics y Copernicus viven solo en el servidor, con caché y dentro de los límites de cada
servicio. El navegador nunca las ve.

## Cinco personas, cinco agentes, 36 horas

Charmy se hizo en el fin de semana de la competencia con un equipo de cinco personas, cada una con su agente de
programación (Claude Code y otros). Los agentes se coordinan en un [tablero](https://github.com/cosmosnehu77/Charmy/issues/1):
un issue fijado donde publican qué cambió, piden carpetas ajenas y anuncian contratos. Cada persona tiene un carril de
carpetas propio, cada tarea es un issue y cada cambio entra por un PR.

- **Más de 210 PR fusionados** y más de 170 issues, todos atados a un requisito de [`REQUISITOS.md`](REQUISITOS.md) y a
  una tarea de [`PLAN.md`](PLAN.md).
- **Cerca de 800 pruebas automáticas** en 88 archivos. Terminado es probado: cada commit corre las pruebas de lo que toca
  y nada entra a `main` con el CI en rojo ([`docs/PRUEBAS.md`](docs/PRUEBAS.md)).
- **Ninguna prueba llama a un servicio externo**: se usan respuestas grabadas y se prueban también las fallas (tiempo
  agotado, 429, 5xx).
- **Repo público desde el primer commit**, sin una sola clave en el historial.
- **Relevo** cuando una persona se queda sin uso de tokens: el trabajo pasa a otra sin perderse
  ([`AGENTS.md`](AGENTS.md), sección 7).

La plantilla de coordinación es abierta: [tabla-agentes](https://github.com/cosmosnehu77/tabla-agentes).

### El equipo

| | Persona | Carril |
|---|---|---|
| <img src="apps/landing/public/equipo/cosmosnehu77.jpg" width="48" alt=""> | Nehuén ([@cosmosnehu77](https://github.com/cosmosnehu77)) | Líder: plataforma, despliegue y coordinación |
| <img src="apps/landing/public/equipo/leonelcnr.jpg" width="48" alt=""> | Leonel ([@leonelcnr](https://github.com/leonelcnr)) | Datos: pipeline, armonización y método |
| <img src="apps/landing/public/equipo/BrunoAguinaga0.jpg" width="48" alt=""> | Bruno ([@BrunoAguinaga0](https://github.com/BrunoAguinaga0)) | Backend: API y focos en vivo |
| <img src="apps/landing/public/equipo/daniace.jpg" width="48" alt=""> | Daniel ([@daniace](https://github.com/daniace)) | App, landing y juego |
| <img src="apps/landing/public/equipo/dimidio6.jpg" width="48" alt=""> | Angelo ([@dimidio6](https://github.com/dimidio6)) | Avisos y predicción |

## Qué hay en el repo

| Carpeta | Qué es |
|---|---|
| [`apps/app/`](apps/app/) | La aplicación: mapa 2D y 3D, calendario, predicción, en vivo y modo experto. |
| [`apps/landing/`](apps/landing/) | La landing. |
| [`apps/juego/`](apps/juego/) | Charmy Brigada. |
| [`packages/charmy/`](packages/charmy/) | El componente `<Charmy mood outfit size say />`, la única forma de mostrar a Charmy. |
| [`packages/ui/`](packages/ui/) | Colores, tipografías y rampas aptas para daltonismo. |
| [`packages/contracts/api/`](packages/contracts/api/) | Contrato OpenAPI de la API, su mock y la colección de Postman. |
| [`packages/contracts/datos/`](packages/contracts/datos/) | Esquema de los datos (focos, calendario, series, métricas y predicción). |
| [`services/pipeline/`](services/pipeline/) | Carga de FIRMS a Parquet, armonización, calendario y métricas. |
| [`services/api/`](services/api/) | La API. |
| [`services/worker/`](services/worker/) | Focos recientes de NOAA-20 y NOAA-21 y su verificación con varias señales. |
| [`services/contexto/`](services/contexto/) | Tiempo (Meteomatics) e imagen satelital (Copernicus) de un foco. |
| [`services/prediccion/`](services/prediccion/) | Modelo de predicción y su entrenamiento. |
| [`services/alertas/`](services/alertas/) | Avisos por Telegram y feed CAP 1.2. |
| [`data/muestras/`](data/muestras/) | Muestras chicas con la forma de los datos reales. Los datos completos se publican fuera del repo. |
| [`infra/`](infra/) | Publicación de los datos y prueba de humo. |

| Documento | Qué dice |
|---|---|
| [`REQUISITOS.md`](REQUISITOS.md) | Qué tiene que hacer Charmy y para quién. |
| [`PLAN.md`](PLAN.md) | Cómo, quién y cuándo: tecnologías, decisiones, fases y tareas. |
| [`docs/metodologia/`](docs/metodologia/README.md) | Armonización, validación, contraste y supuestos. |
| [`AGENTS.md`](AGENTS.md) y [`CLAUDE.md`](CLAUDE.md) | Reglas que siguen los agentes del equipo. |
| [`docs/PRUEBAS.md`](docs/PRUEBAS.md) | Cuándo una tarea está terminada. |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Modelo de seguridad del tablero de agentes. |
| [`docs/charmy-base/`](docs/charmy-base/) | Diseño aprobado de la mascota. |
| [`docs/charmy/`](docs/charmy/) | Las imágenes de Charmy de este README, generadas con el componente (`node docs/charmy/generar.mjs`). |

## Correrlo en local

Requisitos: Node 22 o más, pnpm, uv y Docker.

```bash
pnpm install
uv sync --all-packages
cp .env.example .env
pnpm dev --filter @charmy/app
```

En desarrollo la app usa el mock del contrato (`apps/app/.env.development`), que se levanta con
`pnpm --filter @charmy/contracts-api mock`. Para usar la API local o la de producción, poné `VITE_API_URL` (con
`/api/v1`) en `apps/app/.env.development.local`.

```bash
pnpm check                 # tipos, pruebas y compilación de todo el monorepo
uv run pytest services infra
```

La API corre en un plan gratuito que se duerme: el primer pedido puede tardar cerca de un minuto.

**Datos.** Los datos precalculados se publican como versiones (releases) de GitHub con un `manifest.json` que lista cada
archivo con su tamaño y su `sha256` ([`infra/README.md`](infra/README.md)). Las versiones no se pisan.

**Prueba de humo.** Comprueba que una API desplegada cumple el contrato (`/health`, `/calendar` y el CSV de
`/hotspots`). Corre en el CI contra el mock y después de cada despliegue contra producción. A mano:

```bash
uv run --package humo python -m humo https://<host>/api/v1
```

**Sumarse al equipo.** `gh auth login`, clonar el repo y correr `tools/board check`: tiene que mostrar tu login en la
lista de permitidos. Las claves de `.env` se piden al líder por un canal privado y nunca se suben al repo.

## Uso de inteligencia artificial

- **Datos y armonización:** sin IA. Son reglas fijas y regresiones lineales ([método](docs/metodologia/README.md)).
- **Predicción:** aprendizaje automático (LightGBM, en `charmy-eventos-v1` y en la serie por región). Solo se muestra si
  supera a la climatología en meses de prueba que no vio (D-10, D-40).
- **Verificación de focos en vivo:** un modelo de lenguaje (Nemotron 3.5 Bolt, de NVIDIA) solo etiqueta titulares de
  noticias.
  El veredicto sale de reglas fijas sobre varias señales (D-09).
- **Desarrollo:** el código y la documentación se escribieron con agentes de programación (Claude Code y otros),
  coordinados por el tablero y revisados por las personas del equipo. Toda funcionalidad entra con sus pruebas.

## Datos y créditos

Focos de calor: [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (MODIS y VIIRS). Tiempo:
[Meteomatics](https://www.meteomatics.com/). Imagen: contiene datos modificados de Copernicus Sentinel
([Copernicus Data Space](https://dataspace.copernicus.eu/)). Límites: [Natural Earth](https://www.naturalearthdata.com/).
Localidades: API Georef de datos.gob.ar. Mapa base: OpenFreeMap, OpenMapTiles y OpenStreetMap. Condiciones de uso de
cada fuente: [`PLAN.md`](PLAN.md), sección 1.1.

> **Charmy no reemplaza a los servicios de emergencia.** Si ves fuego, llamá al **100** (bomberos, Argentina) o al
> **132** (bomberos, Chile).
