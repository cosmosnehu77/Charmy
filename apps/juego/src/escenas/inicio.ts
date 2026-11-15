import { paleta } from "@charmy/ui";
import Phaser from "phaser";
import { fechaLarga } from "../cierre";
import { ANCHO, DIA, LINEAS, TEXTO, Y, almacen, boton, cargarCharmy } from "../comun";
import { leerRecord } from "../record";

export class Inicio extends Phaser.Scene {
  constructor() {
    super("inicio");
  }

  preload() {
    cargarCharmy(this, "charmy", "idle");
    cargarCharmy(this, "charmy-festeja", "festeja");
  }

  create() {
    this.add.image(ANCHO / 2, Y(210), "charmy");
    this.add
      .text(ANCHO / 2, Y(320), "Charmy Brigada", { ...TEXTO, fontSize: "40px", color: paleta.acento })
      .setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(350), `Apagá los focos de calor que vieron los satélites el ${fechaLarga(DIA.fecha)}. Los más fuertes piden más toques. Si un foco tiene "?", mantenelo apretado para verificarlo.`, {
        ...TEXTO,
        ...LINEAS,
        fontSize: "18px",
      })
      .setOrigin(0.5, 0);
    const record = leerRecord(almacen());
    if (record > 0) {
      this.add.text(ANCHO / 2, Y(470), `Tu récord: ${record}`, { ...TEXTO, fontSize: "18px" }).setOrigin(0.5);
    }
    boton(this, ANCHO / 2, Y(510), "Jugar", () => this.scene.start("nivel"));
  }
}
