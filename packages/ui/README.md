# @charmy/ui · tokens de diseño

Contrato compartido (PLAN.md §4). Dueño: `@daniace`. Lo consumen la app, la landing y el juego.
Los valores salen de `docs/charmy-base/Paleta.dc.html` y `EnContexto.dc.html`. Un cambio de valor o de nombre se
anuncia en el tablero.

## Qué exporta

| Entrada | Para qué |
|---|---|
| `@charmy/ui/tokens.css` | Variables CSS puras: paleta de Charmy (`--charmy-*`), roles de interfaz (`--color-*`), tipografías (`--fuente-*`), formas (`--radio-*`) y rampas (`--rampa-conteo-1…7`, `--rampa-anomalia-1…7`, `--rampa-sin-dato`). Sirve sin Tailwind (Astro, juego). |
| `@charmy/ui/theme.css` | Lo mismo como tema de Tailwind v4 (`bg-fondo`, `text-tinta-suave`, `bg-acento`, `font-titulos`, `rounded-tarjeta`…) y con los nombres que espera shadcn/ui (`background`, `primary`, `ring`…). Ya importa `tokens.css`. |
| `@charmy/ui/fonts.css` | Bricolage Grotesque, IBM Plex Sans e IBM Plex Mono servidas desde el propio sitio (sin Google Fonts). |
| `@charmy/ui` (JS) | `paleta`, `interfaz`, `rampaConteo`, `rampaAnomalia`, `colorSinDato`, `fuentes`, `colorDeRampa(valor, cortes, rampa)` y `contraste(a, b)`, para MapLibre, Observable Plot y Phaser. |

```css
/* Con Tailwind v4 */
@import "tailwindcss";
@import "@charmy/ui/theme.css";
@import "@charmy/ui/fonts.css";
```

```ts
import { rampaConteo, colorDeRampa } from "@charmy/ui";
colorDeRampa(12, [1, 2, 5, 10, 20, 50], rampaConteo); // "#fc4e2a"
```

Dependencia: `"@charmy/ui": "workspace:*"`.

## Reglas

- **Rampas aptas para daltonismo** (ColorBrewer): YlOrRd para conteos; PuOr para anomalías, con violeta = menos
  fuego que lo normal y naranja = más. El color nunca va solo: el valor también se muestra en texto, en el tamaño o
  en la leyenda (RNF-04).
- **Contraste**: todo par de texto de `interfaz` cumple AA (4,5:1). Lo comprueba `test/tokens.test.ts`.
- `tokens.css` y `src/index.ts` tienen los mismos valores; la prueba falla si se separan.
- Los colores de Charmy son para Charmy y para acentos. El texto va en `tinta` o `tinta-suave`.
