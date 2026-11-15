import { describe, expect, it } from "vitest";
import { AYUDAS, ayudas } from "../src/barra";
import { COSTOS, HERRAMIENTAS } from "../src/partida";

describe("ayudas de la barra", () => {
  it("cada herramienta tiene su ayuda en los dos idiomas", () => {
    for (const h of HERRAMIENTAS) {
      expect(ayudas("es")[h]).toBe(AYUDAS[h]);
      expect(ayudas("en")[h]).toBeTruthy();
      expect(ayudas("en")[h]).not.toBe(AYUDAS[h]);
    }
  });

  it("en inglés también dice cuánto cuesta", () => {
    expect(ayudas("en").piloto).toContain(`${COSTOS.piloto} points`);
  });
});
