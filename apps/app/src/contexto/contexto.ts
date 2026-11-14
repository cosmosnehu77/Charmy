/** Funciones del panel de contexto (RF-CTX-01, RF-CTX-03). Sin React. */

const DIRECCIONES = ["norte", "noreste", "este", "sudeste", "sur", "sudoeste", "oeste", "noroeste"] as const;

/** De dónde viene el viento, en palabras (8 rumbos). `grados` es la dirección desde la que sopla. */
export function direccionViento(grados: number): string {
  const i = Math.round((((grados % 360) + 360) % 360) / 45) % 8;
  return DIRECCIONES[i] ?? "norte";
}

/** La API da la imagen como ruta propia (/api/v1/imagery/…png): se completa con el origen de la API. */
export function urlImagen(baseApi: string, imageUrl: string): string {
  return new URL(imageUrl, baseApi).href;
}
