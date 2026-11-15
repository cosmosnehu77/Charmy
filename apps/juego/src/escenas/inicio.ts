import { paleta } from "@charmy/ui";
import Phaser from "phaser";
import { fechaLarga } from "../cierre";
import { ANCHO, DIA, LINEAS, TEXTO, Y, almacen, boton, cargarCharmy, claveCharmy } from "../comun";
import { HERRAMIENTAS } from "../partida";
import { leerRecord } from "../record";

export class Inicio extends Phaser.Scene {
  constructor() {
    super("inicio");
  }

  preload() {
    // Charmy cambia de vestuario con la herramienta y de estado con la partida.
    for (const outfit of HERRAMIENTAS) {
      for (const mood of ["idle", "alerta", "pensando"] as const) cargarCharmy(this, outfit, mood);
    }
    cargarCharmy(this, "bombero", "festeja");
    cargarCharmy(this, "bombero", "explica");
  }

  create() {
    this.add.image(ANCHO / 2, Y(210), claveCharmy("bombero", "idle"));
    this.add
      .text(ANCHO / 2, Y(320), "Charmy Brigada", { ...TEXTO, fontSize: "40px", color: paleta.acento })
      .setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(350), `Apagá los focos de calor que vieron los satélites el ${fechaLarga(DIA.fecha)}. Los más fuertes piden más toques y cada toque gasta agua: recargá en un lago. Abajo tenés más herramientas.`, {
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
