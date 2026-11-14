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

## Calidad

- Antes de abrir el PR, compila y prueba tu paquete.
- Commits chicos. Nada de `git add -A` ni de force-push.
- Después del congelamiento de la fase 3 solo entran correcciones.

## Documentos vivos

- Si tu cambio altera una tecnología, un requisito o una regla, actualiza `PLAN.md`, `REQUISITOS.md` o este archivo en el mismo PR.
- Si el código ya no coincide con los documentos, no sigas como si nada: avisa en el tablero.

## Comandos

El monorepo todavía no existe. Los comandos para instalar, levantar, probar y compilar se completan en la tarea F1-A1.
