import { interfaz, paleta } from "@charmy/ui";
import Phaser from "phaser";
import { CONSEJOS, cierreDePartida } from "../cierre";
import { ANCHO, DIA, LINEAS, SONIDO, TEXTO, Y, almacen, boton } from "../comun";
import type { Marcador } from "../partida";
import { guardarRecord, leerRecord } from "../record";

export class Fin extends Phaser.Scene {
  constructor() {
    super("fin");
  }

  create(m: Marcador) {
    const record = leerRecord(almacen());
    const esRecord = m.puntos > record;
    if (esRecord) guardarRecord(almacen(), m.puntos);
    SONIDO.tocar("fin");
    const { dato, consejo } = cierreDePartida(DIA, Math.floor(Math.random() * CONSEJOS.length));

    this.add.image(ANCHO / 2, Y(120), "charmy-festeja");
    this.add
      .text(ANCHO / 2, Y(210), esRecord ? `¡Nuevo récord: ${m.puntos} puntos!` : `Hiciste ${m.puntos} puntos`, {
        ...TEXTO,
        fontSize: "28px",
        color: paleta.acento,
      })
      .setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(255), `Apagaste ${m.apagados} focos. Tu mejor combo fue x${m.mejorCombo}.`, {
        ...TEXTO,
        ...LINEAS,
        fontSize: "18px",
      })
      .setOrigin(0.5);
    this.add.text(ANCHO / 2, Y(325), dato, { ...TEXTO, ...LINEAS, fontSize: "18px" }).setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(420), consejo, { ...TEXTO, ...LINEAS, fontSize: "20px", color: interfaz.exito })
      .setOrigin(0.5);
    boton(this, ANCHO / 2, Y(520), "Jugar otra vez", () => this.scene.start("nivel"));
  }
}
