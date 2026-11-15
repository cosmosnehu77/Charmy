// Cálculos del recorrido, sin DOM: se prueban solos (test/recorrido.test.ts).

/** Interpolación suave entre a y b (smoothstep). */
export const suave = (a: number, b: number, t: number): number => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Peso del paso i según el progreso p: 1 en el paso, 0 lejos, con rampas de medio paso. */
export const tramo = (p: number, i: number): number => suave(i - 0.5, i, p) * (1 - suave(i + 0.5, i + 1, p));

/** Fracción del recorrido de una sección en la que el mapa se queda quieto antes de pasar a la siguiente. */
export const QUIETO = 0.65;

/**
 * Progreso de un paso a partir de cuánto se recorrió su sección (0 a 1).
 * El primer 65 % queda en la primera mitad del paso; el resto lleva al paso siguiente.
 */
export function progresoPaso(i: number, f: number): number {
  const x = Math.min(0.999, Math.max(0, f));
  return i + (x < QUIETO ? (x * 0.5) / QUIETO : 0.5 + ((x - QUIETO) * 0.5) / (1 - QUIETO));
}

/** Milisegundos que Charmy deja su globo a la vista: lo que lleva leerlo, con un mínimo de 5 s. */
export const tiempoLectura = (texto: string): number => Math.max(5000, texto.trim().split(/\s+/).length * 380 + 2200);

/** La barra se oculta al bajar y vuelve al subir; cerca del principio siempre se ve. */
export const ocultarBarra = (y: number, anterior: number): boolean => y > 80 && y >= anterior;
