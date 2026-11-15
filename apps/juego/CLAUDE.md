# apps/juego: reglas para los agentes

Charmy Brigada, juego web en Phaser 4 y pixel art 2D (D-11). Dueño: `@dimidio6` (carril E, D-25). Cloudflare Pages
publica `apps/juego/dist` al entrar cambios en `main` (`deploy-web.yml`).

## Comandos

```bash
pnpm dev --filter @charmy/juego       # http://localhost:5173
pnpm check --filter @charmy/juego     # tipos, pruebas y compilación
pnpm --filter @charmy/juego contorno  # regenera src/fondo.json desde data/muestras/regiones.geojson
```

## Reglas

- Los focos salen de `data/muestras/dia-juego.json` (contrato de `packages/contracts/datos/`). `src/datos.ts` los pasa
  a coordenadas de pantalla y se prueba sin Phaser.
- Charmy se dibuja con `charmySvg()` de `@charmy/charmy/core` y se carga como textura. Nunca se copia su SVG.
- Colores con `paleta`, `interfaz` y las rampas de `@charmy/ui`. Nada de valores sueltos.
- La lógica (puntaje, combo, carga de datos) va en módulos puros con pruebas de Vitest; Phaser solo dibuja.
- Una escena de Phaser por archivo en `src/escenas/` (`inicio`, `nivel`, `fin`); lo compartido (tamaño del lienzo,
  textos, botón, fondo) en `src/comun.ts`. `src/main.ts` solo arma el juego.
- Todo azar del juego sale de `crearAzar(semilla)` (`src/azar.ts`), con una fecha `AAAA-MM-DD` como semilla.
- `src/grilla.ts` pasa del lienzo a celdas y de vuelta. `src/contorno.ts` simplifica las regiones y proyecta igual
  que los focos; su resultado, `src/fondo.json`, es generado: no se edita a mano (una prueba lo compara).
- `src/mecanica.ts` pasa el dato real a la mecánica: tabla de FRP a toques y tiempo de escape, y pasadas del
  satélite por hora de detección (de noche la franja baja, de día sube).
- `src/propagacion.ts`: un foco que se escapa enciende celdas vecinas de la grilla, con el azar de la partida y
  sesgadas por el viento, hasta un tope. Hasta F4-C2 no hay viento (`VIENTO = null` en el nivel).
- `src/partida.ts` (puntaje, combo, penalidades y el estado de la partida: focos activos, tanque de agua, herramienta
  elegida, avión y cortafuegos), `src/ritmo.ts` (estado de Charmy y curva de dificultad) y `src/lagos.ts` (lagos
  donde se recarga, con posición aproximada), `src/cierre.ts` (dato real y consejo) y `src/record.ts` (récord en
  el navegador, que sigue leyendo la clave de cuando el juego se llamaba Charmy Kids) son puros y probados.
- Las herramientas (una por vestuario de Charmy) se eligen en una barra de HTML (`#herramientas`, `src/barra.ts`),
  para el dedo, el teclado (1 a 4) y el lector de pantalla. Charmy en el nivel lleva el vestuario de la herramienta.
- El sonido sale de `SONIDO` (`src/sonido.ts`, Web Audio, sin archivos). El silencio es un botón de HTML en el pie
  y se recuerda en el navegador.
- En las escenas, todo tiempo de juego sale del reloj de la escena (`this.time`, `TimerEvent`), nunca de `this.time.now`
  ni de `Date.now()`: los temporizadores se frenan con la pestaña en segundo plano y el resto no.
