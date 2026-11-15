import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import contorno from "../src/fondo.json";
import { contornoDelDia, encuadre, proyectar, simplificar, type Anillo, type GeoJson } from "../src/contorno";

const ruta = (r: string) => fileURLToPath(new URL(r, import.meta.url));
const regiones = JSON.parse(readFileSync(ruta("../../../data/muestras/regiones.geojson"), "utf8")) as GeoJson;
const bbox = dia.bbox as [number, number, number, number];

function extension(anillos: Anillo[]): [number, number, number, number] {
  const lons = anillos.flat().map((p) => p[0]);
  const lats = anillos.flat().map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

describe("simplificar", () => {
  it("saca los puntos casi alineados y conserva el anillo cerrado", () => {
    const anillo: Anillo = [
      [0, 0],
      [1, 0.001],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    expect(simplificar(anillo, 0.01)).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ]);
  });
});

describe("contorno de la región de fondo", () => {
  it("fondo.json está al día con regiones.geojson (se regenera con pnpm contorno)", () => {
    expect(contornoDelDia(regiones, bbox)).toEqual(contorno);
  });

  it("conserva el recuadro del día: solo regiones que lo tocan y la misma extensión", () => {
    expect(contorno.bbox).toEqual(dia.bbox);
    const [oeste, sur, este, norte] = bbox;
    for (const anillo of contorno.anillos as Anillo[]) {
      const [o, s, e, n] = extension([anillo]);
      expect(e >= oeste && o <= este && n >= sur && s <= norte).toBe(true);
    }
    const original = regiones.features
      .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
      .map((poligono) => poligono[0]!)
      .filter((a) => {
        const [o, s, e, n] = extension([a]);
        return e >= oeste && o <= este && n >= sur && s <= norte;
      });
    const antes = extension(original);
    const despues = extension(contorno.anillos as Anillo[]);
    for (let i = 0; i < 4; i++) expect(Math.abs(despues[i]! - antes[i]!)).toBeLessThan(0.1);
  });

  it("pesa menos que el original", () => {
    const original = readFileSync(ruta("../../../data/muestras/regiones.geojson")).length;
    expect(JSON.stringify(contorno).length).toBeLessThan(original / 4);
  });

  it("proyecta con el norte arriba y el oeste a la izquierda, como los focos", () => {
    expect(proyectar([-76, -35], bbox, { ancho: 800, alto: 600 })).toEqual({ x: 0, y: 0 });
    expect(proyectar([-62, -56], bbox, { ancho: 800, alto: 600 })).toEqual({ x: 800, y: 600 });
  });
});

describe("encuadre del mapa", () => {
  it("conserva la proporción real del recuadro y lo centra a lo ancho en un área apaisada", () => {
    const area = { ancho: 760, alto: 520 };
    const e = encuadre(bbox, area);
    const proporcion = (14 * Math.cos((45.5 * Math.PI) / 180)) / 21;
    expect(e.alto).toBe(520);
    expect(e.ancho / e.alto).toBeCloseTo(proporcion, 5);
    expect(e.dx).toBeCloseTo((760 - e.ancho) / 2, 5);
    expect(e.dy).toBe(0);
  });

  it("en un área muy alta y angosta usa todo el ancho y lo centra a lo alto", () => {
    const e = encuadre(bbox, { ancho: 200, alto: 1000 });
    expect(e.ancho).toBe(200);
    expect(e.dx).toBe(0);
    expect(e.dy).toBeCloseTo((1000 - e.alto) / 2, 5);
  });
});
