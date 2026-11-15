import { describe, expect, it } from "vitest";
import { LAGOS, RIOS, lagoTocado } from "../src/lagos";

describe("fuentes de agua", () => {
  it("hay muchas fuentes, todas en Sudamérica y con nombre distinto", () => {
    expect(LAGOS.length).toBeGreaterThanOrEqual(20);
    for (const l of LAGOS) {
      expect(l.lon).toBeGreaterThan(-82);
      expect(l.lon).toBeLessThan(-34);
      expect(l.lat).toBeGreaterThan(-56);
      expect(l.lat).toBeLessThan(13);
      expect(l.r).toBeGreaterThan(0);
    }
    expect(new Set(LAGOS.map((l) => l.nombre)).size).toBe(LAGOS.length);
    expect(LAGOS.map((l) => l.nombre)).toEqual(expect.arrayContaining(["Lago Titicaca", "Nahuel Huapi", "Represa de Itaipú"]));
  });

  it("los ríos tienen al menos dos puntos", () => {
    for (const r of RIOS) expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it("un toque cerca de un lago lo encuentra; lejos, no", () => {
    const enPantalla = [{ nombre: "A", x: 100, y: 100 }];
    expect(lagoTocado(enPantalla, 110, 105, 16)?.nombre).toBe("A");
    expect(lagoTocado(enPantalla, 130, 100, 16)).toBeNull();
  });

  it("entre dos lagos cerca, gana el más cercano", () => {
    const enPantalla = [{ nombre: "A", x: 100, y: 100 }, { nombre: "B", x: 110, y: 100 }];
    expect(lagoTocado(enPantalla, 108, 100, 16)?.nombre).toBe("B");
  });
});
