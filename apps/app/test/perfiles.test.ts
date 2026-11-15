import type { StyleSpecification } from "maplibre-gl";
import { NOMBRE_ES, nombresEnEspanol } from "@/mapa/perfiles";

const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://ejemplo/planet" } },
  layers: [
    { id: "fondo", type: "background" },
    { id: "calle", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "nombre", type: "symbol", source: "openmaptiles", "source-layer": "place" },
  ],
};

describe("nombres del mapa base en español", () => {
  const texto = (c?: StyleSpecification["layers"][number]) => (c?.type === "symbol" ? c.layout?.["text-field"] : undefined);
  // Así arman sus etiquetas los estilos de OpenFreeMap: en inglés cuando hay `name_en`.
  const enIngles = [
    "case",
    ["has", "name:nonlatin"],
    ["concat", ["get", "name:latin"], "\n", ["get", "name:nonlatin"]],
    ["coalesce", ["get", "name_en"], ["get", "name"]],
  ];
  const estilo: StyleSpecification = {
    version: 8,
    sources: base.sources,
    layers: [
      { id: "fondo", type: "background" },
      { id: "lugar", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: { "text-field": enIngles as never } },
      { id: "ruta", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", layout: { "text-field": ["to-string", ["get", "ref"]] } },
    ],
  };

  it("las etiquetas de lugares usan el nombre en español y Malvinas nunca sale como Falkland", () => {
    const capas = nombresEnEspanol(estilo).layers;
    const lugar = capas.find((c) => c.id === "lugar");
    expect(texto(lugar)).toEqual(NOMBRE_ES);
    expect(JSON.stringify(NOMBRE_ES)).toContain('"name:es"');
    expect(NOMBRE_ES).toEqual(expect.arrayContaining(["Falkland Islands", "Islas Malvinas"]));
  });

  it("no toca las etiquetas que no son nombres (números de ruta)", () => {
    const ruta = nombresEnEspanol(estilo).layers.find((c) => c.id === "ruta");
    expect(texto(ruta)).toEqual(["to-string", ["get", "ref"]]);
  });

});
