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

const enlaces = () => Array.from(doc.querySelectorAll("a"), (a) => a.getAttribute("href"));
const texto = (id: string) => doc.getElementById(id)?.textContent ?? "";

describe("landing", () => {
  it("tiene portada, recorrido, modos, juego, nosotros y créditos con encabezado accesible", () => {
    const ids = ["portada", "problema", "armonizacion", "zona", "calendario", "vivo", "modos", "juego", "nosotros", "creditos"];
    for (const id of ids) {
      const seccion = doc.getElementById(id);
      expect(seccion, id).not.toBeNull();
      const titulo = seccion?.getAttribute("aria-labelledby");
      expect(titulo, id).toBeTruthy();
      expect(["H1", "H2"], id).toContain(doc.getElementById(titulo!)?.tagName);
    }
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });

  it("enlaza a la app, al juego y al documento del método", () => {
    expect(enlaces()).toContain("https://charmy-app.pages.dev");
    expect(enlaces()).toContain("https://charmy-juego.pages.dev");
    expect(enlaces()).toContain("https://github.com/cosmosnehu77/Charmy/blob/main/docs/metodologia/README.md");
  });

  it("los créditos nombran FIRMS, Copernicus y Meteomatics", () => {
    const creditos = texto("creditos");
    for (const fuente of ["FIRMS", "Copernicus", "Meteomatics"]) expect(creditos).toContain(fuente);
  });

  it("aclara que no reemplaza a emergencias y da el 100 y el 132", () => {
    const creditos = texto("creditos");
    expect(creditos).toContain("no reemplaza a los servicios de emergencia");
    expect(creditos).toContain("100");
    expect(creditos).toContain("132");
  });

  it("el juego se llama Charmy Brigada", () => {
    expect(html).toContain("Charmy Brigada");
    expect(html).not.toContain("Charmy Kids");
  });

  it("marca las muestras y el mapa como ilustrativos o de ejemplo", () => {
    expect(texto("vivo")).toContain("Ejemplo");
    expect(texto("modos")).toContain("Ejemplo, no son datos reales");
    expect(texto("zona")).toContain("focos de ejemplo");
    expect(texto("creditos")).toContain("El mapa de esta página es ilustrativo");
  });

  it("dibuja a Charmy desde el componente: guía por paso y bombero en el juego", () => {
    const plantillas = Array.from(doc.querySelectorAll<HTMLTemplateElement>("template[id^='charmy-']"));
    expect(plantillas).toHaveLength(7);
    for (const p of plantillas) expect(p.content.querySelector("svg"), p.id).not.toBeNull();
    expect(doc.querySelector("#kids-figura svg")).not.toBeNull();
  });

  it("presenta al equipo con su enlace de GitHub", () => {
    for (const login of ["cosmosnehu77", "leonelcnr", "BrunoAguinaga0", "daniace", "dimidio6"]) {
      expect(enlaces()).toContain(`https://github.com/${login}`);
    }
  });
});
