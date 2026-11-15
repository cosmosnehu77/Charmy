import type { Area } from "./datos";

/** [oeste, sur, este, norte] en grados. */
export type Recuadro = [number, number, number, number];
export type Punto = [number, number];
export type Anillo = Punto[];

/** Lo que se usa de data/muestras/regiones.geojson. */
export interface GeoJson {
  features: {
    geometry: { type: "Polygon"; coordinates: Anillo[] } | { type: "MultiPolygon"; coordinates: Anillo[][] };
  }[];
}

export interface Contorno {
  bbox: Recuadro;
  anillos: Anillo[];
}

/** Cuánto se aleja como mucho el contorno simplificado del original, en grados (unos 5 km, entre 1 y 3 píxeles del lienzo). */
export const TOLERANCIA = 0.05;
/** Las islas más chicas que esto (en grados, unos 15 km) no se ven en el lienzo y se descartan. */
export const LADO_MINIMO = 0.15;

function distanciaASegmento([px, py]: Punto, [ax, ay]: Punto, [bx, by]: Punto): number {
  const dx = bx - ax;
  const dy = by - ay;
  const largo = dx * dx + dy * dy;
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas-Peucker: conserva el primer y el último punto, así el anillo sigue cerrado. */
export function simplificar(anillo: Anillo, tolerancia: number): Anillo {
  if (anillo.length < 3) return anillo;
  const primero = anillo[0]!;
  const ultimo = anillo.at(-1)!;
  let lejos = 0;
  let indice = 0;
  for (let i = 1; i < anillo.length - 1; i++) {
    const d = distanciaASegmento(anillo[i]!, primero, ultimo);
    if (d > lejos) [lejos, indice] = [d, i];
  }
  if (lejos <= tolerancia) return [primero, ultimo];
  return [...simplificar(anillo.slice(0, indice + 1), tolerancia).slice(0, -1), ...simplificar(anillo.slice(indice), tolerancia)];
}

function extension(anillo: Anillo): Recuadro {
  const lons = anillo.map((p) => p[0]);
  const lats = anillo.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function tocaRecuadro(anillo: Anillo, [oeste, sur, este, norte]: Recuadro): boolean {
  const [o, s, e, n] = extension(anillo);
  return e >= oeste && o <= este && n >= sur && s <= norte;
}

function esGrande(anillo: Anillo): boolean {
  const [o, s, e, n] = extension(anillo);
  return Math.max(e - o, n - s) >= LADO_MINIMO;
}

const redondear = ([lon, lat]: Punto): Punto => [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];

/**
 * El contorno de fondo del juego: el borde exterior de cada región que toca el recuadro del día, simplificado y
 * sin las islas chicas.
 * Se calcula una vez con `pnpm contorno` y se guarda en src/fondo.json.
 */
export function contornoDelDia(regiones: GeoJson, bbox: Recuadro, tolerancia = TOLERANCIA): Contorno {
  const anillos = regiones.features
    .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
    .map((poligono) => poligono[0]!)
    .filter((anillo) => tocaRecuadro(anillo, bbox) && esGrande(anillo))
    .map((anillo) => simplificar(anillo, tolerancia).map(redondear))
    .filter((anillo) => anillo.length >= 4);
  return { bbox, anillos };
}

/** De longitud y latitud a coordenadas del área de juego: el recuadro ocupa toda el área, con el norte arriba. */
export function proyectar([lon, lat]: Punto, [oeste, sur, este, norte]: Recuadro, area: Area): { x: number; y: number } {
  return { x: ((lon - oeste) / (este - oeste)) * area.ancho, y: ((norte - lat) / (norte - sur)) * area.alto };
}

export interface Encuadre extends Area {
  /** Corrimiento del mapa dentro del área, para centrarlo. */
  dx: number;
  dy: number;
}

/**
 * El área donde se dibuja el mapa sin estirarlo: un grado de longitud mide cos(latitud) de uno de latitud, así que
 * el recuadro se ajusta al área con esa proporción y se centra en el lado que sobra.
 */
export function encuadre([oeste, sur, este, norte]: Recuadro, area: Area): Encuadre {
  const latitudMedia = ((sur + norte) / 2) * (Math.PI / 180);
  const proporcion = ((este - oeste) * Math.cos(latitudMedia)) / (norte - sur);
  if (area.ancho / area.alto > proporcion) {
    const ancho = area.alto * proporcion;
    return { ancho, alto: area.alto, dx: (area.ancho - ancho) / 2, dy: 0 };
  }
  const alto = area.ancho / proporcion;
  return { ancho: area.ancho, alto, dx: 0, dy: (area.alto - alto) / 2 };
}
