import { describe, expect, it } from "vitest";
import { potencia } from "../src/mecanica";

describe("potencia (FRP) como vida del foco", () => {
  it.each([
    [0.26, 1, 13200],
    [1.99, 1, 13200],
    [2, 2, 11900],
    [9.99, 2, 11900],
    [10, 3, 10500],
    [29.99, 3, 10500],
    [30, 4, 9200],
    [55.06, 4, 9200],
  ])("%s MW: %s toques y %s ms para escaparse", (frp, toques, escapeMs) => {
    expect(potencia(frp)).toEqual({ toques, escapeMs });
  });

  it("más potencia, más toques y menos tiempo para escaparse", () => {
    const tabla = [0, 2, 10, 30].map(potencia);
    for (let i = 1; i < tabla.length; i++) {
      expect(tabla[i]!.toques).toBeGreaterThan(tabla[i - 1]!.toques);
      expect(tabla[i]!.escapeMs).toBeLessThan(tabla[i - 1]!.escapeMs);
    }
  });
});
