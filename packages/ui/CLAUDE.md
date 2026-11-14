# packages/ui

Dueño: `@daniace`. Es un contrato: lo consumen app, landing y juego. Nombres y valores no cambian sin anunciarlo en
el tablero mencionando a `@BrunoAguinaga0` (landing) y a quien tenga el juego.

- Un valor nuevo va en `tokens.css` **y** en `src/index.ts`; si es un rol de interfaz, también en `theme.css`.
- Rampas: solo ColorBrewer aptas para daltonismo (YlOrRd, PuOr, BrBG). No usar arcoíris ni rojo-verde.
- Antes del PR: `pnpm check --filter @charmy/ui`.
