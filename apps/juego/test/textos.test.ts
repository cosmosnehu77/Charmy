import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HTML, TEXTOS } from "../src/textos";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("textos del juego", () => {
  it("cada texto en español tiene su versión en inglés, y al revés", () => {
    expect(Object.keys(TEXTOS.en).sort()).toEqual(Object.keys(TEXTOS.es).sort());
    expect(Object.keys(HTML.en).sort()).toEqual(Object.keys(HTML.es).sort());
  });

  it("las listas tienen el mismo largo en los dos idiomas", () => {
    expect(TEXTOS.en.pasos).toHaveLength(TEXTOS.es.pasos.length);
    expect(TEXTOS.en.rumbos).toHaveLength(8);
    expect(TEXTOS.es.rumbos).toHaveLength(8);
  });

  it("ningún texto en inglés quedó vacío", () => {
    for (const [k, v] of Object.entries(HTML.en)) expect(v.trim(), k).not.toBe("");
    for (const p of TEXTOS.en.pasos) expect(p.titulo && p.texto).toBeTruthy();
  });

  it("cada data-t del HTML existe en los diccionarios", () => {
    const claves = [...html.matchAll(/data-t(?:-aria|-title|-contenido)?="([^"]+)"/g)].map((m) => m[1]!);
    expect(claves.length).toBeGreaterThan(30);
    for (const k of claves) expect(HTML.es, k).toHaveProperty(k);
  });

  it("el HTML trae el texto en español del diccionario, así sin JavaScript se lee igual", () => {
    for (const [, k, texto] of html.matchAll(/data-t="([^"]+)"[^>]*>([^<]+)</g)) {
      expect(texto!.trim(), k).toBe(HTML.es[k!]);
    }
  });

  it("el final de la guía sigue diciendo a quién llamar", () => {
    expect(TEXTOS.en.pasos.at(-1)!.texto).toMatch(/emergency/);
  });

  it("los nombres de zona en inglés salen del mapa de traducciones y en español no cambian", () => {
    expect(TEXTOS.es.zona("el Chaco")).toBe("el Chaco");
    expect(TEXTOS.en.zona("el Chaco")).toBe("the Chaco");
    expect(TEXTOS.en.zona("Rondônia")).toBe("Rondônia");
  });
});
