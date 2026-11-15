/**
 * Estadísticas del panel En vivo (F4-D4): salen de los focos que ya trae /live, con los mismos filtros que el mapa.
 * Sin React, para probarlas solas.
 */
import { VEREDICTOS } from "@/vivo/veredictos";
import type { FocoReciente } from "./datos";
import { enNiveles, type NivelFoco } from "./logica";

const HORA = 3_600_000;
/** /live se pide con hours=48: solo hay ventana anterior completa si la actual dura la mitad o menos. */
const HORAS_PEDIDAS = 48;

/**
 * Focos de la ventana actual (las últimas `horas` hasta el último foco) y de la anterior del mismo largo.
 * null si /live no alcanza para la ventana anterior.
 */
export function compararVentanas(
  focos: FocoReciente[],
  ultimo: number,
  horas: number,
  niveles: NivelFoco[],
): { actual: number; anterior: number } | null {
  if (horas * 2 > HORAS_PEDIDAS) return null;
  const corte = ultimo - horas * HORA;
  const inicio = ultimo - 2 * horas * HORA;
  let actual = 0;
  let anterior = 0;
  for (const f of focos) {
    if (!enNiveles(f.frp, niveles)) continue;
    if (f.t >= corte) actual += 1;
    else if (f.t >= inicio) anterior += 1;
  }
  return { actual, anterior };
}

/** Las regiones con más focos, de más a menos. Los focos fuera de las regiones no cuentan. */
export function regionesConMasFocos(focos: FocoReciente[], tope: number): { region: string; cantidad: number }[] {
  const cuenta = new Map<string, number>();
  for (const f of focos) if (f.region) cuenta.set(f.region, (cuenta.get(f.region) ?? 0) + 1);
  return [...cuenta]
    .map(([region, cantidad]) => ({ region, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, tope);
}

/** Cantidad de focos de cada veredicto (D-09). Un foco recién llegado, sin veredicto, cuenta como «sin confirmar». */
export function porVeredicto(focos: FocoReciente[]): Record<string, number> {
  const cuenta = Object.fromEntries(Object.keys(VEREDICTOS).map((v) => [v, 0]));
  for (const f of focos) {
    const v = f.veredicto && f.veredicto in cuenta ? f.veredicto : "sin_confirmar";
    cuenta[v]! += 1;
  }
  return cuenta;
}
