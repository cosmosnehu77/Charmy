import { describe, expect, it } from "vitest";
import { crearAzar } from "../src/azar";
import { crearGrilla, type Celda } from "../src/grilla";
import { TOPE_ENCENDIDAS, pesosDeVecinos, propagar, type Viento } from "../src/propagacion";

const grilla = crearGrilla({ ancho: 800, alto: 600 }, 20);
const centro: Celda = { col: 20, fila: 15 };
const DEL_OESTE: Viento = { desdeGrados: 270, velocidadMs: 10 };

/** Cuenta hacia qué lado caen las celdas nuevas en muchas propagaciones desde el centro. */
function lados(viento: Viento | null, veces = 400) {
  const azar = crearAzar("2026-11-12");
  let este = 0;
  let oeste = 0;
  let total = 0;
  for (let i = 0; i < veces; i++) {
    for (const c of propagar(grilla, centro, [], azar, viento)) {
      total++;
      if (c.col > centro.col) este++;
      if (c.col < centro.col) oeste++;
    }
  }
  return { este, oeste, total };
}

describe("propagación de un foco que se escapa", () => {
  it("es determinista: misma semilla y mismo estado, mismo resultado", () => {
    const una = propagar(grilla, centro, [], crearAzar("2026-11-12"), DEL_OESTE);
    const otra = propagar(grilla, centro, [], crearAzar("2026-11-12"), DEL_OESTE);
    expect(una).toEqual(otra);
    expect(una.length).toBeGreaterThan(0);
  });

  it("enciende celdas vecinas libres, sin repetir", () => {
    const ocupadas = [{ col: 21, fila: 15 }];
    for (let i = 0; i < 50; i++) {
      const nuevas = propagar(grilla, centro, ocupadas, crearAzar(`s${i}`), null);
      for (const c of nuevas) {
        expect(Math.abs(c.col - centro.col)).toBeLessThanOrEqual(1);
        expect(Math.abs(c.fila - centro.fila)).toBeLessThanOrEqual(1);
        expect(c).not.toEqual(centro);
        expect(ocupadas).not.toContainEqual(c);
      }
      expect(new Set(nuevas.map((c) => `${c.col},${c.fila}`)).size).toBe(nuevas.length);
    }
  });

  it("con viento del oeste, la mayoría de las celdas nuevas quedan al este", () => {
    const { este, total } = lados(DEL_OESTE);
    expect(este / total).toBeGreaterThan(0.6);
  });

  it("con viento del sur, la mayoría quedan al norte (arriba en la pantalla)", () => {
    const azar = crearAzar("2026-11-12");
    let norte = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      for (const c of propagar(grilla, centro, [], azar, { desdeGrados: 180, velocidadMs: 10 })) {
        total++;
        if (c.fila < centro.fila) norte++;
      }
    }
    expect(norte / total).toBeGreaterThan(0.6);
  });

  it("sin viento no hay dirección preferida", () => {
    expect(new Set(pesosDeVecinos(grilla, centro, null).map((v) => v.peso))).toEqual(new Set([1]));
    const { este, oeste } = lados(null);
    expect(Math.abs(este - oeste) / (este + oeste)).toBeLessThan(0.15);
  });

  it("un viento calmo casi no sesga", () => {
    const pesos = pesosDeVecinos(grilla, centro, { desdeGrados: 270, velocidadMs: 0 });
    expect(new Set(pesos.map((v) => v.peso))).toEqual(new Set([1]));
  });

  it("nunca se pasa del tope de celdas encendidas", () => {
    const azar = crearAzar("2026-11-12");
    const encendidas: Celda[] = [centro];
    for (let i = 0; i < 200; i++) {
      const origen = encendidas[Math.floor(azar() * encendidas.length)]!;
      encendidas.push(...propagar(grilla, origen, encendidas, azar, DEL_OESTE));
      expect(encendidas.length).toBeLessThanOrEqual(TOPE_ENCENDIDAS);
    }
    expect(encendidas.length).toBe(TOPE_ENCENDIDAS);
    expect(propagar(grilla, centro, encendidas, azar, null)).toEqual([]);
  });
});

describe("cortafuegos", () => {
  it("un cortafuegos frena la propagación hacia su celda", () => {
    const todas = [-1, 0, 1].flatMap((df) => [-1, 0, 1].map((dc) => ({ col: centro.col + dc, fila: centro.fila + df })));
    const cortafuegos = todas.filter((c) => !(c.col === centro.col && c.fila === centro.fila));
    expect(propagar(grilla, centro, [], crearAzar("x"), DEL_OESTE, cortafuegos)).toEqual([]);
    const algunos = cortafuegos.slice(0, 7);
    for (let i = 0; i < 20; i++) {
      for (const c of propagar(grilla, centro, [], crearAzar(`s${i}`), null, algunos)) {
        expect(algunos).not.toContainEqual(c);
      }
    }
  });

  it("los cortafuegos no cuentan para el tope de encendidas", () => {
    const lejos = Array.from({ length: TOPE_ENCENDIDAS }, (_, i) => ({ col: i, fila: 0 }));
    expect(propagar(grilla, centro, [], crearAzar("x"), null, lejos).length).toBeGreaterThan(0);
  });
});
