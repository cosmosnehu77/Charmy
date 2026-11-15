import { JSDOM } from "jsdom";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Portada from "../src/pages/index.astro";
import { EN } from "../src/scripts/en";

let doc: Document;
beforeAll(async () => {
  const container = await AstroContainer.create();
  doc = new JSDOM(await container.renderToString(Portada)).window.document;
});

describe("card de canales de Telegram (F4-E1b, issue 388)", () => {
  it("está justo después de la card del juego, con su título", () => {
    const s = doc.getElementById("avisos");
    expect(doc.getElementById("juego")?.nextElementSibling).toBe(s);
    expect(doc.getElementById(s!.getAttribute("aria-labelledby")!)?.tagName).toBe("H2");
  });

  it("tiene los tres canales, cada uno con su enlace, que abre en otra pestaña", () => {
    const canales = [...doc.querySelectorAll<HTMLAnchorElement>("#avisos a.canal")];
    expect(canales.map((a) => [a.querySelector("strong")?.textContent, a.getAttribute("href")])).toEqual([
      ["Comarca Andina", "https://t.me/+29kxDW2TpcVlMDY5"],
      ["Norte de Salta", "https://t.me/+ABJdg2Zmsko4OTcx"],
      ["Impenetrable chaqueño", "https://t.me/+5kIYhu5NmCthMmVh"],
    ]);
    for (const a of canales) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.querySelector("svg path")?.getAttribute("d")).toMatch(/^M16\.906 7\.224/); // el avión, sin el círculo del logo
    }
  });

  it("el mensaje de muestra está marcado como ejemplo y nombra el número de emergencias", () => {
    const m = doc.querySelector("#avisos .burbuja")?.textContent ?? "";
    expect(m).toContain("Ejemplo");
    expect(m).toContain("100");
  });

  it("los textos nuevos tienen su versión en inglés", () => {
    for (const t of [
      "Avisos por Telegram", "El aviso te llega", "antes que el humo.", "Unirme",
      "Charmy publica los avisos de peligro de incendio de cada zona en su canal de Telegram. Elegí la tuya y sumate.",
      "Peligro de incendio alto hoy en la zona. Evitá hacer fuego. Si ves humo, llamá al 100.",
    ]) expect(EN[t], t).toBeTruthy();
  });
});
