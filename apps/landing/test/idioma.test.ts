import { describe, expect, it } from "vitest";
import { conIdioma, idiomaInicial } from "../src/scripts/idioma";

describe("idioma de la landing", () => {
  it("el del enlace (cuando se vuelve del juego) gana a lo guardado", () => {
    expect(idiomaInicial("?idioma=en", "es")).toBe("en");
    expect(idiomaInicial("?idioma=es", "en")).toBe("es");
  });

  it("sin enlace, lo guardado; sin nada o con un valor raro, español", () => {
    expect(idiomaInicial("", "en")).toBe("en");
    expect(idiomaInicial("", null)).toBe("es");
    expect(idiomaInicial("?idioma=fr", "xx")).toBe("es");
  });

  it("el enlace al juego lleva el idioma activo", () => {
    expect(conIdioma("https://charmy-juego.pages.dev", "en")).toBe("https://charmy-juego.pages.dev/?idioma=en");
    expect(conIdioma("https://charmy-juego.pages.dev/?idioma=en", "es")).toBe("https://charmy-juego.pages.dev/?idioma=es");
  });
});
