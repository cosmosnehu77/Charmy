import type { components } from "@charmy/contracts-api";
import type { CeldaCalendario } from "@/calendario/grilla";
import { resumenCalendario } from "@/calendario/estadisticas";
import { resumenFocos } from "@/consulta/estadisticas";

type Foco = components["schemas"]["Hotspot"];

// Valores inventados con la forma del contrato.
const celda = (year: number, month: number, value: number, percentile: number) =>
  ({ year, month, value, median: 2, anomaly: value - 2, percentile, origin: "viirs_medido" }) as CeldaCalendario;

describe("resumenCalendario", () => {
  const celdas = [
    celda(2024, 1, 10, 80),
    celda(2024, 2, 4, 50),
    celda(2025, 1, 22, 99),
    celda(2025, 2, 0, 20),
    celda(2025, 7, 1, 10),
  ];

  it("suma el fuego del período y promedia por mes con dato", () => {
    const r = resumenCalendario(celdas);
    expect(r.total).toBe(37);
    expect(r.mesesConDato).toBe(5);
    expect(r.promedioMensual).toBeCloseTo(7.4);
  });

  it("encuentra el mes pico y el año con más fuego", () => {
    const r = resumenCalendario(celdas);
    expect(r.pico).toEqual({ year: 2025, month: 1, value: 22 });
    expect(r.anioMayor).toEqual({ year: 2025, total: 23 });
  });

  it("cuenta los meses por encima y por debajo de lo normal (percentil 75 y 25)", () => {
    const r = resumenCalendario(celdas);
    expect(r.mesesSobreLoNormal).toBe(2);
    expect(r.mesesBajoLoNormal).toBe(2);
  });

  it("arma la temporada: promedio por mes del año, null donde no hay dato", () => {
    const r = resumenCalendario(celdas);
    expect(r.temporada).toHaveLength(12);
    expect(r.temporada[0]).toBe(16);
    expect(r.temporada[1]).toBe(2);
    expect(r.temporada[6]).toBe(1);
    expect(r.temporada[3]).toBeNull();
    expect(r.mesMasActivo).toBe(1);
  });

  it("sin celdas no inventa picos", () => {
    const r = resumenCalendario([]);
    expect(r).toMatchObject({ total: 0, mesesConDato: 0, promedioMensual: 0, pico: null, anioMayor: null, mesMasActivo: null });
    expect(r.temporada.every((v) => v === null)).toBe(true);
  });

  it("si todo es cero no hay mes pico ni mes más activo", () => {
    const r = resumenCalendario([celda(2025, 1, 0, 50), celda(2025, 2, 0, 50)]);
    expect(r.pico).toBeNull();
    expect(r.anioMayor).toBeNull();
    expect(r.mesMasActivo).toBeNull();
  });
});

const foco = (fecha: string, instrument: "MODIS" | "VIIRS", daynight: "D" | "N", frp: number | null): Foco =>
  ({
    type: "Feature",
    id: `${fecha}-${instrument}-${frp}`,
    geometry: { type: "Point", coordinates: [-71, -42] },
    properties: {
      acq_datetime: fecha,
      satellite: instrument === "MODIS" ? "Aqua" : "N20",
      instrument,
      confidence: "high",
      frp,
      daynight,
    },
  }) as Foco;

describe("resumenFocos", () => {
  const focos = [
    foco("2025-01-10T04:00:00Z", "VIIRS", "N", 10),
    foco("2025-01-10T15:00:00Z", "VIIRS", "D", 30),
    foco("2025-01-10T15:30:00Z", "MODIS", "D", null),
    foco("2025-01-12T15:00:00Z", "VIIRS", "D", 2),
  ];

  it("cuenta por instrumento y de noche", () => {
    const r = resumenFocos(focos);
    expect(r.total).toBe(4);
    expect(r.porInstrumento).toEqual({ MODIS: 1, VIIRS: 3 });
    expect(r.deNoche).toBe(1);
  });

  it("encuentra el día con más focos en UTC y cuántos días tuvieron fuego", () => {
    const r = resumenFocos(focos);
    expect(r.diaPico).toEqual({ fecha: "2025-01-10", cantidad: 3 });
    expect(r.diasConFoco).toBe(2);
  });

  it("la potencia ignora los focos sin FRP: máxima y mediana", () => {
    const r = resumenFocos(focos);
    expect(r.frpMax).toBe(30);
    expect(r.frpMediana).toBe(10);
  });

  it("la mediana de una cantidad par promedia los dos del medio", () => {
    expect(resumenFocos([foco("2025-01-10T04:00:00Z", "VIIRS", "N", 4), foco("2025-01-10T05:00:00Z", "VIIRS", "N", 8)]).frpMediana).toBe(6);
  });

  it("sin focos no hay día pico ni potencia", () => {
    expect(resumenFocos([])).toEqual({
      total: 0,
      porInstrumento: { MODIS: 0, VIIRS: 0 },
      deNoche: 0,
      diaPico: null,
      diasConFoco: 0,
      frpMax: null,
      frpMediana: null,
    });
  });
});
