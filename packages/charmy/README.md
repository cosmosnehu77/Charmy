# @charmy/charmy

Charmy, la vizcacha de fuego. Es el **contrato** del componente (`PLAN.md` §4): la API de abajo es estable y la
usan la app, la landing y el juego. Dueño: `@cosmosnehu77`. Un cambio de API se anuncia en el tablero.

El dibujo sale del diseño aprobado en `docs/charmy-base/` (decisión D-07).

## Uso

En React (app, islas de Astro):

```tsx
import { Charmy } from "@charmy/charmy";

<Charmy mood="explica" outfit="guia" size={96} say="Este mes hay más focos que lo normal en tu zona." />
```

Sin React (Astro estático, HTML, el juego):

```ts
import { charmySvg } from "@charmy/charmy/core";

const svg = charmySvg({ mood: "festeja", outfit: "bombero", size: 120 }); // texto SVG listo para insertar
```

En el `package.json` del consumidor: `"@charmy/charmy": "workspace:*"`.

## Props

| Prop | Valores | Por defecto | Qué hace |
|---|---|---|---|
| `mood` | `idle`, `saluda`, `explica`, `alerta`, `festeja`, `pensando` | `idle` | Estado. Cambia brazos, ojos, boca y efectos. |
| `outfit` | `base`, `bombero`, `piloto`, `cientifica`, `guia` | `base` | Vestuario. |
| `size` | número de píxeles | `240` | Lado del dibujo. Por debajo de 40 px se dibuja solo la cabeza. |
| `say` | texto | — | Globo de diálogo al lado del dibujo, anunciado a lectores de pantalla. Apaga el globo de puntos de `explica`. |
| `label` | texto | estado y vestuario | Texto alternativo. |
| `decorative` | booleano | `false` | Oculta el dibujo a lectores de pantalla cuando el texto de al lado ya lo dice. |
| `variant` | `completo`, `cabeza` | según `size` | Fuerza el recorte. |
| `className`, `style` | — | — | Solo en React, sobre el contenedor. |

Un valor inválido vuelve al de por defecto: la página nunca se rompe por Charmy.

## Cuándo usar cada estado y vestuario

| Estado | Cuándo |
|---|---|
| `idle` | La app espera. |
| `saluda` | Primera visita a la landing o a la app. |
| `explica` | Recorrido guiado y ayudas del modo novato. |
| `alerta` | Foco nuevo en la zona o mes por encima de lo normal. |
| `festeja` | Logros en Charmy Kids y reportes confirmados. |
| `pensando` | Mientras se cargan o procesan datos. |

| Vestuario | Dónde |
|---|---|
| `base` | Landing, presentación y redes. |
| `bombero` | Avisos a entidades y protagonista de Charmy Kids. |
| `piloto` | Poder especial del avión hidrante en el juego. |
| `cientifica` | Modo experto, validación y descargas. |
| `guia` | Modo novato y recorrido de cuatro pasos. |

Tamaños: ayudas y alertas, 96 px o más; avatar y listas, 48 a 64 px; menos de 40 px, solo la cabeza.

## Para animar (fase 2)

Cada capa del SVG tiene `data-capa="<nombre>"` y la llama de la cola tiene `data-parte="llama-cola"`. El `<svg>`
lleva `class="charmy"`, `data-mood` y `data-outfit`, así que las animaciones se escriben en CSS sin tocar el dibujo.
`CAPAS_DE(mood, outfit)` devuelve las capas prendidas.

## Comandos

```bash
pnpm --filter @charmy/charmy check        # tipos, pruebas y compilación
pnpm --filter @charmy/charmy muestrario   # dist/muestrario.html con todas las combinaciones
```
