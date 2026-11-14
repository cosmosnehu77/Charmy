/**
 * Conclusión del área en lenguaje simple para el modo novato (RF-MOD-01): sin siglas ni percentiles.
 * Usa el mismo calendario que la tabla.
 */
import { comparacionSimple, MESES_LARGOS, type RespuestaCalendario } from "@/calendario/grilla";

export function conclusionDelArea(cal: RespuestaCalendario): string {
  if (cal.cells.length === 0) return cal.message ?? "Todavía no hay datos de fuego para esta zona.";

  const orden = (c: RespuestaCalendario["cells"][number]) => c.year * 100 + c.month;
  const ultimo = cal.cells.reduce((a, b) => (orden(b) > orden(a) ? b : a));
  const pico = cal.cells.reduce((a, b) => (b.value > a.value ? b : a));
  const cuando = (c: typeof ultimo) => `${MESES_LARGOS[c.month - 1]} de ${c.year}`;

  const comparacion = `hubo ${comparacionSimple(ultimo.percentile)}`;
  const frases = [
    `En ${cuando(ultimo)} ${comparacion} en esta zona, comparado con el mismo mes de otros años.`,
    `El mes con más fuego del período fue ${cuando(pico)}.`,
  ];
  if (cal.provisional) frases.push("Ojo: por ahora son datos de ejemplo, no resultados.");
  return frases.join(" ");
}
