import { rampaAnomalia, rampaConteo, relieve } from "@charmy/ui";
import {
  alturaDelDia,
  colorFoco,
  escalaRegion,
  hace,
  maximo,
  nivelFoco,
  nivelPercentil,
  nivelRegion,
  radioFoco,
  rankingRegiones,
  regionDePunto,
  type RegionResumen,
  valorIndicador,
} from "@/relieve/logica";

function region(id: string, hotspots: number | null, frp: number | null, percentil?: number): RegionResumen {
  return {
    type: "Feature",
    id,
    geometry: { type: "Polygon", coordinates: [] },
    properties: {
      region: id,
      name: `Región ${id}`,
      country: "Argentina",
      hotspots,
      frp_mw: frp,
      by_day: hotspots === null ? null : [hotspots],
      frp_by_day: frp === null ? null : [frp],
      last_month:
        percentil === undefined ? null : { year: 2026, month: 10, value: 10, median: 8, percentile: percentil },
    },
  };
}

const REGIONES = [region("A", 300, 1200, 80), region("B", 0, 0), region("C", 12, 40), region("D", 75, 300, 20)];

describe("valor de cada indicador", () => {
  it("focos, intensidad y anomalía salen de la región; riesgo y predicción no tienen dato", () => {
    const a = REGIONES[0]!.properties;
    expect(valorIndicador(a, "focos")).toBe(300);
    expect(valorIndicador(a, "frp")).toBe(1200);
    expect(valorIndicador(a, "anomalia")).toBe(80);
    expect(valorIndicador(a, "riesgo")).toBeNull();
    expect(valorIndicador(a, "prediccion")).toBeNull();
    expect(valorIndicador(REGIONES[1]!.properties, "anomalia")).toBeNull();
  });
  it("sin focos en vivo, el valor es null", () => {
    expect(valorIndicador(region("X", null, null).properties, "focos")).toBeNull();
  });
});

describe("escala de cada región", () => {
  it("conteos: raíz del valor sobre el máximo, con la rampa YlOrRd", () => {
    const max = maximo(REGIONES, "focos");
    expect(max).toBe(300);
    expect(escalaRegion(300, max, "focos")).toEqual({ color: rampaConteo[6], altura: 1 });
    expect(escalaRegion(75, max, "focos").altura).toBeCloseTo(0.5);
    expect(escalaRegion(75, max, "focos").color).toBe(rampaConteo[3]);
  });
  it("sin focos queda baja y sin color de fuego; sin dato, gris", () => {
    expect(escalaRegion(0, 300, "focos")).toEqual({ color: relieve.sinDato, altura: 0 });
    expect(escalaRegion(null, 300, "focos")).toEqual({ color: relieve.sinDato, altura: 0 });
  });
  it("anomalía: el percentil con la rampa PuOr", () => {
    expect(escalaRegion(80, 100, "anomalia")).toEqual({ color: rampaAnomalia[5], altura: 0.8 });
    expect(escalaRegion(5, 100, "anomalia").color).toBe(rampaAnomalia[0]);
  });
});

describe("ranking", () => {
  it("ordena de mayor a menor, sin regiones en cero ni sin dato", () => {
    const r = rankingRegiones(REGIONES, "focos", 5);
    expect(r.map((x) => x.id)).toEqual(["A", "D", "C"]);
    expect(r[0]).toMatchObject({ nombre: "Región A", valor: 300 });
  });
  it("respeta el tope", () => {
    expect(rankingRegiones(REGIONES, "focos", 2)).toHaveLength(2);
  });
});

describe("nivel de la ficha", () => {
  it("de más a menos fuego", () => {
    expect(nivelRegion(300, 0)).toEqual({ texto: "Entre las de más fuego", tono: "alto" });
    expect(nivelRegion(12, 5)).toEqual({ texto: "Con fuego activo", tono: "medio" });
    expect(nivelRegion(4, 8)).toEqual({ texto: "Poca actividad", tono: "bajo" });
    expect(nivelRegion(0, -1)).toEqual({ texto: "Sin focos esta semana", tono: "cero" });
    expect(nivelRegion(null, -1)).toEqual({ texto: "Focos no disponibles", tono: "cero" });
  });
  it("el percentil en palabras", () => {
    expect(nivelPercentil(80)).toBe("bastante por encima de lo normal");
    expect(nivelPercentil(60)).toBe("un poco por encima de lo normal");
    expect(nivelPercentil(50)).toBe("dentro de lo normal");
    expect(nivelPercentil(30)).toBe("un poco por debajo de lo normal");
    expect(nivelPercentil(10)).toBe("bastante por debajo de lo normal");
  });
});

describe("línea de tiempo", () => {
  it("la altura del día es la de la semana por el día sobre el día con más focos", () => {
    expect(alturaDelDia(0.8, [1, 4, 2], 1)).toBeCloseTo(0.8);
    expect(alturaDelDia(0.8, [1, 4, 2], 2)).toBeCloseTo(0.4);
    expect(alturaDelDia(0.8, [0, 0, 0], 0)).toBe(0);
  });
});

describe("focos en vivo", () => {
  it("el radio crece con la raíz de la intensidad", () => {
    expect(radioFoco(0)).toBe(3);
    expect(radioFoco(100)).toBe(19);
    expect(radioFoco(null)).toBe(3);
  });
  it("color y nivel por intensidad", () => {
    expect(colorFoco(2)).toBe(rampaConteo[1]);
    expect(colorFoco(100)).toBe(rampaConteo[6]);
    expect(nivelFoco(5)).toBe("Bajo");
    expect(nivelFoco(10)).toBe("Fuerte");
    expect(nivelFoco(30)).toBe("Muy fuerte");
  });
  it("hace cuánto, en horas", () => {
    const ahora = new Date("2026-11-14T12:00:00Z");
    expect(hace(ahora, "2026-11-14T11:40:00Z")).toBe("hace menos de 1 h");
    expect(hace(ahora, "2026-11-14T07:00:00Z")).toBe("hace 5 h");
  });
});

describe("región de un punto", () => {
  const cuadrado = (id: string, x: number): RegionResumen => ({
    ...region(id, 0, 0),
    geometry: { type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
  });
  const multi: RegionResumen = {
    ...region("M", 0, 0),
    geometry: { type: "MultiPolygon", coordinates: [[[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]] },
  };
  it("encuentra la región que contiene el punto, también en multipolígonos", () => {
    const regiones = [cuadrado("A", 0), cuadrado("B", 2), multi];
    expect(regionDePunto(regiones, 0.5, 0.5)).toBe("A");
    expect(regionDePunto(regiones, 2.2, 0.9)).toBe("B");
    expect(regionDePunto(regiones, 5.5, 5.5)).toBe("M");
    expect(regionDePunto(regiones, 1.5, 0.5)).toBeNull();
  });
});
