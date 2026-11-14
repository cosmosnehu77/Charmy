/**
 * Lógica del calendario de quema (RF-CAL-01, RF-CAL-02, RF-CAL-05). Sin React, para probarla sola.
 */
import type { components } from "@charmy/contracts-api";
import { colorDeRampa, colorSinDato, contraste, interfaz, rampaAnomalia, rampaConteo } from "@charmy/ui";

export type RespuestaCalendario = components["schemas"]["Calendar"];
export type CeldaCalendario = RespuestaCalendario["cells"][number];
export type Vista = "anomalia" | "cantidad";

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Días-celda con fuego (equivalente VIIRS, D-02): de 0 a más de 50 por mes. */
export const CORTES_CANTIDAD = [1, 2, 5, 10, 20, 50] as const;
/** Percentil contra la mediana histórica del mismo mes: 50 = normal. */
export const CORTES_PERCENTIL = [10, 25, 40, 60, 75, 90] as const;

export interface FilaCalendario {
  year: number;
  meses: (CeldaCalendario | null)[];
}

/** Una fila por año del período, con 12 meses; los que no vienen en la respuesta quedan en null (sin dato). */
export function armarGrilla(celdas: CeldaCalendario[], desdeAnio: number, hastaAnio: number): FilaCalendario[] {
  const porClave = new Map(celdas.map((c) => [`${c.year}-${c.month}`, c]));
  const filas: FilaCalendario[] = [];
  for (let year = desdeAnio; year <= hastaAnio; year++) {
    filas.push({ year, meses: MESES.map((_, i) => porClave.get(`${year}-${i + 1}`) ?? null) });
  }
  return filas;
}

export function colorCelda(celda: CeldaCalendario | null, vista: Vista): string {
  if (!celda) return colorSinDato;
  return vista === "anomalia"
    ? colorDeRampa(celda.percentile, CORTES_PERCENTIL, rampaAnomalia)
    : colorDeRampa(celda.value, CORTES_CANTIDAD, rampaConteo);
}

/** Tinta o blanco, lo que tenga más contraste con el fondo. */
export function colorTexto(fondo: string): string {
  return contraste(interfaz.tinta, fondo) >= contraste(interfaz.superficie, fondo) ? interfaz.tinta : interfaz.superficie;
}

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
export const formatear = (n: number) => numero.format(n);

/** Texto completo de una celda, para lectores de pantalla y para el tooltip. */
export function describirCelda(celda: CeldaCalendario | null, year: number, mes: number): string {
  const cuando = `${MESES_LARGOS[mes]} de ${year}`;
  if (!celda) return `${cuando}: sin dato`;
  const origen = celda.origin === "modis_convertido" ? "MODIS convertido" : "VIIRS medido";
  return `${cuando}: ${formatear(celda.value)} días-celda con fuego, percentil ${Math.round(celda.percentile)} (mediana ${formatear(celda.median)}), ${origen}`;
}
