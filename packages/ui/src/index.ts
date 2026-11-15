/**
 * Los mismos tokens de tokens.css, para el código que no lee CSS: MapLibre, Observable Plot, el juego.
 * Una prueba comprueba que los dos archivos no se separen.
 */

export const paleta = {
  pelaje: "#e8833a",
  pelajeOscuro: "#c4612a",
  hocico: "#fce9cf",
  banda: "#4a2a1e",
  llama: "#ff6b1a",
  llamaNucleo: "#ffc53d",
  acento: "#c2410c",
  casco: "#f2b705",
  chaqueta: "#2e3b4e",
  sombrero: "#4f7a55",
  cielo: "#eef2f4",
  /** Lagos y agua del juego. Azul frente a los naranjas del fuego: se distingue también con daltonismo. */
  agua: "#3b7fb0",
  tinta: "#1b2430",
} as const;

export const interfaz = {
  fondo: "#f6f8f9",
  superficie: "#ffffff",
  superficie2: "#e9eef1",
  tinta: paleta.tinta,
  tintaSuave: "#5a6675",
  borde: "#d6dde3",
  acento: paleta.acento,
  exito: "#2f6b45",
  peligro: "#b42318",
  avisoTexto: "#9a3412",
} as const;

/** YlOrRd de 7 clases, de menos a más focos. */
export const rampaConteo = [
  "#ffffb2",
  "#fed976",
  "#feb24c",
  "#fd8d3c",
  "#fc4e2a",
  "#e31a1c",
  "#b10026",
] as const;

/** PuOr de 7 clases: violeta = menos fuego que lo normal, blanco = normal, naranja = más. */
export const rampaAnomalia = [
  "#542788",
  "#998ec3",
  "#d8daeb",
  "#f7f7f7",
  "#fee0b6",
  "#f1a340",
  "#b35806",
] as const;

export const colorSinDato = "#e3e9ef";

export const fuentes = {
  titulos: '"Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif',
  texto: '"IBM Plex Sans", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
} as const;

/**
 * Elige el color de una rampa según en qué intervalo cae el valor.
 * `cortes` son los límites entre clases, en orden creciente (uno menos que colores).
 * Devuelve `colorSinDato` si el valor no es un número finito.
 */
export function colorDeRampa(
  valor: number | null | undefined,
  cortes: readonly number[],
  rampa: readonly string[],
): string {
  if (valor == null || !Number.isFinite(valor)) return colorSinDato;
  if (cortes.length !== rampa.length - 1) {
    throw new Error(`Hacen falta ${rampa.length - 1} cortes para ${rampa.length} colores`);
  }
  let clase = 0;
  while (clase < cortes.length && valor >= (cortes[clase] as number)) clase++;
  return rampa[clase] as string;
}

/** Contraste WCAG 2 entre dos colores en hexadecimal (#rrggbb). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Color inválido: ${hex}`);
  const n = parseInt(m[1] as string, 16);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
