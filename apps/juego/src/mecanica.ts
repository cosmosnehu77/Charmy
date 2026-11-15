import type { FocoEnPantalla } from "./datos";

/** Cuánto duran todas las pasadas juntas: deja lugar a que el último foco viva antes de que termine la partida. */
export const DURACION_PASADAS_MS = 52_000;

export interface Potencia {
  /** Toques que hacen falta para apagarlo. */
  toques: number;
  /** Cuánto tarda en escaparse si nadie lo apaga. */
  escapeMs: number;
}

/** De la potencia radiativa (FRP, en MW) a la vida del foco: más potente, más toques y menos tiempo. */
const TABLA: { desdeMw: number; potencia: Potencia }[] = [
  { desdeMw: 30, potencia: { toques: 4, escapeMs: 3500 } },
  { desdeMw: 10, potencia: { toques: 3, escapeMs: 4000 } },
  { desdeMw: 2, potencia: { toques: 2, escapeMs: 4500 } },
  { desdeMw: 0, potencia: { toques: 1, escapeMs: 5000 } },
];

export function potencia(frp: number): Potencia {
  return (TABLA.find((t) => frp >= t.desdeMw) ?? TABLA.at(-1)!).potencia;
}

export interface Pasada {
  /** Hora UTC de la detección. */
  hora: number;
  /**
   * NOAA-20 y NOAA-21 pasan sobre la región de madrugada bajando de norte a sur y después del mediodía subiendo de
   * sur a norte (órbita heliosincrónica). Por eso la franja de una pasada nocturna baja y la de una diurna sube.
   */
  haciaElSur: boolean;
  focos: FocoEnPantalla[];
}

/** Agrupa los focos por hora de detección, en orden. */
export function pasadas(focos: FocoEnPantalla[]): Pasada[] {
  const porHora = new Map<number, FocoEnPantalla[]>();
  for (const f of focos) {
    const hora = Number(f.hora_utc.slice(0, 2));
    porHora.set(hora, [...(porHora.get(hora) ?? []), f]);
  }
  return [...porHora.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hora, grupo]) => ({ hora, haciaElSur: hora < 12, focos: grupo }));
}

export interface Ventana {
  hora: number;
  haciaElSur: boolean;
  desdeMs: number;
  hastaMs: number;
}

export interface FocoDelNivel extends FocoEnPantalla {
  apareceMs: number;
}

export interface PlanDeNivel {
  ventanas: Ventana[];
  focos: FocoDelNivel[];
}

/** Una pasada con pocos focos dura como una de este tamaño: así la franja no cruza la pantalla de golpe. */
const FOCOS_MINIMOS_POR_PASADA = 5;

/**
 * Reparte la partida entre las pasadas, cada una en proporción a sus focos, para que el ritmo sea parejo. En cada
 * ventana una franja cruza el área de juego y cada foco aparece cuando la franja llega a su altura.
 */
export function planPorPasadas(focos: FocoEnPantalla[], alto: number, duracionMs: number): PlanDeNivel {
  const grupos = pasadas(focos);
  const pesos = grupos.map((g) => Math.max(g.focos.length, FOCOS_MINIMOS_POR_PASADA));
  const total = pesos.reduce((a, b) => a + b, 0);
  const ventanas: Ventana[] = [];
  const plan: FocoDelNivel[] = [];
  let acumulado = 0;
  grupos.forEach((g, i) => {
    const desdeMs = Math.round((acumulado / total) * duracionMs);
    acumulado += pesos[i]!;
    const hastaMs = Math.round((acumulado / total) * duracionMs);
    ventanas.push({ hora: g.hora, haciaElSur: g.haciaElSur, desdeMs, hastaMs });
    for (const f of g.focos) {
      const altura = Math.min(1, Math.max(0, f.y / alto));
      const avance = g.haciaElSur ? altura : 1 - altura;
      plan.push({ ...f, apareceMs: desdeMs + avance * (hastaMs - desdeMs) });
    }
  });
  return { ventanas, focos: plan.sort((a, b) => a.apareceMs - b.apareceMs) };
}
