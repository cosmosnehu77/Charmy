import type { FocoEnPantalla } from "./datos";
import type { Celda } from "./grilla";
import { potencia } from "./mecanica";

/** Puntos por foco apagado con combo 1. Con combo N suma N veces esto. */
export const PUNTOS_BASE = 10;
/** Tiempo máximo entre dos focos apagados para que el combo siga. */
export const VENTANA_COMBO_MS = 2000;
/** Lo que se pierde por tocar una fuente fija. */
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

/** Un foco que nació de otro que se escapó: chico, de un toque. */
export function focoPropagado(id: number, x: number, y: number): FocoActivo {
  return { id, x, y, frp: 1, golpes: 1, confianza: "nominal", verificado: false, fuenteFija: false };
}

/** Cargas del tanque de agua de Charmy. Cada toque gasta una; un lago lo llena. */
export const TANQUE = 10;
/** Lo que se gasta de más por apagar un foco de confianza baja sin verificarlo. */
export const AGUA_SIN_VERIFICAR = 1;
/** El avión hidrante apaga los focos a esta distancia (en píxeles del lienzo) de donde se lanza. */
export const RADIO_AVION = 50;
export const RECARGA_AVION_MS = 15_000;
export const MAX_CORTAFUEGOS = 4;

/** Una herramienta por vestuario de Charmy. */
export const HERRAMIENTAS = ["bombero", "piloto", "cientifica", "guia"] as const;
export type Herramienta = (typeof HERRAMIENTAS)[number];

/** Estado de la partida: las escenas lo dibujan y lo cambian solo con estas funciones. */
export interface Partida {
  marcador: Marcador;
  activos: FocoActivo[];
  agua: number;
  herramienta: Herramienta;
  /** Desde cuándo (reloj de la partida) se puede volver a lanzar el avión. */
  avionListoMs: number;
  cortafuegos: Celda[];
}

export function nuevaPartida(): Partida {
  return { marcador: marcadorInicial(), activos: [], agua: TANQUE, herramienta: "bombero", avionListoMs: 0, cortafuegos: [] };
}

export function encenderFoco(p: Partida, foco: FocoActivo): Partida {
  return { ...p, activos: [...p.activos, foco] };
}

export function elegirHerramienta(p: Partida, herramienta: Herramienta): Partida {
  return { ...p, herramienta };
}

/** Tocar un lago llena el tanque. */
export function recargar(p: Partida): Partida {
  return { ...p, agua: TANQUE };
}

const buscar = (p: Partida, id: number) => p.activos.find((f) => f.id === id);
const sin = (p: Partida, id: number) => p.activos.filter((f) => f.id !== id);
const restar = (puntos: number) => Math.max(0, puntos - PENALIDAD);

/**
 * Un toque con agua a un foco activo: gasta una carga. Una fuente fija no se apaga: tocarla resta puntos y corta el
 * combo. Un foco de confianza baja sin verificar gasta agua de más. Sin agua, o si el foco ya no estaba, nada cambia.
 */
export function golpearFoco(p: Partida, id: number, ahoraMs: number): Partida {
  const foco = buscar(p, id);
  if (!foco || p.agua < 1) return p;
  const m = p.marcador;
  if (foco.fuenteFija) {
    return {
      ...p,
      marcador: { ...m, puntos: restar(m.puntos), combo: 0, fijasTocadas: m.fijasTocadas + 1 },
      activos: sin(p, id),
      agua: p.agua - 1,
    };
  }
  const golpes = foco.golpes - 1;
  let marcador = golpes > 0 ? m : apagar(m, ahoraMs);
  let gasto = 1;
  if (foco.confianza === "low" && !foco.verificado) {
    marcador = { ...marcador, sinVerificar: marcador.sinVerificar + 1 };
    gasto += AGUA_SIN_VERIFICAR;
  }
  const activos = golpes > 0 ? p.activos.map((f) => (f.id === id ? { ...f, golpes } : f)) : sin(p, id);
  return { ...p, marcador, activos, agua: Math.max(0, p.agua - gasto) };
}

/** Verificar un foco de confianza baja: después se apaga sin gastar agua de más. */
export function verificarFoco(p: Partida, id: number): Partida {
  if (!buscar(p, id)) return p;
  return { ...p, activos: p.activos.map((f) => (f.id === id ? { ...f, verificado: true } : f)) };
}

/**
 * Un foco activo que nadie apagó a tiempo corta el combo y hace perder una carga de agua (castigo suave), pero nunca
 * deja el tanque por debajo de la mitad: los escapes solos no te dejan sin agua. Una fuente fija que se deja no castiga.
 */
export function escaparFoco(p: Partida, id: number): Partida {
  const foco = buscar(p, id);
  if (!foco) return p;
  if (foco.fuenteFija) return { ...p, activos: sin(p, id) };
  const piso = Math.min(p.agua, Math.ceil(TANQUE / 2));
  return { ...p, marcador: dejarEscapar(p.marcador), activos: sin(p, id), agua: Math.max(piso, p.agua - 1) };
}

/**
 * El avión hidrante (piloto): apaga todos los focos de la zona, menos las fuentes fijas, sin gastar el tanque.
 * Después necesita RECARGA_AVION_MS para volver a salir; antes de eso, nada cambia.
 */
export function lanzarAvion(p: Partida, x: number, y: number, ahoraMs: number): Partida {
  if (ahoraMs < p.avionListoMs) return p;
  const enZona = (f: FocoActivo) => !f.fuenteFija && Math.hypot(f.x - x, f.y - y) <= RADIO_AVION;
  const apagados = p.activos.filter(enZona);
  return {
    ...p,
    marcador: apagados.reduce((m) => apagar(m, ahoraMs), p.marcador),
    activos: p.activos.filter((f) => !enZona(f)),
    avionListoMs: ahoraMs + RECARGA_AVION_MS,
  };
}

/** Un cortafuegos (guía) en una celda: el fuego no se propaga ahí. Como mucho MAX_CORTAFUEGOS; se va el más viejo. */
export function ponerCortafuegos(p: Partida, celda: Celda): Partida {
  if (p.cortafuegos.some((c) => c.col === celda.col && c.fila === celda.fila)) return p;
  return { ...p, cortafuegos: [...p.cortafuegos, celda].slice(-MAX_CORTAFUEGOS) };
}

/**
 * Tocar un foco con la herramienta elegida: el bombero lo golpea con agua, la científica lo verifica y el piloto
 * lanza el avión sobre él. La guía no actúa sobre el foco: la escena usa ese toque como un toque en el mapa.
 */
export function tocarFoco(p: Partida, id: number, ahoraMs: number): Partida {
  const foco = buscar(p, id);
  if (!foco) return p;
  switch (p.herramienta) {
    case "bombero":
      return golpearFoco(p, id, ahoraMs);
    case "cientifica":
      return verificarFoco(p, id);
    case "piloto":
      return lanzarAvion(p, foco.x, foco.y, ahoraMs);
    case "guia":
      return p;
  }
}
