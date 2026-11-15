import { describe, expect, it } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import type { DiaJuego } from "../src/datos";
import { CONSEJOS, cierreDePartida } from "../src/cierre";

const real = dia as DiaJuego;

describe("cierreDePartida", () => {
  it("muestra un dato real del día: cuántos focos detectaron los satélites y cuándo", () => {
    const { dato } = cierreDePartida(real, 0);
    expect(dato).toContain(String(real.focos.length));
    expect(dato).toContain("12 de noviembre de 2026");
    expect(dato).not.toContain("muestra");
  });

  it("muestra un consejo de prevención", () => {
    const { consejo } = cierreDePartida(real, 1);
    expect(consejo).toBe(CONSEJOS[1]);
  });

  it("recorre los consejos sin salirse de la lista", () => {
    expect(cierreDePartida(real, CONSEJOS.length + 2).consejo).toBe(CONSEJOS[2]);
  });

  it("si el día es provisorio, lo aclara", () => {
    expect(cierreDePartida({ ...real, provisional: true }, 0).dato).toContain("dato de muestra");
  });

  it("todo consejo dice a qué número llamar o cómo prevenir, sin alarmismo", () => {
    for (const c of CONSEJOS) {
      expect(c).not.toMatch(/!{2,}|PELIGRO/);
      expect(c.length).toBeLessThan(140);
    }
    expect(CONSEJOS.some((c) => c.includes("100") && c.includes("132"))).toBe(true);
  });
});

describe("cierre con fuentes fijas", () => {
  it("si tocaste fuentes fijas, explica por qué no se apagan", () => {
    const { fuentesFijas } = cierreDePartida(real, 0, 2);
    expect(fuentesFijas).toMatch(/2 fuentes fijas/);
    expect(fuentesFijas).toMatch(/no son incendios/i);
  });

  it("si no tocaste ninguna, no dice nada", () => {
    expect(cierreDePartida(real, 0).fuentesFijas).toBeNull();
    expect(cierreDePartida(real, 0, 0).fuentesFijas).toBeNull();
  });
});
