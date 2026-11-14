---
name: charmy
description: Cómo usar a Charmy, la mascota del proyecto (vizcacha de fuego), en la app, la landing, el juego o los avisos. Usar siempre que se muestre a Charmy, se escriba algo que dice Charmy, se elija su estado o vestuario, o se toque packages/charmy.
---

# Charmy

Charmy es la vizcacha de fuego que guía al público. Se usa **siempre por su componente** `@charmy/charmy`
(`packages/charmy/`). Nunca se redibuja, se copia su SVG ni se exporta como imagen suelta.

El contrato completo (props, tamaños, estados y vestuarios) está en `packages/charmy/README.md`. Léelo antes de usarlo.

## Cómo se usa

```tsx
// React (app, islas de Astro)
import { Charmy } from "@charmy/charmy";
<Charmy mood="explica" outfit="guia" size={96} say="Elegí un área en el mapa para empezar." />
```

```ts
// Sin React (Astro estático, el juego)
import { charmySvg } from "@charmy/charmy/core";
el.innerHTML = charmySvg({ mood: "festeja", outfit: "bombero", size: 120 });
```

Dependencia en el `package.json` del consumidor: `"@charmy/charmy": "workspace:*"`.

## Elegir estado y vestuario

| Situación | `mood` | `outfit` |
|---|---|---|
| Portada de la landing, primera visita | `saluda` | `base` |
| Recorrido y ayudas del modo novato | `explica` | `guia` |
| Modo experto, panel de validación, descargas | `explica` o `idle` | `cientifica` |
| Cargando o procesando datos | `pensando` | el de la pantalla |
| Foco nuevo en la zona o mes por encima de lo normal | `alerta` | el de la pantalla |
| Aviso a entidades (Telegram) | `alerta` | `bombero` |
| Charmy Kids: protagonista | según la jugada | `bombero` |
| Charmy Kids: logro, fin de partida ganada | `festeja` | `bombero` |
| Charmy Kids: poder del avión hidrante | — | `piloto` |
| Reporte confirmado | `festeja` | el de la pantalla |
| La app espera sin nada que decir | `idle` | el de la pantalla |

Tamaños: ayudas y alertas, 96 px o más; avatar y listas, 48 a 64 px; por debajo de 40 px el componente dibuja solo la cabeza.

## Cómo habla

- Corto: una o dos frases por globo.
- En segunda persona y con voseo: "Elegí un área", "Si ves fuego, llamá al 100".
- Sin alarmismo. Sí: "Este mes hay más focos que lo normal en tu zona." No: "¡PELIGRO! ¡Se quema todo!"
- En el modo novato, sin jerga. Nada de "anomalía de 2,3 desvíos en VIIRS I-band": decir qué significa.
- Todo aviso aclara que Charmy no reemplaza a los servicios de emergencia y dice a qué número llamar.
- No inventa datos: si un número es una muestra o un valor provisorio, lo dice.
- En el modo experto Charmy acompaña pero no interrumpe: menos globos, más datos.

## Accesibilidad

- Si el texto de al lado ya dice lo mismo que el dibujo, usar `decorative`.
- El globo de `say` se anuncia solo a lectores de pantalla: no repetir el mismo texto en otro lugar visible.
- Las animaciones (fase 2) respetan `prefers-reduced-motion`.

## Si hace falta algo que el componente no tiene

No se resuelve en tu carpeta. Se pide en el tablero mencionando al dueño de `packages/charmy` (`@dimidio6` desde la fase 3).
Un estado o vestuario nuevo es un cambio de contrato: se agrega primero en `docs/charmy-base/` y después en el componente.
