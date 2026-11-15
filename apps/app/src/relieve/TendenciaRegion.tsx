import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { t, useIdioma } from "./idioma";
import type { Tendencia } from "./logica";

const ICONO = { sube: ArrowUpRight, baja: ArrowDownRight, estable: ArrowRight } as const;

function textoTendencia(tendencia: Tendencia): string {
  if (tendencia === "sube") return t("en alza", "rising");
  if (tendencia === "baja") return t("en baja", "falling");
  return t("estable", "stable");
}

/**
 * Minigráfica de los últimos días y flecha de tendencia de una fila del ranking (F4-D6).
 * La gráfica es decorativa; la tendencia también va en texto para los lectores de pantalla.
 */
export function TendenciaRegion({ serie, tendencia }: { serie: number[]; tendencia: Tendencia }) {
  useIdioma((s) => s.idioma);
  const max = Math.max(1, ...serie);
  const Icono = ICONO[tendencia];
  const txt = textoTendencia(tendencia);
  return (
    <span className="flex items-center gap-1" title={`${t("Últimos días", "Recent days")}: ${txt}`}>
      <span aria-hidden="true" className="flex h-3.5 w-8 items-end gap-px">
        {serie.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-[2px] bg-white/35 last:bg-white/20"
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </span>
      <Icono aria-hidden="true" className="size-3.5 text-white/70" />
      <span className="sr-only">, {txt}</span>
    </span>
  );
}
