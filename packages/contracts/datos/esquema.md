# Esquema de datos

Contrato del carril B (`@leonelcnr`). Lo consumen la API (C), la app (D) y el juego (E). Los datos reales y las
muestras de `data/muestras/` tienen exactamente esta forma. Un cambio se anuncia en el tablero (#1).

Los nombres de campo siguen al OpenAPI (`docs/repo-inicial/openapi.yaml`), así la API no tiene que renombrar nada.

| Tabla | Estado | La escribe |
|---|---|---|
| `focos` | **estable** | F1-B1, `services/pipeline` (`pipeline.firms`) |
| `serie` | borrador | F2-B1 |
| `calendario` | borrador | F2-B2 |
| `metricas` | borrador | F2-B2 |

## Grilla

Celdas regulares de 0,1°. `cell_id` es la esquina suroeste con un decimal, `"<lat>_<lon>"`, por ejemplo
`"-45.4_-71.3"` para un foco en lat −45,37, lon −71,22. Es la unidad de los días-celda (D-02).

## `focos`

Un foco de FIRMS por fila, normalizado, **sin filtrar**: los filtros de D-04 (`type = 0`, confianza) los aplica la
armonización. Parquet particionado por Hive: `focos/satellite=<satélite>/year=<año>/*.parquet`.

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
| `satellite`, `year` | partición | `year` es el año UTC de `acq_datetime` |

Clave única: (`satellite`, `acq_datetime`, `latitude`, `longitude`). Si un foco llega por SP y por NRT, queda el de SP.

En GeoJSON (`/hotspots`) cada foco es un `Feature` de tipo `Point` con `[longitude, latitude]` y el resto de las
columnas en `properties`.

## `serie` (borrador, F2-B1)

Días-celda con fuego por región y mes, en "equivalente VIIRS" (D-02, D-03).

| Columna | Tipo | Descripción |
|---|---|---|
| `region` | string | Identificador de la región de calibración |
| `year`, `month` | int16, int8 | Período |
| `source` | string | `harmonized`, `modis`, `viirs` |
| `value` | float64 | Días-celda con fuego |
| `lower`, `upper` | float64 | Intervalo de incertidumbre (RF-ARM-03) |
| `origin` | string | `viirs_medido` o `modis_convertido` |

## `calendario` (borrador, F2-B2)

Lo de `serie` más la comparación con la historia (RF-CAL-02). Coincide con `Calendar.cells` del OpenAPI.

| Columna | Tipo | Descripción |
|---|---|---|
| `year`, `month`, `value`, `lower`, `upper`, `origin` | | Como en `serie` |
| `median` | float64 | Mediana histórica del mismo mes |
| `percentile` | float64 | Posición del valor en la historia de ese mes, 0–100 |

## `metricas` (borrador, F2-B2)

Validación dejando un año afuera, por región (RF-ARM-04). Coincide con `/harmonization/metrics`.

| Columna | Tipo | Descripción |
|---|---|---|
| `region` | string | Región de calibración |
| `pair` | string | Tramo de la cadena: `modis_snpp` o `noaa20_snpp` |
| `r2`, `bias`, `mae` | float64 | Métricas sobre los años dejados afuera |
| `n_months` | int32 | Meses de solape usados |
