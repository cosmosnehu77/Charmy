/** Lagos donde Charmy recarga el tanque. Posición aproximada del centro de cada lago, en grados. */
export interface Lago {
  nombre: string;
  lat: number;
  lon: number;
}

export const LAGOS: Lago[] = [
  { nombre: "Ranco", lat: -40.22, lon: -72.4 },
  { nombre: "Nahuel Huapi", lat: -40.98, lon: -71.5 },
  { nombre: "Llanquihue", lat: -41.13, lon: -72.8 },
  { nombre: "Musters", lat: -45.4, lon: -69.2 },
  { nombre: "General Carrera / Buenos Aires", lat: -46.55, lon: -72.0 },
  { nombre: "Viedma", lat: -49.58, lon: -72.55 },
  { nombre: "Argentino", lat: -50.3, lon: -72.65 },
  { nombre: "Fagnano", lat: -54.55, lon: -67.8 },
];

export interface LagoEnPantalla {
  nombre: string;
  x: number;
  y: number;
}

/** El lago más cercano a un toque, si está a menos de `radio` píxeles. */
export function lagoTocado<L extends LagoEnPantalla>(lagos: L[], x: number, y: number, radio: number): L | null {
  let mejor: L | null = null;
  let distancia = radio;
  for (const l of lagos) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d <= distancia) [mejor, distancia] = [l, d];
  }
  return mejor;
}
