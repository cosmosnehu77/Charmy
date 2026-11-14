/** Atributos originales de un foco para el modo experto (RF-MOD-02), con nombres claros. */
import type { components } from "@charmy/contracts-api";

type PropiedadesFoco = components["schemas"]["Hotspot"]["properties"] & { cell_id?: string };

const SATELITES: Record<string, string> = {
  Terra: "Terra",
  Aqua: "Aqua",
  N: "S-NPP",
  N20: "NOAA-20",
  N21: "NOAA-21",
};

const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export function atributosFoco(p: PropiedadesFoco): [string, string][] {
  const filas: [string, string][] = [
    ["Fecha y hora (UTC)", p.acq_datetime.replace("T", " ").slice(0, 16)],
    ["Satélite", `${SATELITES[p.satellite] ?? p.satellite} (${p.instrument})`],
    ["Confianza", p.confidence],
    ["Potencia radiativa (FRP)", `${decimal.format(p.frp)} MW`],
    ["Momento", p.daynight === "D" ? "día" : "noche"],
  ];
  if (p.cell_id) filas.push(["Celda de 0,1°", p.cell_id]);
  if (p.fixed_source !== undefined) filas.push(["Fuente fija", p.fixed_source ? "sí" : "no"]);
  if (p.verdict) filas.push(["Veredicto", p.verdict.replace("_", " ")]);
  return filas;
}
