import { paleta } from "@charmy/ui";
import Phaser from "phaser";
import { ALTO, ANCHO } from "./comun";
import { Fin } from "./escenas/fin";
import { Inicio } from "./escenas/inicio";
import { Nivel } from "./escenas/nivel";
import "./pagina.css";

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
