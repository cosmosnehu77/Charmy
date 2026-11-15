import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");
const css = leer("../src/styles/landing.css");
const guion = leer("../src/scripts/landing.ts");

describe("sección El problema centrada en el mapa", () => {
  it("la cámara del paso 1 pone el mapa en el medio de la pantalla", () => {
    expect(guion).toMatch(/\{ x: -63\.5, y: -35\.5, z: 1\.02, p: 0, b: 0, cx: 0\.5, cy: 0\.5 \}/);
  });

  it("el año se ubica a la derecha del mapa y el texto a su izquierda, con la misma referencia", () => {
    expect(css).toMatch(/\.hud-anio\{[^}]*left:calc\(50vw \+ var\(--medio-mapa\) \+ var\(--hueco-mapa\)\)/);
    expect(css).toMatch(/#problema \.tarjeta\{margin-left:max\(0px,calc\(50vw - [^}]*var\(--medio-mapa\)/);
  });
});

describe("scroll suave", () => {
  it("usa Lenis solo sin movimiento reducido, con sus estilos", () => {
    expect(guion).toMatch(/import Lenis from "lenis";/);
    expect(guion).toMatch(/import "lenis\/dist\/lenis\.css";/);
    expect(guion).toMatch(/if \(!reducir\) new Lenis\(/);
  });
});
