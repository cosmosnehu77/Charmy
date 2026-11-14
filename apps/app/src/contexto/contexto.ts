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

/** Umbral del índice de riesgo de incendio de Meteomatics (0 a 1): desde acá el riesgo sube (services/contexto). */
export const UMBRAL_RIESGO = 0.5;

/** Texto del riesgo: la etiqueta si la fuente la da; si no, el índice de 0 a 1 contra el umbral. */
export function textoRiesgo(indice?: number, etiqueta?: string): string | null {
  if (etiqueta) return etiqueta.replace("_", " ");
  if (indice === undefined || indice === null) return null;
  const valor = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(indice);
  return `${indice >= UMBRAL_RIESGO ? "por encima de lo habitual" : "bajo"} (índice ${valor} de 1)`;
}
