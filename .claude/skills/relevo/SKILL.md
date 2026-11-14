---
name: relevo
description: Relevo de una tarea cuando la persona se queda sin uso de tokens (alrededor del 90 % de su límite) o vuelve después. Usar cuando la persona dice "relevo", "me quedo sin tokens", "llegué al 90 %", "dejá todo para que siga otro", cuando aparece un aviso de límite de uso, cuando el tablero trae un mensaje RELEVO que te nombra, o cuando la persona dice que vuelve a su tarea.
---

# Relevo

El trabajo no se para porque una persona se quede sin uso. Quien se va deja la tarea lista en pocos tokens; otra
persona la sigue **por un rato** y la devuelve cuando el dueño vuelve. Reglas completas: `AGENTS.md` §7, `PLAN.md` D-24.

El agente no ve el uso de tokens de su persona. El aviso viene de la persona (`/usage` en Claude Code, o el aviso de
límite que muestra la terminal). Si ves ese aviso en la conversación, propón el relevo vos mismo. Al 90 % queda poco:
no explores ni refactorices, haz solo estos pasos.

## Dejar (te quedás sin uso)

1. Commitea tus archivos con un mensaje que diga dónde quedaste (`F2-C1: /calendar a medias, falta 429`). Nada de
   `git add -A`. Si algo no compila, igual commitealo y dilo en "qué falta".
2. Corre, con un "qué falta" **concreto** (el próximo paso, las pruebas mínimas pendientes y cualquier decisión abierta):
   ```bash
   tools/relevo dejar "Falta: X. Próximo paso: Y. Pruebas pendientes: Z. Ojo con: W." @login-sugerido
   ```
   Pushea la rama, abre el PR en borrador si no hay, deja la nota en el issue con la etiqueta `relevo` y avisa en el
   tablero. Si no hay rama `<issue>-<slug>` o hay cambios sin commit, se niega y dice por qué.
3. Respondé a tu persona con el enlace del PR y nada más.

Si tu persona es el líder, su mensaje ya asigna a quien nombra. Si no, el líder confirma en el tablero.

## Tomar (te nombran en un RELEVO)

1. **Solo con confirmación:** el líder te confirmó en el tablero, o el que se va es el líder y te nombró. Si no, pregunta.
2. `tools/relevo tomar <issue>`: baja la rama y muestra la nota. Leé "Qué falta" y las "Pruebas mínimas" del issue.
3. Seguí con las reglas de siempre (prueba primero, YAGNI, `tools/al-dia`), con estos límites:
   - solo las carpetas de **esa** tarea; el traspaso es temporal y no abre las demás carpetas del dueño;
   - nada de rutas protegidas ni de poderes del líder: un PR que las toca espera a que el líder vuelva;
   - commits chicos y `git push` seguido, sin force-push, para que el dueño encuentre todo al volver;
   - podés terminar y fusionar el PR si el dueño no volvió y todo está probado (sale del borrador con
     `gh pr ready`). Avisá en el tablero.
4. Cuando el dueño avise que vuelve: pushea lo que tengas y deja de tocar la rama.

## Volver (recuperaste uso)

`tools/relevo volver <issue>`: baja lo que hizo quien te relevó, saca la etiqueta y le avisa que pare. Leé los
commits nuevos antes de seguir (`git log`).
