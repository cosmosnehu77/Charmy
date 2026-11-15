import type { Mood } from "@charmy/charmy/core";
import type { Marcador, Partida } from "./partida";

/** Con esta cantidad de focos sueltos a la vez (sin contar fuentes fijas), Charmy se pone en alerta. */
export const FOCOS_SUELTOS_ALERTA = 8;

/** Charmy acompaña la partida: alerta con muchos focos sueltos, pensando ante uno dudoso, en reposo si no. */
export function estadoDeCharmy(p: Partida): Mood {
  const sueltos = p.activos.filter((f) => !f.fuenteFija);
  if (sueltos.length >= FOCOS_SUELTOS_ALERTA) return "alerta";
  if (sueltos.some((f) => f.confianza === "low" && !f.verificado)) return "pensando";
  return "idle";
}

/** En el cierre, Charmy festeja si la partida salió bien y si no, explica. */
export function estadoDelCierre(m: Marcador, esRecord: boolean): Mood {
  return esRecord || m.apagados > m.escapados ? "festeja" : "explica";
}

/** Cuánto se estira el tiempo de escape en cada tercio de la partida: empieza tranquila y termina en el ritmo normal. */
const FACTORES = [1.25, 1.1, 1] as const;

export function factorDeTramo(ahoraMs: number, duracionMs: number): number {
  const tramo = Math.min(FACTORES.length - 1, Math.max(0, Math.floor((ahoraMs / duracionMs) * FACTORES.length)));
  return FACTORES[tramo]!;
}
