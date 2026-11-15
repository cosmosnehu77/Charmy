/**
 * Estadísticas del calendario de quema: salen de las mismas celdas que la tabla, sin otra consulta.
 * Sin React, para probarlas solas.
 */
import type { CeldaCalendario } from "./grilla";

/** Mismos cortes que la comparación en lenguaje simple (grilla.ts). */
const ALTO = 75;
const BAJO = 25;

export interface ResumenCalendario {
  /** Días-celda con fuego sumados en todo el período. */
  total: number;
  mesesConDato: number;
  promedioMensual: number;
  /** El mes con más fuego; null si no hubo fuego. */
  pico: { year: number; month: number; value: number } | null;
  anioMayor: { year: number; total: number } | null;
  mesesSobreLoNormal: number;
  mesesBajoLoNormal: number;
  /** Meses con dato y sin fuego (valor 0). */
  mesesSinFuego: number;
  /** Promedio de cada mes del año (enero a diciembre) sobre los años con dato; null si ese mes no tiene dato. */
  temporada: (number | null)[];
  /** Mes del año (1 a 12) con el promedio más alto; null si no hubo fuego. */
  mesMasActivo: number | null;
}

export function resumenCalendario(celdas: CeldaCalendario[]): ResumenCalendario {
  const total = celdas.reduce((s, c) => s + c.value, 0);

  let pico: ResumenCalendario["pico"] = null;
  const porAnio = new Map<number, number>();
  const sumaMes = Array<number>(12).fill(0);
  const cuentaMes = Array<number>(12).fill(0);
  for (const c of celdas) {
    if (c.value > 0 && (!pico || c.value > pico.value)) pico = { year: c.year, month: c.month, value: c.value };
    porAnio.set(c.year, (porAnio.get(c.year) ?? 0) + c.value);
    sumaMes[c.month - 1]! += c.value;
    cuentaMes[c.month - 1]! += 1;
  }

  let anioMayor: ResumenCalendario["anioMayor"] = null;
  for (const [year, suma] of porAnio) if (suma > 0 && (!anioMayor || suma > anioMayor.total)) anioMayor = { year, total: suma };

  const temporada = sumaMes.map((s, i) => (cuentaMes[i] ? s / cuentaMes[i]! : null));
  let mesMasActivo: number | null = null;
  temporada.forEach((v, i) => {
    if (v !== null && v > 0 && (mesMasActivo === null || v > temporada[mesMasActivo - 1]!)) mesMasActivo = i + 1;
  });

  return {
    total,
    mesesConDato: celdas.length,
    promedioMensual: celdas.length ? total / celdas.length : 0,
    pico,
    anioMayor,
    mesesSobreLoNormal: celdas.filter((c) => c.percentile >= ALTO).length,
    mesesBajoLoNormal: celdas.filter((c) => c.percentile <= BAJO).length,
    mesesSinFuego: celdas.filter((c) => c.value === 0).length,
    temporada,
    mesMasActivo,
  };
}

export interface AnioContraLoNormal {
  anio: number;
  /** Último mes con dato del año (1 a 12): la comparación llega hasta acá. */
  hastaMes: number;
  /** Días-celda con fuego del año hasta `hastaMes`. */
  acumulado: number;
  /** Promedio de los años anteriores hasta el mismo mes. */
  promedio: number;
  desde: number;
  hasta: number;
}

/**
 * El último año contra los anteriores «a esta altura»: suma de enero al último mes con dato, y el promedio de esa
 * misma suma en los años anteriores que tienen datos. null si no hay años anteriores.
 */
export function anioContraLoNormal(celdas: CeldaCalendario[]): AnioContraLoNormal | null {
  if (celdas.length === 0) return null;
  const anio = Math.max(...celdas.map((c) => c.year));
  const hastaMes = Math.max(...celdas.filter((c) => c.year === anio).map((c) => c.month));
  const porAnio = new Map<number, number>();
  for (const c of celdas) if (c.month <= hastaMes) porAnio.set(c.year, (porAnio.get(c.year) ?? 0) + c.value);
  const anteriores = [...porAnio].filter(([y]) => y < anio);
  if (anteriores.length === 0) return null;
  const years = anteriores.map(([y]) => y);
  return {
    anio,
    hastaMes,
    acumulado: porAnio.get(anio) ?? 0,
    promedio: anteriores.reduce((s, [, v]) => s + v, 0) / anteriores.length,
    desde: Math.min(...years),
    hasta: Math.max(...years),
  };
}

export interface TotalAnio {
  year: number;
  /** Días de fuego sumados en el año. */
  total: number;
  /** Meses del año con dato. */
  meses: number;
  /** Meses con percentil 75 o más (sobre lo normal). */
  sobre: number;
  /** Meses con percentil 25 o menos (bajo lo normal). */
  bajo: number;
  sinFuego: number;
}

/** Cada año del período con su total y sus meses fuera de lo normal, del más viejo al más nuevo (F4-R2). */
export function porAnio(celdas: CeldaCalendario[]): TotalAnio[] {
  const anios = new Map<number, TotalAnio>();
  for (const c of celdas) {
    const a = anios.get(c.year) ?? { year: c.year, total: 0, meses: 0, sobre: 0, bajo: 0, sinFuego: 0 };
    a.total += c.value;
    a.meses += 1;
    if (c.percentile >= ALTO) a.sobre += 1;
    if (c.percentile <= BAJO) a.bajo += 1;
    if (c.value === 0) a.sinFuego += 1;
    anios.set(c.year, a);
  }
  return [...anios.values()].sort((a, b) => a.year - b.year);
}

/** Cuántos meses salen de cada origen (MODIS convertido, VIIRS medido…), del más usado al menos usado (F4-R2). */
export function porOrigen(celdas: CeldaCalendario[]): { origin: string; meses: number }[] {
  const cuenta = new Map<string, number>();
  for (const c of celdas) cuenta.set(c.origin, (cuenta.get(c.origin) ?? 0) + 1);
  return [...cuenta].map(([origin, meses]) => ({ origin, meses })).sort((a, b) => b.meses - a.meses);
}
