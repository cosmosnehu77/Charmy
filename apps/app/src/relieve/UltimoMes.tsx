import { rampaConteo } from "@charmy/ui";
import { useMemo } from "react";
import { useUltimoMes } from "./consultas";
import { localeActual, t, useIdioma } from "./idioma";
import { cajaDeRegion, nombreMes, periodoUltimoMes, type RegionResumen, serieUltimoMes } from "./logica";

const num = (v: number, d = 0) => v.toLocaleString(localeActual(), { minimumFractionDigits: 0, maximumFractionDigits: d });
const fecha = (dia: string) => t(`${Number(dia.slice(8, 10))} de ${nombreMes(Number(dia.slice(5, 7)))}`, `${nombreMes(Number(dia.slice(5, 7)))} ${Number(dia.slice(8, 10))}`);

/**
 * Cómo fluctuaron los focos de la región día por día en los últimos 30 días (F4-D15), con el histórico armonizado.
 * Si /hotspots no responde, lo dice y el resto de la ficha sigue.
 */
export function UltimoMes({ region }: { region: RegionResumen }) {
  useIdioma((s) => s.idioma);
  const hoy = new Date().toISOString().slice(0, 10);
  const caja = useMemo(() => cajaDeRegion(region.geometry), [region.geometry]);
  const { data, isPending, isError } = useUltimoMes(caja, hoy);
  const { desde } = periodoUltimoMes(hoy);
  const serie = useMemo(
    () => (data ? serieUltimoMes(data.features, region.geometry, desde, 30) : null),
    [data, region.geometry, desde],
  );

  let cuerpo;
  if (isError) cuerpo = <p className="text-xs text-white/55">{t("El último mes no está disponible ahora.", "The last month is not available right now.")}</p>;
  else if (isPending || !serie) cuerpo = <p className="text-xs text-white/55">{t("Cargando el último mes…", "Loading the last month…")}</p>;
  else {
    const total = serie.reduce((s, d) => s + d.focos, 0);
    const pico = serie.reduce((a, b) => (b.focos > a.focos ? b : a), serie[0]!);
    const max = Math.max(1, pico.focos);
    const resumen =
      total === 0
        ? t("No hubo focos en estos 30 días.", "There were no hotspots in these 30 days.")
        : t(
            `${num(total)} focos en 30 días, ${num(total / 30, 1)} por día en promedio. El día con más focos fue el ${fecha(pico.dia)} (${num(pico.focos)}).`,
            `${num(total)} hotspots in 30 days, ${num(total / 30, 1)} per day on average. The busiest day was ${fecha(pico.dia)} (${num(pico.focos)}).`,
          );
    cuerpo = (
      <>
        <div className="flex h-16 items-end gap-px" role="img" aria-label={t("Focos por día en los últimos 30 días", "Hotspots per day over the last 30 days")}>
          {serie.map((d) => (
            <span
              key={d.dia}
              title={`${fecha(d.dia)}: ${num(d.focos)}`}
              className={`flex-1 rounded-t-[2px] ${d.focos === 0 ? "bg-white/15" : ""}`}
              style={{
                height: `${d.focos === 0 ? 3 : Math.max(8, (d.focos / max) * 100)}%`,
                background: d.focos === 0 ? undefined : rampaConteo[Math.min(6, 1 + Math.floor(Math.sqrt(d.focos / max) * 5.99))],
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-white/50" aria-hidden="true">
          <span>{fecha(serie[0]!.dia)}</span>
          <span>{fecha(serie[serie.length - 1]!.dia)}</span>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-white/65">{resumen}</p>
        {data?.truncated && (
          <p className="mt-1 text-[11.5px] text-white/45">
            {t("Hubo tantos focos que se cuentan solo los primeros 20.000.", "There were so many hotspots that only the first 20,000 are counted.")}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="border-t border-white/10 pt-3">
      <h3 className="mb-2 text-[11.5px] font-normal uppercase tracking-wider text-white/50">{t("El último mes", "The last month")}</h3>
      {cuerpo}
    </div>
  );
}
