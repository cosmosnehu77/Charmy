import { iconoCharmy, ponerIcono } from "@/lib/icono";

describe("Charmy en la pestaña del navegador (F4-D15)", () => {
  it("el ícono es la cabeza de Charmy en un SVG data:", () => {
    const url = iconoCharmy();
    expect(url.startsWith("data:image/svg+xml,")).toBe(true);
    const svg = decodeURIComponent(url.slice("data:image/svg+xml,".length));
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="50 4 140 140"');
  });

  it("reemplaza el ícono de la página", () => {
    document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
    ponerIcono(document);
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe(iconoCharmy());
  });
});
