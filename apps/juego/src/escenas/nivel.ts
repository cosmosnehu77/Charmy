import { interfaz, paleta, rampaConteo } from "@charmy/ui";
import Phaser from "phaser";
import { crearAzar, type Azar } from "../azar";
import { barra, AYUDAS, type Barra } from "../barra";
import { ALTO, ANCHO, DIA, SONIDO, TEXTO, claveCharmy, color, dibujarFondo } from "../comun";
import { encuadre, proyectar } from "../contorno";
import { cargarDia } from "../datos";
import { aCelda, centroDe, crearGrilla, type Grilla } from "../grilla";
import { LAGOS, lagoTocado, type LagoEnPantalla } from "../lagos";
import { DURACION_PARTIDA_MS, DURACION_PASADAS_MS, planPorPasadas, potencia, type Ventana } from "../mecanica";
import {
  HERRAMIENTAS,
  RADIO_AVION,
  TANQUE,
  elegirHerramienta,
  encenderFoco,
  escaparFoco,
  focoActivo,
  focoPropagado,
  golpearFoco,
  lanzarAvion,
  nuevaPartida,
  ponerCortafuegos,
  recargar,
  tocarFoco,
  verificarFoco,
  type FocoActivo,
  type Herramienta,
  type Partida,
} from "../partida";
import { propagar, type Viento } from "../propagacion";
import { estadoDeCharmy, factorDeTramo } from "../ritmo";

const MARGEN = 20;
/** Lugar para el marcador, que ocupa dos líneas. */
const ARRIBA = 60;
/** Cuánto hay que mantener apretado un foco de confianza baja para verificarlo con agua en la mano. */
const VERIFICAR_MS = 500;
/** Lado del cuadro de un foco: crece con los toques que le faltan. */
const lado = (golpes: number) => 7 + 3 * golpes;
/** Hora de Argentina (UTC−3) de una hora UTC. */
const horaArgentina = (horaUtc: number) => (horaUtc + 21) % 24;
/** Lado de las celdas por las que se propaga el fuego. */
const LADO_CELDA = 24;
/** Distancia (en píxeles del lienzo) a la que un toque alcanza un lago. */
const RADIO_LAGO = 16;
/** El viento real del día llega con F4-C2 (después del envío). Hasta entonces el fuego se propaga sin dirección. */
const VIENTO: Viento | null = null;
const TECLAS = ["ONE", "TWO", "THREE", "FOUR"] as const;

/** Lo que se dibujó de un foco, para borrarlo o actualizarlo cuando cambia el estado de la partida. */
interface Dibujo {
  cuadro: Phaser.GameObjects.Rectangle;
  duda: Phaser.GameObjects.Text | null;
  borrar(): void;
}

export class Nivel extends Phaser.Scene {
  private partida: Partida = nuevaPartida();
  /** Reloj de la partida: el contador y el combo usan el mismo tiempo que los temporizadores de la escena. */
  private reloj!: Phaser.Time.TimerEvent;
  private hud!: Phaser.GameObjects.Text;
  private ayuda!: Phaser.GameObjects.Text;
  private charmy!: Phaser.GameObjects.Image;
  private grilla!: Grilla;
  /** Azar de la partida, con la fecha del día como semilla. */
  private azar!: Azar;
  private proximoId = 0;
  /** Esquina superior izquierda del mapa en el lienzo. */
  private origen = { x: 0, y: 0 };
  private lagos: LagoEnPantalla[] = [];
  private dibujos = new Map<number, Dibujo>();
  private cortafuegos!: Phaser.GameObjects.Graphics;
  private barra!: Barra;

  constructor() {
    super("nivel");
  }

  create() {
    this.partida = nuevaPartida();
    this.dibujos = new Map();
    this.hud = this.add.text(12, 8, "", { ...TEXTO, fontSize: "18px" }).setDepth(10);
    this.charmy = this.add.image(ANCHO - 64, ALTO - 64, claveCharmy("bombero", "idle")).setScale(0.75).setDepth(10);
    this.ayuda = this.add
      .text(12, ALTO - 8, AYUDAS.bombero, { ...TEXTO, fontSize: "13px", color: interfaz.tintaSuave, wordWrap: { width: ANCHO - 140 } })
      .setOrigin(0, 1)
      .setDepth(10);

    // El mapa conserva su proporción real (no se estira) y se centra en el área de juego.
    const mapa = encuadre(DIA.bbox, { ancho: ANCHO - 2 * MARGEN, alto: ALTO - ARRIBA - MARGEN });
    const area = { ancho: mapa.ancho, alto: mapa.alto };
    this.origen = { x: MARGEN + mapa.dx, y: ARRIBA + mapa.dy };
    dibujarFondo(this, this.origen, area);
    this.grilla = crearGrilla(area, LADO_CELDA);
    this.azar = crearAzar(DIA.fecha);
    this.cortafuegos = this.add.graphics().setDepth(1);

    // Toques en el mapa: el avión y los cortafuegos. Va debajo de los focos y de los lagos.
    this.add
      .zone(this.origen.x, this.origen.y, area.ancho, area.alto)
      .setOrigin(0)
      .setInteractive()
      .on("pointerdown", (p: Phaser.Input.Pointer) => this.tocarMapa(p.worldX, p.worldY));
    this.dibujarLagos(area);

    const plan = planPorPasadas(cargarDia(DIA, area), area.alto, DURACION_PASADAS_MS);
    this.proximoId = plan.focos.length;
    for (const ventana of plan.ventanas) {
      this.time.delayedCall(ventana.desdeMs, () => this.pasada(ventana, area.alto));
    }
    plan.focos.forEach((foco, id) => {
      this.time.delayedCall(foco.apareceMs, () =>
        this.encender(focoActivo(id, { ...foco, x: foco.x + this.origen.x, y: foco.y + this.origen.y })),
      );
    });
    this.reloj = this.time.delayedCall(DURACION_PARTIDA_MS, () => {
      this.scene.start("fin", this.partida.marcador);
    });

    this.barra = barra((h) => this.elegir(h));
    this.barra.marcar("bombero");
    this.barra.mostrar();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.barra.ocultar());
    TECLAS.forEach((tecla, i) => this.input.keyboard?.on(`keydown-${tecla}`, () => this.elegir(HERRAMIENTAS[i]!)));
  }

  private elegir(h: Herramienta) {
    this.partida = elegirHerramienta(this.partida, h);
    this.barra.marcar(h);
    this.ayuda.setText(AYUDAS[h]);
  }

  private dibujarLagos(area: { ancho: number; alto: number }) {
    this.lagos = LAGOS.map((l) => {
      const { x, y } = proyectar([l.lon, l.lat], DIA.bbox, area);
      return { nombre: l.nombre, x: x + this.origen.x, y: y + this.origen.y };
    });
    for (const l of this.lagos) {
      // Un lago es un hueco en la tierra: del color del agua de afuera, con borde.
      const lago = this.add
        .circle(l.x, l.y, 8, color(paleta.cielo))
        .setStrokeStyle(2, color(interfaz.tintaSuave))
        .setDepth(2);
      lago.setInteractive({
        hitArea: new Phaser.Geom.Circle(8, 8, RADIO_LAGO),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      });
      lago.on("pointerdown", () => this.alLago());
    }
  }

  private alLago() {
    if (this.partida.agua === TANQUE) return;
    this.partida = recargar(this.partida);
    SONIDO.tocar("recarga");
  }

  /** Un toque en el mapa (o en un foco con el avión o la guía). */
  private tocarMapa(x: number, y: number) {
    if (lagoTocado(this.lagos, x, y, RADIO_LAGO)) return this.alLago();
    const ahora = this.reloj.getElapsed();
    if (this.partida.herramienta === "piloto") {
      const antes = this.partida;
      this.partida = lanzarAvion(this.partida, x, y, ahora);
      if (this.partida === antes) return;
      const zona = this.add.circle(x, y, RADIO_AVION).setStrokeStyle(3, color(interfaz.tintaSuave)).setDepth(6);
      this.tweens.add({ targets: zona, alpha: 0, scale: 1.2, duration: 500, onComplete: () => zona.destroy() });
      SONIDO.tocar("recarga");
      this.sincronizar();
    } else if (this.partida.herramienta === "guia") {
      this.partida = ponerCortafuegos(this.partida, aCelda(this.grilla, x - this.origen.x, y - this.origen.y));
      this.dibujarCortafuegos();
    }
  }

  private dibujarCortafuegos() {
    const g = this.cortafuegos.clear();
    g.fillStyle(color(paleta.banda));
    for (const c of this.partida.cortafuegos) {
      const { x, y } = centroDe(this.grilla, c);
      g.fillRect(x + this.origen.x - LADO_CELDA / 2 + 3, y + this.origen.y - LADO_CELDA / 2 + 3, LADO_CELDA - 6, LADO_CELDA - 6);
    }
  }

  /** La franja del satélite cruza el mapa mientras dura su pasada. */
  private pasada(v: Ventana, alto: number) {
    const arriba = this.origen.y;
    const [desde, hasta] = v.haciaElSur ? [arriba, arriba + alto] : [arriba + alto, arriba];
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
    const cuadro = this.add
      .rectangle(Math.round(x), Math.round(y), lado(foco.golpes), lado(foco.golpes), color(tono))
      .setDepth(3);
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
        ? this.add.text(x, y - 10, "?", { ...TEXTO, fontSize: "14px" }).setOrigin(0.5, 1).setDepth(4)
        : null;
    // El ritmo crece por tramo: al principio los focos tardan más en escaparse.
    const escapeMs = potencia(frp).escapeMs * factorDeTramo(this.reloj?.getElapsed() ?? 0, DURACION_PASADAS_MS);
    const escape = this.time.delayedCall(escapeMs, () => {
      this.partida = escaparFoco(this.partida, id);
      this.sincronizar();
      if (foco.fuenteFija) return;
      SONIDO.tocar("escape");
      this.propagar(foco);
    });
    this.dibujos.set(id, {
      cuadro,
      duda,
      borrar: () => {
        escape.remove();
        titila?.stop();
        cuadro.destroy();
        duda?.destroy();
      },
    });

    let mantener: Phaser.Time.TimerEvent | null = null;
    cuadro.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const actual = this.partida.activos.find((f) => f.id === id);
      if (!actual) return;
      const h = this.partida.herramienta;
      if (h === "guia" || h === "piloto") return this.tocarMapa(p.worldX, p.worldY);
      if (h === "bombero" && actual.confianza === "low" && !actual.verificado) {
        // Con agua, mantener apretado verifica; soltar antes es un toque sin verificar.
        mantener = this.time.delayedCall(VERIFICAR_MS, () => {
          mantener = null;
          this.partida = verificarFoco(this.partida, id);
          this.sincronizar();
        });
        return;
      }
      this.tocar(id);
    });
    const soltar = () => {
      if (!mantener) return;
      mantener.remove();
      mantener = null;
      this.tocar(id);
    };
    cuadro.on("pointerup", soltar);
    cuadro.on("pointerout", soltar);
  }

  /** Un toque a un foco con el agua o la científica. */
  private tocar(id: number) {
    const foco = this.partida.activos.find((f) => f.id === id);
    if (!foco) return;
    if (this.partida.herramienta === "bombero" && this.partida.agua < 1) {
      this.flotar(foco.x, foco.y, "Sin agua: tocá un lago", interfaz.peligro);
      return;
    }
    const antes = this.partida.marcador;
    this.partida = tocarFoco(this.partida, id, this.reloj.getElapsed());
    const { marcador } = this.partida;
    if (marcador.puntos < antes.puntos) this.flotar(foco.x, foco.y, `-${antes.puntos - marcador.puntos}`, interfaz.peligro);
    if (marcador.apagados > antes.apagados) {
      SONIDO.tocar(marcador.combo > 1 ? "combo" : "apagar");
      if (marcador.combo > 1) this.flotar(foco.x, foco.y, `x${marcador.combo}`, paleta.acento);
    } else if (this.partida.herramienta === "bombero") {
      SONIDO.tocar(foco.fuenteFija ? "escape" : "apagar");
    }
    this.sincronizar();
  }

  /** Pone los dibujos al día con el estado: borra los focos que ya no están y achica o verifica los que siguen. */
  private sincronizar() {
    const activos = new Map(this.partida.activos.map((f) => [f.id, f]));
    for (const [id, dibujo] of this.dibujos) {
      const foco = activos.get(id);
      if (!foco) {
        dibujo.borrar();
        this.dibujos.delete(id);
        continue;
      }
      dibujo.cuadro.setSize(lado(foco.golpes), lado(foco.golpes));
      if (foco.verificado) dibujo.duda?.setText("✓");
    }
  }

  /** Un foco que se escapa enciende celdas vecinas, sesgadas por el viento, hasta el tope; los cortafuegos frenan. */
  private propagar(foco: FocoActivo) {
    const celda = (f: { x: number; y: number }) => aCelda(this.grilla, f.x - this.origen.x, f.y - this.origen.y);
    const encendidas = this.partida.activos.filter((f) => !f.fuenteFija).map(celda);
    const nuevas = propagar(this.grilla, celda(foco), encendidas, this.azar, VIENTO, this.partida.cortafuegos);
    for (const nueva of nuevas) {
      const { x, y } = centroDe(this.grilla, nueva);
      this.encender(focoPropagado(this.proximoId++, x + this.origen.x, y + this.origen.y));
    }
  }

  private flotar(x: number, y: number, texto: string, tinta: string) {
    const aviso = this.add.text(x, y - 12, texto, { ...TEXTO, fontSize: "14px", color: tinta }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: aviso, y: y - 36, alpha: 0, duration: 900, onComplete: () => aviso.destroy() });
  }

  update() {
    const restante = Math.ceil(this.reloj.getRemaining() / 1000);
    const p = this.partida;
    const m = p.marcador;
    this.hud.setText(`Puntos ${m.puntos}   Combo x${m.combo}\nAgua ${p.agua}/${TANQUE}   Tiempo ${restante}s`);
    this.barra.avion(Math.max(0, Math.ceil((p.avionListoMs - this.reloj.getElapsed()) / 1000)));
    const textura = claveCharmy(p.herramienta, estadoDeCharmy(p));
    if (this.charmy.texture.key !== textura) this.charmy.setTexture(textura);
  }
}
