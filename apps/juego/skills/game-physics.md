---
name: game-physics
description: Implementa mecánicas de movimiento fluido, detección de colisiones y efectos de "game feel" (juice).
---

Implementa o refactoriza las mecánicas de movimiento y físicas siguiendo estas reglas estrictas:

1. **Delta Time:** Todo movimiento debe multiplicarse por `dt` (tiempo transcurrido entre frames) para garantizar la misma velocidad en monitores de 60Hz y 144Hz.
2. **Movimiento Orgánico:** Evita cambios de posición instantáneos (`x += speed`). Usa vectores de velocidad, aceleración y fricción/amortiguación.
3. **Colisiones Precisas:** Implementa AABB (Axis-Aligned Bounding Box) o colisión circular según corresponda, separando la resolución de ejes X e Y para evitar que el jugador se atasque en esquinas.
4. **Game Feel (Juice):** Añade micro-detalles que mejoren la respuesta: *coyote time* (si es plataformas), *input buffering*, ligero *screen shake* en impactos y partículas simples al saltar o chocar.