import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("enlaces del juego", () => {
  it("«Salir del juego» vuelve a la landing en charmy.earth", () => {
    expect(html).toMatch(/id="pausaSalir"[^>]*href="https:\/\/charmy\.earth"/);
    expect(html).not.toContain("pages.dev");
  });
});
