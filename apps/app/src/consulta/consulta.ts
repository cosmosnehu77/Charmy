/**
 * Lógica de la consulta de focos: área, fechas y filtros (RF-MAP-02, RF-MAP-04, RF-MAP-05).
 * Sin React ni MapLibre, para probarla sola.
 */
import type { components } from "@charmy/contracts-api";
import turfBbox from "@turf/bbox";
import turfCircle from "@turf/circle";

export type Poligono = components["schemas"]["GeoJSONPolygon"];
export type ColeccionFocos = components["schemas"]["HotspotCollection"];
/** oeste, sur, este, norte (mismo orden que FIRMS y que el parámetro bbox). */
export type Bbox = [number, number, number, number];
export type Fuente = "harmonized" | "modis" | "viirs";
export type Confianza = "low" | "nominal" | "high";
export type Momento = "todos" | "D" | "N";

/** Primer mes con datos de MODIS en el archivo de FIRMS. */
export const INICIO_DATOS = "2000-11-01";

const numero = (texto: string) => {
  const limpio = texto.trim().replace(",", ".");
  return limpio === "" ? Number.NaN : Number(limpio);
};

/** Devuelve el mensaje de error, o null si el punto es válido. Acepta coma decimal. */
export function validarPunto(lat: string, lon: string): string | null {
  const la = numero(lat);
  const lo = numero(lon);
  if (!Number.isFinite(la) || la < -90 || la > 90) return "La latitud tiene que ser un número entre -90 y 90.";
  if (!Number.isFinite(lo) || lo < -180 || lo > 180) return "La longitud tiene que ser un número entre -180 y 180.";
  return null;
}

export function leerPunto(lat: string, lon: string): [number, number] {
  return [numero(lat), numero(lon)];
}

/** Círculo de `radioKm` alrededor del punto, como polígono GeoJSON. */
export function areaDesdePunto(lat: number, lon: number, radioKm: number): Poligono {
  const circulo = turfCircle([lon, lat], radioKm, { steps: 48, units: "kilometers" });
  return { type: "Polygon", coordinates: circulo.geometry.coordinates };
}

export function bboxDeArea(area: Poligono): Bbox {
  const [oeste, sur, este, norte] = turfBbox(area);
  return [oeste, sur, este, norte];
}

/** Devuelve el mensaje de error, o null si el rango es válido. `hoy` se inyecta (AAAA-MM-DD). */
export function validarFechas(desde: string, hasta: string, hoy: string): string | null {
  if (!desde || !hasta) return "Elegí una fecha de inicio y una de fin.";
  if (desde > hasta) return "La fecha «desde» tiene que ser anterior o igual a «hasta».";
  if (hasta > hoy) return "No hay datos de fechas futuras: elegí hasta hoy como máximo.";
  if (desde < INICIO_DATOS) return "Los datos empiezan en noviembre de 2000.";
  return null;
}

export interface ParametrosFocos {
  bbox: Bbox;
  desde: string;
  hasta: string;
  fuente: Fuente;
  confianzaMin: Confianza;
}

const redondear = (n: number) => String(Math.round(n * 1e4) / 1e4);

/** Ruta de GET /hotspots con los parámetros del contrato. */
export function rutaFocos(p: ParametrosFocos): string {
  const q = new URLSearchParams({
    bbox: p.bbox.map(redondear).join(","),
    from: p.desde,
    to: p.hasta,
    source: p.fuente,
    min_confidence: p.confianzaMin,
  });
  return `/hotspots?${q.toString()}`;
}

/** Ruta de la descarga en CSV: los mismos parámetros que el mapa, con format=csv (RF-EXP-01). */
export function rutaCsv(p: ParametrosFocos): string {
  return `${rutaFocos(p)}&format=csv`;
}

export interface FiltrosLocales {
  /** Potencia radiativa mínima, en MW. */
  frpMin: number;
  momento: Momento;
}

/**
 * Intensidad y momento del día se filtran en el navegador: el contrato v0 de /hotspots no los recibe.
 * Así cambiar estos filtros no hace otra consulta.
 */
export function filtrarFocos(coleccion: ColeccionFocos, f: FiltrosLocales): ColeccionFocos {
  return {
    ...coleccion,
    features: coleccion.features.filter(
      (foco) =>
        // Un foco sin FRP (null) se muestra salvo que se pida una potencia mínima.
        (foco.properties.frp ?? 0) >= f.frpMin &&
        (f.momento === "todos" || foco.properties.daynight === f.momento),
    ),
  };
}

const SERIES: Record<Fuente, string> = { harmonized: "Armonizada", modis: "MODIS", viirs: "VIIRS" };
const CONFIANZAS: Record<Confianza, string> = {
  low: "cualquier confianza",
  nominal: "confianza nominal o más",
  high: "confianza alta",
};

/** Una línea con los filtros elegidos, para el paso Filtros plegado (F4-D8). Potencia y momento, solo si filtran. */
export function resumenFiltros(f: { fuente: Fuente; confianzaMin: Confianza; frpMin: number; momento: Momento }): string {
  const partes = [SERIES[f.fuente], CONFIANZAS[f.confianzaMin]];
  if (f.frpMin > 0) partes.push(`${f.frpMin} MW o más`);
  if (f.momento !== "todos") partes.push(f.momento === "D" ? "de día" : "de noche");
  return partes.join(" · ");
}
