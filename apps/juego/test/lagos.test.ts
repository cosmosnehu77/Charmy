import { describe, expect, it } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import { LAGOS, lagoTocado } from "../src/lagos";

describe("lagos", () => {
  it("hay al menos seis lagos y todos caen dentro del recuadro del día", () => {
    const [oeste, sur, este, norte] = dia.bbox;
    expect(LAGOS.length).toBeGreaterThanOrEqual(6);
    for (const l of LAGOS) {
      expect(l.lon).toBeGreaterThanOrEqual(oeste!);
      expect(l.lon).toBeLessThanOrEqual(este!);
      expect(l.lat).toBeGreaterThanOrEqual(sur!);
      expect(l.lat).toBeLessThanOrEqual(norte!);
    }
    expect(LAGOS.map((l) => l.nombre)).toContain("Nahuel Huapi");
  });

  it("un toque cerca de un lago lo encuentra; lejos, no", () => {
    const enPantalla = [{ nombre: "A", x: 100, y: 100 }];
    expect(lagoTocado(enPantalla, 110, 105, 16)?.nombre).toBe("A");
    expect(lagoTocado(enPantalla, 130, 100, 16)).toBeNull();
  });
});
