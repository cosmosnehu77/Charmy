import { describe, expect, it } from "vitest";
import { aCelda, centroDe, crearGrilla, vecinos } from "../src/grilla";

const grilla = crearGrilla({ ancho: 800, alto: 600 }, 20);

describe("grilla de celdas", () => {
  it("divide el área en celdas del lado pedido", () => {
    expect(grilla).toEqual({ columnas: 40, filas: 30, lado: 20 });
  });

  it("de pantalla a celda y de vuelta cae en la misma celda", () => {
    for (const [x, y] of [
      [0, 0],
      [19.9, 20],
      [401, 299],
      [799, 599],
    ] as const) {
      const celda = aCelda(grilla, x, y);
      const centro = centroDe(grilla, celda);
      expect(aCelda(grilla, centro.x, centro.y)).toEqual(celda);
    }
  });

  it("los bordes y lo que queda afuera no salen de la grilla", () => {
    expect(aCelda(grilla, 800, 600)).toEqual({ col: 39, fila: 29 });
    expect(aCelda(grilla, -5, -5)).toEqual({ col: 0, fila: 0 });
    expect(aCelda(grilla, 10_000, 3)).toEqual({ col: 39, fila: 0 });
  });

  it("una esquina tiene 3 vecinos y el centro 8", () => {
    expect(vecinos(grilla, { col: 0, fila: 0 })).toHaveLength(3);
    expect(vecinos(grilla, { col: 39, fila: 29 })).toHaveLength(3);
    const centro = vecinos(grilla, { col: 20, fila: 15 });
    expect(centro).toHaveLength(8);
    expect(centro).not.toContainEqual({ col: 20, fila: 15 });
    for (const v of centro) {
      expect(Math.abs(v.col - 20)).toBeLessThanOrEqual(1);
      expect(Math.abs(v.fila - 15)).toBeLessThanOrEqual(1);
    }
  });
});
