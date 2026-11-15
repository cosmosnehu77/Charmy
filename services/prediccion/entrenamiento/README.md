# Entrenamiento de `charmy-eventos-v1`

El código que entrenó el modelo binario que sirve `servir.py` (#336, D-40). Lo publicado está en el Release
[`modelo-nehuen-v1`](https://github.com/cosmosnehu77/Charmy/releases/tag/modelo-nehuen-v1). Los resultados de
esa corrida están en [`REPORTE.md`](REPORTE.md).

**Qué predice:** la probabilidad de que una celda de 0,1° tenga un **evento** en un mes, de 1 a 6 meses
adelante. Un evento es al menos un foco VIIRS S-NPP de confianza alta, o fuego en 2 o más días del mes. Hay un
LightGBM por plazo. Las variables salen solo de la historia de focos hasta el mes de emisión: S-NPP, NOAA-20,
NOAA-21 y MODIS (Terra y Aqua). El clima se probó y no aportó, así que el modelo publicado no lo usa.

## Datos

Los datos no entran al repo (`datos/` y `salidas/` están ignorados). Salen del Release de datos
`datos-2026-11-14c`:

```bash
gh release download datos-2026-11-14c -D services/prediccion/entrenamiento/datos \
  -p 'focos--*.parquet' -p entrenamiento.parquet -p fuentes_fijas.csv -p regiones.geojson
```

Pesan unos 500 MB. `entrenamiento.parquet` solo se usa para saber qué meses están completos y para la
muestra de R-B1.

## Pasos

Se corren en orden desde la raíz del repo, con `uv run --package prediccion python
services/prediccion/entrenamiento/<paso>.py`. Cada paso escribe en `salidas/`.

| Paso | Qué hace | Sale |
|---|---|---|
| `00_clima.py` | Clima mensual de NASA POWER (MERRA-2). **Opcional:** solo para el experimento con clima (`--variables sat,clima`). Llama a la API; cada respuesta queda en `datos/clima/`. | `clima.parquet` |
| `01_tabla.py` | De los focos a una tabla celda × mes por sensor, con los filtros de la armonización (D-04) y sin fuentes fijas. | `mensual-<sensor>.parquet` |
| `02_modelo.py` | Entrena un LightGBM por plazo y lo mide contra la climatología (compuerta D-10): prueba de 24 meses, año por año, calibración isotónica y κ para llevar la probabilidad a un área. | `modelo-h1..h6.txt`, `calibracion-h*.json`, `metricas.json`, `prediccion_celdas.csv` |
| `03_salidas.py` | Probabilidad por provincia y por área dibujada (`--bbox` o `--geojson`), y el reporte. | `prediccion_provincias.csv`; `REPORTE.md` en esta carpeta |
| `04_exportar.py` | Arma los archivos del Release: `modelo.json` (manifiesto con métricas, calibración, κ y SHA-256), los seis modelos y las entradas del mes de emisión. | `salidas/release/` |

`02_modelo.py --solo-metricas` mide sin guardar modelos. `--rb1` suma la medición en la prueba común de R-B1
(3.000 celdas, semilla 0). `--variables base|sat|sat,clima` elige los grupos de variables. Para publicar,
`04_exportar.py` exige que `metricas.json` sea la del modelo sin clima (`--variables sat`, que es la opción por
defecto).

Para publicar una versión nueva: se suben los archivos de `salidas/release/` a un Release nuevo, y en el
servicio se cambian `MODELO_URL` y `MODELO_SHA256` (el SHA-256 de `modelo.json`).

## Pruebas

```bash
uv run --package prediccion pytest services/prediccion/tests/test_entrenamiento.py
```

Prueban las métricas, la climatología, los vecinos, la calibración, la agregación a un área y que las
variables no miren el futuro. Usan números a mano y datos sintéticos: no leen `datos/` ni llaman a la red.
