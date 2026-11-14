import type { StyleSpecification } from "maplibre-gl";
import { perfiles, transformarEstilo, URL_TERRARIUM } from "@/mapa/perfiles";

const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://ejemplo/planet" } },
  layers: [
    { id: "fondo", type: "background" },
    { id: "calle", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "nombre", type: "symbol", source: "openmaptiles", "source-layer": "place" },
  ],
};

describe("perfiles del mapa (RF-MAP-06)", () => {
  it("2D: sin relieve ni inclinación", () => {
    const estilo = transformarEstilo("2d")(undefined, { ...base, terrain: { source: "x" } });
    expect(estilo.terrain).toBeUndefined();
    expect(estilo.sources).not.toHaveProperty("relieve");
    expect(perfiles["2d"].inclinacionMax).toBe(0);
  });

  it("3D: relieve Terrarium y sombreado debajo de las calles", () => {
    const estilo = transformarEstilo("3d")(undefined, base);
    expect(estilo.terrain?.source).toBe("relieve");
    expect(estilo.sources.relieve).toMatchObject({ type: "raster-dem", encoding: "terrarium", tiles: [URL_TERRARIUM] });
    expect(estilo.layers.map((c) => c.id)).toEqual(["fondo", "sombreado", "calle", "nombre"]);
    expect(perfiles["3d"].inclinacion).toBeGreaterThan(0);
  });

  it("no modifica el estilo que recibe", () => {
    transformarEstilo("3d")(undefined, base);
    expect(base.layers).toHaveLength(3);
    expect(base.sources).not.toHaveProperty("relieve");
  });

  it("los dos perfiles usan estilos sin clave", () => {
    for (const p of Object.values(perfiles)) expect(p.estilo).not.toMatch(/key=|token=/i);
  });
});
