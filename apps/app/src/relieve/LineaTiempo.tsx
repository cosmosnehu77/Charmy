import { Pause, Play } from "lucide-react";
import { useEffect } from "react";
import { useRelieve } from "./estado";
import { t, useIdioma } from "./idioma";
import { diaCorto, type RegionResumen } from "./logica";

/** Línea de tiempo de la región elegida: una barra por día con sus focos; el play los recorre (F4-R1). */
export function LineaTiempo({ region, dias }: { region: RegionResumen; dias: string[] }) {
  useIdioma((s) => s.idioma);
  const { linea, usarLinea } = useRelieve();
  const porDia = region.properties.by_day;

  // Al elegir la región, la línea arranca en el último día.
  useEffect(() => {
    usarLinea({ activa: false, play: false, dia: Math.max(0, dias.length - 1) });
  }, [region.id, dias.length, usarLinea]);

  useEffect(() => {
    if (!linea.play) return;
    const reloj = setInterval(() => {
      const { linea: l } = useRelieve.getState();
      if (l.dia >= dias.length - 1) usarLinea({ play: false });
      else usarLinea({ dia: l.dia + 1 });
    }, 900);
    return () => clearInterval(reloj);
  }, [linea.play, dias.length, usarLinea]);

  if (!porDia || dias.length === 0) return null;
  const max = Math.max(1, ...porDia);
  const dia = dias[linea.dia] ?? dias[dias.length - 1] ?? "";
  const focosDelDia = porDia[linea.dia] ?? 0;
  const reproducir = () => {
    const desdeElPrincipio = !linea.play && linea.dia >= dias.length - 1;
    usarLinea({ activa: true, play: !linea.play, dia: desdeElPrincipio ? 0 : linea.dia });
  };

  return (
    <div
      role="group"
      aria-label={t(`Focos por día en ${region.properties.name}`, `Daily hotspots in ${region.properties.name}`)}
      data-guia="linea"
      className="linea-relieve vidrio-relieve pointer-events-auto absolute left-1/2 top-[76px] z-20 flex w-max max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-4 rounded-full py-[9px] pl-[9px] pr-[22px] md:bottom-[84px] md:top-auto"
    >
      <button
        type="button"
        onClick={reproducir}
        aria-label={linea.play ? t("Pausar", "Pause") : t("Reproducir los días", "Play days")}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-charmy-llama text-tinta shadow-[0_0_18px_var(--charmy-llama)] hover:bg-relieve-brillo"
      >
        {linea.play ? <Pause aria-hidden="true" className="size-3.5 fill-current" /> : <Play aria-hidden="true" className="size-3.5 fill-current" />}
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-4 whitespace-nowrap text-xs text-white/60">
          <span>{t(`Focos en ${region.properties.name}`, `Hotspots in ${region.properties.name}`)}</span>
          <b className="font-semibold text-white" aria-live="polite">
            {linea.activa
              ? `${diaCorto(dia)} · ${focosDelDia} ${focosDelDia === 1 ? t("foco", "hotspot") : t("focos", "hotspots")}`
              : t("Tocá play o un día", "Tap play or a day")}
          </b>
        </div>
        <div className="flex items-end gap-2">
          {dias.map((d, i) => {
            const n = porDia[i] ?? 0;
            const estado = !linea.activa ? "" : i === linea.dia ? "hoy" : i < linea.dia ? "paso" : "";
            return (
              <button
                key={d}
                type="button"
                onClick={() => usarLinea({ activa: true, play: false, dia: i })}
                aria-label={`${diaCorto(d)}: ${n} ${n === 1 ? t("foco", "hotspot") : t("focos", "hotspots")}`}
                aria-pressed={linea.activa && i === linea.dia}
                className="group flex w-[34px] flex-col items-center gap-[3px]"
              >
                <span className="flex h-6 w-full items-end">
                  <i className={`barra-dia ${estado}`} style={{ height: `${n ? Math.max(8, (n / max) * 100) : 4}%` }} />
                </span>
                <small className={`text-[10px] leading-none tabular-nums ${estado === "hoy" ? "font-semibold text-white" : "text-white/45"}`}>
                  {d.slice(8, 10)}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
