import { describe, expect, it } from "vitest";
import { adentro, contornoDe, encuadre, proyectar, regionEn, type Paises, type Recuadro } from "../src/contorno";
import geo from "../src/sudamerica.json";

const bbox: Recuadro = [-76, -56, -62, -35];
const mapa = contornoDe(geo as Paises);

describe("mapa de Sudamérica", () => {
  it("cada anillo trae el nombre de su país", () => {
    expect(mapa.nombres).toHaveLength(mapa.anillos.length);
    expect(mapa.nombres).toEqual(expect.arrayContaining(["Argentina", "Chile", "Brasil", "Islas Malvinas"]));
  });

  it("los nombres están en español", () => {
    expect(mapa.nombres).not.toContain("Falkland Islands");
    expect(mapa.nombres).not.toContain("Brazil");
  });

  it("encuentra el país de un punto, o null en el mar", () => {
    expect(regionEn(mapa, [-58.38, -34.6])).toBe("Argentina"); // Buenos Aires
    expect(regionEn(mapa, [-70.65, -33.45])).toBe("Chile"); // Santiago
    expect(regionEn(mapa, [-59.0, -51.7])).toBe("Islas Malvinas");
    expect(regionEn(mapa, [-40, -45])).toBeNull(); // el Atlántico
  });

  it("un punto adentro de un cuadrado está adentro; afuera, no", () => {
    const cuadrado: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(adentro([5, 5], cuadrado)).toBe(true);
    expect(adentro([15, 5], cuadrado)).toBe(false);
  });
});

describe("proyección y encuadre", () => {
  it("proyecta con el norte arriba y el oeste a la izquierda", () => {
    expect(proyectar([-76, -35], bbox, { ancho: 800, alto: 600 })).toEqual({ x: 0, y: 0 });
    expect(proyectar([-62, -56], bbox, { ancho: 800, alto: 600 })).toEqual({ x: 800, y: 600 });
  });

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
