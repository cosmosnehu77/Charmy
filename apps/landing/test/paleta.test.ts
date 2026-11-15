import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../src/styles/landing.css", import.meta.url)), "utf8");

describe("paleta de la landing", () => {
  it("no usa colores sueltos: todo sale de tokens de @charmy/ui", () => {
    expect(css.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(css.match(/rgba?\(/gi) ?? []).toEqual([]);
  });

  it("los dos temas usan la paleta del mapa (sala de mapas)", () => {
    for (const alias of ["fondo", "panel", "texto", "titulo", "ambar"]) {
      expect(css).toMatch(new RegExp(`--l-${alias}:var\\(--mapa-dia-`));
      expect(css).toMatch(new RegExp(`--l-${alias}:var\\(--mapa-noche-`));
    }
  });
});
