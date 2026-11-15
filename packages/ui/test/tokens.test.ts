import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  colorDeRampa,
  colorSinDato,
  contraste,
  interfaz,
  mapaDia,
  mapaNoche,
  paleta,
  rampaAnomalia,
  rampaConteo,
} from "../src/index";

const css = readFileSync(fileURLToPath(new URL("../tokens.css", import.meta.url)), "utf8");
const variable = (nombre: string) => {
  const m = new RegExp(`--${nombre}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
  return m?.[1]?.toLowerCase();
};

describe("tokens.css e index.ts dicen lo mismo", () => {
  it("rampa de conteo", () => {
    rampaConteo.forEach((c, i) => expect(variable(`rampa-conteo-${i + 1}`)).toBe(c));
  });
  it("rampa de anomalía", () => {
    rampaAnomalia.forEach((c, i) => expect(variable(`rampa-anomalia-${i + 1}`)).toBe(c));
  });
  it("paleta de Charmy", () => {
    expect(variable("charmy-pelaje")).toBe(paleta.pelaje);
    expect(variable("charmy-acento")).toBe(paleta.acento);
    expect(variable("charmy-tinta")).toBe(paleta.tinta);
    expect(variable("charmy-llama")).toBe(paleta.llama);
    expect(variable("charmy-agua")).toBe(paleta.agua);
  });
  it("sin dato", () => {
    expect(variable("rampa-sin-dato")).toBe(colorSinDato);
  });
});

describe("contraste de texto (RNF-04, AA 4,5:1)", () => {
  const pares: [string, string, string][] = [
    ["tinta sobre fondo", interfaz.tinta, interfaz.fondo],
    ["tinta suave sobre fondo", interfaz.tintaSuave, interfaz.fondo],
    ["tinta suave sobre superficie 2", interfaz.tintaSuave, interfaz.superficie2],
    ["acento sobre blanco", interfaz.acento, interfaz.superficie],
    ["blanco sobre acento", interfaz.superficie, interfaz.acento],
    ["aviso sobre blanco", interfaz.avisoTexto, interfaz.superficie],
    ["peligro sobre blanco", interfaz.peligro, interfaz.superficie],
    ["éxito sobre blanco", interfaz.exito, interfaz.superficie],
  ];
  it.each(pares)("%s", (_n, a, b) => {
    expect(contraste(a, b)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("colorDeRampa", () => {
  const cortes = [1, 2, 5, 10, 20, 50];
  it("asigna la clase según los cortes", () => {
    expect(colorDeRampa(0, cortes, rampaConteo)).toBe(rampaConteo[0]);
    expect(colorDeRampa(1, cortes, rampaConteo)).toBe(rampaConteo[1]);
    expect(colorDeRampa(49, cortes, rampaConteo)).toBe(rampaConteo[5]);
    expect(colorDeRampa(500, cortes, rampaConteo)).toBe(rampaConteo[6]);
  });
  it("sin dato si no hay número", () => {
    expect(colorDeRampa(null, cortes, rampaConteo)).toBe(colorSinDato);
    expect(colorDeRampa(Number.NaN, cortes, rampaConteo)).toBe(colorSinDato);
  });
  it("rechaza cortes mal contados", () => {
    expect(() => colorDeRampa(1, [1, 2], rampaConteo)).toThrow();
  });
});

describe("agua (lagos del juego)", () => {
  it("se distingue del fondo cielo y de los tonos de fuego", () => {
    expect(contraste(paleta.agua, paleta.cielo)).toBeGreaterThanOrEqual(3);
    expect(paleta.agua).not.toBe(paleta.cielo);
  });
});

describe("paleta de mapa de la landing (sala de mapas)", () => {
  const casos = [
    ["noche", mapaNoche],
    ["dia", mapaDia],
  ] as const;
  it.each(casos)("tokens.css e index.ts dicen lo mismo: %s", (tema, valores) => {
    for (const [clave, color] of Object.entries(valores)) {
      const nombre = clave.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
      expect(variable(`mapa-${tema}-${nombre}`), clave).toBe(color);
    }
  });
  it.each(casos)("texto legible (AA 4,5:1): %s", (_t, c) => {
    for (const fondo of [c.fondo, c.panel, c.elevado]) {
      expect(contraste(c.tinta, fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.texto, fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.tenue, fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.acentoTexto, fondo)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
