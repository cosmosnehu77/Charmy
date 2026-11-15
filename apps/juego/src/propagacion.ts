import type { Azar } from "./azar";
import { vecinos, type Celda, type Grilla } from "./grilla";

/** Viento del día (llega con F4-C2, `GET /game/day`). */
export interface Viento {
  /** De dónde viene, en grados como en meteorología: 0 del norte, 90 del este, 270 del oeste. */
  desdeGrados: number;
  velocidadMs: number;
}

/** Celdas encendidas a la vez como máximo: más allá, los focos que se escapan ya no se propagan. */
export const TOPE_ENCENDIDAS = 20;
/** Celdas nuevas que enciende un foco que se escapa. */
export const CELDAS_POR_ESCAPE = 2;
/** Con este viento (m/s) o más, la celda a favor del viento pesa 1 + SESGO_MAXIMO. */
const VIENTO_FUERTE_MS = 10;
const SESGO_MAXIMO = 4;

export interface VecinoConPeso extends Celda {
  peso: number;
}

/**
 * Cuánto pesa cada vecina al elegir hacia dónde se propaga el fuego. Sin viento, todas pesan 1. Con viento, las que
 * quedan a favor del viento pesan más, en proporción a la velocidad. El norte es arriba en la pantalla.
 */
export function pesosDeVecinos(g: Grilla, celda: Celda, viento: Viento | null): VecinoConPeso[] {
  const fuerza = viento ? SESGO_MAXIMO * Math.min(1, viento.velocidadMs / VIENTO_FUERTE_MS) : 0;
  const haciaRad = viento ? (((viento.desdeGrados + 180) % 360) * Math.PI) / 180 : 0;
  return vecinos(g, celda).map((v) => {
    const este = v.col - celda.col;
    const norte = celda.fila - v.fila;
    const rumbo = Math.atan2(este, norte);
    const aFavor = Math.max(0, Math.cos(rumbo - haciaRad));
    return { ...v, peso: fuerza === 0 ? 1 : 1 + fuerza * aFavor };
  });
}

/**
 * Las celdas que enciende un foco que se escapa: hasta CELDAS_POR_ESCAPE vecinas libres, elegidas con el azar de la
 * partida y sesgadas por el viento, sin pasar de TOPE_ENCENDIDAS entre todas las encendidas. Los cortafuegos no se
 * encienden ni cuentan para el tope.
 */
export function propagar(
  g: Grilla,
  celda: Celda,
  encendidas: Celda[],
  azar: Azar,
  viento: Viento | null,
  cortafuegos: Celda[] = [],
): Celda[] {
  const ocupada = new Set([...encendidas, ...cortafuegos].map((c) => `${c.col},${c.fila}`));
  let libres = pesosDeVecinos(g, celda, viento).filter((v) => !ocupada.has(`${v.col},${v.fila}`));
  const cuantas = Math.min(CELDAS_POR_ESCAPE, TOPE_ENCENDIDAS - encendidas.length, libres.length);
  const nuevas: Celda[] = [];
  for (let i = 0; i < cuantas; i++) {
    const total = libres.reduce((suma, v) => suma + v.peso, 0);
    let tiro = azar() * total;
    const elegida = libres.find((v) => (tiro -= v.peso) < 0) ?? libres.at(-1)!;
    nuevas.push({ col: elegida.col, fila: elegida.fila });
    libres = libres.filter((v) => v !== elegida);
  }
  return nuevas;
}
