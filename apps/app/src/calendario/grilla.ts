/**
 * Lógica del calendario de quema (RF-CAL-01, RF-CAL-02, RF-CAL-05). Sin React, para probarla sola.
 */
import type { components } from "@charmy/contracts-api";
import { colorDeRampa, colorSinDato, contraste, interfaz, rampaAnomalia, rampaConteo } from "@charmy/ui";
import { enIngles, localeActual, t } from "@/relieve/idioma";

export type RespuestaCalendario = components["schemas"]["Calendar"];
export type CeldaCalendario = RespuestaCalendario["cells"][number];
export type Vista = "anomalia" | "cantidad";

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MESES_LARGOS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;
const MESES_LARGOS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const MESES: readonly string[] = new Proxy(MESES_ES, {
  get(target, prop) {
    const activo = enIngles() ? MESES_EN : target;
    const val = Reflect.get(activo, prop, activo);
    return typeof val === "function" ? val.bind(activo) : val;
  },
});

export const MESES_LARGOS: readonly string[] = new Proxy(MESES_LARGOS_ES, {
  get(target, prop) {
    const activo = enIngles() ? MESES_LARGOS_EN : target;
    const val = Reflect.get(activo, prop, activo);
    return typeof val === "function" ? val.bind(activo) : val;
  },
});

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

/** Cómo se obtuvo cada valor (esquema.md). Un origen nuevo que no esté acá se muestra tal cual. */
export function textoOrigen(origin: string): string {
  if (origin === "modis_convertido") return t("MODIS convertido", "converted MODIS");
  if (origin === "modis_medido") return t("MODIS medido", "measured MODIS");
  if (origin === "viirs_medido") return t("VIIRS medido", "measured VIIRS");
  if (origin === "viirs_convertido") return t("VIIRS NOAA-20 convertido", "converted NOAA-20 VIIRS");
  return origin;
}

export const formatear = (n: number) => new Intl.NumberFormat(localeActual(), { maximumFractionDigits: 1 }).format(n);
/** Con signo explícito y el signo menos tipográfico: «+18», «−3», «0». */
const conSigno = (n: number) => (n > 0 ? `+${formatear(n)}` : n < 0 ? `−${formatear(-n)}` : "0");

/** Texto completo de una celda, para lectores de pantalla y para el tooltip. */
export function describirCelda(celda: CeldaCalendario | null, year: number, mes: number): string {
  const cuando = t(`${MESES_LARGOS[mes]} de ${year}`, `${MESES_LARGOS[mes]} ${year}`);
  if (!celda) return t(`${cuando}: sin dato`, `${cuando}: no data`);
  const origen = textoOrigen(celda.origin);
  return t(
    `${cuando}: ${formatear(celda.value)} días de fuego, anomalía ${conSigno(celda.anomaly)}, percentil ${Math.round(celda.percentile)} (mediana ${formatear(celda.median)}), ${origen}`,
    `${cuando}: ${formatear(celda.value)} fire days, anomaly ${conSigno(celda.anomaly)}, percentile ${Math.round(celda.percentile)} (median ${formatear(celda.median)}), ${origen}`,
  );
}
