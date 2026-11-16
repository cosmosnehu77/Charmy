/**
 * Lógica pura de la vista Relieve (F4-R1): qué valor muestra cada región, su color y altura, el ranking,
 * el nivel de la ficha y el tamaño de los focos en vivo. Sin React ni MapLibre, para poder probarla.
 */
import type { components } from "@charmy/contracts-api";
import type { StyleSpecification } from "maplibre-gl";
import { rampaAnomalia, rampaConteo, relieve } from "@charmy/ui";
import type { Pestana } from "./estado";
import { enIngles, localeActual, t } from "./idioma";

export type Resumen = components["schemas"]["RegionsSummary"];
export type PrediccionRegiones = components["schemas"]["RegionsForecast"];
export type MesPrediccion = components["schemas"]["ForecastMonth"];
type FeatureResumen = Resumen["features"][number];
/** Las propiedades de /regions/summary, más los meses de /regions/forecast cuando llegan (F4-D12). */
export type PropsRegion = FeatureResumen["properties"] & { prediccion?: MesPrediccion[] };
export type RegionResumen = Omit<FeatureResumen, "properties"> & { properties: PropsRegion };

export type Indicador = "focos" | "frp" | "anomalia" | "prediccion";

export const INDICADORES: { id: Indicador; nombre: string; unidad: string; ayuda: string; disponible: boolean }[] = [
  {
    id: "focos",
    get nombre() {
      return t("Focos", "Hotspots");
    },
    get unidad() {
      return t("días de fuego", "fire days");
    },
    get ayuda() {
      return t(
        "Fuego del último mes cerrado, en días de fuego: el mapa se divide en cuadrados de unos 11 km y cada cuadrado con fuego suma uno por día.",
        "Fire in the last full month, in fire days: the map is split into squares of about 11 km and each square with fire adds one per day.",
      );
    },
    disponible: true,
  },
  {
    id: "frp",
    get nombre() {
      return t("Intensidad", "Intensity");
    },
    unidad: "MW",
    get ayuda() {
      return t("Potencia del fuego sumada (FRP).", "Total fire radiative power (FRP).");
    },
    disponible: true,
  },
  {
    id: "anomalia",
    get nombre() {
      return t("Anomalía", "Anomaly");
    },
    get unidad() {
      return t("percentil", "percentile");
    },
    get ayuda() {
      return t("Último mes contra su historia; 50 es lo típico.", "Last month vs. history; 50 is typical.");
    },
    disponible: true,
  },
  {
    id: "prediccion",
    get nombre() {
      return t("Predicción", "Forecast");
    },
    get unidad() {
      return t("cuadrados", "squares");
    },
    get ayuda() {
      return t(
        "Cuadrados de unos 11 km con fuego que el modelo espera el mes que viene. Es una estimación.",
        "Squares of about 11 km with fire expected by the model next month. This is an estimate.",
      );
    },
    disponible: true,
  },
];

export function valorIndicador(p: PropsRegion, indicador: Indicador): number | null {
  // El último mes cerrado, como la ficha (#373): los focos de los últimos días están en En vivo.
  if (indicador === "focos") return p.last_month?.value ?? null;
  if (indicador === "frp") return p.frp_mw ?? null;
  if (indicador === "anomalia") return p.last_month?.percentile ?? null;
  if (indicador === "prediccion") return p.prediccion?.find((m) => m.horizon === 1)?.expected_cells ?? null;
  return null;
}

/** Suma a cada región sus meses de /regions/forecast. Sin predicción, las regiones quedan como estaban. */
export function conPrediccion(regiones: RegionResumen[], prediccion: PrediccionRegiones | undefined): RegionResumen[] {
  if (!prediccion?.regions) return regiones;
  const porRegion = new Map(prediccion.regions.map((r) => [r.region, r.months]));
  return regiones.map((r) => {
    const meses = porRegion.get(r.id);
    return meses ? { ...r, properties: { ...r.properties, prediccion: meses } } : r;
  });
}

const decimal = (v: number) => v.toLocaleString(localeActual(), { maximumFractionDigits: 1 });

/** Una frase corta: cuántas celdas con fuego se esperan contra las habituales (±15 % cuenta como lo mismo). */
export function textoPrediccion(m: MesPrediccion): string {
  if (enIngles()) {
    const esperadas = `${decimal(m.expected_cells)} ${m.expected_cells === 1 ? "square" : "squares"} with fire expected`;
    const habituales = `the usual ${decimal(m.usual_cells)}`;
    if (Math.abs(m.expected_cells - m.usual_cells) <= 0.15 * m.usual_cells) return `${esperadas}, similar to ${habituales}.`;
    return `${esperadas}, ${m.expected_cells > m.usual_cells ? "more" : "fewer"} than ${habituales}.`;
  }
  const esperadas = `Se esperan ${decimal(m.expected_cells)} ${m.expected_cells === 1 ? "cuadrado" : "cuadrados"} con fuego`;
  const habituales = `los ${decimal(m.usual_cells)} habituales`;
  if (Math.abs(m.expected_cells - m.usual_cells) <= 0.15 * m.usual_cells) return `${esperadas}, como ${habituales}.`;
  return `${esperadas}, ${m.expected_cells > m.usual_cells ? "más" : "menos"} que ${habituales}.`;
}

/** En un área chica, la probabilidad de al menos un evento contra la habitual (±15 % cuenta como lo mismo). */
export function textoProbabilidad(m: MesPrediccion): string {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  if (enIngles()) {
    const inicio = `Fire probability: ${pct(m.probability)}`;
    const habitual = `the usual ${pct(m.usual_probability)}`;
    if (Math.abs(m.probability - m.usual_probability) <= 0.15 * m.usual_probability) return `${inicio}, similar to ${habitual}.`;
    return `${inicio}, ${m.probability > m.usual_probability ? "higher" : "lower"} than ${habitual}.`;
  }
  const inicio = `Probabilidad de fuego: ${pct(m.probability)}`;
  const habitual = `el ${pct(m.usual_probability)} habitual`;
  if (Math.abs(m.probability - m.usual_probability) <= 0.15 * m.usual_probability) return `${inicio}, como ${habitual}.`;
  return `${inicio}, ${m.probability > m.usual_probability ? "más" : "menos"} que ${habitual}.`;
}

/** Los plazos 1 y 2 son pronóstico; del 3 al 6 la compuerta no pasó todos los años (D-40). */
export function plazoPrediccion(m: MesPrediccion): string {
  return m.kind === "forecast" ? t("Pronóstico", "Forecast") : t("Lo habitual, ajustado", "Usual, adjusted");
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
  props?: PropsRegion,
): { color: string; altura: number } {
  if (valor === null || (indicador !== "anomalia" && valor <= 0)) return { color: relieve.sinDato, altura: 0 };
  const t = indicador === "anomalia" ? Math.min(1, Math.max(0, valor / 100)) : Math.sqrt(valor / (max || 1));
  // Predicción (F4-D15): la altura son las celdas esperadas; el color, cuánto se aleja de lo habitual.
  if (indicador === "prediccion" && props) return { color: colorPrediccion(mesSiguiente(props)), altura: t };
  const rampa = indicador === "anomalia" ? rampaAnomalia : rampaConteo;
  return { color: rampa[Math.min(rampa.length - 1, Math.floor(t * rampa.length))] as string, altura: t };
}

/** El mes que viene de la predicción de una región (plazo 1), si llegó. */
export function mesSiguiente(p: PropsRegion): MesPrediccion | undefined {
  return p.prediccion?.find((m) => m.horizon === 1);
}

export type Sentido = "mas" | "menos" | "igual";

/** Lo esperado contra lo habitual: cuántas veces y hacia dónde (±15 % cuenta como lo mismo). */
export function comparacionPrediccion(m: MesPrediccion): { sentido: Sentido; veces: number | null } {
  const veces = m.usual_cells > 0 ? m.expected_cells / m.usual_cells : null;
  if (veces === null) return { sentido: m.expected_cells > 0 ? "mas" : "igual", veces };
  return { sentido: veces > 1.15 ? "mas" : veces < 0.85 ? "menos" : "igual", veces };
}

/**
 * Color de la predicción en la rampa divergente (apta para daltonismo): violeta intenso si se espera mucho menos
 * que lo habitual, claro si es lo mismo, naranja intenso si se espera mucho más. Cada paso es un factor de √2:
 * la mitad o el doble quedan a dos pasos del centro, un cuarto o cuatro veces en la punta.
 */
export function colorPrediccion(m: MesPrediccion | undefined): string {
  if (!m || (m.expected_cells <= 0 && m.usual_cells <= 0)) return relieve.sinDato;
  const centro = (rampaAnomalia.length - 1) / 2;
  if (m.usual_cells <= 0) return rampaAnomalia[rampaAnomalia.length - 1] as string;
  if (m.expected_cells <= 0) return rampaAnomalia[0] as string;
  const pasos = Math.log2(m.expected_cells / m.usual_cells) * 2;
  const i = Math.round(centro + Math.max(-centro, Math.min(centro, pasos)));
  return rampaAnomalia[i] as string;
}

function cuantoMas(veces: number | null, sentido: Sentido): string {
  const pct = (v: number) => `${Math.round(Math.abs(v - 1) * 100)} %`;
  if (veces === null) return t("Se espera fuego donde normalmente casi no hay", "Fire is expected where there is usually almost none");
  if (sentido === "mas") {
    if (veces >= 1.9 && veces < 2.1) return t("Se espera el doble de lo habitual", "About twice the usual is expected");
    if (veces >= 2.1) return t(`Se espera ${decimal(veces)} veces lo habitual`, `${decimal(veces)} times the usual is expected`);
    return t(`Se espera un ${pct(veces)} más que lo habitual`, `${pct(veces)} more than usual is expected`);
  }
  if (veces > 0.45 && veces <= 0.55) return t("Se espera la mitad de lo habitual", "About half the usual is expected");
  return t(`Se espera un ${pct(veces)} menos que lo habitual`, `${pct(veces)} less than usual is expected`);
}

/**
 * Por qué se espera más o menos fuego en una región. El modelo mira el fuego de los últimos tres meses, el del
 * mismo mes del año pasado y lo habitual de cada mes (D-40); de eso la ficha tiene a mano el último mes y su
 * percentil, así que lo nombra cuando va en el mismo sentido que la predicción.
 */
export function porQuePrediccion(
  m: MesPrediccion,
  ultimo: { month: number; percentile?: number | null } | null | undefined,
): string {
  const { sentido, veces } = comparacionPrediccion(m);
  const p = ultimo?.percentile ?? null;
  if (sentido === "igual") {
    return t(
      "Se espera algo parecido a lo habitual: el fuego de los últimos meses no se aleja de lo normal para la época.",
      "Something close to the usual is expected: fire in recent months is not far from normal for the season.",
    );
  }
  const inicio = cuantoMas(veces, sentido);
  const mismoSentido = p !== null && (sentido === "mas" ? p >= 55 : p <= 45);
  if (ultimo && mismoSentido) {
    const mes = nombreMes(ultimo.month);
    const Mes = mes.charAt(0).toUpperCase() + mes.slice(1);
    return sentido === "mas"
      ? t(
          `${inicio}. ${Mes} vino con más fuego que lo normal acá, y el modelo lo arrastra a los meses que vienen.`,
          `${inicio}. ${Mes} had more fire than normal here, and the model carries that into the coming months.`,
        )
      : t(
          `${inicio}. ${Mes} vino con menos fuego que lo normal acá, y el modelo lo arrastra a los meses que vienen.`,
          `${inicio}. ${Mes} had less fire than normal here, and the model carries that into the coming months.`,
        );
  }
  return t(
    `${inicio}, por el fuego de los últimos meses y del mismo mes del año pasado.`,
    `${inicio}, because of fire in recent months and in the same month last year.`,
  );
}

export function rankingRegiones(regiones: RegionResumen[], indicador: Indicador, tope: number) {
  const max = maximo(regiones, indicador);
  return regiones
    .map((r) => ({ id: r.id, nombre: r.properties.name, valor: valorIndicador(r.properties, indicador) }))
    .filter((x): x is { id: string; nombre: string; valor: number } => x.valor !== null && x.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, tope)
    .map((x) => ({
      ...x,
      color: escalaRegion(x.valor, max, indicador, regiones.find((r) => r.id === x.id)?.properties).color,
    }));
}

export type Tono = "alto" | "medio" | "bajo" | "cero";

/** Estado de la ficha: `posicion` es el lugar de la región en el ranking de focos (-1 si no está). */
export function nivelRegion(focos: number | null, posicion: number): { texto: string; tono: Tono } {
  if (focos === null) return { texto: t("Focos no disponibles", "Hotspots unavailable"), tono: "cero" };
  if (focos === 0) return { texto: t("Sin fuego ese mes", "No fire that month"), tono: "cero" };
  if (posicion >= 0 && posicion < 3) return { texto: t("Entre las de más fuego", "Among the highest fire activity"), tono: "alto" };
  if (focos >= 10) return { texto: t("Con fuego activo", "Active fire"), tono: "medio" };
  return { texto: t("Poca actividad", "Low activity"), tono: "bajo" };
}

export function nivelPercentil(p: number): string {
  if (p >= 75) return t("bastante por encima de lo normal", "well above normal");
  if (p >= 55) return t("un poco por encima de lo normal", "slightly above normal");
  if (p > 45) return t("dentro de lo normal", "within normal range");
  if (p > 25) return t("un poco por debajo de lo normal", "slightly below normal");
  return t("bastante por debajo de lo normal", "well below normal");
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

export function etiquetaNivelFoco(nivel: NivelFoco): string {
  if (nivel === "Muy fuerte") return t("Muy fuerte", "Very strong");
  if (nivel === "Fuerte") return t("Fuerte", "Strong");
  return t("Bajo", "Low");
}

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

/** En vivo en 3D (#373): cuántos de los focos que se ven caen en cada región. */
export function focosPorRegion<T extends { region: string | null; t: number; frp: number | null | undefined }>(
  focos: T[],
  horas: number,
  niveles: NivelFoco[],
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const f of focosVivoVisibles(focos, horas, niveles)) {
    if (f.region) conteo.set(f.region, (conteo.get(f.region) ?? 0) + 1);
  }
  return conteo;
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

/** Desde cuántos focos un grupo late, para que se vean primero los incendios grandes. */
export const GRUPO_LATE = 100;

/** Aspecto de un grupo de focos: crece con la cantidad y toma el color de su foco más intenso. */
export function estiloGrupo(cantidad: number, frpMax: number | null | undefined) {
  const diametro = cantidad >= 200 ? 54 : cantidad >= 50 ? 44 : cantidad >= 10 ? 36 : 30;
  return { diametro, color: colorFoco(frpMax), late: cantidad >= GRUPO_LATE, texto: cantidad.toLocaleString(localeActual()) };
}

export function hace(ahora: Date, cuando: string): string {
  const horas = Math.round((ahora.getTime() - new Date(cuando).getTime()) / 3_600_000);
  return horas < 1 ? t("hace menos de 1 h", "less than 1 h ago") : t(`hace ${horas} h`, `${horas} h ago`);
}

const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function nombreMes(mes: number): string {
  return (enIngles() ? MESES_EN : MESES_ES)[mes - 1] ?? "";
}

/** Primer año de la serie armonizada (MODIS desde 11/2000; ver `docs/metodologia/`). */
const PRIMER_ANIO = 2001;

/**
 * Qué es «lo normal» en la ficha (#381): el valor del mes contra la mediana de ese mes en los años anteriores, la
 * misma que usa el pipeline para el percentil.
 */
export function textoLoNormal(u: { year: number; month: number; value: number; median: number | null }): string | null {
  if (u.median === null) return null;
  const mes = nombreMes(u.month);
  return t(
    `En ${mes} de ${u.year} hubo ${decimal(u.value)} días de fuego. Lo normal acá en ${mes} es ${decimal(u.median)}: la mediana de los ${mes}s de ${PRIMER_ANIO} a ${u.year - 1}.`,
    `In ${mes} ${u.year} there were ${decimal(u.value)} fire days. Normal here in ${mes} is ${decimal(u.median)}: the median of every ${mes} from ${PRIMER_ANIO} to ${u.year - 1}.`,
  );
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

/** La serie diaria del indicador: la potencia tiene una por día; focos (un mes) y la anomalía, no. */
export function serieDelIndicador(p: Pick<PropsRegion, "by_day" | "frp_by_day">, indicador: Indicador): number[] | null {
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

/**
 * Capa de regiones usada para interacción en el mapa: en 2D va plana (`reg-2d`) debajo de las divisiones;
 * en 3D se extruye (`reg-3d`).
 */
export function capaRegiones(plano: boolean): "reg-2d" | "reg-3d" {
  return plano ? "reg-2d" : "reg-3d";
}

/**
 * Visibilidad de las capas de regiones según modo:
 * - `En vivo` y `Tu zona` (`apagado`): fondo gris (`vivo-gris`) y divisiones en 2D.
 * - Indicadores en 2D (`plano`): relleno plano (`reg-2d`) y divisiones por encima.
 * - Indicadores en 3D: extrusión (`reg-3d`), sin líneas planas debajo que se transparenten.
 */
export function capasRegionesVisibles(plano: boolean, apagado: boolean) {
  const en2d = plano || apagado;
  return {
    vivoGris: apagado,
    reg2d: !apagado && plano,
    regBorde: en2d,
    reg3d: !apagado && !plano,
  };
}

/**
 * Si el mapa va plano (sin inclinación). Todas las pestañas siguen el botón 2D/3D; en Experto, además, el mapa
 * se aplana mientras hay una herramienta de dibujo elegida, para trazar el área sin perspectiva.
 */
export function mapaPlano(pestana: Pestana, plano: boolean, dibujando: string | null): boolean {
  return plano || (pestana === "zona" && dibujando !== null);
}

/** Los 30 días que muestra «El último mes»: hasta ayer, que es el último día completo del histórico. */
export function periodoUltimoMes(hoy: string): { desde: string; hasta: string } {
  const dia = (n: number) => new Date(Date.parse(`${hoy}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  return { desde: dia(30), hasta: dia(1) };
}

type Geometria = { type: string; coordinates: unknown };

function poligonosDe(g: Geometria): Anillo[][] {
  return (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Anillo[][];
}

/** Caja oeste, sur, este, norte del contorno de una región, para pedirle a /hotspots solo esa zona. */
export function cajaDeRegion(g: Geometria): [number, number, number, number] {
  let [o, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of poligonosDe(g))
    for (const [x = 0, y = 0] of p[0] ?? []) {
      o = Math.min(o, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return [o, s, e, n];
}

/** Focos por día UTC de `dias` días desde `desde`, contando solo los que caen dentro del contorno de la región. */
export function serieUltimoMes(
  focos: { geometry: { coordinates: number[] }; properties: { acq_datetime: string } }[],
  g: Geometria,
  desde: string,
  dias: number,
): { dia: string; focos: number }[] {
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const serie = Array.from({ length: dias }, (_, i) => ({
    dia: new Date(inicio + i * 86_400_000).toISOString().slice(0, 10),
    focos: 0,
  }));
  const poligonos = poligonosDe(g);
  for (const f of focos) {
    const i = Math.floor((Date.parse(f.properties.acq_datetime) - inicio) / 86_400_000);
    const [lon = 0, lat = 0] = f.geometry.coordinates;
    const d = serie[i];
    if (d && poligonos.some((p) => dentroDePoligono(p, lon, lat))) d.focos++;
  }
  return serie;
}

/**
 * Opacidad de las provincias (`reg-2d`, `reg-3d`) y del gris de En vivo. Con una provincia elegida van opacas para
 * que las rutas del mapa base no se mezclen (#251); con la imagen satelital (#396), transparentes para ver el terreno.
 */
export function opacidadRegiones(seleccion: boolean, satelital: boolean): { regiones: number; gris: number } {
  if (satelital) return { regiones: seleccion ? 0.7 : 0.45, gris: 0.15 };
  return { regiones: seleccion ? 1 : 0.92, gris: 0.55 };
}

/** Franjas fijas del celular, en px (#413): arriba la píldora con tema e idioma; abajo el aviso de emergencias. */
export const TECHO_CELULAR = { chico: 104, mediano: 122 } as const;
export const PIE_CELULAR = 72;
/** Alto máximo de las hojas del celular: la ficha, Experto y las fichas de foco. */
export const HOJA_CELULAR = 0.52;
const MAPA_MINIMO = 120;

/**
 * Márgenes de la cámara al encuadrar el país, una provincia o el área de Experto. En celular la provincia queda
 * en el pedazo de mapa libre: entre la franja de arriba, la hoja abierta y el aviso, a la izquierda de los controles.
 * El panel de En vivo y Experto sin área no cuentan: encuadrar el país arriba de la hoja lo achicaba hasta mostrar
 * medio mundo; así la hoja tapa solo el sur.
 */
export function margenesCamara(c: {
  ancho: number;
  alto: number;
  region: boolean;
  zona: boolean;
  area: boolean;
}): { top: number; bottom: number; left: number; right: number } {
  if (c.ancho >= 768) {
    // En Tu zona el panel ocupa la izquierda y, con un área, el calendario la parte de abajo.
    return c.zona
      ? { top: 90, bottom: c.area ? Math.round(c.alto * 0.46) + 30 : 60, left: 380, right: 90 }
      : { top: 90, bottom: 80, left: c.region ? 60 : 300, right: c.region ? 460 : 80 };
  }
  const top = c.ancho <= 480 ? TECHO_CELULAR.chico : TECHO_CELULAR.mediano;
  const hoja = c.region || (c.zona && c.area) ? HOJA_CELULAR : 0;
  const bottom = Math.max(PIE_CELULAR, Math.min(PIE_CELULAR + Math.round(c.alto * hoja) + 16, c.alto - MAPA_MINIMO - top));
  return { top, bottom, left: 16, right: 56 };
}
