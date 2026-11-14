# apps/juego: reglas para los agentes

Charmy Kids, juego web en Phaser 4 y pixel art 2D (D-11). Dueño: `@dimidio6` (carril E, D-25). Cloudflare Pages
publica `apps/juego/dist` al entrar cambios en `main` (`deploy-web.yml`).

## Comandos

```bash
pnpm dev --filter @charmy/juego       # http://localhost:5173
pnpm check --filter @charmy/juego     # tipos, pruebas y compilación
```

## Reglas

- Los focos salen de `data/muestras/dia-juego.json` (contrato de `packages/contracts/datos/`). `src/datos.ts` los pasa
  a coordenadas de pantalla y se prueba sin Phaser.
- Charmy se dibuja con `charmySvg()` de `@charmy/charmy/core` y se carga como textura. Nunca se copia su SVG.
- Colores con `paleta`, `interfaz` y las rampas de `@charmy/ui`. Nada de valores sueltos.
- La lógica (puntaje, combo, carga de datos) va en módulos puros con pruebas de Vitest; Phaser solo dibuja.
- `src/partida.ts` (puntaje, combo, ritmo del nivel) y `src/cierre.ts` (dato real y consejo) son puros y probados.
- En las escenas, todo tiempo de juego sale del reloj de la escena (`this.time`, `TimerEvent`), nunca de `this.time.now`
  ni de `Date.now()`: los temporizadores se frenan con la pestaña en segundo plano y el resto no.
