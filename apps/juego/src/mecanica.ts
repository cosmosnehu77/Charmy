export interface Potencia {
  /** Toques que hacen falta para apagarlo. */
  toques: number;
  /** Cuánto tarda en escaparse si nadie lo apaga. */
  escapeMs: number;
}

/** De la potencia radiativa (FRP, en MW) a la vida del foco: más potente, más toques y menos tiempo. */
const TABLA: { desdeMw: number; potencia: Potencia }[] = [
  { desdeMw: 30, potencia: { toques: 4, escapeMs: 9200 } },
  { desdeMw: 10, potencia: { toques: 3, escapeMs: 10500 } },
  { desdeMw: 2, potencia: { toques: 2, escapeMs: 11900 } },
  { desdeMw: 0, potencia: { toques: 1, escapeMs: 13200 } },
];

export function potencia(frp: number): Potencia {
  return (TABLA.find((t) => frp >= t.desdeMw) ?? TABLA.at(-1)!).potencia;
}
