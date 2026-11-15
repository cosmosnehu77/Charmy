import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Portada from "../src/pages/index.astro";
import { EN } from "../src/scripts/en";

const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");
const css = leer("../src/styles/landing.css");
const guion = leer("../src/scripts/landing.ts");

let doc: Document;
beforeAll(async () => {
  const container = await AstroContainer.create();
  doc = new JSDOM(await container.renderToString(Portada)).window.document;
});

describe("agradecimientos y ajustes del recorrido (F4-E1b, issue 357)", () => {
  it("agradecimientos es la última sección de la página, con título y antes del pie", () => {
    const secciones = [...doc.querySelectorAll("section")];
    const g = doc.getElementById("gracias");
    expect(secciones.at(-1)).toBe(g);
    expect(doc.getElementById(g!.getAttribute("aria-labelledby")!)?.tagName).toBe("H2");
    expect(g!.compareDocumentPosition(doc.getElementById("creditos")!) & 4).toBe(4); // el pie viene después
  });

  it("tiene un botón que abre el abanico y una card por persona, con su nombre y su foto", () => {
    const boton = doc.querySelector("#gracias button.abrir");
    expect(boton?.getAttribute("aria-expanded")).toBe("false");
    expect(boton?.getAttribute("aria-controls")).toBe("abanico");
    const cards = [...doc.querySelectorAll("#abanico .persona")];
    expect(cards.map((c) => c.querySelector("strong")?.textContent?.trim())).toEqual(["Walter Sánchez", "Debora Reitovich", "Franco García", "Brian Rodríguez", "El equipo de Charmy"]);
    expect(doc.getElementById("gracias")!.textContent).not.toMatch(/Nombre Apellido|Institución o rol/);
    for (const c of cards) {
      const img = c.querySelector("img");
      expect(img?.getAttribute("alt")).toBeTruthy();
      expect(existsSync(fileURLToPath(new URL("../public" + img!.getAttribute("src"), import.meta.url))), img!.getAttribute("src")!).toBe(true);
      expect(c.getAttribute("tabindex")).toBe("0");
      expect(c.getAttribute("style")).toMatch(/--d:-?[\d.]+;--a:[\d.]+/);
    }
  });

  it("el foco de una card espera a que el cursor se quede quieto", () => {
    expect(guion).toMatch(/setTimeout\(\(\) => enfocar\(c\), 220\)/);
  });

  it("el enlace del método no se estira al ancho de la tarjeta", () => {
    expect(css).toMatch(/\.tarjeta \.enlace\{align-self:flex-start\}/);
  });

  it("el paso 4 corre la grilla y la tarjeta a la izquierda, sin salirse del margen", () => {
    expect(guion).toMatch(/x0: W \* 0\.42, y0: H \* 0\.15/);
    expect(css).toMatch(/#calendario \.tarjeta\{margin-left:max\(-5vw,min\(0px,calc\(644px - 50vw\)\)\)\}/);
  });

  it("los textos nuevos tienen su versión en inglés", () => {
    for (const t of ["Agradecimientos", "Gracias a quienes", "nos acompañaron.", "Charmy salió adelante con ayuda. Pasá el cursor para ver a cada persona.", "Ver a todos", "Cerrar", "El equipo de Charmy"]) expect(EN[t], t).toBeTruthy();
  });
});
