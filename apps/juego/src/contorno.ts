import type { Area } from "./datos";

/** [oeste, sur, este, norte] en grados. */
export type Recuadro = [number, number, number, number];
export type Punto = [number, number];
export type Anillo = Punto[];

/** Forma de src/sudamerica.json: los países de Sudamérica, cada uno con sus anillos ([lon, lat]). */
export interface Paises {
  paises: { n: string; r: Anillo[] }[];
}

export interface Contorno {
  anillos: Anillo[];
  /** El nombre del país de cada anillo, en el mismo orden. */
  nombres: string[];
}

/** Todos los anillos de los países, con el nombre de su país al lado. */
export function contornoDe(geo: Paises): Contorno {
  return {
    anillos: geo.paises.flatMap((p) => p.r),
    nombres: geo.paises.flatMap((p) => p.r.map(() => p.n)),
  };
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

/** ¿El punto está dentro del anillo? (rayo hacia el este, regla par-impar). */
export function adentro([lon, lat]: Punto, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]!;
    const [xj, yj] = anillo[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** El país (sobre el contorno simplificado) donde cae un punto, o null si cae fuera de todas. */
export function regionEn(contorno: Contorno, punto: Punto): string | null {
  const i = contorno.anillos.findIndex((anillo) => adentro(punto, anillo));
  return i === -1 ? null : (contorno.nombres[i] ?? null);
}
