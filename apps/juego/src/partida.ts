import type { FocoEnPantalla } from "./datos";

/** Puntos por foco apagado con combo 1. Con combo N suma N veces esto. */
export const PUNTOS_BASE = 10;
/** Tiempo máximo entre dos focos apagados para que el combo siga. */
export const VENTANA_COMBO_MS = 2000;

export interface Marcador {
  puntos: number;
  combo: number;
  mejorCombo: number;
  apagados: number;
  escapados: number;
  ultimoApagadoMs: number | null;
}

export function marcadorInicial(): Marcador {
  return { puntos: 0, combo: 0, mejorCombo: 0, apagados: 0, escapados: 0, ultimoApagadoMs: null };
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

export interface FocoDelNivel extends FocoEnPantalla {
  apareceMs: number;
}

/**
 * Reparte los focos del día a lo largo de la partida en el orden en que los vieron los satélites, a ritmo
 * parejo: las pasadas se agrupan de noche y de tarde, y repartirlas por hora dejaría la pantalla vacía.
 */
export function planDeNivel(focos: FocoEnPantalla[], duracionMs: number): FocoDelNivel[] {
  const ordenados = [...focos].sort((a, b) => a.hora_utc.localeCompare(b.hora_utc));
  const ultimo = ordenados.length - 1;
  return ordenados.map((f, i) => ({ ...f, apareceMs: ultimo === 0 ? 0 : (i / ultimo) * duracionMs }));
}

/** Un foco encendido en la pantalla. */
export interface FocoActivo {
  id: number;
  x: number;
  y: number;
  frp: number;
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

const activo = (p: Partida, id: number) => p.activos.some((f) => f.id === id);
const sin = (p: Partida, id: number) => p.activos.filter((f) => f.id !== id);

/** Apagar un foco activo. Si ya no estaba (se escapó o ya se apagó), nada cambia. */
export function apagarFoco(p: Partida, id: number, ahoraMs: number): Partida {
  return activo(p, id) ? { marcador: apagar(p.marcador, ahoraMs), activos: sin(p, id) } : p;
}

/** Un foco activo que nadie apagó a tiempo. Si ya no estaba, nada cambia. */
export function escaparFoco(p: Partida, id: number): Partida {
  return activo(p, id) ? { marcador: dejarEscapar(p.marcador), activos: sin(p, id) } : p;
}
