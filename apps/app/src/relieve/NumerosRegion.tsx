import { useMemo } from "react";
import { anioContraLoNormal, resumenCalendario } from "@/calendario/estadisticas";
import { MESES_LARGOS } from "@/calendario/grilla";
import { Temporada } from "@/calendario/ResumenCalendario";
import { type Indicador, Indicadores } from "@/components/Indicadores";
import { useCalendarioRegion } from "./consultas";

/** Por debajo de esta diferencia, el año se dice «parecido» a los anteriores: no se exagera un cambio chico. */
const PARECIDO = 10;

function comparacionAnio(acumulado: number, promedio: number): string {
  if (promedio === 0) return acumulado > 0 ? "Más que otros años" : "Igual que otros años";
  const diferencia = Math.round((acumulado / promedio - 1) * 100);
  if (Math.abs(diferencia) < PARECIDO) return "Parecido a otros años";
  return `${diferencia > 0 ? "+" : "−"}${Math.abs(diferencia).toLocaleString("es-AR")} %`;
}

/**
 * «En números» de la ficha de provincia (F4-D5): puesto en el ranking, este año contra los anteriores y la temporada.
 * El calendario de la región es la misma consulta que el calendario plegado; si falla, solo esa parte lo dice.
 */
export function NumerosRegion({
  region,
  posicion,
  total,
  conHistorial,
}: {
  region: string;
  /** Lugar en el ranking por focos, desde 0; -1 si no tiene focos. */
  posicion: number;
  total: number;
  conHistorial: boolean;
}) {
  const calendario = useCalendarioRegion(conHistorial ? region : null);
  const celdas = useMemo(() => calendario.data?.cells ?? [], [calendario.data]);
  const anio = useMemo(() => anioContraLoNormal(celdas), [celdas]);
  const resumen = useMemo(() => resumenCalendario(celdas), [celdas]);

  const items: Indicador[] = [
    {
      nombre: "Puesto por focos",
      valor: posicion >= 0 ? `${posicion + 1}.º de ${total}` : "Sin focos",
      detalle: posicion >= 0 ? "en los últimos días" : undefined,
    },
  ];
  if (anio) {
    const contra = anio.desde === anio.hasta ? `${anio.desde}` : `el promedio de ${anio.desde} a ${anio.hasta}`;
    items.push({
      nombre: `Año ${anio.anio}`,
      valor: comparacionAnio(anio.acumulado, anio.promedio),
      detalle: `hasta ${MESES_LARGOS[anio.hastaMes - 1]}, contra ${contra}`,
    });
  }

  return (
    <section aria-labelledby={`numeros-${region}`} className="tema-relieve flex flex-col gap-3 border-t border-white/10 pt-3">
      <h3 id={`numeros-${region}`} className="text-[11.5px] uppercase tracking-wider text-white/50">
        En números
      </h3>
      <Indicadores items={items} />
      {conHistorial && calendario.isPending && <p className="text-xs text-white/55">Cargando la comparación con otros años…</p>}
      {conHistorial && calendario.isError && (
        <p className="text-xs text-white/55">La comparación con otros años no está disponible ahora. El resto de la ficha sigue andando.</p>
      )}
      {celdas.length > 0 && <Temporada temporada={resumen.temporada} mesMasActivo={resumen.mesMasActivo} />}
    </section>
  );
}
