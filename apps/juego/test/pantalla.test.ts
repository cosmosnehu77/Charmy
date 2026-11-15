import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { dimensiones } from "../src/pantalla";

describe("dimensiones del lienzo", () => {
  it("en una pantalla vertical (teléfono) usa un lienzo vertical", () => {
    expect(dimensiones(375, 700)).toEqual({ ancho: 480, alto: 720 });
  });
  it("en una pantalla apaisada o casi cuadrada usa el lienzo de 800 × 600", () => {
    expect(dimensiones(1400, 900)).toEqual({ ancho: 800, alto: 600 });
    expect(dimensiones(800, 820)).toEqual({ ancho: 800, alto: 600 });
  });
});

describe("página del juego", () => {
  const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  it("enlaza a la landing y a la app en producción", () => {
    expect(html).toContain('href="https://charmy-landing.pages.dev"');
    expect(html).toContain('href="https://charmy-app.pages.dev"');
  });
  it("tiene un botón de silencio que se puede usar con teclado", () => {
    expect(html).toMatch(/<button[^>]*id="silencio"[^>]*aria-pressed="false"/);
  });
  it("tiene la barra de herramientas con un botón por vestuario", () => {
    expect(html).toMatch(/role="toolbar"/);
    for (const h of ["bombero", "piloto", "cientifica", "guia"]) {
      expect(html).toMatch(new RegExp(`<button type="button" data-herramienta="${h}" aria-pressed="(true|false)"`));
    }
  });
  it("tiene el botón del modo explorador y una región que anuncia a los lectores de pantalla", () => {
    expect(html).toMatch(/<button type="button" id="explorador"[^>]*>Modo explorador/);
    expect(html).toMatch(/<p id="anuncio" class="solo-lector" aria-live="polite">/);
  });
  it("tiene descripción y el aviso de emergencias", () => {
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toMatch(/no reemplaza a los servicios de emergencia/);
    expect(html).toMatch(/100/);
    expect(html).toMatch(/132/);
  });
});
