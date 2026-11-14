import { JSDOM } from "jsdom";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Portada from "../src/pages/index.astro";

let html = "";
let doc: Document;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(Portada);
  doc = new JSDOM(html).window.document;
});

const encabezados = () => Array.from(doc.querySelectorAll("h2"), (h) => h.textContent?.trim() ?? "");

describe("landing", () => {
  it("tiene las secciones problema, funcionalidades, equipo y créditos con encabezado accesible", () => {
    for (const id of ["problema", "funcionalidades", "equipo", "creditos"]) {
      const seccion = doc.getElementById(id);
      expect(seccion, id).not.toBeNull();
      const titulo = seccion?.getAttribute("aria-labelledby");
      expect(titulo, id).toBeTruthy();
      expect(doc.getElementById(titulo!)?.tagName, id).toBe("H2");
    }
    expect(encabezados()).toHaveLength(4);
  });

  it("enlaza a la app y al juego", () => {
    const enlaces = Array.from(doc.querySelectorAll("a"), (a) => a.getAttribute("href"));
    expect(enlaces).toContain("https://charmy-app.pages.dev");
    expect(enlaces).toContain("https://charmy-juego.pages.dev");
  });

  it("los créditos nombran FIRMS, Copernicus y Meteomatics", () => {
    const creditos = doc.getElementById("creditos")?.textContent ?? "";
    expect(creditos).toContain("FIRMS");
    expect(creditos).toContain("Copernicus");
    expect(creditos).toContain("Meteomatics");
  });
});
