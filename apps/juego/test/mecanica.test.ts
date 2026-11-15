import { describe, expect, it } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import { cargarDia, type DiaJuego, type FocoEnPantalla } from "../src/datos";
import { DURACION_PARTIDA_MS, DURACION_PASADAS_MS, pasadas, planPorPasadas, potencia } from "../src/mecanica";

describe("potencia (FRP) como vida del foco", () => {
  it.each([
    [0.26, 1, 6000],
    [1.99, 1, 6000],
    [2, 2, 5400],
    [9.99, 2, 5400],
    [10, 3, 4800],
    [29.99, 3, 4800],
    [30, 4, 4200],
    [55.06, 4, 4200],
  ])("%s MW: %s toques y %s ms para escaparse", (frp, toques, escapeMs) => {
    expect(potencia(frp)).toEqual({ toques, escapeMs });
  });

  it("los extremos de la muestra quedan en los extremos de la tabla", () => {
    const frps = (dia as DiaJuego).focos.map((f) => f.frp);
    expect(potencia(Math.min(...frps)).toques).toBe(1);
    expect(potencia(Math.max(...frps)).toques).toBe(4);
  });
});

const foco = (hora_utc: string, y: number): FocoEnPantalla => ({
  lat: -40,
  lon: -70,
  frp: 1,
  confidence: "nominal",
  hora_utc,
  x: 0,
  y,
});

describe("pasadas del satélite", () => {
  it("agrupa los focos por hora de detección y las pasadas salen en orden", () => {
    const grupos = pasadas([foco("18:10", 0), foco("04:55", 0), foco("18:59", 0), foco("05:01", 0)]);
    expect(grupos.map((g) => g.hora)).toEqual([4, 5, 18]);
    expect(grupos.map((g) => g.focos.length)).toEqual([1, 1, 2]);
  });

  it("de noche el satélite baja de norte a sur y de día sube de sur a norte", () => {
    const [noche, dia] = pasadas([foco("04:00", 0), foco("18:00", 0)]);
    expect(noche!.haciaElSur).toBe(true);
    expect(dia!.haciaElSur).toBe(false);
  });

  it("con la muestra salen las seis pasadas del día", () => {
    const focos = cargarDia(dia as DiaJuego, { ancho: 800, alto: 600 });
    expect(pasadas(focos).map((g) => g.hora)).toEqual([4, 5, 6, 17, 18, 19]);
  });
});

describe("plan por pasadas", () => {
  const ALTO = 600;

  it("cada foco aparece cuando la franja llega a su altura, dentro de la ventana de su pasada", () => {
    const focos = [foco("04:00", 0), foco("04:00", 600), foco("18:00", 0), foco("18:00", 600)];
    const plan = planPorPasadas(focos, ALTO, 4000);
    expect(plan.ventanas).toEqual([
      { hora: 4, haciaElSur: true, desdeMs: 0, hastaMs: 2000 },
      { hora: 18, haciaElSur: false, desdeMs: 2000, hastaMs: 4000 },
    ]);
    const aparece = plan.focos.map((f) => [f.hora_utc, f.y, f.apareceMs]);
    // De noche (hacia el sur) el de arriba (y = 0) aparece primero; de día, el de abajo.
    expect(aparece).toEqual([
      ["04:00", 0, 0],
      ["04:00", 600, 2000],
      ["18:00", 600, 2000],
      ["18:00", 0, 4000],
    ]);
  });

  it("con la muestra, todos los focos aparecen una vez y dentro de la partida", () => {
    const focos = cargarDia(dia as DiaJuego, { ancho: 800, alto: 600 });
    const plan = planPorPasadas(focos, 600, DURACION_PASADAS_MS);
    expect(plan.focos).toHaveLength(focos.length);
    for (const f of plan.focos) {
      expect(f.apareceMs).toBeGreaterThanOrEqual(0);
      expect(f.apareceMs).toBeLessThanOrEqual(DURACION_PASADAS_MS);
    }
    expect(plan.ventanas.at(-1)!.hastaMs).toBe(DURACION_PASADAS_MS);
  });

  it("una pasada con más focos dura más, para que el ritmo sea parejo", () => {
    const focos = [foco("04:00", 0), ...Array.from({ length: 9 }, () => foco("18:00", 0))];
    const [chica, grande] = planPorPasadas(focos, ALTO, 10_000).ventanas;
    expect(grande!.hastaMs - grande!.desdeMs).toBeGreaterThan(chica!.hastaMs - chica!.desdeMs);
  });
});

describe("tiempos de la partida", () => {
  it("el último foco de las pasadas tiene tiempo de vivir antes de que termine la partida", () => {
    expect(DURACION_PASADAS_MS + potencia(0).escapeMs).toBeLessThan(DURACION_PARTIDA_MS);
  });
});
