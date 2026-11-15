import { localeDe, type Idioma } from "./idioma";
import type { FocoActivo } from "./partida";

/** Qué cambia entre el modo normal y el modo explorador (accesibilidad, RF-KID-11). */
export interface Reglas {
  /** La partida termina cuando se acaba el tiempo. */
  reloj: boolean;
  /** Los focos sin apagar se escapan y se propagan. */
  escapes: boolean;
  gastaAgua: boolean;
  /** El puntaje cuenta para el récord (y, cuando exista, para la tabla del desafío). */
  sumaRecord: boolean;
}

export const REGLAS: Record<"normal" | "explorador", Reglas> = {
  normal: { reloj: true, escapes: true, gastaAgua: true, sumaRecord: true },
  explorador: { reloj: false, escapes: false, gastaAgua: false, sumaRecord: false },
};

/** Orden de recorrido con el teclado: de norte a sur, de oeste a este y, si empatan, por número de foco. */
export function ordenDeRecorrido(focos: FocoActivo[]): number[] {
  return [...focos].sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id).map((f) => f.id);
}

/** El foco siguiente (paso 1) o anterior (paso −1); al pasar el final vuelve al principio. */
export function siguiente(orden: number[], actual: number | null, paso: 1 | -1): number | null {
  if (orden.length === 0) return null;
  const i = actual === null ? -1 : orden.indexOf(actual);
  if (i === -1) return paso === 1 ? orden[0]! : orden.at(-1)!;
  return orden[(i + paso + orden.length) % orden.length]!;
}

const TEXTO_FOCO = {
  es: {
    donde: (r: string | null) => (r ? `en ${r} (aproximado)` : "fuera de las regiones del mapa"),
    numero: (p: number, t: number, donde: string) => `Foco ${p} de ${t}, ${donde}.`,
    fija: "Es una fuente fija, como una industria o un volcán: no es un incendio y no hay que apagarla.",
    potencia: (mw: string, g: number) => `Potencia ${mw} megavatios: hacen falta ${g === 1 ? "1 toque" : `${g} toques`}.`,
    verificado: "Verificado.",
    dudoso: "Confianza baja: puede ser una falsa alarma. Verificalo con la tecla V.",
  },
  en: {
    donde: (r: string | null) => (r ? `in ${r} (approximate)` : "outside the map's regions"),
    numero: (p: number, t: number, donde: string) => `Fire ${p} of ${t}, ${donde}.`,
    fija: "It's a fixed source, like an industry or a volcano: it isn't a wildfire and doesn't need putting out.",
    potencia: (mw: string, g: number) => `Power ${mw} megawatts: it takes ${g === 1 ? "1 tap" : `${g} taps`}.`,
    verificado: "Verified.",
    dudoso: "Low confidence: it may be a false alarm. Verify it with the V key.",
  },
} satisfies Record<Idioma, unknown>;

/** Lo que el lector de pantalla dice de un foco: dónde está, su potencia y si es dudoso. Corto y sin jerga. */
export function textoDeFoco(foco: FocoActivo, posicion: number, total: number, region: string | null, idioma: Idioma = "es"): string {
  const T = TEXTO_FOCO[idioma];
  const partes = [T.numero(posicion, total, T.donde(region))];
  if (foco.fuenteFija) {
    partes.push(T.fija);
    return partes.join(" ");
  }
  const mw = foco.frp.toLocaleString(localeDe(idioma), { maximumFractionDigits: 1 });
  partes.push(T.potencia(mw, foco.golpes));
  if (foco.confianza === "low") partes.push(foco.verificado ? T.verificado : T.dudoso);
  return partes.join(" ");
}
