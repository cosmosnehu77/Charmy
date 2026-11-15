import dia from "../../../data/muestras/dia-juego.json";
import { fechaLarga } from "./cierre";
import type { DiaJuego } from "./datos";

/** La muestra de data/muestras: se juega cuando el desafío del día no llega. */
const MUESTRA = dia as DiaJuego;
/** Con menos focos que esto el desafío no vale la pena: se juega la muestra. */
export const MINIMO_FOCOS = 20;
/** Cuánto se espera a la API antes de jugar la muestra. */
export const ESPERA_MS = 3000;

const HORA_MS = 3_600_000;

/** El día de ayer en hora de Argentina (UTC−3, sin horario de verano), como AAAA-MM-DD. */
export function fechaDeAyerArgentina(ahora: Date): string {
  const enArgentina = new Date(ahora.getTime() - 3 * HORA_MS);
  enArgentina.setUTCDate(enArgentina.getUTCDate() - 1);
  return enArgentina.toISOString().slice(0, 10);
}

export type Pedir = (url: string, init?: RequestInit) => Promise<Response>;

export interface Desafio {
  dia: DiaJuego;
  /** Qué decir en pantalla si se juega la muestra en lugar del desafío. */
  aviso: string | null;
}

const esNumero = (x: unknown) => typeof x === "number" && Number.isFinite(x);

/** ¿La respuesta tiene la forma de dia-juego.json? */
function esDia(x: unknown): x is DiaJuego {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.fecha === "string" &&
    typeof d.fuente === "string" &&
    Array.isArray(d.bbox) &&
    d.bbox.length === 4 &&
    d.bbox.every(esNumero) &&
    Array.isArray(d.focos) &&
    d.focos.every((f: Record<string, unknown>) => esNumero(f.lat) && esNumero(f.lon) && esNumero(f.frp) && typeof f.hora_utc === "string" && typeof f.confidence === "string")
  );
}

const conMuestra = (motivo: string): Desafio => ({
  dia: MUESTRA,
  aviso: `${motivo} Hoy jugás con la muestra del ${fechaLarga(MUESTRA.fecha)}.`,
});

/**
 * El desafío del día: los focos de `fecha` desde nuestra API (`GET /game/day`, F4-C2). Nunca se llama a FIRMS ni a
 * Meteomatics. Si no hay API, tarda, falla o trae muy pocos focos, se juega la muestra y se avisa.
 */
export async function cargarDesafio(
  fecha: string,
  { base, pedir, tiempoMs }: { base: string; pedir: Pedir; tiempoMs: number },
): Promise<Desafio> {
  const raiz = base.replace(/\/+$/, "");
  if (!raiz) return conMuestra("El desafío del día todavía no está disponible.");
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), tiempoMs);
  try {
    const respuesta = await pedir(`${raiz}/game/day?date=${encodeURIComponent(fecha)}`, {
      headers: { Accept: "application/json" },
      signal: corte.signal,
    });
    if (!respuesta.ok) return conMuestra("El desafío del día no está disponible ahora.");
    const cuerpo: unknown = await respuesta.json();
    if (!esDia(cuerpo)) return conMuestra("El desafío del día no está disponible ahora.");
    if (cuerpo.focos.length < MINIMO_FOCOS) return conMuestra("Ayer hubo muy pocos focos para un desafío.");
    return { dia: cuerpo, aviso: null };
  } catch {
    return conMuestra("El desafío del día no está disponible ahora.");
  } finally {
    clearTimeout(reloj);
  }
}
