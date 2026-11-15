/** Una fuente de agua donde Charmy recarga el tanque. Posición aproximada del centro, en grados. */
export interface Lago {
  nombre: string;
  lat: number;
  lon: number;
  /** Radio dibujado en la maqueta (exagerado, para que se vea). */
  r: number;
}

/** Los lagos, represas y humedales más grandes de Sudamérica. */
export const LAGOS: Lago[] = [
  { nombre: "Lago de Maracaibo", lat: 9.8, lon: -71.5, r: 6 },
  { nombre: "Embalse de Guri", lat: 7.5, lon: -63.0, r: 4.5 },
  { nombre: "Río Amazonas", lat: -3.1, lon: -60.0, r: 5 },
  { nombre: "Represa de Tucuruí", lat: -4.3, lon: -49.6, r: 4.5 },
  { nombre: "Represa de Sobradinho", lat: -9.6, lon: -41.6, r: 4.5 },
  { nombre: "Lago Titicaca", lat: -15.8, lon: -69.4, r: 5.5 },
  { nombre: "Pantanal", lat: -18.0, lon: -57.2, r: 5.5 },
  { nombre: "Represa de Itaipú", lat: -25.0, lon: -54.5, r: 4.5 },
  { nombre: "Esteros del Iberá", lat: -28.3, lon: -57.3, r: 4.5 },
  { nombre: "Mar Chiquita", lat: -30.6, lon: -62.6, r: 4.5 },
  { nombre: "Lagoa dos Patos", lat: -31.0, lon: -51.4, r: 5 },
  { nombre: "Nahuel Huapi", lat: -40.98, lon: -71.3, r: 4 },
  { nombre: "Lago Buenos Aires", lat: -46.55, lon: -71.6, r: 4.5 },
  { nombre: "Lago Argentino", lat: -50.3, lon: -72.3, r: 4 },
  { nombre: "Represa de Balbina", lat: -1.6, lon: -59.6, r: 4 },
  { nombre: "Lago Junín", lat: -11.0, lon: -76.1, r: 3.5 },
  { nombre: "Serra da Mesa", lat: -13.9, lon: -48.3, r: 4 },
  { nombre: "Lago Poopó", lat: -18.8, lon: -67.1, r: 4 },
  { nombre: "Represa de Yacyretá", lat: -27.4, lon: -56.6, r: 4 },
  { nombre: "Salto Grande", lat: -31.0, lon: -57.9, r: 3.5 },
  { nombre: "Laguna Merín", lat: -32.8, lon: -53.2, r: 4.5 },
  { nombre: "Embalse El Chocón", lat: -39.3, lon: -68.9, r: 4 },
  { nombre: "Lago Llanquihue", lat: -41.1, lon: -72.8, r: 3.5 },
  { nombre: "Lago Viedma", lat: -49.6, lon: -72.6, r: 3.5 },
  { nombre: "Lago Fagnano", lat: -54.55, lon: -67.8, r: 3.5 },
];

/** Ríos principales, de la naciente a la desembocadura ([lon, lat]). Trazo aproximado, solo para ubicarse. */
export const RIOS: [number, number][][] = [
  [[-73.5, -4.5], [-70, -4.2], [-67, -2.6], [-64.7, -3.3], [-60, -3.1], [-58, -3.2], [-55.5, -2.0], [-52, -1.4], [-50.5, -0.5]],
  [[-67, 1.2], [-65, -0.4], [-62.9, -1.2], [-60, -3.1]],
  [[-65.3, -10.8], [-63.9, -8.7], [-61.5, -6.0], [-59.5, -4.0], [-58.8, -3.4]],
  [[-58, -9.5], [-56.5, -6], [-55, -2.5]],
  [[-53, -11], [-52.5, -6], [-52, -3.2], [-52, -1.6]],
  [[-48.5, -12], [-48.3, -8], [-49.6, -4.2], [-49.2, -2], [-48.8, -1.3]],
  [[-67.6, 3.5], [-67.5, 6.2], [-66, 7.6], [-64, 8.1], [-62.5, 8.5], [-61, 9.0]],
  [[-75.5, 2.5], [-74.7, 5.5], [-74.1, 7.5], [-74.8, 10.9]],
  [[-57.6, -16.5], [-57.6, -19], [-57.9, -22], [-57.6, -25.3], [-58.5, -27.3]],
  [[-47.5, -20], [-51.5, -21.5], [-54.3, -24.5], [-54.6, -25.6], [-55.9, -27.4], [-58.6, -27.3], [-59.6, -29.5], [-60.6, -32.9], [-59, -33.9], [-58.4, -34.2]],
  [[-51.5, -27.5], [-54.5, -27.4], [-57.6, -30.0], [-58.1, -32.5], [-58.4, -34.0]],
  [[-45.5, -18.5], [-44.5, -15], [-43.5, -11.5], [-41.5, -9.6], [-38.5, -9.0], [-36.5, -10.4]],
  [[-68.1, -38.95], [-66, -39.2], [-64, -40.0], [-63, -41.0]],
];

export interface LagoEnPantalla {
  nombre: string;
  x: number;
  y: number;
}

/** El lago más cercano a un toque, si está a menos de `radio`. */
export function lagoTocado<L extends LagoEnPantalla>(lagos: L[], x: number, y: number, radio: number): L | null {
  let mejor: L | null = null;
  let distancia = radio;
  for (const l of lagos) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d <= distancia) [mejor, distancia] = [l, d];
  }
  return mejor;
}
