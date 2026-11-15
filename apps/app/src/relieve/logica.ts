/**
 * Lógica pura de la vista Relieve (F4-R1): qué valor muestra cada región, su color y altura, el ranking,
 * el nivel de la ficha y el tamaño de los focos en vivo. Sin React ni MapLibre, para poder probarla.
 */
import type { components } from "@charmy/contracts-api";
import type { StyleSpecification } from "maplibre-gl";
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

export type NivelFoco = "Bajo" | "Fuerte" | "Muy fuerte";

/** Niveles de intensidad de un foco (MW): desde (incluido) y hasta (sin incluir). */
export const NIVELES_FOCO: { nivel: NivelFoco; desde: number; hasta: number | null }[] = [
  { nivel: "Bajo", desde: 0, hasta: 10 },
  { nivel: "Fuerte", desde: 10, hasta: 30 },
  { nivel: "Muy fuerte", desde: 30, hasta: null },
];

export function nivelFoco(frp: number | null | undefined): NivelFoco {
  const v = frp ?? 0;
  return v >= 30 ? "Muy fuerte" : v >= 10 ? "Fuerte" : "Bajo";
}

/** ¿El foco entra en los niveles elegidos en En vivo? Sin ninguno elegido entran todos. */
export function enNiveles(frp: number | null | undefined, niveles: NivelFoco[]): boolean {
  return niveles.length === 0 || niveles.includes(nivelFoco(frp));
}

/** Focos de En vivo que se ven: los de las últimas `horas` (contadas desde el último foco) y de los niveles elegidos. */
export function focosVivoVisibles<T extends { t: number; frp: number | null | undefined }>(
  focos: T[],
  horas: number,
  niveles: NivelFoco[],
): T[] {
  const ultimo = focos.reduce((max, f) => Math.max(max, f.t), 0);
  return focos.filter((f) => f.t >= ultimo - horas * 3_600_000 && enNiveles(f.frp, niveles));
}

/**
 * Agrupado de En vivo (#333): los focos a menos de 50 px en pantalla se juntan en un círculo con la cantidad, desde
 * 3 focos. Hasta el zoom 8 (provincia); desde el 9 (departamento) se ven todos sueltos.
 */
export const AGRUPAR_VIVO = { clusterRadius: 50, clusterMinPoints: 3, clusterMaxZoom: 8 } as const;

/**
 * Agrupado de Experto (#343): igual que En vivo, pero hasta el zoom 12. El área se ve más cerca que el país y un
 * período largo junta muchos focos en el mismo lugar; desde el zoom 13 se ven todos sueltos.
 */
export const AGRUPAR_ZONA = { clusterRadius: 50, clusterMinPoints: 3, clusterMaxZoom: 12 } as const;

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

type Caja = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

/**
 * Dónde va el globo de Charmy guía (arriba a la izquierda del grupo). Al costado del elemento si entra; si al costado
 * tendría que subirse más arriba de la pantalla (la píldora, la lupa), va justo debajo y centrado en el elemento.
 */
export function ubicarGlobo(
  rect: Caja | null,
  { W, H, ancho, alto }: { W: number; H: number; ancho: number; alto: number },
): { x: number; y: number; izquierda: boolean } {
  const margen = 12;
  const sep = 16;
  if (!rect) return { x: (W - ancho) / 2, y: (H - alto) / 2, izquierda: false };
  const ajustar = (x: number, y: number, izquierda: boolean) => ({
    x: Math.min(Math.max(margen, x), W - ancho - margen),
    y: Math.min(Math.max(margen, y), H - alto - margen),
    izquierda,
  });
  const centroY = rect.top + rect.height / 2 - alto / 2;
  if (centroY >= margen) {
    if (rect.right + sep + ancho <= W) return ajustar(rect.right + sep, centroY, false);
    if (rect.left - sep - ancho >= 0) return ajustar(rect.left - sep - ancho, centroY, true);
  }
  const x = rect.left + rect.width / 2 - ancho / 2;
  return ajustar(x, rect.bottom + sep + alto <= H ? rect.bottom + sep : rect.top - alto - sep, false);
}

/**
 * Zoom desde el que aparece cada nombre del mapa base (capas de OpenFreeMap). Con el país entero a la vista solo
 * quedan los países; al acercar aparecen las ciudades grandes, las provincias y después el resto (#236).
 */
const ZOOM_NOMBRES: Record<string, number> = {
  place_city_large: 4.5,
  place_state: 5.5,
  place_city: 6.5,
  place_town: 8,
  place_village: 10,
  place_suburb: 11,
  place_other: 11,
};

export function nombresPorZoom(estilo: StyleSpecification): StyleSpecification {
  return {
    ...estilo,
    layers: estilo.layers.map((c) => {
      const min = ZOOM_NOMBRES[c.id];
      return min === undefined ? c : { ...c, minzoom: Math.max(c.minzoom ?? 0, min) };
    }),
  };
}

export type Tendencia = "sube" | "baja" | "estable";

/** Por debajo de esto, un cambio se dice «estable»: no se exagera el ruido de pocos focos (F4-D6). */
const CAMBIO_MINIMO = 1;
const CAMBIO_RELATIVO = 0.2;

/** La serie diaria del indicador: focos y potencia tienen una por día; la anomalía, no. */
export function serieDelIndicador(p: Pick<PropsRegion, "by_day" | "frp_by_day">, indicador: Indicador): number[] | null {
  if (indicador === "focos") return p.by_day ?? null;
  if (indicador === "frp") return p.frp_by_day ?? null;
  return null;
}

/**
 * Tendencia de los últimos días: el promedio de la segunda mitad contra el de la primera (con días impares, el del
 * medio no cuenta). El día de hoy todavía no terminó y no cuenta. null si quedan menos de dos días.
 */
export function tendencia(serie: number[] | null, dias: string[], hoy: string): Tendencia | null {
  if (!serie) return null;
  const valores = dias.at(-1) === hoy ? serie.slice(0, -1) : serie;
  if (valores.length < 2) return null;
  const mitad = Math.floor(valores.length / 2);
  const promedio = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const antes = promedio(valores.slice(0, mitad));
  const despues = promedio(valores.slice(valores.length - mitad));
  const cambio = despues - antes;
  if (Math.abs(cambio) < CAMBIO_MINIMO || Math.abs(cambio) < CAMBIO_RELATIVO * Math.max(antes, despues)) return "estable";
  return cambio > 0 ? "sube" : "baja";
}
