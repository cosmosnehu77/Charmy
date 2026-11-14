import { charmySvg } from "@charmy/charmy/core";
import { interfaz, paleta, rampaConteo } from "@charmy/ui";
import Phaser from "phaser";
import dia from "../../../data/muestras/dia-juego.json";
import { CONSEJOS, cierreDePartida, fechaLarga } from "./cierre";
import { cargarDia, type DiaJuego } from "./datos";
import { apagar, dejarEscapar, marcadorInicial, planDeNivel, type Marcador } from "./partida";
import { dimensiones } from "./pantalla";
import "./pagina.css";

const { ancho: ANCHO, alto: ALTO } = dimensiones(window.innerWidth, window.innerHeight);
/** Las posiciones verticales se pensaron para 600 de alto: se escalan al alto real del lienzo. */
const Y = (y: number) => Math.round((y / 600) * ALTO);
/** Ancho de los textos largos, para que se corten en líneas dentro del lienzo. */
const LINEAS = { wordWrap: { width: ANCHO - 80 }, align: "center" } as const;
const DURACION_MS = 60_000;
/** Cuánto tarda un foco sin apagar en escaparse. */
const VIDA_FOCO_MS = 4_000;
const MARGEN = 20;
/** Lugar para el marcador, que ocupa dos líneas. */
const ARRIBA = 60;
const CLAVE_RECORD = "charmy-kids-record";

const DIA = dia as DiaJuego;
const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const TEXTO = { fontFamily: "monospace", color: interfaz.tinta } as const;

function leerRecord(): number {
  try {
    return Number(localStorage.getItem(CLAVE_RECORD)) || 0;
  } catch {
    return 0;
  }
}

function guardarRecord(puntos: number) {
  try {
    localStorage.setItem(CLAVE_RECORD, String(puntos));
  } catch {
    // Sin almacenamiento el récord dura solo esta visita.
  }
}

function cargarCharmy(escena: Phaser.Scene, clave: string, mood: "idle" | "festeja") {
  const svg = charmySvg({ mood, outfit: "bombero", size: 128 });
  // El cargador de Phaser solo acepta data URI en base64; el SVG puede traer caracteres no ASCII.
  const base64 = btoa(Array.from(new TextEncoder().encode(svg), (b) => String.fromCharCode(b)).join(""));
  escena.load.svg(clave, `data:image/svg+xml;base64,${base64}`, { width: 128, height: 128 });
}

class Inicio extends Phaser.Scene {
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
      .text(ANCHO / 2, Y(320), "Charmy Kids", { ...TEXTO, fontSize: "40px", color: paleta.acento })
      .setOrigin(0.5);
    this.add
      .text(ANCHO / 2, Y(395), `Estos son los focos de calor que vieron los satélites el ${fechaLarga(DIA.fecha)}.\nTocalos para apagarlos. Si apagás seguido, sumás combo.`, {
        ...TEXTO,
        ...LINEAS,
        fontSize: "18px",
      })
      .setOrigin(0.5);
    const record = leerRecord();
    if (record > 0) {
      this.add.text(ANCHO / 2, Y(455), `Tu récord: ${record}`, { ...TEXTO, fontSize: "18px" }).setOrigin(0.5);
    }
    boton(this, ANCHO / 2, Y(510), "Jugar", () => this.scene.start("nivel"));
  }
}

class Nivel extends Phaser.Scene {
  private marcador: Marcador = marcadorInicial();
  /** Reloj de la partida: el contador y el combo usan el mismo tiempo que los temporizadores de la escena. */
  private reloj!: Phaser.Time.TimerEvent;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super("nivel");
  }

  create() {
    this.marcador = marcadorInicial();
    this.hud = this.add.text(12, 8, "", { ...TEXTO, fontSize: "18px" }).setDepth(10);
    this.add.image(ANCHO - 64, ALTO - 64, "charmy").setScale(0.75).setDepth(10);

    // Margen arriba para el marcador y a los costados para que ningún foco quede cortado.
    const focos = cargarDia(DIA, { ancho: ANCHO - 2 * MARGEN, alto: ALTO - ARRIBA - MARGEN });
    for (const foco of planDeNivel(focos, DURACION_MS - VIDA_FOCO_MS)) {
      this.time.delayedCall(foco.apareceMs, () => this.encender(foco.x + MARGEN, foco.y + ARRIBA, foco.frp));
    }
    this.reloj = this.time.delayedCall(DURACION_MS, () => {
      this.scene.start("fin", this.marcador);
    });
  }

  private encender(x: number, y: number, frp: number) {
    // Más potencia (FRP), color más intenso de la rampa de conteo.
    const tono = rampaConteo[Math.min(rampaConteo.length - 1, 3 + Math.floor(Math.log2(1 + frp)))]!;
    const foco = this.add.rectangle(Math.round(x), Math.round(y), 10, 10, color(tono));
    foco.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-12, -12, 34, 34),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const titila = this.tweens.add({ targets: foco, scale: 1.4, duration: 300, yoyo: true, repeat: -1 });
    const escape = this.time.delayedCall(VIDA_FOCO_MS, () => {
      titila.stop();
      foco.destroy();
      this.marcador = dejarEscapar(this.marcador);
    });
    foco.once("pointerdown", () => {
      escape.remove();
      titila.stop();
      foco.destroy();
      this.marcador = apagar(this.marcador, this.reloj.getElapsed());
      if (this.marcador.combo > 1) {
        const aviso = this.add
          .text(x, y - 12, `x${this.marcador.combo}`, { ...TEXTO, fontSize: "14px", color: paleta.acento })
          .setOrigin(0.5);
        this.tweens.add({ targets: aviso, y: y - 36, alpha: 0, duration: 600, onComplete: () => aviso.destroy() });
      }
    });
  }

  update() {
    const restante = Math.ceil(this.reloj.getRemaining() / 1000);
    const m = this.marcador;
    this.hud.setText(`Puntos ${m.puntos}   Combo x${m.combo}\nApagados ${m.apagados}   Tiempo ${restante}s`);
  }
}

class Fin extends Phaser.Scene {
  constructor() {
    super("fin");
  }

  create(m: Marcador) {
    const record = leerRecord();
    const esRecord = m.puntos > record;
    if (esRecord) guardarRecord(m.puntos);
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

function boton(escena: Phaser.Scene, x: number, y: number, texto: string, alTocar: () => void) {
  const etiqueta = escena.add
    .text(x, y, texto, {
      ...TEXTO,
      fontSize: "20px",
      color: interfaz.superficie,
      backgroundColor: interfaz.acento,
      padding: { x: 20, y: 10 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  etiqueta.on("pointerdown", alTocar);
  // También con el teclado: Enter o Espacio (RNF-04). Un solo botón por escena.
  escena.input.keyboard?.once("keydown-ENTER", alTocar);
  escena.input.keyboard?.once("keydown-SPACE", alTocar);
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
