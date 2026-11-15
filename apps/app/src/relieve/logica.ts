/**
 * Lógica pura de la vista Relieve (F4-R1): qué valor muestra cada región, su color y altura, el ranking,
 * el nivel de la ficha y el tamaño de los focos en vivo. Sin React ni MapLibre, para poder probarla.
 */
import type { components } from "@charmy/contracts-api";
import { rampaAnomalia, rampaConteo, relieve } from "@charmy/ui";

export type Resumen = components["schemas"]["RegionsSummary"];
export type RegionResumen = Resumen["features"][number];
export type PropsRegion = RegionResumen["properties"];

export type Indicador = "focos" | "frp" | "anomalia" | "riesgo" | "prediccion";

export const INDICADORES: { id: Indicador; nombre: string; unidad: string; ayuda: string; disponible: boolean }[] = [
  { id: "focos", nombre: "Focos", unidad: "focos", ayuda: "Focos de calor de los últimos días.", disponible: true },
  {
    id: "frp",
    nombre: "Intensidad",
    unidad: "MW",
    ayuda: "Potencia del fuego sumada (FRP).",
    disponible: true,
  },
  {
    id: "anomalia",
    nombre: "Anomalía",
    unidad: "percentil",
    ayuda: "Último mes contra su historia; 50 es lo típico.",
    disponible: true,
  },
  {
    id: "riesgo",
    nombre: "Riesgo",
    unidad: "",
    ayuda: "El riesgo de incendio por región todavía no está disponible.",
    disponible: false,
  },
  {
    id: "prediccion",
    nombre: "Predicción",
    unidad: "",
    ayuda: "La predicción por región todavía no está disponible.",
    disponible: false,
  },
];

export function valorIndicador(p: PropsRegion, indicador: Indicador): number | null {
  if (indicador === "focos") return p.hotspots ?? null;
  if (indicador === "frp") return p.frp_mw ?? null;
  if (indicador === "anomalia") return p.last_month?.percentile ?? null;
  return null;
}

export function maximo(regiones: RegionResumen[], indicador: Indicador): number {
  let max = 0;
  for (const r of regiones) max = Math.max(max, valorIndicador(r.properties, indicador) ?? 0);
  return max;
}

/** Color y altura (0 a 1) de una región. Los conteos usan la raíz, así una región enorme no aplasta a las demás. */
export function escalaRegion(
  valor: number | null,
  max: number,
  indicador: Indicador,
): { color: string; altura: number } {
  if (valor === null || (indicador !== "anomalia" && valor <= 0)) return { color: relieve.sinDato, altura: 0 };
  const t = indicador === "anomalia" ? Math.min(1, Math.max(0, valor / 100)) : Math.sqrt(valor / (max || 1));
  const rampa = indicador === "anomalia" ? rampaAnomalia : rampaConteo;
  return { color: rampa[Math.min(rampa.length - 1, Math.floor(t * rampa.length))] as string, altura: t };
}

export function rankingRegiones(regiones: RegionResumen[], indicador: Indicador, tope: number) {
  const max = maximo(regiones, indicador);
  return regiones
    .map((r) => ({ id: r.id, nombre: r.properties.name, valor: valorIndicador(r.properties, indicador) }))
    .filter((x): x is { id: string; nombre: string; valor: number } => x.valor !== null && x.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, tope)
    .map((x) => ({ ...x, color: escalaRegion(x.valor, max, indicador).color }));
}

export type Tono = "alto" | "medio" | "bajo" | "cero";

/** Estado de la ficha: `posicion` es el lugar de la región en el ranking de focos (-1 si no está). */
export function nivelRegion(focos: number | null, posicion: number): { texto: string; tono: Tono } {
  if (focos === null) return { texto: "Focos no disponibles", tono: "cero" };
  if (focos === 0) return { texto: "Sin focos esta semana", tono: "cero" };
  if (posicion >= 0 && posicion < 3) return { texto: "Entre las de más fuego", tono: "alto" };
  if (focos >= 10) return { texto: "Con fuego activo", tono: "medio" };
  return { texto: "Poca actividad", tono: "bajo" };
}

export function nivelPercentil(p: number): string {
  if (p >= 75) return "bastante por encima de lo normal";
  if (p >= 55) return "un poco por encima de lo normal";
  if (p > 45) return "dentro de lo normal";
  if (p > 25) return "un poco por debajo de lo normal";
  return "bastante por debajo de lo normal";
}

/** Con la línea de tiempo en uso, la región sube según el día: su altura de la semana en el día con más focos. */
export function alturaDelDia(alturaSemana: number, porDia: number[], dia: number): number {
  const max = Math.max(0, ...porDia);
  return max === 0 ? 0 : (alturaSemana * (porDia[dia] ?? 0)) / max;
}

/** Radio en píxeles de un foco en vivo: crece con la raíz de la intensidad. */
export function radioFoco(frp: number | null | undefined): number {
  return 3 + 1.6 * Math.sqrt(Math.max(0, frp ?? 0));
}

/** Cortes de intensidad (MW) entre los colores 2 a 7 de la rampa de conteo. */
export const CORTES_FOCO = [3.06, 12.3, 27.5, 48.9, 76.4] as const;

export function colorFoco(frp: number | null | undefined): string {
  const v = frp ?? 0;
  let clase = 1;
  for (const corte of CORTES_FOCO) if (v >= corte) clase++;
  return rampaConteo[clase] as string;
}

export function nivelFoco(frp: number | null | undefined): "Bajo" | "Fuerte" | "Muy fuerte" {
  const v = frp ?? 0;
  return v >= 30 ? "Muy fuerte" : v >= 10 ? "Fuerte" : "Bajo";
}

export function hace(ahora: Date, cuando: string): string {
  const horas = Math.round((ahora.getTime() - new Date(cuando).getTime()) / 3_600_000);
  return horas < 1 ? "hace menos de 1 h" : `hace ${horas} h`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

/** "13/11" a partir de "2026-11-13". */
export function diaCorto(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

type Anillo = number[][];

function dentroDeAnillo(anillo: Anillo, x: number, y: number): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi = 0, yi = 0] = anillo[i] ?? [];
    const [xj = 0, yj = 0] = anillo[j] ?? [];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function dentroDePoligono(poligono: Anillo[], x: number, y: number): boolean {
  const [exterior, ...huecos] = poligono;
  return !!exterior && dentroDeAnillo(exterior, x, y) && !huecos.some((h) => dentroDeAnillo(h, x, y));
}

/** Código de la región que contiene el punto (lon, lat), o null si cae fuera de todas. */
export function regionDePunto(regiones: RegionResumen[], lon: number, lat: number): string | null {
  for (const r of regiones) {
    const g = r.geometry as { type: string; coordinates: unknown };
    const poligonos = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Anillo[][];
    if (poligonos.some((p) => dentroDePoligono(p, lon, lat))) return r.id;
  }
  return null;
}
