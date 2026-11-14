# Esquema de datos

Contrato del carril B (`@leonelcnr`). Lo consumen la API (C), la app (D) y el juego (E). Los datos reales y las
muestras de `data/muestras/` tienen exactamente esta forma. Un cambio se anuncia en el tablero (#1).

Los nombres de campo siguen al OpenAPI (`docs/repo-inicial/openapi.yaml`), así la API no tiene que renombrar nada.

| Tabla | Estado | La escribe |
|---|---|---|
| `focos` | **estable** | F1-B1, `services/pipeline` (`pipeline.firms`) |
| `regiones` | **estable** | F2-B1, `pipeline.regiones` |
| `serie` | **estable** | F2-B1, `pipeline.armonizacion` (en `data/muestras`, todavía provisoria) |
| `calendario` | **estable** | F2-B2, `pipeline.armonizacion` (en `data/muestras`, todavía provisorio) |
| `metricas` | **estable** | F2-B1, `pipeline.armonizacion` (en `data/muestras`, todavía provisoria) |

## Grilla

Celdas regulares de 0,1°. `cell_id` es la esquina suroeste con un decimal, `"<lat>_<lon>"`, por ejemplo
`"-45.4_-71.3"` para un foco en lat −45,37, lon −71,22. Es la unidad de los días-celda (D-02).

## `regiones`

Regiones de calibración: las 23 provincias de Argentina (la Ciudad de Buenos Aires va dentro de `AR-B`) y las 16
regiones de Chile. `regiones.geojson` es una `FeatureCollection` de polígonos con `properties`:

| Propiedad | Tipo | Descripción |
|---|---|---|
| `region` | string | Código ISO 3166-2, por ejemplo `AR-U` (Chubut) o `CL-AR` (La Araucanía). Es el `region` de las otras tablas |
| `nombre` | string | Nombre de la provincia o región |
| `pais` | string | `Argentina` o `Chile` |

Fuente: Natural Earth, admin 1 a 1:10m (dominio público), simplificada a ~1 km y sin la Antártida. Una celda
pertenece a la región que contiene su centro; las celdas en el mar o en otros países no entran en la serie.

## `focos`

Un foco de FIRMS por fila, normalizado, **sin filtrar**: los filtros de D-04 (`type = 0`, confianza) los aplica la
armonización. Un Parquet por satélite y año, `focos/<satellite>-<year>.parquet` (por ejemplo `focos/N20-2019.parquet`),
con **todas** las columnas adentro, `satellite` y `year` incluidas: cada archivo se lee solo, también aplanado en un
release y por HTTPS.

| Columna | Tipo | Descripción |
|---|---|---|
| `latitude` | float64 | Grados decimales, WGS84 |
| `longitude` | float64 | Grados decimales, WGS84 |
| `acq_datetime` | datetime (UTC) | Fecha y hora de paso del satélite (`acq_date` + `acq_time` de FIRMS) |
| `satellite` | string | `Terra`, `Aqua`, `N` (S-NPP), `N20` (NOAA-20), `N21` (NOAA-21) |
| `instrument` | string | `MODIS` o `VIIRS` |
| `confidence` | string | `low`, `nominal` o `high`. En MODIS sale de `confidence_pct`: < 30 `low`, 30–79 `nominal`, ≥ 80 `high` (los cortes de FIRMS) |
| `confidence_pct` | int8, nulo | Confianza MODIS 0–100. Nulo en VIIRS |
| `brightness` | float64 | Temperatura de brillo en K: MODIS banda 21/22 (`brightness`), VIIRS I-4 (`bright_ti4`) |
| `brightness_2` | float64 | MODIS banda 31 (`bright_t31`), VIIRS I-5 (`bright_ti5`) |
| `frp` | float64 | Potencia radiativa del fuego, MW |
| `scan`, `track` | float64 | Tamaño del píxel, km |
| `daynight` | string | `D` o `N` |
| `type` | int8, nulo | 0 vegetación, 1 volcán, 2 fuente fija en tierra, 3 en mar. Nulo en NRT, que no lo trae |
| `version` | string | Versión de la colección de FIRMS, por ejemplo `6.1NRT` o `2` |
| `product` | string | `sp` (archivo estándar) o `nrt` (casi en tiempo real) |
| `cell_id` | string | Celda de 0,1° (ver Grilla) |
| `year` | int32 | Año UTC de `acq_datetime` |

Clave única: (`satellite`, `acq_datetime`, `latitude`, `longitude`). Si un foco llega por SP y por NRT, queda el de SP.

**Id del foco** (el `id` del `Feature` en la API): `<satellite>-<acq_datetime ISO UTC>-<latitude .5f>-<longitude .5f>`,
por ejemplo `N20-2026-11-12T04:04:00Z--52.52398--70.23965`. Sale de la clave única, así que es estable mientras el
foco exista. Un foco NRT y su versión SP pueden diferir en coordenadas: el id no une NRT con histórico.

En GeoJSON (`/hotspots`) cada foco es un `Feature` de tipo `Point` con `[longitude, latitude]` y el resto de las
columnas en `properties`.

## `serie`

Días-celda con fuego por región y mes, en "equivalente VIIRS S-NPP" (D-02, D-03). Antes se filtran los focos
según D-04. Cada (celda, día UTC) cuenta una vez por sensor; Terra y Aqua cuentan juntos como MODIS. Los meses sin
fuego valen 0.

| Columna | Tipo | Descripción |
|---|---|---|
| `region` | string | Código de `regiones` |
| `year`, `month` | int16, int8 | Período |
| `source` | string | `harmonized`; `modis` (MODIS medido) o `viirs` (S-NPP medido), para verlos por separado (RF-ARM-04) |
| `value` | float64 | Días-celda con fuego |
| `lower`, `upper` | float64 | Intervalo del 90 % (RF-ARM-03). En lo medido son iguales a `value` |
| `origin` | string | `modis_convertido` (hasta 2011), `viirs_medido` (mientras hay S-NPP), `viirs_convertido` (NOAA-20 llevado a S-NPP, después de S-NPP) o `modis_medido` (solo en `source = modis`) |
| `provisional` | bool | `true` si el valor es de ejemplo y no un resultado. La app lo tiene que mostrar como tal |

## `calendario`

Lo de `serie` más la comparación con la historia (RF-CAL-02). Coincide con `Calendar.cells` del OpenAPI.

| Columna | Tipo | Descripción |
|---|---|---|
| `region`, `year`, `month`, `value`, `lower`, `upper`, `origin`, `provisional` | | Como en `serie`, solo `source = harmonized` |
| `median` | float64 | Mediana del mismo mes en los años anteriores al último de la serie. El año en curso se compara con su historia sin entrar en ella. Nula si no hay historia |
| `anomaly` | float64 | `value − median` |
| `percentile` | float64 | Posición del valor en la historia de ese mes, 0–100 |

## `metricas`

Validación dejando un año afuera, por región (RF-ARM-04): para cada año de solape se calibra sin ese año y se
predicen sus meses. Coincide con `/harmonization/metrics`.

| Columna | Tipo | Descripción |
|---|---|---|
| `region` | string | Región de calibración |
| `pair` | string | Tramo de la cadena: `modis_snpp` o `noaa20_snpp` |
| `r2` | float64, nulo | 1 − SSres/SStot de las predicciones de los años dejados afuera. Nulo si no hubo fuego en el solape (0/0) |
| `bias` | float64, nulo | Sesgo relativo: Σ(predicho − medido) / Σ medido. Nulo si no hubo fuego en el solape |
| `mae` | float64 | Error medio absoluto, en días-celda |
| `n_months` | int32 | Meses predichos en la validación |
| `provisional` | bool | Como en `serie` |

## Muestras (`data/muestras/`)

Las genera `uv run --package pipeline python -m pipeline.muestras <csv>... --out data/muestras --dia <fecha>`.

| Archivo | Contenido | ¿Real? |
|---|---|---|
| `focos.parquet` | Tabla `focos` en un solo archivo, con `satellite` y `year` como columnas | Real: FIRMS NRT del 7 al 14/11/2026, sur de Argentina y Chile |
| `focos.geojson` | Los mismos focos en GeoJSON | Real |
| `serie.parquet`, `calendario.parquet`, `metricas.parquet` | Tablas de arriba para `AR-U` (Chubut) y `CL-AR` (Araucanía) | **Provisorio**: `provisional = true` |
| `dia-juego.json` | Focos VIIRS de un día, para el juego (RF-KID-02) | Real |
| `regiones.geojson` | Tabla `regiones` (39 regiones, ~190 KB) | Real |

`dia-juego.json`:

```json
{
  "fecha": "2026-11-12",
  "fuente": "NASA FIRMS, VIIRS NOAA-20 y NOAA-21 (NRT)",
  "provisional": false,
  "bbox": [-76, -56, -62, -35],
  "focos": [{ "lat": -52.52, "lon": -70.24, "hora_utc": "04:04", "frp": 1.37, "confidence": "nominal" }]
}
```

## Publicación

`pipeline.armonizacion` deja en `--out` lo que se publica: `serie.parquet`, `calendario.parquet`,
`metricas.parquet` y `regiones.geojson`. Se suben con `publicar` (`infra/README.md`) como `datos-AAAA-MM-DD`.
