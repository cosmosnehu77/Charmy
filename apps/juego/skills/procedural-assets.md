---
name: procedural-assets
description: Genera gráficos vectoriales/pixel-art por código y efectos de sonido usando Web Audio API sin depender de archivos externos.
---

Genera todos los recursos visuales y sonoros de forma 100% procedural para que el juego funcione sin depender de assets externos:

1. **Gráficos Procedurales:** Dibuja sprites, fondos y efectos usando primitivas de Canvas 2D, SVG inline o matrices de píxeles renderizadas en un canvas off-screen (caching) para optimizar rendimiento. Incluye paletas de colores armoniosas.
2. **Audio con Web Audio API:** Crea un sintetizador ligero en JS puro (`AudioContext`) con funciones para generar sonidos retro (ej. `playJump()`, `playExplosion()`, `playCoin()`) usando osciladores (`sine`, `square`, `sawtooth`) y envolventes de ganancia (ADSR).
3. **Cero Errores 404:** No enlaces URLs externas ni rutas locales de imágenes o sonidos inexistentes.