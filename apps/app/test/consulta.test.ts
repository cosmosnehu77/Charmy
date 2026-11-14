import type { components } from "@charmy/contracts-api";
import {
  areaDesdePunto,
  bboxDeArea,
  filtrarFocos,
  rutaFocos,
  validarFechas,
  validarPunto,
} from "@/consulta/consulta";

type Coleccion = components["schemas"]["HotspotCollection"];

describe("validarPunto (RF-MAP-02)", () => {
  it("acepta latitud y longitud válidas", () => {
    expect(validarPunto("-42.9", "-71.3")).toBeNull();
  });
  it("rechaza latitud fuera de -90 a 90", () => {
    expect(validarPunto("-95", "-71.3")).toMatch(/latitud/i);
  });
  it("rechaza longitud fuera de -180 a 180", () => {
    expect(validarPunto("-42.9", "190")).toMatch(/longitud/i);
  });
  it("rechaza texto que no es número y campos vacíos", () => {
    expect(validarPunto("abc", "-71.3")).toMatch(/latitud/i);
    expect(validarPunto("-42.9", "")).toMatch(/longitud/i);
  });
  it("acepta coma decimal", () => {
    expect(validarPunto("-42,9", "-71,3")).toBeNull();
  });
});

describe("areaDesdePunto y bboxDeArea", () => {
  it("arma un polígono cerrado alrededor del punto con el radio pedido", () => {
    const area = areaDesdePunto(-42.9, -71.3, 25);
    expect(area.type).toBe("Polygon");
    const anillo = area.coordinates[0] ?? [];
    expect(anillo[0]).toEqual(anillo[anillo.length - 1]);
    const [oeste, sur, este, norte] = bboxDeArea(area);
    expect(sur).toBeLessThan(-42.9);
    expect(norte).toBeGreaterThan(-42.9);
    // 25 km son unos 0,22° de latitud
    expect(norte - sur).toBeCloseTo(0.45, 1);
    expect(oeste).toBeLessThan(-71.3);
    expect(este).toBeGreaterThan(-71.3);
  });
});

describe("validarFechas (RF-MAP-04)", () => {
  const hoy = "2026-11-14";
  it("acepta un rango válido", () => {
    expect(validarFechas("2026-11-01", "2026-11-14", hoy)).toBeNull();
  });
  it("bloquea 'desde' posterior a 'hasta'", () => {
    expect(validarFechas("2026-11-10", "2026-11-01", hoy)).toMatch(/desde.*hasta/i);
  });
  it("bloquea fechas futuras", () => {
    expect(validarFechas("2026-11-01", "2026-12-01", hoy)).toMatch(/futur/i);
  });
  it("bloquea fechas anteriores al inicio de MODIS", () => {
    expect(validarFechas("1999-01-01", "2001-01-01", hoy)).toMatch(/2000/);
  });
  it("pide las dos fechas", () => {
    expect(validarFechas("", "2026-11-14", hoy)).toMatch(/fecha/i);
  });
});

describe("rutaFocos: la consulta lleva área, fechas y filtros (RF-MAP-05)", () => {
  it("arma la ruta de /hotspots con los parámetros del contrato", () => {
    const ruta = rutaFocos({
      bbox: [-71.6, -42.8, -71, -42.2],
      desde: "2026-11-07",
      hasta: "2026-11-14",
      fuente: "viirs",
      confianzaMin: "high",
    });
    const url = new URL(ruta, "http://x");
    expect(url.pathname).toBe("/hotspots");
    expect(url.searchParams.get("bbox")).toBe("-71.6,-42.8,-71,-42.2");
    expect(url.searchParams.get("from")).toBe("2026-11-07");
    expect(url.searchParams.get("to")).toBe("2026-11-14");
    expect(url.searchParams.get("source")).toBe("viirs");
    expect(url.searchParams.get("min_confidence")).toBe("high");
  });
  it("redondea el área a 4 decimales", () => {
    const ruta = rutaFocos({
      bbox: [-71.123456789, -42.1, -71, -42],
      desde: "2026-11-07",
      hasta: "2026-11-14",
      fuente: "harmonized",
      confianzaMin: "nominal",
    });
    expect(new URL(ruta, "http://x").searchParams.get("bbox")).toBe("-71.1235,-42.1,-71,-42");
  });
});

describe("filtrarFocos: intensidad y momento del día (RF-MAP-05)", () => {
  const foco = (id: string, frp: number, daynight: "D" | "N") => ({
    type: "Feature" as const,
    id,
    geometry: { type: "Point" as const, coordinates: [-71.3, -42.9] },
    properties: {
      acq_datetime: "2026-11-12T18:00:00Z",
      satellite: "N20" as const,
      instrument: "VIIRS" as const,
      confidence: "nominal" as const,
      frp,
      daynight,
    },
  });
  const coleccion: Coleccion = {
    type: "FeatureCollection",
    features: [foco("a", 2, "D"), foco("b", 20, "N"), foco("c", 50, "D")],
  };
  const ids = (c: Coleccion) => c.features.map((f) => f.id);

  it("sin filtros devuelve todo", () => {
    expect(ids(filtrarFocos(coleccion, { frpMin: 0, momento: "todos" }))).toEqual(["a", "b", "c"]);
  });
  it("filtra por potencia mínima", () => {
    expect(ids(filtrarFocos(coleccion, { frpMin: 10, momento: "todos" }))).toEqual(["b", "c"]);
  });
  it("filtra por día o noche", () => {
    expect(ids(filtrarFocos(coleccion, { frpMin: 0, momento: "N" }))).toEqual(["b"]);
    expect(ids(filtrarFocos(coleccion, { frpMin: 10, momento: "D" }))).toEqual(["c"]);
  });
});
