import { describe, expect, it } from "vitest";
import { GET } from "../src/pages/favicon.svg";

describe("favicon", () => {
  it("devuelve la cabeza de Charmy del componente, sin fondo", async () => {
    const r = await GET();
    expect(r.headers.get("content-type")).toBe("image/svg+xml");
    const svg = await r.text();
    expect(svg).toMatch(/^<svg [^>]*class="charmy"/);
    expect(svg).toContain('viewBox="50 4 140 140"');
  });
});
