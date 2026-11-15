---
name: game-ui
description: Crea la interfaz de usuario del juego (HUD, pantalla de inicio, Game Over y controles adaptables).
---

Construye la capa de interfaz de usuario (UI) y flujo de estados del juego:

1. **Máquina de Estados:** Gestiona claramente los estados `MENU`, `PLAYING`, `PAUSED` y `GAME_OVER`.
2. **HUD Minimalista:** Muestra puntuación, vidas o barra de energía de forma clara sin obstruir el área de juego.
3. **Persistencia:** Guarda y muestra el `High Score` usando `localStorage`.
4. **Controles Duales:** Soporta teclado (WASD / Flechas / Espacio) y añade botones táctiles en pantalla o soporte de mouse/touch si se detecta pantalla móvil.
5. **Escalado:** Centra el canvas en el viewport manteniendo su relación de aspecto sin barras de desplazamiento (`overflow: hidden`).