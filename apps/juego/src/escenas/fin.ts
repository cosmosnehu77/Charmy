import { interfaz, paleta } from "@charmy/ui";
import Phaser from "phaser";
import { CONSEJOS, cierreDePartida, focos } from "../cierre";
import { ANCHO, DIA, LINEAS, SONIDO, TEXTO, Y, almacen, anunciar, boton, claveCharmy } from "../comun";
import { estadoDelCierre } from "../ritmo";
import { REGLAS } from "../explorador";
import type { Modo } from "./nivel";
import type { Marcador } from "../partida";
import { guardarRecord, leerRecord } from "../record";

export class Fin extends Phaser.Scene {
  constructor() {
    super("fin");
  }

  create(m: Marcador & { modo?: Modo }) {
    const modo = m.modo ?? "normal";
    const record = leerRecord(almacen());
    // El modo explorador no suma récord (RF-KID-11).
    const esRecord = REGLAS[modo].sumaRecord && m.puntos > record;
    if (esRecord) guardarRecord(almacen(), m.puntos);
    SONIDO.tocar("fin");
    const { dato, consejo, fuentesFijas } = cierreDePartida(
      DIA,
      Math.floor(Math.random() * CONSEJOS.length),
      m.fijasTocadas,
    );

    const resumen =
      modo === "explorador"
        ? `Apagaste ${focos(m.apagados)} en el modo explorador. Este modo no suma récord.`
        : `Apagaste ${focos(m.apagados)}. Tu mejor combo fue x${m.mejorCombo}.`;
    anunciar(`Terminaste. ${resumen} ${consejo} Enter para jugar otra vez.`);
    this.add.image(ANCHO / 2, Y(120), claveCharmy("bombero", estadoDelCierre(m, esRecord)));
    this.add
      .text(ANCHO / 2, Y(210), esRecord ? `¡Nuevo récord: ${m.puntos} puntos!` : `Hiciste ${m.puntos} puntos`, {
        ...TEXTO,
        fontSize: "28px",
        color: paleta.acento,
      })
      .setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(255), resumen, {
        ...TEXTO,
        ...LINEAS,
        fontSize: "18px",
      })
      .setOrigin(0.5);
    this.add.text(ANCHO / 2, Y(325), fuentesFijas ?? dato, { ...TEXTO, ...LINEAS, fontSize: "18px" }).setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(420), consejo, { ...TEXTO, ...LINEAS, fontSize: "20px", color: interfaz.exito })
      .setOrigin(0.5);
    boton(this, ANCHO / 2, Y(520), "Jugar otra vez", () => this.scene.start("nivel", { modo }));
  }
}
