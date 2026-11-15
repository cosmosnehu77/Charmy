/** Récord del jugador en este navegador. */
export const CLAVE_RECORD = "charmy-brigada-record";
/** Clave de cuando el juego se llamaba Charmy Kids: se sigue leyendo para no perder récords anteriores. */
export const CLAVE_RECORD_VIEJA = "charmy-kids-record";

export type Almacen = Pick<Storage, "getItem" | "setItem">;

function leerClave(almacen: Almacen, clave: string): number {
  try {
    return Number(almacen.getItem(clave)) || 0;
  } catch {
    return 0;
  }
}

export function leerRecord(almacen: Almacen): number {
  return Math.max(leerClave(almacen, CLAVE_RECORD), leerClave(almacen, CLAVE_RECORD_VIEJA));
}

export function guardarRecord(almacen: Almacen, puntos: number): void {
  try {
    almacen.setItem(CLAVE_RECORD, String(puntos));
  } catch {
    // Sin almacenamiento el récord dura solo esta visita.
  }
}

/** Las tres mejores partidas de este navegador, con su fecha, para la pantalla final. */
export const CLAVE_MEJORES = "charmy-brigada-mejores";
export const CUANTAS_MEJORES = 3;

/** Una partida guardada: `p` puntos, `t` cuándo (milisegundos desde 1970; 0 si no se sabe). */
export interface Marca {
  p: number;
  t: number;
}

/**
 * Las mejores partidas guardadas. `respaldo` es el récord de antes de que se guardaran: si no hay lista, entra como
 * una marca sin fecha.
 */
export function leerMejores(almacen: Almacen, respaldo = 0): Marca[] {
  try {
    const lista: unknown = JSON.parse(almacen.getItem(CLAVE_MEJORES) ?? "null");
    if (Array.isArray(lista)) {
      return lista
        .filter((x): x is Marca => typeof x === "object" && x !== null && Number.isFinite(x.p) && Number.isFinite(x.t))
        .slice(0, CUANTAS_MEJORES);
    }
  } catch {
    // Un valor roto se trata como si no hubiera lista.
  }
  return respaldo > 0 ? [{ p: respaldo, t: 0 }] : [];
}

/** Suma una partida y deja las mejores, de más a menos puntos; a igual puntaje, la más nueva primero. */
export function sumarMejor(lista: Marca[], p: number, t: number): Marca[] {
  return [...lista, { p, t }].sort((x, y) => y.p - x.p || y.t - x.t).slice(0, CUANTAS_MEJORES);
}

export function guardarMejores(almacen: Almacen, lista: Marca[]): void {
  try {
    almacen.setItem(CLAVE_MEJORES, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento la lista dura solo esta visita.
  }
}

const inicioDelDia = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "Hoy", "Ayer", "Hace 3 días", en la hora local del jugador. Una marca sin fecha queda como "Antes". */
export function cuando(t: number, ahora: number): string {
  if (!t) return "Antes";
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(t)) / 86_400_000);
  return dias <= 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`;
}
