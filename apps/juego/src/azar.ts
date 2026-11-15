/** Un generador de números entre 0 (incluido) y 1 (excluido). */
export type Azar = () => number;

/** Hash FNV-1a de 32 bits: pasa la semilla (una fecha AAAA-MM-DD) a un entero. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: la misma semilla da siempre la misma secuencia, en cualquier navegador. */
export function crearAzar(semilla: string): Azar {
  let estado = hash(semilla);
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
