# apps/juego: reglas para los agentes

Charmy Brigada, juego web sobre una maqueta 3D de Sudamérica en PixiJS 8 (D-36, reemplaza a D-11). Dueño:
`@dimidio6` (carril E, D-25). Cloudflare Pages publica `apps/juego/dist` al entrar cambios en `main` (`deploy-web.yml`).

## Comandos

```bash
pnpm dev --filter @charmy/juego       # http://localhost:5173
pnpm check --filter @charmy/juego     # tipos, pruebas y compilación
```

## Reglas

- Los focos son **simulados** (D-36): aparecen por barridas del satélite en zonas de Sudamérica donde el fuego es
  habitual. El juego no llama a la API ni a FIRMS ni a Meteomatics. Lo dice la guía y lo repite el final con el 100 y
  el 132 (`AVISO_SIMULADOS` en `src/cierre.ts`).
- `src/juego.js` arma el mundo y la interfaz: maqueta en relieve (malla de Pixi con cámara en perspectiva hecha a mano),
  fuego y partículas, barridas, viento, unidades, guía de Charmy, pausa, temas claro y oscuro, inicio y final. Solo
  dibuja y conecta: las reglas van en módulos puros de TypeScript con pruebas de Vitest.
- Módulos puros y probados: `partida.ts` (puntaje, combo, agua, herramientas, costos en puntos, falsas alarmas y
  premio de los cortafuegos), `reloj.ts` (tiempo que sube al apagar y corre más rápido con más focos, victoria),
  `mecanica.ts` (de FRP a toques y tiempo de escape), `propagacion.ts` (un foco que se escapa enciende vecinos, sesgado
  por el viento), `ritmo.ts` (estado de Charmy), `lagos.ts` (fuentes de agua y ríos), `explorador.ts` (modo sin reloj
  para lector de pantalla), `cierre.ts` (consejo y frase del final), `record.ts` (récord y mejores partidas en el
  navegador, que sigue leyendo la clave de Charmy Kids), `sonido.ts` (Web Audio, sin archivos), `contorno.ts`,
  `grilla.ts` y `azar.ts`.
- Una regla nueva o un número que cambia el puntaje se escribe primero como prueba en `test/` y después en el módulo;
  `juego.js` solo lo usa.
- El mapa (`src/sudamerica.json`) sale de Natural Earth 1:50m (dominio público), simplificado. Los nombres van en
  español y las Islas Malvinas se llaman así (una prueba lo comprueba).
- Charmy se dibuja siempre con `charmySvg()` de `@charmy/charmy/core` (en el HTML y como textura de Pixi). Nunca se
  copia su SVG.
- Colores y tipografías de `@charmy/ui`: `tokens.css` y `fonts.css` en el CSS, `paleta` y `rampaConteo` en el código.
  Los pocos tonos propios del juego (hover del ámbar, agua y avisos sobre el mapa oscuro) están definidos una sola vez
  en el `:root` de `src/estilo.css`.
- Todo azar de la partida sale de `crearAzar(semilla)` (`src/azar.ts`).
- Accesibilidad: las herramientas y la cámara son botones de HTML; lo que dice el lector de pantalla va a `anunciar()`
  (la región `aria-live` `#anuncio`); las animaciones respetan `prefers-reduced-motion`.
- Idioma: el juego habla español o inglés, el mismo que la landing. Llega en el enlace (`?idioma=en`) o de lo
  guardado en `charmy-idioma` (`src/idioma.ts`). Todo texto nuevo va en los dos idiomas: los del HTML con `data-t`
  (y `data-t-aria`, `data-t-title`) en `HTML` de `src/textos.ts`; los de `juego.js` en `TEXTOS`. Las pruebas comprueban
  que no falte ninguna clave.
- La tabla de puntajes compartida (F4-E10, RF-KID-04) queda para después.
