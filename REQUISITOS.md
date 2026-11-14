# Requisitos de Charmy

> **Qué es este documento.** Dice *qué* tiene que hacer Charmy y *para quién*, sin nombrar tecnologías.
> El *cómo*, el *quién* y el *cuándo* están en [`PLAN.md`](PLAN.md), que se alimenta de este documento.
>
> **Regla de oro.** Todo requisito tiene un ID. Toda tarea de `PLAN.md` apunta a uno o más IDs.
> Si se agrega, cambia o quita un requisito acá, `PLAN.md` se actualiza en el mismo PR (ver [Cómo cambiar este documento](#8-cómo-cambiar-este-documento)).

**Versión:** 1.3 · **Última actualización:** 14 de noviembre de 2026

---

## 1. Visión

Charmy es una herramienta web que une más de veinte años de focos de calor detectados por satélite en un solo
**calendario de actividad de quema**, para que cualquier persona pueda ver cuándo y dónde hubo fuego en una zona,
si el momento actual es normal o excepcional, y avisar a quien puede actuar.

Una vizcacha de fuego, Charmy, acompaña al usuario en toda la experiencia.

## 2. Contexto y origen de los requisitos

| Origen | Qué aporta |
|---|---|
| Desafío "Harmonization of MODIS and VIIRS Hot Spots" (NASA Space Apps 2026, propuesto por CONAE) | Los requisitos de armonización, calendario, mapa y descargas. Son los que evalúa el jurado en "Relevancia". |
| Idea del equipo (excalidraw y conversación inicial) | Mascota, landing, juego, dos modos de usuario, predicción, verificación de focos y avisos a entidades. |
| Criterios del jurado: impacto, creatividad, validez, relevancia y presentación | Los requisitos de validación visible, transparencia y material de entrega. |
| Recursos del evento y fuentes que el equipo decidió sumar (14 de noviembre) | Los requisitos de contexto del foco: tiempo, imagen satelital y contraste con estadísticas externas. |

## 3. Usuarios

| Usuario | Qué necesita | Modo |
|---|---|---|
| **Público general** (vecinos, escuelas, prensa) | Entender sin conocimientos técnicos si hay fuego cerca y si es normal para la época. | Novato |
| **Respuesta a emergencias** (brigadas, bomberos, Defensa Civil) | Enterarse rápido de focos nuevos en su zona y ver su contexto histórico. | Experto y avisos |
| **Investigación y técnica** (científicos, gestores de tierras) | Leer, filtrar y descargar los datos procesados y saber qué tan confiables son. | Experto |
| **Niñas y niños** | Aprender jugando sobre incendios y prevención. | Juego |
| **Jurado** | Ver en pocos minutos que el desafío está resuelto y que el método es válido. | Todos |

## 4. Prioridades

| Prioridad | Significado |
|---|---|
| **Imprescindible** | Sin esto no hay MVP. Define el cierre de la fase núcleo o de la entrega. |
| **Importante** | Entra en el MVP si su versión mínima funciona antes del congelamiento. |
| **Deseable** | Solo si sobra tiempo. No bloquea nada. |
| **Fuera** | Decidido que no entra en el MVP. Queda en la hoja de ruta. |

## 5. Requisitos funcionales

### 5.1 Armonización de datos (ARM)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-ARM-01 | Combinar los focos de calor de los dos sensores en una única serie temporal consistente, desde principios de los 2000 hasta hoy, de modo que el sensor de origen no cambie la lectura de tendencias, patrones y anomalías. | Imprescindible |
| RF-ARM-02 | La serie debe seguir siendo consistente cuando un satélite deja de entregar datos o se suma uno nuevo. | Imprescindible |
| RF-ARM-03 | Cada tramo de la serie indica si es un dato medido o convertido y qué incertidumbre tiene. | Importante |
| RF-ARM-04 | Mostrar evidencia de que la armonización funciona: comparación de ambos sensores en el período en que coinciden, con métricas por región, y la posibilidad de ver la serie armonizada junto a cada sensor por separado. | Imprescindible |
| RF-ARM-05 | Distinguir los focos que no son incendios (fuentes de calor fijas, como antorchas de gas o industria) y no contarlos como actividad de quema. | Importante |

### 5.2 Calendario de actividad de quema (CAL)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-CAL-01 | Mostrar, para el área elegida, un calendario con la cantidad de actividad por mes y por año sobre la serie armonizada. | Imprescindible |
| RF-CAL-02 | Comparar cada período con su valor histórico típico (mediana de varios años) y mostrar la anomalía. El mes actual se compara con su historia. | Imprescindible |
| RF-CAL-03 | Permitir identificar de un vistazo los meses del año y los años con más actividad (períodos críticos). | Imprescindible |
| RF-CAL-04 | Ofrecer una vista con detalle diario dentro del año. | Deseable |
| RF-CAL-05 | Usar rampas de color que se distingan con daltonismo, acompañadas de valores numéricos. | Imprescindible |

### 5.3 Mapa interactivo (MAP)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-MAP-01 | Mostrar los focos históricos y recientes sobre un mapa interactivo. El mapa es la pieza central de la aplicación. | Imprescindible |
| RF-MAP-02 | Elegir el área de interés dibujándola sobre el mapa o ingresando latitud y longitud. | Imprescindible |
| RF-MAP-03 | Elegir el área buscando una localidad por nombre. | Importante |
| RF-MAP-04 | Elegir una fecha o un rango de fechas. | Imprescindible |
| RF-MAP-05 | Filtrar los focos por serie (armonizada o por sensor), nivel de confianza, intensidad y momento del día. | Imprescindible |
| RF-MAP-06 | Ofrecer dos formas de ver el mapa: una en 3D con relieve y otra en 2D de carga rápida para conexiones lentas. | Imprescindible |
| RF-MAP-07 | Reproducir en el tiempo cómo cambian los focos a lo largo de los meses. | Importante |
| RF-MAP-08 | El MVP cubre Argentina y Chile. El diseño debe permitir extenderlo a cualquier región del mundo sin rehacerlo. | Imprescindible (cobertura) / Deseable (vista global) |

### 5.4 Descargas (EXP)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-EXP-01 | Descargar en CSV los focos del área y el período consultados. | Imprescindible |
| RF-EXP-02 | Descargar las analíticas y visualizaciones de la consulta (imagen del calendario, datos geográficos). | Importante |

### 5.5 Modos de uso (MOD)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-MOD-01 | Modo novato: lenguaje simple, sin siglas, una conclusión clara por área ("este mes está por encima de lo normal") y ayuda de Charmy. | Imprescindible |
| RF-MOD-02 | Modo experto: acceso a todos los datos, filtros, métricas de validación y descargas, con los atributos originales de cada foco. | Imprescindible |
| RF-MOD-03 | Cambiar de modo en cualquier momento sin perder el área ni las fechas elegidas. | Imprescindible |

### 5.6 Charmy, la mascota (CHA)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-CHA-01 | Una sola mascota, una vizcacha de fuego, con la identidad definida en el diseño "Charmy · Variantes": forma, paleta, estados y vestuarios. | Imprescindible |
| RF-CHA-02 | Charmy cambia de estado según lo que pasa: en reposo, saluda, explica, alerta, festeja y pensando. Versión mínima: saluda, explica y alerta. | Imprescindible (mínimo) / Importante (los seis) |
| RF-CHA-03 | Charmy cambia de vestuario según el lugar: base, bombero, piloto, científica y guía. Versión mínima: base y uno más. | Imprescindible (mínimo) / Importante (los cinco) |
| RF-CHA-04 | Charmy aparece en la landing y en la app. También en el juego y en los avisos cuando esas piezas existan. | Imprescindible |
| RF-CHA-05 | En el modo novato, Charmy guía al usuario paso a paso en su primer uso y explica lo que ve. | Imprescindible |
| RF-CHA-06 | Charmy tiene animaciones fluidas y respeta la preferencia de movimiento reducido. | Importante |
| RF-CHA-07 | Charmy habla corto, claro, en segunda persona y sin alarmismo. | Imprescindible |

### 5.7 Landing (LAN)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-LAN-01 | Presentación llamativa con animaciones fluidas que explique el problema y la solución. | Imprescindible |
| RF-LAN-02 | Sección de funcionalidades: qué hace el software. | Imprescindible |
| RF-LAN-03 | Sección para presentar al equipo. | Imprescindible |
| RF-LAN-04 | Accesos a la app y al juego, y créditos de los datos usados. | Imprescindible |

### 5.8 Focos recientes y verificación (VIV)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-VIV-01 | Mostrar los focos de las últimas horas con datos casi en tiempo real. | Importante |
| RF-VIV-02 | Dar a cada foco reciente un veredicto de veracidad (confirmado, probable, sin confirmar, probable fuente fija) que combine varias señales, y mostrar la evidencia detrás del veredicto. | Importante |
| RF-VIV-03 | Usar noticias publicadas como una de las señales. | Importante |
| RF-VIV-04 | La inteligencia artificial solo apoya (por ejemplo, leyendo noticias). Nunca decide sola un veredicto, y que no haya noticias no convierte un foco en falso. | Imprescindible si existe RF-VIV-02 |

### 5.9 Avisos a entidades locales (ALE)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-ALE-01 | Cualquier persona puede reportar un foco sin crear una cuenta. | Importante |
| RF-ALE-02 | Las entidades aliadas (bomberos, Defensa Civil, brigadas) reciben un aviso inmediato de los focos y reportes dentro de su zona, por un canal de mensajería que ya usen. | Importante |
| RF-ALE-03 | La entidad puede marcar el estado de un aviso (visto, en camino, controlado, falso) y eso mejora la verificación. | Importante |
| RF-ALE-04 | Los avisos se publican también en un formato estándar de alerta que otros sistemas puedan consumir. | Importante |
| RF-ALE-05 | Las entidades tienen cuenta propia, definen su zona y ven sus avisos dentro de la app. | Deseable |
| RF-ALE-06 | Toda pantalla o mensaje de aviso aclara que Charmy no reemplaza a los servicios de emergencia e indica a qué número llamar. | Imprescindible si existe algún aviso |
| RF-ALE-07 | El público general no necesita cuenta para usar ninguna función. | Imprescindible |

### 5.10 Predicción (PRE)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-PRE-01 | Estimar la actividad de quema esperada por zona para los próximos uno a tres meses. | Deseable |
| RF-PRE-02 | La predicción solo se muestra si es mejor que suponer "lo mismo que el promedio histórico", y siempre con su incertidumbre. | Imprescindible si existe RF-PRE-01 |

### 5.11 Charmy Kids, el juego (KID)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-KID-01 | Juego web en el que Charmy bombero apaga incendios, con partidas cortas, puntaje y un bucle que invite a volver a jugar. | Importante |
| RF-KID-02 | Los focos del juego salen de un día real de datos satelitales. | Importante |
| RF-KID-03 | Cada partida termina con un dato real y un consejo de prevención. | Importante |
| RF-KID-04 | Tabla de puntajes compartida entre jugadores. | Deseable |
| RF-KID-05 | Versión en 3D. | Fuera |

### 5.12 Contexto del foco y fuentes complementarias (CTX)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-CTX-01 | Mostrar, para el lugar de un foco o el área elegida, el tiempo actual y el pronóstico de las próximas horas (viento con su dirección, temperatura y humedad) y un índice de riesgo de incendio. | Importante |
| RF-CTX-02 | Los avisos a las entidades incluyen el viento en el lugar del foco como dato de contexto. | Importante |
| RF-CTX-03 | Ver una imagen satelital óptica reciente del lugar de un foco, para inspeccionar a simple vista humo o superficie quemada. | Importante |
| RF-CTX-04 | Comparar la imagen de antes y después de un incendio y estimar la severidad de la quema. | Deseable |
| RF-CTX-05 | Sumar detecciones de fuego de otros satélites, además de los dos sensores armonizados, como señal adicional de verificación. | Deseable |
| RF-CTX-06 | Contrastar las cifras de Charmy con estadísticas públicas de incendios de otras fuentes, como chequeo de plausibilidad, citando la fuente. | Importante |

## 6. Requisitos no funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-01 | **Un solo repositorio** público que contenga todas las piezas, con instrucciones para correrlo. Es lo que se entrega. | Imprescindible |
| RNF-02 | **Demo resistente.** El mapa y el calendario históricos funcionan aunque los servicios en vivo o la red fallen. | Imprescindible |
| RNF-03 | **Liviano.** El modo 2D se puede usar con una conexión móvil lenta. | Imprescindible |
| RNF-04 | **Accesible.** Contraste suficiente, uso con teclado, colores que no dependan solo del tono y funcionamiento en pantallas de teléfono. | Imprescindible |
| RNF-05 | **Privado.** Los reportes ciudadanos no guardan datos personales. Lo que se guarde cumple la Ley 25.326. | Imprescindible si existe RF-ALE-01 |
| RNF-06 | **Seguro.** Ninguna clave ni secreto en el repositorio. Los servicios externos que requieren credenciales se consultan solo desde el servidor, con caché, para respetar sus límites de uso. | Imprescindible |
| RNF-07 | **Transparente.** Se citan las fuentes de datos, se explican el método y sus supuestos, y se declara el uso de inteligencia artificial. | Imprescindible |
| RNF-08 | **Reproducible.** Una persona nueva puede levantar todo el proyecto en su máquina con un solo comando. | Importante |
| RNF-09 | **Paralelizable.** Cada pieza vive en su propia carpeta, con un dueño, y se comunica con las demás por contratos acordados, para que varios agentes trabajen a la vez sin pisarse. | Imprescindible |
| RNF-10 | **Sin costo.** Todo corre en planes gratuitos. | Imprescindible |
| RNF-11 | **Idioma.** La interfaz está en español. El material de entrega va en el idioma que pida el evento. | Imprescindible |
| RNF-12 | **Coherencia visual.** Landing, app, juego y avisos comparten la paleta y las tipografías de la base de Charmy. | Importante |
| RNF-13 | **Fuentes usadas según sus condiciones.** Cada fuente externa se usa por su vía oficial y dentro de sus cuotas. De un sitio sin API ni licencia visible no se copian datos: solo se lo cita y se lo enlaza. | Imprescindible |
| RNF-14 | **Tolerante a fuentes caídas.** Si una fuente complementaria (tiempo, imagen satelital, noticias) no responde, esa parte se muestra como no disponible y el resto sigue funcionando. | Imprescindible si existe RF-CTX-01 o RF-CTX-03 |

## 7. Restricciones y supuestos

| Tipo | Detalle |
|---|---|
| Tiempo | El hackathon es el 14 y 15 de noviembre de 2026: unas 48 horas. |
| Equipo | Cuatro personas activas con agente de Claude, una quinta que puede sumarse más adelante y una sin agente. Se coordinan con `tabla-agentes`. |
| Datos | Se usan datos abiertos de NASA (FIRMS) y el dataset que entregue el evento. Los datos nuevos de uno de los satélites dejaron de publicarse el 2 de noviembre de 2026. |
| Fuentes complementarias | Datos del tiempo de un proveedor que el evento ofrece a los participantes (cuenta activa, con tope diario de pedidos y **vigente hasta el 22 de noviembre de 2026**), imágenes del programa Copernicus consumidas por API con cuenta gratuita y cuotas mensuales, y un sitio público de estadísticas de incendios sin API ni licencia visible, que solo se usa como referencia citada. |
| Nube | El evento ofrece créditos de Azure. El equipo lo usó poco: no entra en el MVP y queda como opción posterior. |
| Reglas del evento | **A confirmar:** si se puede llegar con código o arte hechos antes, el formato de la demo, el idioma y la hora de cierre. |
| Entidades | Para el MVP alcanza con una entidad de demostración. Las alianzas reales son posteriores. |

### Criterio de MVP

El MVP está alcanzado cuando, en la versión publicada:

1. Una persona elige un área y un período, ve el calendario armonizado con sus anomalías y descarga el CSV (RF-ARM-01, RF-CAL-01 a 03, RF-MAP-01/02/04, RF-EXP-01).
2. Puede ver por qué la armonización es confiable (RF-ARM-04).
3. Puede usar la app en modo novato con Charmy o en modo experto, en 2D o en 3D (RF-MOD, RF-MAP-06, RF-CHA-05).
4. La landing presenta el proyecto y al equipo (RF-LAN).
5. El repositorio es público, sin secretos y con su documentación (RNF-01, RNF-06, RNF-07).

Los requisitos "Importante" que lleguen funcionando se suman al MVP. Los que no, pasan a la hoja de ruta de `PLAN.md`.

## 8. Cómo cambiar este documento

1. **Proponer.** Cualquier persona abre un PR que agrega, cambia o quita una fila. Un requisito nuevo recibe el siguiente número libre de su grupo (por ejemplo `RF-MAP-09`). Los IDs no se reutilizan: un requisito descartado pasa a prioridad "Fuera".
2. **Actualizar el plan en el mismo PR.** En `PLAN.md` se agrega o ajusta la tarea que lo cubre, se actualiza la tabla "Cobertura de requisitos" y, si cambia una tecnología, la "Tabla de referencia".
3. **Anunciar.** Al hacer merge, se publica en el tablero: `[Agente de Nombre] @all requisito RF-XXX-NN agregado/cambiado, ver PLAN.md`.
4. **Registrar.** Se agrega una línea al registro de cambios de abajo.

Un requisito sin tarea en `PLAN.md` no se está haciendo. Una tarea sin requisito no debería existir.

### Registro de cambios

| Fecha | Cambio | Quién |
|---|---|---|
| 2026-11-13 | Versión inicial a partir del desafío, la idea del equipo y el plan técnico. | — |
| 2026-11-14 | Versión 1.2. RNF-06 vuelve a exigir que todo servicio con credenciales se consulte desde el servidor, porque las imágenes de Copernicus se consumen por API. Se confirma la vigencia de la cuenta del tiempo. | — |
| 2026-11-14 | Versión 1.1. Se agrega el grupo CTX (tiempo en el foco, imagen satelital, otros satélites, contraste con estadísticas externas), RNF-13 y RNF-14. Se ajusta RNF-06. Azure queda como opción posterior al MVP. | — |
| 2026-11-14 | Versión 1.3. El equipo activo pasa a ser de cuatro personas con agente; una quinta puede sumarse después. RNF-09 deja de fijar la cantidad de agentes. No cambia ningún requisito funcional. | `@cosmosnehu77` |
