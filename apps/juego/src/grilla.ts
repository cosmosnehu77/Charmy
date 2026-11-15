import type { Area } from "./datos";

export interface Grilla {
  columnas: number;
  filas: number;
  /** Lado de cada celda, en píxeles del lienzo. */
  lado: number;
}

export interface Celda {
  col: number;
  fila: number;
}

export function crearGrilla(area: Area, lado: number): Grilla {
  return { columnas: Math.ceil(area.ancho / lado), filas: Math.ceil(area.alto / lado), lado };
}

const entre = (n: number, max: number) => Math.min(max, Math.max(0, n));

/** La celda de un punto del lienzo. Lo que cae fuera del área va a la celda del borde más cercana. */
export function aCelda(g: Grilla, x: number, y: number): Celda {
  return { col: entre(Math.floor(x / g.lado), g.columnas - 1), fila: entre(Math.floor(y / g.lado), g.filas - 1) };
}

export function centroDe(g: Grilla, c: Celda): { x: number; y: number } {
  return { x: (c.col + 0.5) * g.lado, y: (c.fila + 0.5) * g.lado };
}

/** Las hasta 8 celdas que tocan a una, sin salir de la grilla. */
export function vecinos(g: Grilla, c: Celda): Celda[] {
  const lista: Celda[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dc = -1; dc <= 1; dc++) {
      const col = c.col + dc;
      const fila = c.fila + df;
      if ((dc || df) && col >= 0 && fila >= 0 && col < g.columnas && fila < g.filas) lista.push({ col, fila });
    }
  }
  return lista;
}
