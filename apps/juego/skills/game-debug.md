---
name: game-debug
description: Audita el código del videojuego en busca de fugas de memoria, caídas de FPS y errores de colisión.
---

Analiza el código actual del videojuego y optimízalo:

1. **Memory Leaks:** Verifica que los proyectiles, partículas o enemigos fuera de pantalla se eliminen correctamente de los arrays y que los `eventListeners` se limpien al reiniciar.
2. **Rendimiento de Renderizado:** Evita crear objetos o gradientes nuevos dentro del bucle `draw()`. Implementa *Object Pooling* si hay muchas entidades simultáneas.
3. **Modo Debug (Tecla F1 o D):** Añade una bandera `DEBUG_MODE` que dibuje las cajas de colisión (hitboxes) en rojo, vectores de velocidad en verde y un contador de FPS en la esquina superior.