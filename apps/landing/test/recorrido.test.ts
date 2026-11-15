import { describe, expect, it } from "vitest";
import { progresoPaso, suave, tiempoLectura, tramo } from "../src/scripts/recorrido";

describe("recorrido", () => {
  it("suave va de 0 a 1 y se recorta fuera del intervalo", () => {
    expect(suave(0, 1, -1)).toBe(0);
    expect(suave(0, 1, 0.5)).toBe(0.5);
    expect(suave(0, 1, 2)).toBe(1);
  });

  it("tramo vale 1 en su paso y 0 a un paso de distancia", () => {
    expect(tramo(2, 2)).toBe(1);
    expect(tramo(1, 2)).toBe(0);
    expect(tramo(3, 2)).toBe(0);
  });

  it("el mapa queda en la primera mitad del paso durante el primer 65 % de la sección", () => {
    expect(progresoPaso(2, 0)).toBe(2);
    expect(progresoPaso(2, 0.64)).toBeLessThan(2.5);
    expect(progresoPaso(2, 0.65)).toBeCloseTo(2.5);
    expect(progresoPaso(2, 1)).toBeLessThan(3);
    expect(progresoPaso(2, 0.99)).toBeGreaterThan(2.95);
  });

  it("deja leer el globo al menos 5 s y más si el texto es largo", () => {
    expect(tiempoLectura("Hola")).toBe(5000);
    expect(tiempoLectura("una ".repeat(20))).toBe(20 * 380 + 2200);
  });
});
