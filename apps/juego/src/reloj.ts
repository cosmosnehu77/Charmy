/** Reloj de la partida: sube al apagar focos y corre más rápido cuantos más focos hay prendidos. */
export const TIEMPO_INICIAL_MS = 60_000;
/** El reloj nunca guarda más que esto. */
export const TIEMPO_MAX_MS = 90_000;
/** Lo que se pierde cuando un foco se escapa. */
export const CASTIGO_ESCAPE_MS = 1500;
/** Cada foco prendido acelera el reloj en esta fracción, hasta RITMO_MAXIMO. */
export const RITMO_POR_FOCO = 0.07;
export const RITMO_MAXIMO = 2.6;
/** Lo que suma cada foco apagado, más un poco por combo (hasta combo 5). */
export const PREMIO_MS = 1000;
export const PREMIO_POR_COMBO_MS = 200;
/** Ganar (apagar todo después de las barridas) multiplica los puntos y paga cada segundo que sobró. */
export const MULTIPLICADOR_VICTORIA = 2;
export const PUNTOS_POR_SEGUNDO_SOBRANTE = 10;

/** A qué velocidad corre el reloj con `prendidos` focos encendidos. */
export const ritmoDelReloj = (prendidos: number) => Math.min(RITMO_MAXIMO, 1 + RITMO_POR_FOCO * Math.max(0, prendidos));

/** Cuánto tiempo suma apagar `apagados` focos con el combo en `combo`. */
export const premioDeTiempo = (apagados: number, combo: number) =>
  Math.max(0, apagados) * (PREMIO_MS + PREMIO_POR_COMBO_MS * Math.min(Math.max(0, combo), 5));

/** Suma tiempo sin pasar del máximo. */
export const sumarTiempo = (tiempoMs: number, extraMs: number) => Math.min(TIEMPO_MAX_MS, tiempoMs + extraMs);

/** Los puntos al ganar: el doble, más PUNTOS_POR_SEGUNDO_SOBRANTE por cada segundo que quedaba. */
export const puntosDeVictoria = (puntos: number, tiempoMs: number) =>
  puntos * MULTIPLICADOR_VICTORIA + Math.round(Math.max(0, tiempoMs) / 1000) * PUNTOS_POR_SEGUNDO_SOBRANTE;
