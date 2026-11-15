import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Tendencia } from "./logica";

const TEXTO: Record<Tendencia, string> = { sube: "en alza", baja: "en baja", estable: "estable" };
const ICONO = { sube: ArrowUpRight, baja: ArrowDownRight, estable: ArrowRight } as const;

/**
 * Minigráfica de los últimos días y flecha de tendencia de una fila del ranking (F4-D6).
 * La gráfica es decorativa; la tendencia también va en texto para los lectores de pantalla.
 */
export function TendenciaRegion({ serie, tendencia }: { serie: number[]; tendencia: Tendencia }) {
  const max = Math.max(1, ...serie);
  const Icono = ICONO[tendencia];
  return (
    <span className="flex items-center gap-1" title={`Últimos días: ${TEXTO[tendencia]}`}>
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
      <span className="sr-only">, {TEXTO[tendencia]}</span>
    </span>
  );
}
