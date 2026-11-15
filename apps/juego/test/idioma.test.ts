import { describe, expect, it } from "vitest";
import { CLAVE_IDIOMA, conIdioma, guardarIdioma, idiomaInicial, localeDe } from "../src/idioma";

const guardado = (valor: string | null) => ({ getItem: () => valor, setItem: () => {} });
const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } };

describe("idioma al entrar", () => {
  it("usa la misma clave que la landing", () => {
    expect(CLAVE_IDIOMA).toBe("charmy-idioma");
  });

  it("el idioma del enlace gana a lo guardado", () => {
    expect(idiomaInicial("?idioma=en", guardado("es"))).toBe("en");
    expect(idiomaInicial("?x=1&idioma=es", guardado("en"))).toBe("es");
  });

  it("sin enlace, usa lo guardado; sin nada, español", () => {
    expect(idiomaInicial("", guardado("en"))).toBe("en");
    expect(idiomaInicial("", guardado(null))).toBe("es");
  });

  it("un valor raro cae a lo guardado o a español", () => {
    expect(idiomaInicial("?idioma=fr", guardado("en"))).toBe("en");
    expect(idiomaInicial("?idioma=fr", guardado("xx"))).toBe("es");
  });

  it("un almacenamiento bloqueado no rompe", () => {
    expect(idiomaInicial("", roto)).toBe("es");
    expect(idiomaInicial("?idioma=en", roto)).toBe("en");
    expect(() => guardarIdioma(roto, "en")).not.toThrow();
  });

  it("guarda el idioma en la clave compartida", () => {
    const hecho: [string, string][] = [];
    guardarIdioma({ getItem: () => null, setItem: (k, v) => void hecho.push([k, v]) }, "en");
    expect(hecho).toEqual([["charmy-idioma", "en"]]);
  });
});

describe("enlace con idioma", () => {
  it("agrega el idioma sin perder lo demás", () => {
    expect(conIdioma("https://charmy.earth", "en")).toBe("https://charmy.earth/?idioma=en");
    expect(conIdioma("https://charmy.earth/a?b=1#c", "en")).toBe("https://charmy.earth/a?b=1&idioma=en#c");
  });

  it("reemplaza el que ya tenía", () => {
    expect(conIdioma("https://charmy.earth/?idioma=en", "es")).toBe("https://charmy.earth/?idioma=es");
  });
});

describe("formato de números", () => {
  it("español de Argentina o inglés", () => {
    expect(localeDe("es")).toBe("es-AR");
    expect(localeDe("en")).toBe("en-US");
  });
});
