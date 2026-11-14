# Método de Charmy: armonización, validación y supuestos

Este documento explica cómo Charmy convierte los focos de calor de MODIS y VIIRS en una sola serie mensual, cómo se
comprobó que funciona y qué supone. Cubre RNF-07 (transparencia), RF-ARM-04 (evidencia de la armonización),
RF-CTX-06 (contraste con estadísticas externas) y RNF-13 (fuentes usadas según sus condiciones).

Las cifras salen de los datos publicados `datos-2026-11-14b`
([manifiesto](https://github.com/cosmosnehu77/Charmy/releases/download/datos-2026-11-14b/manifest.json)). El código
está en `services/pipeline/` y el formato de cada tabla, en `packages/contracts/datos/esquema.md`.

## En una frase

Charmy cuenta **días-celda con fuego** (una celda de 0,1° que tuvo al menos un foco en un día cuenta 1) y lleva todos
los sensores a la escala de VIIRS S-NPP con una recta aprendida en los años en que los sensores coinciden.

## Fuentes

| Fuente | Qué se usa | Cómo se accede | Condiciones |
|---|---|---|---|
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | Focos de calor históricos: MODIS C6.1 (Terra y Aqua, desde 11/2000), VIIRS S-NPP (desde 01/2012), NOAA-20 (desde 04/2018) y NOAA-21 (desde 2023). Productos estándar (SP) y, para lo más reciente, tiempo casi real (NRT) | Descarga del archivo de Argentina y Chile con la clave del equipo, solo desde el servidor | Datos abiertos de NASA; se cita la fuente. La clave nunca sale del servidor |
| [Natural Earth](https://www.naturalearthdata.com/) | Límites de las 39 provincias y regiones de Argentina y Chile | Archivo descargado una vez | Dominio público |
| [Meteomatics](https://www.meteomatics.com/) | Viento, temperatura, humedad e índice de riesgo de incendio en el lugar de un foco (`/weather`) | API, solo desde el servidor, con caché por celda y media hora (límite de 1.000 pedidos por día) | Cuenta del evento, vence el 22/11/2026. La copia de respaldo no se publica (D-26) |
| [Copernicus Data Space](https://dataspace.copernicus.eu/) | Imagen Sentinel-2 L2A del lugar de un foco (`/imagery`) | APIs Catalog y Process, solo desde el servidor, con caché de imágenes | Cada imagen lleva la atribución "Contiene datos modificados de Copernicus Sentinel" |
| [currentwildfires.com](https://currentwildfires.com/) | Referencia para comparar a mano | No se lee de forma automática | Sin API ni licencia visible: solo se cita y se enlaza (D-20) |

S-NPP dejó de publicar datos nuevos el 2/11/2026. Los focos en vivo de la API salen solo de NOAA-20 y NOAA-21.

## Armonización paso a paso

1. **Carga** (`pipeline.firms`). Se leen 17,5 millones de focos. Si un foco está en SP y en NRT, gana SP. Cada foco
   recibe su `cell_id`: la esquina suroeste de su celda de 0,1° (`floor(valor × 10) / 10`).
2. **Fuentes fijas** (`pipeline.fuentes_fijas`, RF-ARM-05). Una celda es fuente fija si:
    - tiene un punto de unos 1 km (0,01°) con focos VIIRS en 6 días o más por año, en 10 o más meses distintos del año y
      en 5 o más años; o
    - FIRMS marca como estáticos (`type` > 0) a la mayoría de sus focos VIIRS.

   Con el histórico completo quedan 370 celdas: sobre todo industria y antorchas de gas. Pedir 10 meses distintos deja
   afuera la quema agrícola, que se repite cada año pero en temporada.
3. **Filtros (D-04).** Solo focos de vegetación (`type` = 0; los NRT no traen `type` y se conservan), MODIS con
   confianza de 30 o más y VIIRS con confianza nominal o alta. Todo foco en una celda de fuente fija queda afuera, en SP
   y en NRT por igual.
4. **Días-celda (D-02).** Por sensor, región y mes se cuentan las celdas distintas con fuego de cada día y se suman en
   el mes. Así no importa cuántos focos ni cuántas pasadas de satélite tuvo una celda en un día.
5. **Meses completos.** Un mes cuenta para un sensor solo si ese sensor tuvo focos en al menos el 90 % de los días del
   mes, en toda la zona. Como en Argentina y Chile hay focos todos los días, un mes con menos es un corte del satélite o
   un mes a medias (por ejemplo, noviembre de 2026 para S-NPP).
6. **Calibración en cadena (D-03).** Para cada región y mes del año se ajusta, por mínimos cuadrados, una recta en
   escala logarítmica sobre los meses con fuego en los dos sensores:

   ```
   ln(S-NPP) = a + b · ln(otro sensor)
   ```

   Hay dos rectas: MODIS → S-NPP (solape 2012–2026) y NOAA-20 → S-NPP (solape 2018–2026). Si una región y mes tiene
   menos de 5 meses para ajustar, se usa la recta de la región entera, y si tampoco alcanza, la de todo el conjunto.
   Un cero sigue siendo cero.
7. **Serie armonizada.** Cada mes sale del mejor sensor que lo cubrió entero, en este orden: S-NPP medido, NOAA-20
   convertido y MODIS convertido. Cada valor convertido lleva un intervalo del 90 % (`lower`, `upper`), calculado con el
   error de la recta, y su origen (`viirs_medido`, `viirs_convertido` o `modis_convertido`; RF-ARM-03). La serie se
   publica junto con cada sensor por separado, sin convertir (RF-ARM-04).
8. **Calendario y anomalías (RF-CAL-02).** Cada mes se compara con la mediana de ese mes en los años anteriores al
   último. La anomalía es la diferencia; el percentil ubica el mes entre todos los años. El año en curso se compara con
   su historia sin entrar en ella.

## Validación

Para cada año de solape se calibra sin ese año y se predicen sus meses. Las métricas comparan lo predicho con lo que
midió S-NPP, por región (`metricas.parquet`; la app las muestra en el modo experto).

| Conversión | r² (mediana entre regiones) | Sesgo relativo (mediana) | Error medio absoluto (mediana) | Meses por región (mediana) |
|---|---|---|---|---|
| MODIS → S-NPP | 0,90 | −4,6 % | 10,5 días-celda por mes | 173 |
| NOAA-20 → S-NPP | 0,94 | −0,7 % | 7,3 días-celda por mes | 98 |

La conversión desde NOAA-20 es mejor porque es el mismo instrumento (VIIRS) en otro satélite. La de MODIS tiene que
cubrir una diferencia de resolución: píxeles de 1 km contra 375 m.

## Contraste con estadísticas externas (RF-CTX-06)

Las estadísticas oficiales miden **superficie quemada** en hectáreas; Charmy mide **actividad de quema** en días-celda.
No son la misma magnitud, así que el chequeo no busca que coincidan los números. Busca que los grandes incendios
documentados aparezcan donde y cuando corresponde, y que los años malos y buenos vayan en la misma dirección.

| Evento documentado | Cifra externa | Qué muestra Charmy |
|---|---|---|
| Incendios de Corrientes, enero y febrero de 2022 | 934.238 ha al 21/02/2022, según el INTA ([El Economista](https://eleconomista.com.ar/actualidad/los-incendios-corrientes-ya-quemaron-934000-hectareas-n50960), 25/02/2022) | Enero y febrero de 2022 en Corrientes (AR-W): 2.183 y 2.210 días-celda, unas 10 y 6 veces la mediana de esos meses (221 y 374). Puestos 10 y 9 entre los 310 meses de la serie |
| Delta del Paraná, 2020 | 328.000 ha a noviembre de 2020, según el Ministerio de Ambiente de Santa Fe ([La Capital](https://www.lacapital.com.ar/la-ciudad/con-el-2020-se-van-mas-300-mil-hectareas-incendiadas-el-delta-del-rio-parana-n2631286.html), 20/12/2020); agosto fue el mes con más focos | Agosto de 2020 en Entre Ríos (AR-E): 1.773 días-celda, 4,8 veces la mediana. Es el segundo mes más alto de la serie en esa provincia |
| Temporada 2022-2023 en Chile (incendios de febrero de 2023) | 428.343 ha y 6.797 incendios ([CONAF](https://www.conaf.cl/conaf-entrego-balance-de-incendios-temporada-2023-2024/), 26/04/2024) | Febrero de 2023 en Biobío (CL-BI) es el mes más alto de sus 310. La Araucanía y Ñuble también quedan en el percentil 98. La temporada es la tercera más alta de Chile en la serie (de 24) |
| Temporada 2023-2024 en Chile | 71.923 ha, 83 % menos que la anterior ([CONAF](https://www.conaf.cl/conaf-entrego-balance-de-incendios-temporada-2023-2024/)) | Es la temporada más baja de Chile en la serie (puesto 24 de 24) |
| "Tormenta de fuego" de enero de 2017 en Chile central | La temporada 2016-2017 es la de mayor superficie afectada registrada en Chile | Enero de 2017 en Maule (CL-ML) y O'Higgins (CL-LI): puestos 3 y 5 de 310 en cada región |

**Lo que el contraste deja ver:**

- Los grandes incendios aparecen como anomalías fuertes en su región y su mes. En los cuatro eventos el valor queda en
  el percentil 98 de su región.
- La dirección de los años coincide en el caso más claro: para CONAF, 2023-2024 tuvo 83 % menos superficie que la
  temporada anterior, y en Charmy es la temporada más baja.
- **El tamaño no coincide.** La temporada 2016-2017, la de mayor superficie en Chile, queda séptima en días-celda.
  Un incendio enorme y continuo ocupa muchas hectáreas pero relativamente pocos días-celda, mientras que la quema
  agrícola, chica y repetida, suma muchos. Por eso Charmy habla de actividad de quema y no de hectáreas.
- Las cifras externas de 2022 y 2020 son de la prensa que cita al INTA y al Ministerio de Ambiente de Santa Fe; no se
  encontró el documento original. La comparación con currentwildfires.com es manual y queda pendiente de anotar acá.

## Supuestos y límites

- **Un foco no es un incendio.** Es un píxel más caliente que su entorno en el momento de la pasada. Una quema chica
  puede no verse; un incendio grande genera muchos focos.
- **La unidad atenúa, pero no borra, la diferencia de resolución.** Una celda de 0,1° (unos 11 km) contiene muchos
  píxeles de MODIS y de VIIRS: si cualquiera ve fuego, la celda cuenta. La recta corrige lo que queda.
- **La relación entre sensores es estable en el tiempo.** Se ajusta en 2012–2026 y se aplica a 2001–2011 con MODIS. Si
  la relación cambió (por la degradación de Terra o el cambio de órbita), la serie antigua arrastra ese error.
- **Regiones con poco fuego** usan rectas más generales y tienen intervalos más anchos.
- **Huecos.** Junio de 2001 y marzo de 2002 no tienen ningún sensor completo y quedan sin valor armonizado.
- **Fuentes fijas.** La máscara puede dejar afuera una quema agrícola muy constante o dejar adentro una fuente
  industrial nueva (menos de 5 años de focos).
- **Muestras.** Los valores de `data/muestras/` son de ejemplo y llevan `provisional = true`. Nunca se presentan como
  resultado.

## Predicción (RF-PRE)

Para cada celda con fuego en 5 años o más se predicen los días con fuego de los próximos meses, con un rango p10–p90.
Usa solo S-NPP, meses completos y sin fuentes fijas. El modelo es LightGBM (Poisson para el valor esperado y cuantiles
0,1 y 0,9). Se compara con la climatología (el promedio de los años anteriores) en los dos últimos años, que no vio al
entrenar. Un plazo se publica solo si mejora el error medio absoluto en más de 2 % (compuerta D-10).

| Plazo | Mejora sobre la climatología | ¿Se publica? |
|---|---|---|
| 1 mes | +8,1 % | Sí |
| 2 meses | +3,3 % | Sí |
| 3 meses | +0,4 % | No |

Según D-31, el carril E va a probar TimesFM 2.5 contra LightGBM con la misma compuerta y los mismos años de prueba.

## Uso de inteligencia artificial (RNF-07)

- **Datos y armonización:** sin IA. Son reglas fijas y regresiones lineales, descritas arriba.
- **Predicción:** un modelo de aprendizaje automático (LightGBM), que solo se muestra si supera a la climatología.
- **Verificación de focos en vivo:** un modelo de lenguaje solo etiqueta noticias; el veredicto sale de varias señales
  (D-09, `services/worker`).
- **Desarrollo:** el código y esta documentación se escribieron con agentes de IA (Claude Code y otros), revisados por
  las personas del equipo.

## Cómo reproducirlo

```bash
uv run --package pipeline python -m pipeline.firms <carpeta FIRMS> --out data/focos
uv run --package pipeline python -m pipeline.fuentes_fijas --focos data/focos --out data/pub
uv run --package pipeline python -m pipeline.armonizacion --focos data/focos --regiones data/muestras/regiones.geojson --out data/pub
uv run --package pipeline python -m pipeline.prediccion --focos data/focos --out data/pub
```

El archivo histórico se pide en el sitio de FIRMS y llega por correo como CSV. Con el histórico completo, la
armonización usa unos 950 MB de memoria y la predicción unos 4,3 GB durante 8 minutos.
