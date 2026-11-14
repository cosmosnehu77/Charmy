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

export interface Cierre {
  dato: string;
  consejo: string;
}

/** Texto del final de la partida: un dato real del día jugado y un consejo de prevención. */
export function cierreDePartida(dia: DiaJuego, indiceConsejo: number): Cierre {
  const muestra = dia.provisional ? " (dato de muestra)" : "";
  return {
    dato: `El ${fechaLarga(dia.fecha)} los satélites detectaron ${dia.focos.length} focos de calor en el sur de Argentina y Chile${muestra}. Fuente: ${dia.fuente}.`,
    consejo: CONSEJOS[indiceConsejo % CONSEJOS.length]!,
  };
}
