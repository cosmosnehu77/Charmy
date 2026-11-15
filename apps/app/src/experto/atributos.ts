/** Atributos originales de un foco para el modo experto (RF-MOD-02), con nombres claros. */
import type { components } from "@charmy/contracts-api";
import { localeActual, t } from "@/relieve/idioma";

type PropiedadesFoco = components["schemas"]["Hotspot"]["properties"] & { cell_id?: string };

const SATELITES: Record<string, string> = {
  Terra: "Terra",
  Aqua: "Aqua",
  N: "S-NPP",
  N20: "NOAA-20",
  N21: "NOAA-21",
};

export function atributosFoco(p: PropiedadesFoco): [string, string][] {
  const decimal = new Intl.NumberFormat(localeActual(), { maximumFractionDigits: 1 });
  const filas: [string, string][] = [
    [t("Fecha y hora (UTC)", "Date and time (UTC)"), p.acq_datetime.replace("T", " ").slice(0, 16)],
    [t("Satélite", "Satellite"), `${SATELITES[p.satellite] ?? p.satellite} (${p.instrument})`],
    [t("Confianza", "Confidence"), p.confidence],
    [t("Potencia radiativa (FRP)", "Radiative power (FRP)"), p.frp == null ? t("sin dato", "no data") : `${decimal.format(p.frp)} MW`],
    [t("Momento", "Time of day"), p.daynight === "D" ? t("día", "day") : t("noche", "night")],
  ];
  if (p.cell_id) filas.push([t("Celda de 0,1°", "0.1° cell"), p.cell_id]);
  if (p.fixed_source !== undefined) filas.push([t("Fuente fija", "Fixed source"), p.fixed_source ? t("sí", "yes") : "no"]);
  if (p.verdict) filas.push([t("Veredicto", "Verdict"), p.verdict.replace("_", " ")]);
  return filas;
}
