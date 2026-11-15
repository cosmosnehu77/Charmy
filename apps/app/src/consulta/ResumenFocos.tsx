import { useMemo } from "react";
import { type Indicador, Indicadores } from "@/components/Indicadores";
import { MESES } from "@/calendario/grilla";
import { localeActual, t, useIdioma } from "@/relieve/idioma";
import type { ColeccionFocos } from "./consulta";
import { resumenFocos } from "./estadisticas";

/** «29 ene 2024»: corto, para que entre en el indicador. La fecha ya viene en UTC (AAAA-MM-DD). */
const fecha = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]!.toLowerCase()} ${iso.slice(0, 4)}`;
const porcentaje = (parte: number, total: number) => `${Math.round((parte / total) * 100)} %`;

/** Estadísticas de los focos que muestra el mapa (los mismos filtros). */
export function ResumenFocos({ focos }: { focos: ColeccionFocos }) {
  useIdioma((s) => s.idioma);
  const entero = new Intl.NumberFormat(localeActual());
  const decimal = new Intl.NumberFormat(localeActual(), { maximumFractionDigits: 1 });
  const r = useMemo(() => resumenFocos(focos.features), [focos]);
  if (r.total === 0) return null;

  const items: Indicador[] = [
    {
      nombre: t("Día con más focos", "Peak hotspot day"),
      valor: r.diaPico ? fecha(r.diaPico.fecha) : "—",
      detalle: r.diaPico ? t(`${entero.format(r.diaPico.cantidad)} focos`, `${entero.format(r.diaPico.cantidad)} hotspots`) : undefined,
    },
    {
      nombre: t("Días con focos", "Days with hotspots"),
      valor: entero.format(r.diasConFoco),
      detalle: t(
        `${decimal.format(r.total / r.diasConFoco)} focos por día`,
        `${decimal.format(r.total / r.diasConFoco)} hotspots per day`,
      ),
    },
    {
      nombre: t("De noche", "At night"),
      valor: porcentaje(r.deNoche, r.total),
      detalle: t(`${entero.format(r.deNoche)} de ${entero.format(r.total)}`, `${entero.format(r.deNoche)} of ${entero.format(r.total)}`),
    },
    {
      nombre: "MODIS / VIIRS",
      valor: `${entero.format(r.porInstrumento.MODIS)} / ${entero.format(r.porInstrumento.VIIRS)}`,
    },
    {
      nombre: t("Potencia máxima", "Peak power"),
      valor: r.frpMax === null ? "—" : `${decimal.format(r.frpMax)} MW`,
      detalle:
        r.frpMediana === null
          ? t("Sin FRP", "No FRP")
          : t(`Mediana ${decimal.format(r.frpMediana)} MW`, `Median ${decimal.format(r.frpMediana)} MW`),
    },
  ];

  return (
    <section aria-labelledby="titulo-resumen-focos" className="flex flex-col gap-2">
      <h3 id="titulo-resumen-focos" className="text-sm font-semibold">
        {t("Resumen de los focos", "Hotspot summary")}
      </h3>
      <Indicadores items={items} />
    </section>
  );
}
