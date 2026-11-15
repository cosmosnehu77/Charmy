import { describe, expect, it } from "vitest";
import { AVISO_SIMULADOS, CONSEJOS, cierreDePartida, focos, fraseDelFinal, miles } from "../src/cierre";

describe("cierreDePartida", () => {
  it("muestra un consejo de prevención", () => {
    expect(cierreDePartida(1).consejo).toBe(CONSEJOS[1]);
  });

  it("recorre los consejos sin salirse de la lista", () => {
    expect(cierreDePartida(CONSEJOS.length + 2).consejo).toBe(CONSEJOS[2]);
  });

  it("todo consejo dice a qué número llamar o cómo prevenir, sin alarmismo", () => {
    for (const c of CONSEJOS) {
      expect(c).not.toMatch(/!{2,}|PELIGRO/);
      expect(c.length).toBeLessThan(140);
    }
    expect(CONSEJOS.some((c) => c.includes("100") && c.includes("132"))).toBe(true);
  });

  it("el aviso del final dice que los focos son simulados y a qué número llamar", () => {
    expect(AVISO_SIMULADOS).toMatch(/simulados/);
    expect(AVISO_SIMULADOS).toContain("100");
    expect(AVISO_SIMULADOS).toContain("132");
  });
});

describe("cierre con fuentes fijas", () => {
  it("si tocaste fuentes fijas, explica por qué no se apagan", () => {
    const { fuentesFijas } = cierreDePartida(0, 2);
    expect(fuentesFijas).toMatch(/2 fuentes fijas/);
    expect(fuentesFijas).toMatch(/no son incendios/i);
  });

  it("si no tocaste ninguna, no dice nada", () => {
    expect(cierreDePartida(0).fuentesFijas).toBeNull();
    expect(cierreDePartida(0, 0).fuentesFijas).toBeNull();
  });
});

describe("frase del final", () => {
  const base = { puntos: 860, antes: 860, record: 1240, apagados: 31, barridas: 3, victoria: false, sumaRecord: true };

  it("dice cuánto faltó para el récord", () => {
    expect(fraseDelFinal(base)).toBe("Apagaste <b>31 focos</b> en 3 barridas. Te faltaron <b>380 puntos</b> para tu récord de 1.240.");
  });

  it("con récord nuevo, dice por cuánto pasaste la marca anterior", () => {
    expect(fraseDelFinal({ ...base, puntos: 1380 })).toContain("Pasaste tu marca anterior por <b>140 puntos</b>.");
  });

  it("la primera partida es la primera marca, e igualar el récord se dice", () => {
    expect(fraseDelFinal({ ...base, record: 0 })).toContain("Es tu primera marca.");
    expect(fraseDelFinal({ ...base, puntos: 1240 })).toContain("Igualaste tu récord.");
  });

  it("al ganar, cuenta que los puntos valieron el doble", () => {
    expect(fraseDelFinal({ ...base, victoria: true, antes: 700, puntos: 1500 })).toMatch(/^No quedó ni un foco prendido: tus <b>700 puntos<\/b> valieron el doble\./);
  });

  it("una sola barrida va en singular", () => {
    expect(fraseDelFinal({ ...base, barridas: 1 })).toContain("en 1 barrida.");
  });

  it("el modo explorador no habla de récord", () => {
    const f = fraseDelFinal({ ...base, sumaRecord: false });
    expect(f).toContain("modo explorador");
    expect(f).not.toContain("récord de");
  });
});

describe("números en palabras", () => {
  it("usa singular y plural", () => {
    expect(focos(0)).toBe("0 focos");
    expect(focos(1)).toBe("1 foco");
    expect(focos(142)).toBe("142 focos");
  });

  it("separa los miles con punto", () => {
    expect(miles(1240)).toBe("1.240");
    expect(miles(999.6)).toBe("1.000");
  });
});
