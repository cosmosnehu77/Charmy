import { paleta } from "@charmy/ui";
import Phaser from "phaser";
import { ALTO, ANCHO, SONIDO, almacen, usarDesafio } from "./comun";
import { ESPERA_MS, cargarDesafio, fechaDeAyerArgentina } from "./desafio";
import { Fin } from "./escenas/fin";
import { Inicio } from "./escenas/inicio";
import { Nivel } from "./escenas/nivel";
import { guardarSilencio } from "./sonido";
import "./pagina.css";

/** Botón de silencio de la página: un botón de HTML, así se usa con teclado y lector de pantalla. */
const silencio = document.querySelector<HTMLButtonElement>("#silencio");
if (silencio) {
  const mostrar = () => {
    silencio.setAttribute("aria-pressed", String(SONIDO.silenciado()));
    silencio.textContent = SONIDO.silenciado() ? "Sonido: no" : "Sonido: sí";
  };
  mostrar();
  silencio.addEventListener("click", () => {
    SONIDO.silenciar(!SONIDO.silenciado());
    guardarSilencio(almacen(), SONIDO.silenciado());
    mostrar();
  });
  // Enter o Espacio sobre el botón no deben llegar al juego (empezarían la partida).
  silencio.addEventListener("keydown", (e) => e.stopPropagation());
}

// Desafío del día: los focos de ayer (hora de Argentina) desde nuestra API; si no llegan, la muestra.
usarDesafio(
  await cargarDesafio(fechaDeAyerArgentina(new Date()), {
    base: import.meta.env.VITE_API_URL ?? "",
    pedir: (url, init) => fetch(url, init),
    tiempoMs: ESPERA_MS,
  }),
);

const juego = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "juego",
  width: ANCHO,
  height: ALTO,
  pixelArt: true,
  backgroundColor: paleta.cielo,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Inicio, Nivel, Fin],
});

/** Modo explorador (accesibilidad): un botón de HTML, que encuentran el teclado y el lector de pantalla. */
const explorador = document.querySelector<HTMLButtonElement>("#explorador");
explorador?.addEventListener("click", () => {
  for (const escena of juego.scene.getScenes(true)) escena.scene.stop();
  juego.scene.start("nivel", { modo: "explorador" });
  // Si el foco queda en el botón, sus teclas no llegan al juego (ver el keydown de abajo).
  explorador.blur();
});
explorador?.addEventListener("keydown", (e) => e.stopPropagation());
