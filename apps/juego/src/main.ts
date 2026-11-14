import { charmySvg } from "@charmy/charmy/core";
import { interfaz, paleta, rampaConteo } from "@charmy/ui";
import Phaser from "phaser";
import dia from "../../../data/muestras/dia-juego.json";
import { cargarDia, type DiaJuego } from "./datos";

const ANCHO = 800;
const ALTO = 600;
const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

class Escena extends Phaser.Scene {
  preload() {
    const svg = charmySvg({ mood: "saluda", outfit: "bombero", size: 96 });
    // El cargador de Phaser solo acepta data URI en base64; el SVG puede traer caracteres no ASCII.
    const base64 = btoa(Array.from(new TextEncoder().encode(svg), (b) => String.fromCharCode(b)).join(""));
    this.load.svg("charmy", `data:image/svg+xml;base64,${base64}`, {
      width: 96,
      height: 96,
    });
  }

  create() {
    const datos = dia as DiaJuego;
    for (const foco of cargarDia(datos, { ancho: ANCHO, alto: ALTO })) {
      this.add.rectangle(Math.round(foco.x), Math.round(foco.y), 6, 6, color(rampaConteo[5]));
    }
    this.add.image(ANCHO - 64, ALTO - 64, "charmy");
    this.add.text(12, 12, `Focos del ${datos.fecha}\n${datos.fuente}`, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: interfaz.tinta,
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "juego",
  width: ANCHO,
  height: ALTO,
  pixelArt: true,
  backgroundColor: paleta.cielo,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: Escena,
});
