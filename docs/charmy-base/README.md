# Base de Charmy

Fuente del lienzo de diseño "Charmy · Variantes" (https://claude.ai/artifact/Wj82ew58QGwS7F4UWa1E6K).
Es la base acordada para la mascota (decisión D-07 de `PLAN.md`).

| Archivo | Qué contiene |
|---|---|
| `Charmy.dc.html` | El dibujo: un SVG de 240 × 240 por capas. Cada estado y cada vestuario es un grupo que se muestra u oculta. De acá sale `packages/charmy`. |
| `Estados.dc.html` | Los 6 estados (`idle`, `saluda`, `explica`, `alerta`, `festeja`, `pensando`) y cuándo se usa cada uno. |
| `Vestuarios.dc.html` | Los 5 vestuarios (`base`, `bombero`, `piloto`, `cientifica`, `guia`) y dónde se usa cada uno. |
| `EnContexto.dc.html` | Maquetas de Charmy en la app, la landing, el juego y Telegram. Los textos son ejemplos. |
| `PixelArt.dc.html` | Sprite de 16 px de Charmy bombero para el juego, con su paleta. |
| `Paleta.dc.html` | Colores, tamaños mínimos, tono de voz y entradas de animación. |
| `Main.dc.html` | Explorador interactivo de estados y vestuarios. |
| `canvas.json` | Posición de los tableros en el lienzo. |

Los `.dc.html` son el formato del lienzo de diseño. Para el producto solo hace falta el `<svg>` de `Charmy.dc.html`
y la tabla de qué capa se ve en cada estado, que está en el `renderVals()` del mismo archivo.

Los huecos `{{o.algo}}` del SVG son opacidades 0 o 1 calculadas a partir de `mood` y `outfit`.
