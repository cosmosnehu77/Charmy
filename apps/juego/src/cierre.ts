import { localeDe, type Idioma } from "./idioma";

/** Consejos de prevención para el cierre de la partida. Cortos, con voseo y sin alarmismo. */
export const CONSEJOS = [
  "Si ves humo o fuego, avisá enseguida: 100 en Argentina, 132 en Chile.",
  "Un fogón se apaga con mucha agua y tierra, hasta que no quede nada tibio.",
  "No tires colillas ni vidrios en el campo: pueden empezar un incendio.",
  "Hacé fuego solo en los lugares permitidos y nunca cuando hay mucho viento.",
  "Las quemas de pastizales se descontrolan fácil: no las hagas sin permiso.",
] as const;

const CONSEJOS_EN = [
  "If you see smoke or fire, tell someone right away: 100 in Argentina, 132 in Chile.",
  "Put out a campfire with lots of water and dirt, until nothing is warm.",
  "Don't throw cigarette butts or glass in the countryside: they can start a fire.",
  "Only make fires where it's allowed, and never when it's very windy.",
  "Grass burns get out of control easily: don't do them without permission.",
] as const;

/** Lo que se aclara siempre al final: los focos no son reales y a quién llamar si ves fuego de verdad. */
export const AVISO_SIMULADOS = "Los focos del juego son simulados. Si ves fuego de verdad, llamá al 100 en Argentina o al 132 en Chile.";
const AVISO_SIMULADOS_EN = "The fires in the game are simulated. If you see a real fire, call 100 in Argentina or 132 in Chile.";

export const avisoSimulados = (idioma: Idioma = "es") => (idioma === "en" ? AVISO_SIMULADOS_EN : AVISO_SIMULADOS);

/** "1 foco", "2 focos". */
export const focos = (n: number, idioma: Idioma = "es") =>
  idioma === "en" ? `${n} ${n === 1 ? "fire" : "fires"}` : `${n} ${n === 1 ? "foco" : "focos"}`;

/** Separador de miles: 1.240 en español, 1,240 en inglés. */
export const miles = (n: number, idioma: Idioma = "es") => Math.round(n).toLocaleString(localeDe(idioma));

export interface Cierre {
  consejo: string;
  /** Por qué las fuentes fijas no se apagan, si el jugador tocó alguna. */
  fuentesFijas: string | null;
}

/** Texto del final de la partida: un consejo de prevención y, si tocó alguna, qué es una fuente fija. */
export function cierreDePartida(indiceConsejo: number, fijasTocadas = 0, idioma: Idioma = "es"): Cierre {
  const consejos = idioma === "en" ? CONSEJOS_EN : CONSEJOS;
  const uno = fijasTocadas === 1;
  return {
    consejo: consejos[indiceConsejo % consejos.length]!,
    fuentesFijas:
      fijasTocadas <= 0
        ? null
        : idioma === "en"
          ? `You touched ${fijasTocadas} ${uno ? "fixed source" : "fixed sources"}: industries, gas flares or volcanoes that satellites see as hot every day. They aren't wildfires and don't need putting out.`
          : `Tocaste ${fijasTocadas} ${uno ? "fuente fija" : "fuentes fijas"}: industrias, antorchas de gas o volcanes que los satélites ven calientes todos los días. No son incendios y no hay que apagarlas.`,
  };
}

const FRASES = {
  es: {
    explorador: (f: string) => `Apagaste ${f} en el modo explorador. Este modo no suma récord.`,
    victoria: (p: string) => `No quedó ni un foco prendido: tus <b>${p} puntos</b> valieron el doble.`,
    normal: (f: string, b: number) => `Apagaste <b>${f}</b> en ${b} ${b === 1 ? "barrida" : "barridas"}.`,
    pasaste: (p: string) => ` Pasaste tu marca anterior por <b>${p} puntos</b>.`,
    primera: " Es tu primera marca.",
    igualaste: " Igualaste tu récord.",
    faltaron: (p: string, r: string) => ` Te faltaron <b>${p} puntos</b> para tu récord de ${r}.`,
  },
  en: {
    explorador: (f: string) => `You put out ${f} in explorer mode. This mode doesn't count toward your record.`,
    victoria: (p: string) => `Not a single fire left burning: your <b>${p} points</b> counted double.`,
    normal: (f: string, b: number) => `You put out <b>${f}</b> in ${b} ${b === 1 ? "sweep" : "sweeps"}.`,
    pasaste: (p: string) => ` You beat your previous best by <b>${p} points</b>.`,
    primera: " It's your first record.",
    igualaste: " You tied your record.",
    faltaron: (p: string, r: string) => ` You were <b>${p} points</b> short of your record of ${r}.`,
  },
} satisfies Record<Idioma, unknown>;

/**
 * La frase del final según cómo salió la partida. `record` es el de antes de esta partida; `antes`, los puntos
 * antes de multiplicar por la victoria. Va con <b> para resaltar números (los valores son siempre números).
 */
export function fraseDelFinal(
  o: {
    puntos: number;
    antes: number;
    record: number;
    apagados: number;
    barridas: number;
    victoria: boolean;
    sumaRecord: boolean;
  },
  idioma: Idioma = "es",
): string {
  const F = FRASES[idioma];
  const m = (n: number) => miles(n, idioma);
  if (!o.sumaRecord) return F.explorador(focos(o.apagados, idioma));
  const base = o.victoria ? F.victoria(m(o.antes)) : F.normal(focos(o.apagados, idioma), o.barridas);
  if (o.puntos > o.record) return base + (o.record > 0 ? F.pasaste(m(o.puntos - o.record)) : F.primera);
  if (o.puntos === o.record) return base + F.igualaste;
  return base + F.faltaron(m(o.record - o.puntos), m(o.record));
}
