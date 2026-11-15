import type { DiaJuego } from "./datos";

/** Consejos de prevención para el cierre de la partida. Cortos, con voseo y sin alarmismo. */
export const CONSEJOS = [
  "Si ves humo o fuego, avisá enseguida: 100 en Argentina, 132 en Chile.",
  "Un fogón se apaga con mucha agua y tierra, hasta que no quede nada tibio.",
  "No tires colillas ni vidrios en el campo: pueden empezar un incendio.",
  "Hacé fuego solo en los lugares permitidos y nunca cuando hay mucho viento.",
  "Las quemas de pastizales se descontrolan fácil: no las hagas sin permiso.",
] as const;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function fechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return `${dia} de ${MESES[(mes ?? 1) - 1]} de ${anio}`;
}

/** "1 foco", "2 focos". */
export const focos = (n: number) => `${n} ${n === 1 ? "foco" : "focos"}`;

export interface Cierre {
  dato: string;
  consejo: string;
  /** Por qué las fuentes fijas no se apagan, si el jugador tocó alguna. */
  fuentesFijas: string | null;
}

/** Texto del final de la partida: un dato real del día jugado y un consejo de prevención. */
export function cierreDePartida(dia: DiaJuego, indiceConsejo: number, fijasTocadas = 0): Cierre {
  const muestra = dia.provisional ? " (dato de muestra)" : "";
  return {
    dato: `El ${fechaLarga(dia.fecha)} los satélites detectaron ${dia.focos.length} focos de calor en el sur de Argentina y Chile${muestra}. Fuente: ${dia.fuente}.`,
    consejo: CONSEJOS[indiceConsejo % CONSEJOS.length]!,
    fuentesFijas:
      fijasTocadas > 0
        ? `Tocaste ${fijasTocadas} ${fijasTocadas === 1 ? "fuente fija" : "fuentes fijas"}: industrias, antorchas de gas o volcanes que los satélites ven calientes todos los días. No son incendios y no hay que apagarlas.`
        : null,
  };
}
