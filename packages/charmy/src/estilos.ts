// Animaciones y globo de diálogo de Charmy. Solo CSS: no hay JavaScript corriendo por cada cuadro.
// El componente de React lo inserta una sola vez; sin React, usar "@charmy/charmy/charmy.css" o CHARMY_CSS.
// Todas las animaciones se apagan con prefers-reduced-motion o con animate={false}.

export const CHARMY_CSS = `
.charmy [data-parte="llama-cola"] {
  transform-box: fill-box; transform-origin: 50% 90%;
  animation: charmy-llama 1.1s ease-in-out infinite alternate;
}
@keyframes charmy-llama { from { transform: scale(1, 1); } to { transform: scale(0.92, 1.12) rotate(-4deg); } }

/* saluda: el brazo derecho oscila desde el hombro y las líneas de movimiento laten */
.charmy[data-mood="saluda"] [data-capa="armRUp"] {
  transform-box: view-box; transform-origin: 166px 146px;
  animation: charmy-saludo 0.9s ease-in-out infinite alternate;
}
@keyframes charmy-saludo { from { transform: rotate(-14deg); } to { transform: rotate(10deg); } }
.charmy[data-mood="saluda"] [data-capa="wave"] { animation: charmy-latido 0.9s ease-in-out infinite alternate; }
@keyframes charmy-latido { from { opacity: 0.35; } to { opacity: 1; } }

/* explica: señala con el brazo, mueve la boca al hablar y los puntos del globo se encienden en orden */
.charmy[data-mood="explica"] [data-capa="armRPoint"] {
  transform-box: view-box; transform-origin: 162px 154px;
  animation: charmy-senala 1.6s ease-in-out infinite;
}
@keyframes charmy-senala { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-7deg); } }
.charmy[data-mood="explica"] [data-capa="mouthOpen"] {
  transform-box: fill-box; transform-origin: 50% 0%;
  animation: charmy-habla 0.32s ease-in-out infinite alternate;
}
@keyframes charmy-habla { from { transform: scaleY(1); } to { transform: scaleY(0.55); } }
.charmy[data-mood="explica"] [data-capa="speech"] circle { animation: charmy-punto 1.2s ease-in-out infinite; }
.charmy[data-mood="explica"] [data-capa="speech"] circle:nth-of-type(2) { animation-delay: 0.2s; }
.charmy[data-mood="explica"] [data-capa="speech"] circle:nth-of-type(3) { animation-delay: 0.4s; }
@keyframes charmy-punto { 0%, 60%, 100% { opacity: 0.35; } 30% { opacity: 1; } }

/* alerta: se encienden las puntas de las orejas y el signo de exclamación rebota. Sin parpadeos rápidos. */
.charmy[data-mood="alerta"] [data-parte="orejas-llama"] {
  transform-box: fill-box; transform-origin: 50% 100%;
  animation: charmy-orejas 0.7s ease-in-out infinite alternate;
}
@keyframes charmy-orejas { from { transform: scale(0.85); } to { transform: scale(1.1); } }
.charmy[data-mood="alerta"] [data-parte="exclamacion"] { animation: charmy-rebote 1s ease-in-out infinite; }
@keyframes charmy-rebote { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }

/* Globo de diálogo */
.charmy-con-globo { display: inline-flex; align-items: center; gap: 0.75rem; }
.charmy-con-globo[data-globo="arriba"] { flex-direction: column-reverse; align-items: flex-start; gap: 0.5rem; }
.charmy-globo {
  position: relative; max-width: 22rem; padding: 0.55rem 0.8rem;
  background: #FFFFFF; color: #1B2430; border: 2px solid #CBD5E1; border-radius: 14px;
  font: inherit; line-height: 1.4;
  animation: charmy-globo-entra 0.22s ease-out both;
}
.charmy-globo::before, .charmy-globo::after { content: ""; position: absolute; border: solid transparent; }
.charmy-con-globo:not([data-globo="arriba"]) .charmy-globo::before {
  left: -12px; top: 50%; margin-top: -9px; border-width: 9px 12px 9px 0; border-right-color: #CBD5E1;
}
.charmy-con-globo:not([data-globo="arriba"]) .charmy-globo::after {
  left: -9px; top: 50%; margin-top: -7px; border-width: 7px 10px 7px 0; border-right-color: #FFFFFF;
}
.charmy-con-globo[data-globo="arriba"] .charmy-globo::before {
  bottom: -12px; left: 1.5rem; border-width: 12px 9px 0 9px; border-top-color: #CBD5E1;
}
.charmy-con-globo[data-globo="arriba"] .charmy-globo::after {
  bottom: -9px; left: calc(1.5rem + 2px); border-width: 10px 7px 0 7px; border-top-color: #FFFFFF;
}
@keyframes charmy-globo-entra { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* Movimiento reducido o animación apagada a pedido */
.charmy[data-animado="no"] *, .charmy-raiz[data-animado="no"] .charmy-globo { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .charmy *, .charmy-globo { animation: none !important; }
}
`;
