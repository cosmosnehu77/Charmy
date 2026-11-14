import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Charmy, CAPAS_DE, MOODS, OUTFITS, capasVisibles, charmySvg } from "../src/index.js";
import { CAPAS } from "../src/dibujo.js";

const visibles = (svg: string) =>
  [...new Set([...svg.matchAll(/data-capa="(\w+)" opacity="1"/g)].map((m) => m[1]))].sort();

describe("capas", () => {
  it("todas las capas del dibujo tienen regla", () => {
    for (const m of MOODS) for (const o of OUTFITS) {
      const v = capasVisibles(m, o);
      expect(Object.keys(v).sort()).toEqual([...CAPAS].sort());
    }
  });

  it("cada estado tiene exactamente un par de ojos y una boca", () => {
    for (const m of MOODS) {
      const v = capasVisibles(m, "base");
      expect(v.eyesOpen + v.eyesHappy + v.eyesAlert + v.eyesThink).toBe(1);
      expect(v.mouthW + v.mouthOpen + v.mouthBig + v.mouthO).toBe(1);
    }
  });

  it("cada vestuario prende solo su capa", () => {
    for (const o of OUTFITS) {
      const v = capasVisibles("idle", o);
      const prendidas = (["bombero", "piloto", "cientifica", "guia"] as const).filter((c) => v[c] === 1);
      expect(prendidas).toEqual(o === "base" ? [] : [o]);
    }
  });

  it("con texto se apaga el globo de puntos del dibujo", () => {
    expect(capasVisibles("explica", "base").speech).toBe(1);
    expect(capasVisibles("explica", "base", true).speech).toBe(0);
  });

  it("CAPAS_DE coincide con lo que se dibuja", () => {
    expect(visibles(charmySvg({ mood: "alerta", outfit: "bombero" }))).toEqual(
      CAPAS_DE("alerta", "bombero").sort(),
    );
  });
});

describe("charmySvg", () => {
  it("valores inválidos vuelven a los de por defecto", () => {
    const svg = charmySvg({ mood: "x" as never, outfit: "y" as never, size: -3 });
    expect(svg).toContain('data-mood="idle"');
    expect(svg).toContain('data-outfit="base"');
    expect(svg).toContain('width="240"');
  });

  it("por debajo de 40 px dibuja solo la cabeza", () => {
    expect(charmySvg({ size: 32 })).toContain('viewBox="50 4 140 140"');
    expect(charmySvg({ size: 64 })).toContain('viewBox="0 0 240 240"');
  });

  it("escapa el texto alternativo", () => {
    const svg = charmySvg({ label: '"><script>x</script>' });
    expect(svg).not.toContain("<script>");
  });

  it("describe estado y vestuario para lectores de pantalla", () => {
    expect(charmySvg({ mood: "saluda", outfit: "bombero" })).toContain('aria-label="Charmy de bombero saludando"');
    expect(charmySvg({ decorative: true })).toContain('aria-hidden="true"');
  });
});

describe("<Charmy />", () => {
  it("sin texto no dibuja globo", () => {
    const html = renderToStaticMarkup(<Charmy mood="saluda" />);
    expect(html).not.toContain("charmy-globo");
  });

  it("con texto muestra el globo y lo anuncia", () => {
    const html = renderToStaticMarkup(<Charmy mood="explica" say="Este mes hay más focos que lo normal." />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Este mes hay más focos que lo normal.");
  });

  it("el texto del globo se escapa", () => {
    const html = renderToStaticMarkup(<Charmy say="<b>hola</b>" />);
    expect(html).not.toContain("<b>hola</b>");
  });
});
