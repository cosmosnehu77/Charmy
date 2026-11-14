# packages/charmy

Dueño: `@dimidio6` desde la fase 3 (antes `@cosmosnehu77`). Es un contrato: la API de `README.md` no cambia sin anunciarlo en el tablero.

- `src/dibujo.ts` sale de `docs/charmy-base/Charmy.dc.html`. No se redibuja a mano: si cambia el diseño, se regenera
  desde la base, se revisa con `pnpm muestrario` y se compara con el lienzo aprobado.
- `src/core.ts` no importa React: lo usan Astro y el juego. Lo de React va solo en `src/index.tsx`.
- Todo texto libre que entre al SVG se escapa con `escaparTexto`.
- Antes del PR: `pnpm --filter @charmy/charmy check`.
- Toda animación cuelga de `.charmy[data-mood="…"]`, así la apagan `prefers-reduced-motion` y `animate={false}`.
  Si la parte animada tiene `transform` propio (los brillos), se anima solo su opacidad.
