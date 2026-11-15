import { paleta } from "@charmy/ui";
import Phaser from "phaser";
import { ALTO, ANCHO, SONIDO, almacen } from "./comun";
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

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "juego",
  width: ANCHO,
  height: ALTO,
  pixelArt: true,
  backgroundColor: paleta.cielo,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Inicio, Nivel, Fin],
});
