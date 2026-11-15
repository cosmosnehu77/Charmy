import type { Almacen } from "./record";

/** Silencio del juego en este navegador: "1" silenciado, cualquier otra cosa con sonido. */
export const CLAVE_SILENCIO = "charmy-brigada-silencio";

export function leerSilencio(almacen: Almacen): boolean {
  try {
    return almacen.getItem(CLAVE_SILENCIO) === "1";
  } catch {
    return false;
  }
}

export function guardarSilencio(almacen: Almacen, silencio: boolean): void {
  try {
    almacen.setItem(CLAVE_SILENCIO, silencio ? "1" : "0");
  } catch {
    // Sin almacenamiento el silencio dura solo esta visita.
  }
}

interface Nota {
  tipo: OscillatorType;
  /** Frecuencia al empezar y al terminar, en Hz: si cambian, la nota sube o baja. */
  desde: number;
  hasta: number;
  /** Segundos desde que empieza el sonido. */
  inicio: number;
  duracion: number;
  volumen: number;
}

const nota = (tipo: OscillatorType, desde: number, hasta: number, inicio: number, duracion: number, volumen = 0.15): Nota => ({
  tipo,
  desde,
  hasta,
  inicio,
  duracion,
  volumen,
});

/** Sonidos cortos y suaves, generados al momento: sin archivos de audio. */
export const SONIDOS = {
  apagar: [nota("square", 660, 330, 0, 0.08, 0.08)],
  combo: [nota("square", 660, 660, 0, 0.06, 0.08), nota("square", 880, 880, 0.06, 0.08, 0.08)],
  escape: [nota("triangle", 300, 120, 0, 0.25)],
  viento: [nota("sine", 180, 420, 0, 0.5, 0.05)],
  victoria: [nota("triangle", 523, 523, 0, 0.1), nota("triangle", 659, 659, 0.1, 0.1), nota("triangle", 784, 784, 0.2, 0.1), nota("triangle", 1047, 1047, 0.3, 0.35)],
  recarga: [nota("sine", 300, 900, 0, 0.2)],
  fin: [nota("triangle", 523, 523, 0, 0.12), nota("triangle", 659, 659, 0.12, 0.12), nota("triangle", 784, 784, 0.24, 0.25)],
} satisfies Record<string, Nota[]>;

export type NombreSonido = keyof typeof SONIDOS;

/** Lo que se usa de un AudioContext. */
export type Contexto = Pick<AudioContext, "currentTime" | "destination" | "state" | "resume" | "createOscillator" | "createGain">;

export interface Sonido {
  tocar(nombre: NombreSonido): void;
  silenciar(silencio: boolean): void;
  silenciado(): boolean;
}

/**
 * El contexto de audio se crea recién con el primer sonido, que siempre llega después de que el jugador tocó algo:
 * así lo piden los navegadores. Con silencio no se crea nada. Si el navegador no tiene audio, el juego sigue mudo.
 */
export function crearSonido(crearContexto: () => Contexto, silencioInicial: boolean): Sonido {
  let silencio = silencioInicial;
  let contexto: Contexto | null = null;
  let sinAudio = false;

  return {
    tocar(nombre) {
      if (silencio || sinAudio) return;
      try {
        contexto ??= crearContexto();
        if (contexto.state === "suspended") void contexto.resume();
        const t0 = contexto.currentTime;
        for (const n of SONIDOS[nombre]) {
          const empieza = t0 + n.inicio;
          const termina = empieza + n.duracion;
          const oscilador = contexto.createOscillator();
          const ganancia = contexto.createGain();
          oscilador.type = n.tipo;
          oscilador.frequency.setValueAtTime(n.desde, empieza);
          if (n.hasta !== n.desde) oscilador.frequency.exponentialRampToValueAtTime(n.hasta, termina);
          ganancia.gain.setValueAtTime(n.volumen, empieza);
          ganancia.gain.exponentialRampToValueAtTime(0.001, termina);
          oscilador.connect(ganancia).connect(contexto.destination);
          oscilador.start(empieza);
          oscilador.stop(termina);
        }
      } catch {
        sinAudio = true;
      }
    },
    silenciar(valor) {
      silencio = valor;
    },
    silenciado: () => silencio,
  };
}
