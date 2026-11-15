import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Portada from "../src/pages/index.astro";
import { EN } from "../src/scripts/en";

const guion = readFileSync(fileURLToPath(new URL("../src/scripts/landing.ts", import.meta.url)), "utf8");

let doc: Document;
beforeAll(async () => {
  const container = await AstroContainer.create();
  doc = new JSDOM(await container.renderToString(Portada)).window.document;
});
const texto = (sel: string) => doc.querySelector(sel)?.textContent ?? "";

describe("cards de la landing (F4-E1b, #286)", () => {
  it("el paso 1 trae el gráfico nuevo, marcado como ilustrativo y sin leyenda aparte", () => {
    const g = doc.querySelector("#grafico svg");
    expect(g).not.toBeNull();
    for (const serie of ["arm", "cru", "dif"]) expect(g!.querySelector(`.${serie}`), serie).not.toBeNull();
    for (const t of ["MODIS", "VIIRS", "LLEGA VIIRS", "NOAA-20", "NOAA-21", "ILUSTRATIVO"]) expect(g!.textContent).toContain(t);
    expect(g!.getAttribute("aria-label")).toBeTruthy();
    expect(doc.querySelector("#problema .ley")).toBeNull();
  });

  it("novato y experto son cards con su pieza, y el juego es la tercera", () => {
    expect(doc.querySelectorAll("#modos .modo")).toHaveLength(2);
    expect(doc.querySelector("#modos .modo.n .lectura svg.charmy")).not.toBeNull();
    expect(doc.querySelectorAll("#modos .modo.x #barras rect.b")).toHaveLength(12);
    expect(texto("#modos .modo.x .csv")).toContain("fire_days");
    expect(doc.getElementById("juego")?.classList.contains("modo")).toBe(true);
  });

  it("la muestra de novato sigue marcada como ejemplo", () => {
    expect(texto("#modos .modo.n .lectura.l1")).toContain("Ejemplo");
  });

  it("la card del juego muestra una captura real, enlaza al juego y no promete focos de un día real", () => {
    const img = doc.querySelector<HTMLImageElement>("#juego .captura img");
    expect(img?.getAttribute("alt")).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/juego/partida.jpg");
    expect(existsSync(fileURLToPath(new URL("../public/juego/partida.jpg", import.meta.url)))).toBe(true);
    expect(doc.querySelector("#juego .captura")?.getAttribute("href")).toBe("https://charmy-juego.pages.dev");
    expect(texto("#juego")).not.toContain("día real");
  });

  it("los textos nuevos tienen su versión en inglés", () => {
    const nuevos = [
      "Elegís tu zona y Charmy compara este mes con lo normal. Sin jerga: más fuego, menos o como siempre.",
      "La serie armonizada de MODIS y VIIRS, por celda y por mes. Ves lo mismo que bajás y lo validás por tu cuenta.",
      "Apagá los focos con Charmy.",
      "Un juego para chicas y chicos sobre una maqueta en relieve de Sudamérica. El satélite pasa, aparecen focos y los apagás con agua, aviones y brigadas antes de que el viento los corra.",
      "El mismo mapa sirve a quien quiere saber si su zona está bien, a quien necesita validar la serie y a quien viene a jugar.",
      "días con fuego", "Más fuego que lo normal", "Este año", "Lo normal · 6 días", "Días con fuego", "Meses sin fuego",
      "LLEGA VIIRS", "ILUSTRATIVO", "DÍAS CON FUEGO",
    ];
    for (const t of nuevos) {
      expect(EN[t], t).toBeTruthy();
      expect(doc.body.textContent, t).toContain(t);
    }
  });

  it("la guía de Charmy no promete focos de un día real y se aparta sobre las cards", () => {
    expect(guion).not.toMatch(/día real|real day/);
    expect(guion).toMatch(/\[\$\("modos"\), \$\("juego"\)\]\.forEach\(\(s\) => aparta\.observe\(s\)\)/);
  });
});
