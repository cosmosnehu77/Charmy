import type { FocoEnPantalla } from "./datos";
import { potencia } from "./mecanica";

/** Puntos por foco apagado con combo 1. Con combo N suma N veces esto. */
export const PUNTOS_BASE = 10;
/** Tiempo máximo entre dos focos apagados para que el combo siga. */
export const VENTANA_COMBO_MS = 2000;
/** Lo que se pierde por tocar una fuente fija o un foco de confianza baja sin verificar (gastar agua de más). */
export const PENALIDAD = 5;

export interface Marcador {
  puntos: number;
  combo: number;
  mejorCombo: number;
  apagados: number;
  escapados: number;
  /** Toques a focos de confianza baja sin verificar. */
  sinVerificar: number;
  fijasTocadas: number;
  ultimoApagadoMs: number | null;
}

export function marcadorInicial(): Marcador {
  return { puntos: 0, combo: 0, mejorCombo: 0, apagados: 0, escapados: 0, sinVerificar: 0, fijasTocadas: 0, ultimoApagadoMs: null };
}

/** Apagar un foco: si el anterior fue hace menos de la ventana, el combo crece; si no, vuelve a 1. */
export function apagar(m: Marcador, ahoraMs: number): Marcador {
  const enRacha =
    m.combo > 0 && m.ultimoApagadoMs !== null && ahoraMs - m.ultimoApagadoMs <= VENTANA_COMBO_MS;
  const combo = enRacha ? m.combo + 1 : 1;
  return {
    ...m,
    puntos: m.puntos + PUNTOS_BASE * combo,
    combo,
    mejorCombo: Math.max(m.mejorCombo, combo),
    apagados: m.apagados + 1,
    ultimoApagadoMs: ahoraMs,
  };
}

/** Un foco que nadie apagó a tiempo corta el combo. */
export function dejarEscapar(m: Marcador): Marcador {
  return { ...m, combo: 0, escapados: m.escapados + 1 };
}

/** Un foco encendido en la pantalla. */
export interface FocoActivo {
  id: number;
  x: number;
  y: number;
  frp: number;
  /** Toques que faltan para apagarlo. */
  golpes: number;
  confianza: string;
  verificado: boolean;
  fuenteFija: boolean;
}

export function focoActivo(id: number, f: FocoEnPantalla): FocoActivo {
  return {
    id,
    x: f.x,
    y: f.y,
    frp: f.frp,
    golpes: potencia(f.frp).toques,
    confianza: f.confidence,
    verificado: false,
    fuenteFija: f.fuente_fija === true,
  };
}

/** Estado de la partida: las escenas lo dibujan y lo cambian solo con estas funciones. */
export interface Partida {
  marcador: Marcador;
  activos: FocoActivo[];
}

export function nuevaPartida(): Partida {
  return { marcador: marcadorInicial(), activos: [] };
}

export function encenderFoco(p: Partida, foco: FocoActivo): Partida {
  return { ...p, activos: [...p.activos, foco] };
}

const buscar = (p: Partida, id: number) => p.activos.find((f) => f.id === id);
const sin = (p: Partida, id: number) => p.activos.filter((f) => f.id !== id);
const restar = (puntos: number) => Math.max(0, puntos - PENALIDAD);

/**
 * Un toque a un foco activo. Una fuente fija no se apaga: tocarla resta y corta el combo. Un foco de confianza baja
 * sin verificar descuenta en cada toque. Si ya no estaba activo, nada cambia.
 */
export function golpearFoco(p: Partida, id: number, ahoraMs: number): Partida {
  const foco = buscar(p, id);
  if (!foco) return p;
  const m = p.marcador;
  if (foco.fuenteFija) {
    return { marcador: { ...m, puntos: restar(m.puntos), combo: 0, fijasTocadas: m.fijasTocadas + 1 }, activos: sin(p, id) };
  }
  const golpes = foco.golpes - 1;
  let marcador = golpes > 0 ? m : apagar(m, ahoraMs);
  if (foco.confianza === "low" && !foco.verificado) {
    marcador = { ...marcador, puntos: restar(marcador.puntos), sinVerificar: marcador.sinVerificar + 1 };
  }
  const activos = golpes > 0 ? p.activos.map((f) => (f.id === id ? { ...f, golpes } : f)) : sin(p, id);
  return { marcador, activos };
}

/** Verificar un foco de confianza baja: después se puede apagar sin descuento. */
export function verificarFoco(p: Partida, id: number): Partida {
  if (!buscar(p, id)) return p;
  return { ...p, activos: p.activos.map((f) => (f.id === id ? { ...f, verificado: true } : f)) };
}

/** Un foco activo que nadie apagó a tiempo corta el combo. Una fuente fija que se deja no castiga. */
export function escaparFoco(p: Partida, id: number): Partida {
  const foco = buscar(p, id);
  if (!foco) return p;
  return { marcador: foco.fuenteFija ? p.marcador : dejarEscapar(p.marcador), activos: sin(p, id) };
}
