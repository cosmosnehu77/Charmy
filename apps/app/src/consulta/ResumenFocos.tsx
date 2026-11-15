import { useMemo } from "react";
import { type Indicador, Indicadores } from "@/components/Indicadores";
import { MESES } from "@/calendario/grilla";
import { useApp } from "@/estado/app";
import type { ColeccionFocos } from "./consulta";
import { resumenFocos } from "./estadisticas";

const entero = new Intl.NumberFormat("es-AR");
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
/** «29 ene 2024»: corto, para que entre en el indicador. La fecha ya viene en UTC (AAAA-MM-DD). */
const fecha = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]!.toLowerCase()} ${iso.slice(0, 4)}`;
const porcentaje = (parte: number, total: number) => `${Math.round((parte / total) * 100)} %`;

/** Estadísticas de los focos que muestra el mapa (los mismos filtros). La potencia, solo en experto (RF-MOD-01). */
export function ResumenFocos({ focos }: { focos: ColeccionFocos }) {
  const experto = useApp((s) => s.modo === "experto");
  const r = useMemo(() => resumenFocos(focos.features), [focos]);
  if (r.total === 0) return null;

  const items: Indicador[] = [
    {
      nombre: "Día con más focos",
      valor: r.diaPico ? fecha(r.diaPico.fecha) : "—",
      detalle: r.diaPico ? `${entero.format(r.diaPico.cantidad)} focos` : undefined,
    },
    {
      nombre: experto ? "Días con focos" : "Días con fuego",
      valor: entero.format(r.diasConFoco),
      detalle: `${decimal.format(r.total / r.diasConFoco)} focos por día`,
    },
    { nombre: "De noche", valor: porcentaje(r.deNoche, r.total), detalle: `${entero.format(r.deNoche)} de ${entero.format(r.total)}` },
  ];
  if (experto) {
    items.push({
      nombre: "MODIS / VIIRS",
      valor: `${entero.format(r.porInstrumento.MODIS)} / ${entero.format(r.porInstrumento.VIIRS)}`,
    });
    items.push({
      nombre: "Potencia máxima",
      valor: r.frpMax === null ? "—" : `${decimal.format(r.frpMax)} MW`,
      detalle: r.frpMediana === null ? "Sin FRP" : `Mediana ${decimal.format(r.frpMediana)} MW`,
    });
  }

  return (
    <section aria-labelledby="titulo-resumen-focos" className="flex flex-col gap-2">
      <h3 id="titulo-resumen-focos" className="text-sm font-semibold">
        Resumen de los focos
      </h3>
      <Indicadores items={items} />
    </section>
  );
}
