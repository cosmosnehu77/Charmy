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
