import { interfaz, paleta, rampaConteo } from "@charmy/ui";
import Phaser from "phaser";
import { crearAzar, type Azar } from "../azar";
import { ALTO, ANCHO, DIA, SONIDO, TEXTO, color, dibujarFondo } from "../comun";
import { cargarDia } from "../datos";
import { aCelda, centroDe, crearGrilla, type Grilla } from "../grilla";
import { DURACION_PASADAS_MS, planPorPasadas, potencia, type Ventana } from "../mecanica";
import {
  encenderFoco,
  escaparFoco,
  focoActivo,
  focoPropagado,
  golpearFoco,
  nuevaPartida,
  verificarFoco,
  type FocoActivo,
  type Partida,
} from "../partida";
import { propagar, type Viento } from "../propagacion";

const DURACION_MS = 60_000;
const MARGEN = 20;
/** Lugar para el marcador, que ocupa dos líneas. */
const ARRIBA = 60;
/** Cuánto hay que mantener apretado un foco de confianza baja para verificarlo. */
const VERIFICAR_MS = 500;
/** Lado del cuadro de un foco: crece con los toques que le faltan. */
const lado = (golpes: number) => 7 + 3 * golpes;
/** Hora de Argentina (UTC−3) de una hora UTC. */
const horaArgentina = (horaUtc: number) => (horaUtc + 21) % 24;
/** Lado de las celdas por las que se propaga el fuego. */
const LADO_CELDA = 24;
/** El viento real del día llega con F4-C2 (después del envío). Hasta entonces el fuego se propaga sin dirección. */
const VIENTO: Viento | null = null;

export class Nivel extends Phaser.Scene {
  private partida: Partida = nuevaPartida();
  /** Reloj de la partida: el contador y el combo usan el mismo tiempo que los temporizadores de la escena. */
  private reloj!: Phaser.Time.TimerEvent;
  private hud!: Phaser.GameObjects.Text;
  private grilla!: Grilla;
  /** Azar de la partida, con la fecha del día como semilla. */
  private azar!: Azar;
  private proximoId = 0;

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
    this.grilla = crearGrilla(area, LADO_CELDA);
    this.azar = crearAzar(DIA.fecha);
    const plan = planPorPasadas(cargarDia(DIA, area), area.alto, DURACION_PASADAS_MS);
    this.proximoId = plan.focos.length;
    for (const ventana of plan.ventanas) {
      this.time.delayedCall(ventana.desdeMs, () => this.pasada(ventana, area.alto));
    }
    plan.focos.forEach((foco, id) => {
      this.time.delayedCall(foco.apareceMs, () =>
        this.encender(focoActivo(id, { ...foco, x: foco.x + MARGEN, y: foco.y + ARRIBA })),
      );
    });
    this.reloj = this.time.delayedCall(DURACION_MS, () => {
      this.scene.start("fin", this.partida.marcador);
    });
  }

  /** La franja del satélite cruza el área de juego mientras dura su pasada. */
  private pasada(v: Ventana, alto: number) {
    const [desde, hasta] = v.haciaElSur ? [ARRIBA, ARRIBA + alto] : [ARRIBA + alto, ARRIBA];
    const franja = this.add.rectangle(ANCHO / 2, desde, ANCHO, 6, color(paleta.llama)).setAlpha(0.35).setDepth(5);
    const rotulo = this.add
      .text(12, desde, `Pasada del satélite: ${horaArgentina(v.hora)} h`, {
        ...TEXTO,
        fontSize: "13px",
        color: interfaz.tintaSuave,
      })
      .setOrigin(0, v.haciaElSur ? 1 : 0)
      .setDepth(5);
    this.tweens.add({
      targets: [franja, rotulo],
      y: hasta,
      duration: v.hastaMs - v.desdeMs,
      onComplete: () => {
        franja.destroy();
        rotulo.destroy();
      },
    });
  }

  private encender(foco: FocoActivo) {
    this.partida = encenderFoco(this.partida, foco);
    const { id, x, y, frp } = foco;
    // Más potencia (FRP), color más intenso de la rampa de conteo. Una fuente fija va en gris y no titila.
    const tono = foco.fuenteFija
      ? interfaz.tintaSuave
      : rampaConteo[Math.min(rampaConteo.length - 1, 3 + Math.floor(Math.log2(1 + frp)))]!;
    const cuadro = this.add.rectangle(Math.round(x), Math.round(y), lado(foco.golpes), lado(foco.golpes), color(tono));
    cuadro.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-12, -12, 34, 34),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const titila = foco.fuenteFija
      ? null
      : this.tweens.add({ targets: cuadro, scale: 1.3, duration: 300, yoyo: true, repeat: -1 });
    // Confianza baja: puede ser una falsa alarma. Se marca con "?" hasta que se verifica.
    const duda =
      foco.confianza === "low"
        ? this.add.text(x, y - 10, "?", { ...TEXTO, fontSize: "14px", color: interfaz.tinta }).setOrigin(0.5, 1)
        : null;
    const borrar = () => {
      titila?.stop();
      cuadro.destroy();
      duda?.destroy();
    };
    const escape = this.time.delayedCall(potencia(frp).escapeMs, () => {
      borrar();
      this.partida = escaparFoco(this.partida, id);
      if (foco.fuenteFija) return;
      SONIDO.tocar("escape");
      this.propagar(foco);
    });

    const golpe = () => {
      const antes = this.partida.marcador.puntos;
      this.partida = golpearFoco(this.partida, id, this.reloj.getElapsed());
      const { marcador } = this.partida;
      const sigue = this.partida.activos.find((f) => f.id === id);
      if (marcador.puntos < antes) this.flotar(x, y, `-${antes - marcador.puntos}`, interfaz.peligro);
      if (sigue) {
        cuadro.setSize(lado(sigue.golpes), lado(sigue.golpes));
        SONIDO.tocar("apagar");
        return;
      }
      escape.remove();
      borrar();
      if (foco.fuenteFija) {
        SONIDO.tocar("escape");
        return;
      }
      SONIDO.tocar(marcador.combo > 1 ? "combo" : "apagar");
      if (marcador.combo > 1) this.flotar(x, y, `x${marcador.combo}`, paleta.acento);
    };

    let mantener: Phaser.Time.TimerEvent | null = null;
    cuadro.on("pointerdown", () => {
      const actual = this.partida.activos.find((f) => f.id === id);
      if (!actual) return;
      if (actual.confianza !== "low" || actual.verificado) return golpe();
      // Mantener apretado verifica; soltar antes es un toque sin verificar.
      mantener = this.time.delayedCall(VERIFICAR_MS, () => {
        mantener = null;
        this.partida = verificarFoco(this.partida, id);
        duda?.setText("✓");
      });
    });
    const soltar = () => {
      if (!mantener) return;
      mantener.remove();
      mantener = null;
      golpe();
    };
    cuadro.on("pointerup", soltar);
    cuadro.on("pointerout", soltar);
  }

  /** Un foco que se escapa enciende celdas vecinas, sesgadas por el viento, hasta el tope de encendidas. */
  private propagar(foco: FocoActivo) {
    const celda = (f: { x: number; y: number }) => aCelda(this.grilla, f.x - MARGEN, f.y - ARRIBA);
    const encendidas = this.partida.activos.filter((f) => !f.fuenteFija).map(celda);
    for (const nueva of propagar(this.grilla, celda(foco), encendidas, this.azar, VIENTO)) {
      const { x, y } = centroDe(this.grilla, nueva);
      this.encender(focoPropagado(this.proximoId++, x + MARGEN, y + ARRIBA));
    }
  }

  private flotar(x: number, y: number, texto: string, tinta: string) {
    const aviso = this.add.text(x, y - 12, texto, { ...TEXTO, fontSize: "14px", color: tinta }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: aviso, y: y - 36, alpha: 0, duration: 600, onComplete: () => aviso.destroy() });
  }

  update() {
    const restante = Math.ceil(this.reloj.getRemaining() / 1000);
    const m = this.partida.marcador;
    this.hud.setText(`Puntos ${m.puntos}   Combo x${m.combo}\nApagados ${m.apagados}   Tiempo ${restante}s`);
  }
}
