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
    temporada,
    mesMasActivo,
  };
}
