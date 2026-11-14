# @charmy/charmy

Charmy, la vizcacha de fuego. Es el **contrato** del componente (`PLAN.md` §4): la API de abajo es estable y la
usan la app, la landing y el juego. Dueño: `@dimidio6` (desde la fase 3; antes `@cosmosnehu77`). Un cambio de API se anuncia en el tablero.

El dibujo sale del diseño aprobado en `docs/charmy-base/` (decisión D-07).

## Uso

En React (app, islas de Astro):

```tsx
import { Charmy } from "@charmy/charmy";

<Charmy mood="explica" outfit="guia" size={96} say="Este mes hay más focos que lo normal en tu zona." />
```

Sin React (Astro estático, HTML, el juego):

```ts
import { charmyHtml, charmySvg } from "@charmy/charmy/core";
import "@charmy/charmy/charmy.css"; // animaciones y globo (o insertar CHARMY_CSS en un <style>)

const html = charmyHtml({ mood: "saluda", size: 120, say: "¡Hola!" }); // dibujo y globo
const svg = charmySvg({ mood: "festeja", outfit: "bombero", size: 120 }); // solo el dibujo
```

En React no hace falta importar el CSS: el componente lo inserta una sola vez (React 19).

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
| `animate` | booleano | `true` | `false` deja a Charmy quieto (listas, avatares). |
| `sayPosition` | `derecha`, `arriba` | `derecha` | Dónde va el globo de `say`. |
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

## Animaciones

Son solo CSS (`src/estilos.ts`), sin JavaScript por cuadro. Se apagan solas con `prefers-reduced-motion`.

| Estado | Qué se mueve |
|---|---|
| todos | La llama de la cola titila. |
| `saluda` | El brazo saluda desde el hombro y laten las líneas de movimiento. |
| `explica` | Señala con el brazo, mueve la boca y los puntos del globo se encienden en orden. |
| `alerta` | Se encienden las puntas de las orejas y rebota el signo de exclamación. Sin parpadeos rápidos. |
| `idle` | Parpadea despacio, una vez cada cuatro segundos. |
| `festeja` | Mueve los dos brazos arriba y los brillos titilan en orden. |
| `pensando` | Las burbujas de pensamiento se encienden de la más chica a la más grande. |

Los seis estados están animados. Para sumar una animación: cada capa tiene
`data-capa="<nombre>"` y las partes móviles `data-parte` (`llama-cola`, `orejas-llama`, `exclamacion`); el `<svg>`
lleva `class="charmy"`, `data-mood` y `data-outfit`. Una capa animada nunca tiene `transform` propio en su `<g>`:
el CSS lo pisaría (hay una prueba que lo controla). `CAPAS_DE(mood, outfit)` devuelve las capas prendidas.

## Comandos

```bash
pnpm --filter @charmy/charmy check        # tipos, pruebas y compilación
pnpm --filter @charmy/charmy muestrario   # dist/muestrario.html con todas las combinaciones
```
