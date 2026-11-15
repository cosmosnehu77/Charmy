/**
 * Resumen de los focos del área: sale de los focos ya filtrados que muestra el mapa, sin otra consulta.
 * Las fechas se agrupan en UTC, como las da la API.
 */
import type { ColeccionFocos } from "./consulta";

type Foco = ColeccionFocos["features"][number];

export interface ResumenFocos {
  total: number;
  porInstrumento: { MODIS: number; VIIRS: number };
  deNoche: number;
  /** El día (AAAA-MM-DD, UTC) con más focos. */
  diaPico: { fecha: string; cantidad: number } | null;
  diasConFoco: number;
  /** Potencia radiativa en MW; los focos sin FRP no cuentan. */
  frpMax: number | null;
  frpMediana: number | null;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

export function resumenFocos(focos: Foco[]): ResumenFocos {
  const porInstrumento = { MODIS: 0, VIIRS: 0 };
  const porDia = new Map<string, number>();
  const frps: number[] = [];
  let deNoche = 0;
  for (const { properties: p } of focos) {
    porInstrumento[p.instrument] += 1;
    if (p.daynight === "N") deNoche += 1;
    const dia = p.acq_datetime.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    if (p.frp !== null && p.frp !== undefined) frps.push(p.frp);
  }

  let diaPico: ResumenFocos["diaPico"] = null;
  for (const [fecha, cantidad] of porDia) if (!diaPico || cantidad > diaPico.cantidad) diaPico = { fecha, cantidad };

  return {
    total: focos.length,
    porInstrumento,
    deNoche,
    diaPico,
    diasConFoco: porDia.size,
    frpMax: frps.length ? Math.max(...frps) : null,
    frpMediana: mediana(frps),
  };
}
