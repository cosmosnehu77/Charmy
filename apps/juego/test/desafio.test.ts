import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import type { DiaJuego } from "../src/datos";
import { MINIMO_FOCOS, cargarDesafio, fechaDeAyerArgentina, type Pedir } from "../src/desafio";

const MUESTRA = dia as DiaJuego;
const BASE = "https://api.ejemplo.test/api/v1";

// Ninguna prueba llama a la red: si algo usara fetch de verdad, falla.
beforeAll(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Las pruebas no llaman a la red");
  });
});
afterAll(() => vi.unstubAllGlobals());

/** Respuesta grabada de GET /game/day: la forma de dia-juego.json, con otra fecha. */
const GRABADA: DiaJuego = { ...MUESTRA, fecha: "2026-11-13", fuente: "NASA FIRMS, VIIRS NOAA-20 y NOAA-21 (NRT)" };

const responde = (estado: number, cuerpo: unknown): Pedir => async () =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

describe("fecha del desafío", () => {
  it.each([
    ["2026-11-15T02:30:00Z", "2026-11-13"], // 23:30 del 14 en Argentina: ayer es el 13
    ["2026-11-15T03:00:00Z", "2026-11-14"], // medianoche del 15 en Argentina: ayer es el 14
    ["2026-11-15T03:30:00Z", "2026-11-14"],
    ["2026-12-01T01:00:00Z", "2026-11-29"], // 22:00 del 30/11 en Argentina, cambio de mes
    ["2027-01-01T05:00:00Z", "2026-12-31"], // cambio de año
  ])("a las %s UTC, ayer en Argentina es %s", (ahora, esperado) => {
    expect(fechaDeAyerArgentina(new Date(ahora))).toBe(esperado);
  });
});

describe("cargar el desafío del día", () => {
  it("con una respuesta grabada, usa esos focos y esa fecha, y pide la fecha correcta", async () => {
    const pedidas: string[] = [];
    const pedir: Pedir = async (url) => {
      pedidas.push(String(url));
      return responde(200, GRABADA)(url);
    };
    const r = await cargarDesafio("2026-11-13", { base: BASE, pedir, tiempoMs: 1000 });
    expect(pedidas).toEqual([`${BASE}/game/day?date=2026-11-13`]);
    expect(r).toEqual({ dia: GRABADA, aviso: null });
  });

  it("sin URL de la API (hoy, hasta F4-C2), juega la muestra, lo avisa y no pide nada", async () => {
    let pedidos = 0;
    const r = await cargarDesafio("2026-11-13", {
      base: "",
      pedir: async (url) => {
        pedidos++;
        return responde(200, GRABADA)(url);
      },
      tiempoMs: 1000,
    });
    expect(pedidos).toBe(0);
    expect(r.dia).toBe(MUESTRA);
    expect(r.aviso).toMatch(/muestra/);
  });

  it.each([404, 429, 500, 503])("con %s, juega la muestra y lo avisa", async (estado) => {
    const r = await cargarDesafio("2026-11-13", { base: BASE, pedir: responde(estado, { code: "x" }), tiempoMs: 1000 });
    expect(r.dia).toBe(MUESTRA);
    expect(r.aviso).toMatch(/muestra/);
  });

  it("con tiempo agotado, juega la muestra y lo avisa", async () => {
    const colgada: Pedir = (_url, init) =>
      new Promise((_, rechazar) => init?.signal?.addEventListener("abort", () => rechazar(new Error("abortado"))));
    const r = await cargarDesafio("2026-11-13", { base: BASE, pedir: colgada, tiempoMs: 20 });
    expect(r.dia).toBe(MUESTRA);
    expect(r.aviso).toMatch(/muestra/);
  });

  it("si la red falla o la respuesta no tiene la forma esperada, juega la muestra", async () => {
    const rota: Pedir = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect((await cargarDesafio("2026-11-13", { base: BASE, pedir: rota, tiempoMs: 1000 })).dia).toBe(MUESTRA);
    const rara = responde(200, { fecha: "2026-11-13", focos: "no" });
    expect((await cargarDesafio("2026-11-13", { base: BASE, pedir: rara, tiempoMs: 1000 })).dia).toBe(MUESTRA);
  });

  it("con menos focos que el mínimo, juega la muestra y lo avisa", async () => {
    const pocos = { ...GRABADA, focos: GRABADA.focos.slice(0, MINIMO_FOCOS - 1) };
    const r = await cargarDesafio("2026-11-13", { base: BASE, pedir: responde(200, pocos), tiempoMs: 1000 });
    expect(r.dia).toBe(MUESTRA);
    expect(r.aviso).toMatch(/pocos focos/);
  });

  it("con justo el mínimo de focos, juega el día", async () => {
    const justos = { ...GRABADA, focos: GRABADA.focos.slice(0, MINIMO_FOCOS) };
    const r = await cargarDesafio("2026-11-13", { base: BASE, pedir: responde(200, justos), tiempoMs: 1000 });
    expect(r.dia.fecha).toBe("2026-11-13");
    expect(r.aviso).toBeNull();
  });
});
