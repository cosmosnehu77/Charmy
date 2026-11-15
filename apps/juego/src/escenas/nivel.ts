import { paleta, rampaConteo } from "@charmy/ui";
import Phaser from "phaser";
import { ALTO, ANCHO, DIA, TEXTO, color, dibujarFondo } from "../comun";
import { cargarDia } from "../datos";
import { apagarFoco, encenderFoco, escaparFoco, nuevaPartida, planDeNivel, type FocoActivo, type Partida } from "../partida";

const DURACION_MS = 60_000;
/** Cuánto tarda un foco sin apagar en escaparse. */
const VIDA_FOCO_MS = 4_000;
const MARGEN = 20;
/** Lugar para el marcador, que ocupa dos líneas. */
const ARRIBA = 60;

export class Nivel extends Phaser.Scene {
  private partida: Partida = nuevaPartida();
  /** Reloj de la partida: el contador y el combo usan el mismo tiempo que los temporizadores de la escena. */
  private reloj!: Phaser.Time.TimerEvent;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super("nivel");
  }

  create() {
    this.partida = nuevaPartida();
    this.hud = this.add.text(12, 8, "", { ...TEXTO, fontSize: "18px" }).setDepth(10);
    this.add.image(ANCHO - 64, ALTO - 64, "charmy").setScale(0.75).setDepth(10);

    // Margen arriba para el marcador y a los costados para que ningún foco quede cortado.
    const area = { ancho: ANCHO - 2 * MARGEN, alto: ALTO - ARRIBA - MARGEN };
    dibujarFondo(this, { x: MARGEN, y: ARRIBA }, area);
    const focos = cargarDia(DIA, area);
    planDeNivel(focos, DURACION_MS - VIDA_FOCO_MS).forEach((foco, id) => {
      this.time.delayedCall(foco.apareceMs, () =>
        this.encender({ id, x: foco.x + MARGEN, y: foco.y + ARRIBA, frp: foco.frp }),
      );
    });
    this.reloj = this.time.delayedCall(DURACION_MS, () => {
      this.scene.start("fin", this.partida.marcador);
    });
  }

  private encender(foco: FocoActivo) {
    this.partida = encenderFoco(this.partida, foco);
    const { x, y, frp } = foco;
    // Más potencia (FRP), color más intenso de la rampa de conteo.
    const tono = rampaConteo[Math.min(rampaConteo.length - 1, 3 + Math.floor(Math.log2(1 + frp)))]!;
    const cuadro = this.add.rectangle(Math.round(x), Math.round(y), 10, 10, color(tono));
    cuadro.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-12, -12, 34, 34),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const titila = this.tweens.add({ targets: cuadro, scale: 1.4, duration: 300, yoyo: true, repeat: -1 });
    const borrar = () => {
      titila.stop();
      cuadro.destroy();
    };
    const escape = this.time.delayedCall(VIDA_FOCO_MS, () => {
      borrar();
      this.partida = escaparFoco(this.partida, foco.id);
    });
    cuadro.once("pointerdown", () => {
      escape.remove();
      borrar();
      this.partida = apagarFoco(this.partida, foco.id, this.reloj.getElapsed());
      const { combo } = this.partida.marcador;
      if (combo > 1) {
        const aviso = this.add
          .text(x, y - 12, `x${combo}`, { ...TEXTO, fontSize: "14px", color: paleta.acento })
          .setOrigin(0.5);
        this.tweens.add({ targets: aviso, y: y - 36, alpha: 0, duration: 600, onComplete: () => aviso.destroy() });
      }
    });
  }

  update() {
    const restante = Math.ceil(this.reloj.getRemaining() / 1000);
    const m = this.partida.marcador;
    this.hud.setText(`Puntos ${m.puntos}   Combo x${m.combo}\nApagados ${m.apagados}   Tiempo ${restante}s`);
  }
}
