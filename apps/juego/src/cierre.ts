/** Consejos de prevención para el cierre de la partida. Cortos, con voseo y sin alarmismo. */
export const CONSEJOS = [
  "Si ves humo o fuego, avisá enseguida: 100 en Argentina, 132 en Chile.",
  "Un fogón se apaga con mucha agua y tierra, hasta que no quede nada tibio.",
  "No tires colillas ni vidrios en el campo: pueden empezar un incendio.",
  "Hacé fuego solo en los lugares permitidos y nunca cuando hay mucho viento.",
  "Las quemas de pastizales se descontrolan fácil: no las hagas sin permiso.",
] as const;

/** Lo que se aclara siempre al final: los focos no son reales y a quién llamar si ves fuego de verdad. */
export const AVISO_SIMULADOS = "Los focos del juego son simulados. Si ves fuego de verdad, llamá al 100 en Argentina o al 132 en Chile.";

/** "1 foco", "2 focos". */
export const focos = (n: number) => `${n} ${n === 1 ? "foco" : "focos"}`;

/** Separador de miles en español: 1.240. */
export const miles = (n: number) => Math.round(n).toLocaleString("es-AR");

export interface Cierre {
  consejo: string;
  /** Por qué las fuentes fijas no se apagan, si el jugador tocó alguna. */
  fuentesFijas: string | null;
}

/** Texto del final de la partida: un consejo de prevención y, si tocó alguna, qué es una fuente fija. */
export function cierreDePartida(indiceConsejo: number, fijasTocadas = 0): Cierre {
  return {
    consejo: CONSEJOS[indiceConsejo % CONSEJOS.length]!,
    fuentesFijas:
      fijasTocadas > 0
        ? `Tocaste ${fijasTocadas} ${fijasTocadas === 1 ? "fuente fija" : "fuentes fijas"}: industrias, antorchas de gas o volcanes que los satélites ven calientes todos los días. No son incendios y no hay que apagarlas.`
        : null,
  };
}

/**
 * La frase del final según cómo salió la partida. `record` es el de antes de esta partida; `antes`, los puntos
 * antes de multiplicar por la victoria. Va con <b> para resaltar números (los valores son siempre números).
 */
export function fraseDelFinal(o: {
  puntos: number;
  antes: number;
  record: number;
  apagados: number;
  barridas: number;
  victoria: boolean;
  sumaRecord: boolean;
}): string {
  const base = !o.sumaRecord
    ? `Apagaste ${focos(o.apagados)} en el modo explorador. Este modo no suma récord.`
    : o.victoria
      ? `No quedó ni un foco prendido: tus <b>${miles(o.antes)} puntos</b> valieron el doble.`
      : `Apagaste <b>${focos(o.apagados)}</b> en ${o.barridas} ${o.barridas === 1 ? "barrida" : "barridas"}.`;
  if (!o.sumaRecord) return base;
  if (o.puntos > o.record) {
    return base + (o.record > 0 ? ` Pasaste tu marca anterior por <b>${miles(o.puntos - o.record)} puntos</b>.` : " Es tu primera marca.");
  }
  if (o.puntos === o.record) return `${base} Igualaste tu récord.`;
  return `${base} Te faltaron <b>${miles(o.record - o.puntos)} puntos</b> para tu récord de ${miles(o.record)}.`;
}
