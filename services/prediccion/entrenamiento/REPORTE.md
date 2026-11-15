# Prototipo de predicción con LightGBM: resultados

Generado por `03_salidas.py`. El evento se mide con VIIRS S-NPP 2012-2026 (filtros de la armonización).
El modelo mira además NOAA-20, NOAA-21 y MODIS desde 2001 (sin clima: se probó y no aportó), hasta el mes
de emisión.
**Es un prototipo**: los números son resultados de esta corrida de prueba, no un pronóstico publicado.

**Evento**: en una celda de 0,1° (~10 km) y un mes, al menos un foco de confianza alta, o fuego en 2 o más días.

## 1. ¿Qué tan bien predice? (24 meses nunca vistos: 2024-11 a 2026-10)

`mejora_brier` es la compuerta D-10: cuánto baja el error frente a la climatología (la frecuencia histórica
de esa celda en ese mes). Mayor que 0 es mejor que la climatología. `auc` mide si ordena bien las celdas
(0,5 es azar, 1 es perfecto).

| meses_adelante | mes_que_emitiria_hoy | auc_modelo | auc_climatologia | mejora_brier | peor_anio_2019_2026 | mejor_anio |
|---|---|---|---|---|---|---|
| 1 | 2026-11 | 0.9231 | 0.857 | 13 % | 9 % | 18 % |
| 2 | 2026-12 | 0.9164 | 0.857 | 12 % | -1 % | 17 % |
| 3 | 2027-01 | 0.9118 | 0.857 | 9 % | -4 % | 13 % |
| 4 | 2027-02 | 0.9112 | 0.857 | 10 % | -7 % | 12 % |
| 5 | 2027-03 | 0.9106 | 0.857 | 9 % | -5 % | 11 % |
| 6 | 2027-04 | 0.9098 | 0.857 | 8 % | -7 % | 10 % |

### Detección y 10 % de mayor riesgo

Cada mes se marca el 10 % de celdas con más riesgo: `aciertos` es qué parte de las marcadas tuvo
evento y `captura` qué parte de todos los eventos quedó adentro. `recall` es qué parte de los eventos
se avisa si se avisa desde 50 % o desde 20 %, y `precision` qué parte de esos avisos acierta.
`(clim)` es lo mismo usando solo la climatología.

| meses_adelante | top10_aciertos | top10_aciertos (clim) | top10_captura | top10_captura (clim) | recall_50 | precision_50 | recall_20 | precision_20 | mejora_perdida_log |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 26 % | 22 % | 68 % | 57 % | 23 % | 55 % | 60 % | 33 % | 30 % |
| 2 | 25 % | 22 % | 64 % | 57 % | 13 % | 62 % | 52 % | 34 % | 28 % |
| 3 | 24 % | 22 % | 63 % | 57 % | 9 % | 61 % | 46 % | 33 % | 26 % |
| 4 | 24 % | 22 % | 62 % | 57 % | 10 % | 63 % | 48 % | 32 % | 26 % |
| 5 | 24 % | 22 % | 62 % | 57 % | 8 % | 64 % | 48 % | 32 % | 25 % |
| 6 | 24 % | 22 % | 61 % | 57 % | 14 % | 54 % | 53 % | 30 % | 24 % |

### ¿Qué aporta cada grupo de variables?

Mejora del error (Brier, sin calibrar) frente a la climatología, en la misma prueba.

| variables | mejora_1_mes | mejora_2_mes | mejora_3_mes |
|---|---|---|---|
| solo S-NPP | 10 % | 9 % | 7 % |
| + NOAA-20, NOAA-21 y MODIS | 12 % | 11 % | 9 % |
| S-NPP + clima pasado | 10 % | 8 % | 7 % |
| satélites + clima pasado | 12 % | 10 % | 8 % |
| satélites + clima, sabiendo el clima del mes pronosticado (no usable: techo) | 17 % | 13 % | 11 % |

### Medido como R-B1 (para comparar con #223)

Evento = cualquier foco (`fire_days > 0`), emisiones 2025-01 a 2026-09, muestra de 3.000 celdas con
semilla 0; este modelo cubre 1557 de ellas (solo Argentina y Chile).
Detección con corte en 50 %; top 10 % global de celdas-mes.

| meses_adelante | prediccion | recall | precision | precision_top10 | captura_top10 | perdida_log |
|---|---|---|---|---|---|---|
| 1 | modelo | 41 % | 61 % | 62 % | 39 % | 0.32478 |
| 1 | climatologia | 42 % | 54 % | 57 % | 36 % | 0.42851 |
| 2 | modelo | 36 % | 62 % | 60 % | 38 % | 0.33236 |
| 2 | climatologia | 44 % | 54 % | 58 % | 36 % | 0.42705 |
| 3 | modelo | 38 % | 58 % | 59 % | 37 % | 0.34375 |
| 3 | climatologia | 44 % | 53 % | 58 % | 36 % | 0.43168 |

### ¿Los porcentajes son creíbles? (a 1 mes, por celda)

Cuando el modelo dice un rango, ¿qué parte de las veces pasó el evento?

| rango | casos | predicho | observado |
|---|---|---|---|
| 0%-2% | 369951 | <1 % | <1 % |
| 2%-5% | 51877 | 3 % | 3 % |
| 5%-10% | 35692 | 7 % | 6 % |
| 10%-20% | 28053 | 14 % | 12 % |
| 20%-30% | 13906 | 24 % | 21 % |
| 30%-40% | 9189 | 34 % | 29 % |
| 40%-50% | 5119 | 45 % | 36 % |
| 50%-60% | 3122 | 55 % | 45 % |
| 60%-70% | 2275 | 65 % | 55 % |
| 70%-80% | 1635 | 75 % | 59 % |
| 80%-90% | 1327 | 81 % | 73 % |

### Por área (a 1 mes)

Probabilidad de al menos un evento dentro del área, contra lo observado en los mismos 24 meses.

| tamaño_del_area | areas_probadas | veces_con_evento | auc | mejora_brier | kappa |
|---|---|---|---|---|---|
| 0.3° | 81604 | 12 % | 0.9261 | 8 % | 0.58 |
| 0.5° | 32568 | 20 % | 0.9224 | 7 % | 0.52 |
| 1.0° | 9177 | 35 % | 0.917 | 5 % | 0.6 |
| 2.0° | 2760 | 54 % | 0.9304 | 5 % | 0.62 |
| provincia | 897 | 81 % | 0.9372 | 5 % | 0.56 |

Fiabilidad en cuadrados de 0,5° (~50 km):

| rango | casos | predicho | observado |
|---|---|---|---|
| 0%-2% | 13137 | <1 % | <1 % |
| 2%-5% | 4552 | 3 % | 5 % |
| 5%-10% | 3404 | 7 % | 10 % |
| 10%-20% | 2887 | 14 % | 19 % |
| 20%-30% | 1703 | 25 % | 31 % |
| 30%-40% | 1168 | 35 % | 40 % |
| 40%-50% | 884 | 45 % | 51 % |
| 50%-60% | 790 | 55 % | 59 % |
| 60%-70% | 683 | 65 % | 63 % |
| 70%-80% | 695 | 75 % | 72 % |
| 80%-90% | 841 | 85 % | 81 % |
| 90%-100% | 1824 | 97 % | 91 % |

## Provincias: 2026-12 (el próximo mes, 2 mes(es) después del último dato)

`prob_evento`: probabilidad de al menos un evento en la provincia. `celdas_esperadas`: cuántas celdas de
~10 km tendrían evento; `celdas_habituales`, lo normal para ese mes. `historia`: en cuántos de los años
con datos hubo evento ese mes, y el máximo de celdas.

| provincia | prob_evento | nivel | celdas_esperadas | celdas_habituales | vs_habitual_pct | historia_anios_con_evento | historia_celdas_max |
|---|---|---|---|---|---|---|---|
| Santa Fe | 100 % | muy alta | 60.3 | 93.9 | -36 | 14/14 | 232.0 |
| Formosa | 100 % | muy alta | 49.8 | 65.8 | -24 | 14/14 | 261.0 |
| Corrientes | 100 % | muy alta | 40.2 | 40.7 | -1 | 14/14 | 171.0 |
| Chaco | 100 % | muy alta | 37.4 | 50.5 | -26 | 14/14 | 175.0 |
| Santiago del Estero | 100 % | muy alta | 35.8 | 41.1 | -13 | 14/14 | 75.0 |
| Buenos Aires | 100 % | muy alta | 31.7 | 42.4 | -25 | 14/14 | 119.0 |
| Entre Ríos | 100 % | muy alta | 21.8 | 29.5 | -26 | 14/14 | 120.0 |
| La Pampa | 100 % | muy alta | 21.0 | 27.5 | -24 | 14/14 | 131.0 |
| Salta | 100 % | muy alta | 20.7 | 35.7 | -42 | 14/14 | 78.0 |
| Misiones | 100 % | muy alta | 18.0 | 24.9 | -28 | 14/14 | 70.0 |
| Córdoba | 100 % | muy alta | 14.1 | 17.6 | -20 | 14/14 | 31.0 |
| Región Metropolitana de Santiago | 100 % | muy alta | 13.3 | 14.4 | -8 | 14/14 | 23.0 |
| Río Negro | 100 % | muy alta | 13.2 | 22.2 | -41 | 14/14 | 115.0 |
| La Araucanía | 100 % | muy alta | 12.8 | 10.8 | 19 | 14/14 | 35.0 |
| Mendoza | 100 % | muy alta | 10.5 | 11.4 | -8 | 14/14 | 27.0 |
| Bío-Bío | 100 % | muy alta | 10.2 | 11.9 | -15 | 14/14 | 27.0 |
| Libertador General Bernardo O'Higgins | 100 % | muy alta | 9.5 | 10.1 | -6 | 14/14 | 23.0 |
| Maule | 99 % | muy alta | 9.5 | 10.1 | -6 | 14/14 | 27.0 |
| Neuquén | 99 % | muy alta | 8.3 | 8.9 | -8 | 14/14 | 16.0 |
| San Luis | 99 % | muy alta | 9.0 | 14.8 | -39 | 14/14 | 31.0 |
| San Juan | 97 % | muy alta | 6.2 | 6.4 | -3 | 14/14 | 13.0 |
| Valparaíso | 95 % | muy alta | 5.4 | 7.0 | -23 | 14/14 | 12.0 |
| Atacama | 95 % | muy alta | 4.8 | 3.5 | 38 | 13/14 | 7.0 |
| Tucumán | 94 % | muy alta | 5.2 | 7.1 | -27 | 13/14 | 18.0 |
| Ñuble | 93 % | muy alta | 5.0 | 3.9 | 27 | 12/14 | 12.0 |
| Antofagasta | 92 % | muy alta | 3.9 | 2.0 | 97 | 11/14 | 7.0 |
| La Rioja | 86 % | muy alta | 3.6 | 4.7 | -24 | 14/14 | 9.0 |
| Catamarca | 85 % | muy alta | 3.6 | 5.4 | -34 | 14/14 | 12.0 |
| Jujuy | 82 % | alta | 3.3 | 5.2 | -38 | 14/14 | 10.0 |
| Chubut | 76 % | alta | 2.7 | 2.6 | 5 | 11/14 | 8.0 |
| Los Lagos | 60 % | media | 1.7 | 4.1 | -58 | 7/14 | 35.0 |
| Santa Cruz | 59 % | media | 1.7 | 2.4 | -30 | 12/14 | 6.0 |
| Coquimbo | 58 % | media | 1.6 | 1.9 | -16 | 12/14 | 5.0 |
| Tarapacá | 45 % | media | 1.1 | 0.9 | 28 | 8/14 | 2.0 |
| Arica y Parinacota | 34 % | media | 0.8 | 0.4 | s/d | 3/14 | 2.0 |
| Los Ríos | 30 % | media | 0.7 | 0.6 | 20 | 5/14 | 3.0 |
| Magallanes y Antártica Chilena | 15 % | baja | 0.3 | 0.5 | s/d | 4/14 | 4.0 |
| Aisén del General Carlos Ibáñez del Campo | 11 % | baja | 0.2 | 0.3 | s/d | 3/14 | 2.0 |
| Tierra del Fuego | 9 % | muy baja | 0.2 | 0.6 | -68 | 4/14 | 5.0 |

## Provincias: 2026-11 (el mes en curso, 1 mes(es) después del último dato)

`prob_evento`: probabilidad de al menos un evento en la provincia. `celdas_esperadas`: cuántas celdas de
~10 km tendrían evento; `celdas_habituales`, lo normal para ese mes. `historia`: en cuántos de los años
con datos hubo evento ese mes, y el máximo de celdas.

| provincia | prob_evento | nivel | celdas_esperadas | celdas_habituales | vs_habitual_pct | historia_anios_con_evento | historia_celdas_max |
|---|---|---|---|---|---|---|---|
| Santa Fe | 100 % | muy alta | 82.2 | 127.3 | -35 | 14/14 | 305.0 |
| Santiago del Estero | 100 % | muy alta | 59.2 | 85.3 | -31 | 14/14 | 171.0 |
| Formosa | 100 % | muy alta | 57.3 | 92.2 | -38 | 14/14 | 240.0 |
| Chaco | 100 % | muy alta | 55.4 | 82.7 | -33 | 14/14 | 216.0 |
| Corrientes | 100 % | muy alta | 45.8 | 45.2 | 1 | 14/14 | 206.0 |
| Salta | 100 % | muy alta | 33.7 | 79.0 | -57 | 14/14 | 184.0 |
| Misiones | 100 % | muy alta | 24.9 | 39.0 | -36 | 14/14 | 118.0 |
| Entre Ríos | 100 % | muy alta | 20.0 | 29.1 | -31 | 14/14 | 115.0 |
| Córdoba | 100 % | muy alta | 19.2 | 25.1 | -24 | 14/14 | 56.0 |
| Buenos Aires | 100 % | muy alta | 14.5 | 22.2 | -35 | 14/14 | 62.0 |
| Mendoza | 100 % | muy alta | 11.6 | 13.4 | -14 | 14/14 | 36.0 |
| La Araucanía | 100 % | muy alta | 10.4 | 11.9 | -12 | 14/14 | 22.0 |
| Maule | 100 % | muy alta | 9.4 | 10.1 | -7 | 14/14 | 18.0 |
| Tucumán | 100 % | muy alta | 9.1 | 20.1 | -55 | 14/14 | 44.0 |
| Atacama | 99 % | muy alta | 7.5 | 5.5 | 37 | 14/14 | 11.0 |
| Neuquén | 99 % | muy alta | 7.3 | 6.4 | 14 | 14/14 | 9.0 |
| Río Negro | 99 % | muy alta | 8.5 | 11.0 | -23 | 14/14 | 22.0 |
| San Juan | 99 % | muy alta | 8.3 | 9.6 | -14 | 14/14 | 17.0 |
| Región Metropolitana de Santiago | 99 % | muy alta | 7.8 | 12.2 | -36 | 14/14 | 24.0 |
| San Luis | 99 % | muy alta | 8.2 | 13.8 | -40 | 14/14 | 28.0 |
| Bío-Bío | 99 % | muy alta | 7.6 | 9.0 | -15 | 14/14 | 14.0 |
| Libertador General Bernardo O'Higgins | 98 % | muy alta | 6.7 | 9.6 | -30 | 14/14 | 25.0 |
| Catamarca | 98 % | muy alta | 6.5 | 9.8 | -33 | 14/14 | 26.0 |
| La Rioja | 98 % | muy alta | 6.1 | 9.5 | -36 | 14/14 | 21.0 |
| Antofagasta | 97 % | muy alta | 5.4 | 2.5 | 118 | 12/14 | 6.0 |
| Jujuy | 95 % | muy alta | 5.1 | 13.9 | -63 | 14/14 | 34.0 |
| La Pampa | 93 % | muy alta | 4.8 | 6.4 | -25 | 13/14 | 18.0 |
| Ñuble | 93 % | muy alta | 4.5 | 4.0 | 13 | 14/14 | 8.0 |
| Valparaíso | 84 % | alta | 3.2 | 6.4 | -51 | 14/14 | 14.0 |
| Coquimbo | 61 % | alta | 1.6 | 3.3 | -50 | 13/14 | 8.0 |
| Chubut | 57 % | media | 1.5 | 2.3 | -35 | 12/14 | 7.0 |
| Tarapacá | 48 % | media | 1.1 | 0.7 | 56 | 8/14 | 2.0 |
| Santa Cruz | 47 % | media | 1.1 | 1.9 | -43 | 11/14 | 5.0 |
| Los Lagos | 44 % | media | 1.0 | 2.1 | -52 | 9/14 | 10.0 |
| Arica y Parinacota | 41 % | media | 0.9 | 0.2 | s/d | 3/14 | 1.0 |
| Los Ríos | 20 % | baja | 0.4 | 0.2 | s/d | 3/14 | 1.0 |
| Magallanes y Antártica Chilena | 19 % | baja | 0.3 | 0.9 | -59 | 10/14 | 2.0 |
| Aisén del General Carlos Ibáñez del Campo | 10 % | muy baja | 0.2 | 0.6 | -68 | 4/14 | 5.0 |
| Tierra del Fuego | 2 % | muy baja | 0.0 | 0.2 | s/d | 3/14 | 1.0 |

## Provincias: 2027-01 (dos meses adelante, 3 mes(es) después del último dato)

`prob_evento`: probabilidad de al menos un evento en la provincia. `celdas_esperadas`: cuántas celdas de
~10 km tendrían evento; `celdas_habituales`, lo normal para ese mes. `historia`: en cuántos de los años
con datos hubo evento ese mes, y el máximo de celdas.

| provincia | prob_evento | nivel | celdas_esperadas | celdas_habituales | vs_habitual_pct | historia_anios_con_evento | historia_celdas_max |
|---|---|---|---|---|---|---|---|
| Formosa | 100 % | muy alta | 79.6 | 96.7 | -18 | 14/14 | 367.0 |
| Corrientes | 100 % | muy alta | 77.0 | 71.3 | 8 | 14/14 | 401.0 |
| Santa Fe | 100 % | muy alta | 76.3 | 105.2 | -27 | 14/14 | 282.0 |
| Chaco | 100 % | muy alta | 52.9 | 54.5 | -3 | 14/14 | 152.0 |
| Buenos Aires | 100 % | muy alta | 37.1 | 46.4 | -20 | 14/14 | 84.0 |
| Entre Ríos | 100 % | muy alta | 33.4 | 38.8 | -14 | 13/14 | 106.0 |
| Santiago del Estero | 100 % | muy alta | 32.4 | 34.6 | -7 | 14/14 | 65.0 |
| La Araucanía | 100 % | muy alta | 23.6 | 22.5 | 5 | 14/14 | 43.0 |
| Misiones | 100 % | muy alta | 21.2 | 21.6 | -2 | 14/14 | 46.0 |
| Bío-Bío | 100 % | muy alta | 19.4 | 20.7 | -6 | 14/14 | 47.0 |
| Maule | 100 % | muy alta | 19.1 | 19.1 | 0 | 14/14 | 80.0 |
| La Pampa | 100 % | muy alta | 18.4 | 43.4 | -58 | 14/14 | 203.0 |
| Río Negro | 100 % | muy alta | 15.1 | 21.3 | -29 | 14/14 | 66.0 |
| Salta | 100 % | muy alta | 13.5 | 18.3 | -26 | 14/14 | 40.0 |
| Córdoba | 100 % | muy alta | 13.3 | 14.2 | -6 | 14/14 | 27.0 |
| Mendoza | 100 % | muy alta | 13.0 | 21.0 | -38 | 14/14 | 70.0 |
| Chubut | 100 % | muy alta | 12.4 | 7.6 | 62 | 14/14 | 34.0 |
| Libertador General Bernardo O'Higgins | 100 % | muy alta | 11.4 | 12.1 | -6 | 14/14 | 36.0 |
| Región Metropolitana de Santiago | 100 % | muy alta | 9.5 | 11.1 | -15 | 14/14 | 25.0 |
| Ñuble | 99 % | muy alta | 8.7 | 6.6 | 32 | 13/14 | 32.0 |
| Neuquén | 98 % | muy alta | 7.8 | 9.6 | -19 | 14/14 | 22.0 |
| San Luis | 98 % | muy alta | 7.7 | 12.0 | -36 | 14/14 | 34.0 |
| Atacama | 98 % | muy alta | 6.4 | 6.9 | -7 | 12/14 | 13.0 |
| Valparaíso | 93 % | muy alta | 5.2 | 6.0 | -14 | 14/14 | 16.0 |
| San Juan | 92 % | muy alta | 4.9 | 5.6 | -12 | 13/14 | 12.0 |
| Antofagasta | 90 % | muy alta | 3.9 | 2.4 | 59 | 13/14 | 5.0 |
| Los Lagos | 83 % | alta | 3.5 | 3.2 | 8 | 11/14 | 17.0 |
| Santa Cruz | 82 % | alta | 3.4 | 3.4 | -1 | 13/14 | 8.0 |
| Tucumán | 81 % | alta | 3.3 | 3.8 | -13 | 14/14 | 9.0 |
| Catamarca | 76 % | alta | 2.8 | 3.6 | -22 | 13/14 | 10.0 |
| La Rioja | 72 % | alta | 2.4 | 2.9 | -15 | 13/14 | 5.0 |
| Jujuy | 64 % | alta | 2.0 | 2.8 | -28 | 13/14 | 5.0 |
| Coquimbo | 59 % | media | 1.7 | 2.1 | -20 | 10/14 | 9.0 |
| Los Ríos | 42 % | media | 1.1 | 0.7 | 52 | 7/14 | 2.0 |
| Arica y Parinacota | 22 % | baja | 0.5 | 0.1 | s/d | 2/14 | 1.0 |
| Aisén del General Carlos Ibáñez del Campo | 21 % | baja | 0.5 | 0.5 | s/d | 2/14 | 4.0 |
| Tarapacá | 20 % | baja | 0.4 | 0.2 | s/d | 3/14 | 1.0 |
| Magallanes y Antártica Chilena | 18 % | baja | 0.4 | 0.6 | -40 | 4/14 | 3.0 |
| Tierra del Fuego | 8 % | muy baja | 0.2 | 0.3 | s/d | 4/14 | 1.0 |

## Áreas dibujadas (ejemplos)

**Comarca Andina (El Bolsón, Lago Puelo)** (lon -71.9 a -71.2, lat -42.3 a -41.7)

| mes | horizonte | celdas | prob_evento | prob_habitual | celdas_esperadas | celda_mas_alta | nivel |
|---|---|---|---|---|---|---|---|
| 2026-11 | 1 | 30 | 8 % | 8 % | 0.16 | 2 % | muy baja |
| 2026-12 | 2 | 30 | 22 % | 20 % | 0.49 | 7 % | baja |
| 2027-01 | 3 | 30 | 74 % | 56 % | 2.71 | 26 % | alta |
| 2027-02 | 4 | 30 | 63 % | 44 % | 2.13 | 12 % | alta |
| 2027-03 | 5 | 30 | 49 % | 35 % | 1.45 | 15 % | media |
| 2027-04 | 6 | 30 | 7 % | 5 % | 0.19 | 2 % | muy baja |

**Delta del Paraná** (lon -60.0 a -58.6, lat -34.2 a -33.2)

| mes | horizonte | celdas | prob_evento | prob_habitual | celdas_esperadas | celda_mas_alta | nivel |
|---|---|---|---|---|---|---|---|
| 2026-11 | 1 | 138 | 97 % | 100 % | 5.39 | 26 % | muy alta |
| 2026-12 | 2 | 138 | 98 % | 100 % | 6.81 | 19 % | muy alta |
| 2027-01 | 3 | 138 | 100 % | 100 % | 12.0 | 43 % | muy alta |
| 2027-02 | 4 | 138 | 100 % | 100 % | 11.88 | 35 % | muy alta |
| 2027-03 | 5 | 138 | 100 % | 99 % | 11.52 | 32 % | muy alta |
| 2027-04 | 6 | 138 | 99 % | 97 % | 9.55 | 31 % | muy alta |

**Sierras de Córdoba** (lon -64.9 a -64.3, lat -31.8 a -30.9)

| mes | horizonte | celdas | prob_evento | prob_habitual | celdas_esperadas | celda_mas_alta | nivel |
|---|---|---|---|---|---|---|---|
| 2026-11 | 1 | 53 | 23 % | 40 % | 0.47 | 4 % | baja |
| 2026-12 | 2 | 53 | 12 % | 24 % | 0.26 | 2 % | baja |
| 2027-01 | 3 | 53 | 7 % | 7 % | 0.14 | <1 % | muy baja |
| 2027-02 | 4 | 53 | 5 % | 3 % | 0.12 | 2 % | muy baja |
| 2027-03 | 5 | 53 | 6 % | 6 % | 0.14 | 3 % | muy baja |
| 2027-04 | 6 | 53 | 5 % | 3 % | 0.12 | 2 % | muy baja |

**Esteros del Iberá** (lon -58.0 a -56.6, lat -29.0 a -27.6)

| mes | horizonte | celdas | prob_evento | prob_habitual | celdas_esperadas | celda_mas_alta | nivel |
|---|---|---|---|---|---|---|---|
| 2026-11 | 1 | 189 | 99 % | 100 % | 8.17 | 18 % | muy alta |
| 2026-12 | 2 | 189 | 99 % | 99 % | 7.56 | 13 % | muy alta |
| 2027-01 | 3 | 189 | 100 % | 100 % | 16.18 | 26 % | muy alta |
| 2027-02 | 4 | 189 | 100 % | 100 % | 23.43 | 29 % | muy alta |
| 2027-03 | 5 | 189 | 100 % | 100 % | 24.1 | 36 % | muy alta |
| 2027-04 | 6 | 189 | 100 % | 100 % | 15.93 | 24 % | muy alta |

**Araucanía costera** (lon -73.4 a -72.4, lat -38.9 a -37.9)

| mes | horizonte | celdas | prob_evento | prob_habitual | celdas_esperadas | celda_mas_alta | nivel |
|---|---|---|---|---|---|---|---|
| 2026-11 | 1 | 100 | 98 % | 99 % | 5.88 | 18 % | muy alta |
| 2026-12 | 2 | 100 | 99 % | 100 % | 8.45 | 24 % | muy alta |
| 2027-01 | 3 | 100 | 100 % | 100 % | 16.28 | 62 % | muy alta |
| 2027-02 | 4 | 100 | 100 % | 100 % | 20.28 | 65 % | muy alta |
| 2027-03 | 5 | 100 | 100 % | 100 % | 34.32 | 70 % | muy alta |
| 2027-04 | 6 | 100 | 100 % | 100 % | 31.96 | 70 % | muy alta |

## Las 15 celdas más probables en 2026-12

| cell_id | region | lat | lon | prob | prob_habitual |
|---|---|---|---|---|---|
| -25.6_-70.2 | CL-AN | -25.55 | -70.15 | 72 % | 71 % |
| -37.1_-69.5 | AR-M | -37.05 | -69.45 | 60 % | 7 % |
| -38.7_-68.8 | AR-Q | -38.65 | -68.75 | 60 % | 14 % |
| -38.7_-68.7 | AR-Q | -38.65 | -68.65 | 59 % | 29 % |
| -39.0_-69.2 | AR-Q | -38.95 | -69.15 | 58 % | 43 % |
| -38.8_-68.8 | AR-Q | -38.75 | -68.75 | 56 % | 14 % |
| -26.4_-70.3 | CL-AT | -26.35 | -70.25 | 53 % | 64 % |
| -27.1_-69.9 | CL-AT | -27.05 | -69.85 | 49 % | 57 % |
| -22.5_-68.9 | CL-AN | -22.45 | -68.85 | 43 % | 29 % |
| -27.9_-70.2 | CL-AT | -27.85 | -70.15 | 43 % | 29 % |
| -33.2_-70.7 | CL-RM | -33.15 | -70.65 | 40 % | 50 % |
| -30.2_-62.9 | AR-X | -30.15 | -62.85 | 40 % | 71 % |
| -33.4_-70.9 | CL-RM | -33.35 | -70.85 | 39 % | 57 % |
| -29.9_-62.8 | AR-X | -29.85 | -62.75 | 39 % | 64 % |
| -30.2_-62.8 | AR-X | -30.15 | -62.75 | 37 % | 50 % |
