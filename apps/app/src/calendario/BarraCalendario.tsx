import { CalendarDays, ChevronUp } from "lucide-react";
import { useMemo } from "react";
import { t, useIdioma } from "@/relieve/idioma";
import { resumenCalendario } from "./estadisticas";
import { formatear } from "./grilla";
import { textoMes } from "./ResumenCalendario";
import { useCalendario } from "./useCalendario";

/**
 * El calendario de quema minimizado (F4-R2): una barra con el total y el mes pico, para dejar libre el mapa. Tocarla
 * vuelve a abrir la hoja. Usa la misma consulta que el calendario, que ya está en caché.
 */
export function BarraCalendario({ onAbrir }: { onAbrir: () => void }) {
  useIdioma((s) => s.idioma);
  const { consulta } = useCalendario();
  const celdas = consulta.data?.cells;
  const r = useMemo(() => (celdas?.length ? resumenCalendario(celdas) : null), [celdas]);

  return (
    <section aria-label={t("Calendario de quema minimizado", "Burn calendar minimized")} data-guia="calendario">
      <button
        type="button"
        onClick={onAbrir}
        aria-label={t("Abrir el calendario de quema", "Open the burn calendar")}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-charmy-llama" />
        <span className="font-semibold">{t("Calendario de quema", "Burn calendar")}</span>
        {r && (
          <span className="flex min-w-0 flex-wrap gap-x-3 text-xs text-tinta-suave">
            <span className="tabular-nums">
              {formatear(r.total)} {t("días de fuego", "fire days")}
            </span>
            {r.pico && (
              <span>
                {t("pico", "peak")}: {textoMes(r.pico.year, r.pico.month)}
              </span>
            )}
          </span>
        )}
        <span aria-hidden="true" className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-borde px-2.5 py-0.5 text-xs">
          {t("Abrir", "Open")}
          <ChevronUp className="size-3.5" />
        </span>
      </button>
    </section>
  );
}
