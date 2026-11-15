import { describe, expect, it } from "vitest";
import { crearAzar } from "../src/azar";

const tirar = (semilla: string, n = 20) => {
  const azar = crearAzar(semilla);
  return Array.from({ length: n }, () => azar());
};

describe("números aleatorios con semilla", () => {
  it("la misma semilla da la misma secuencia", () => {
    expect(tirar("2026-11-12")).toEqual(tirar("2026-11-12"));
  });

  it("semillas distintas dan secuencias distintas", () => {
    expect(tirar("2026-11-12")).not.toEqual(tirar("2026-11-13"));
  });

  it("los números quedan entre 0 (incluido) y 1 (excluido)", () => {
    for (const n of tirar("2026-11-12", 1000)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
