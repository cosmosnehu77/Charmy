import { useMemo } from "react";
import { Indicadores } from "@/components/Indicadores";
import { resumenCalendario } from "./estadisticas";
import { type CeldaCalendario, formatear, MESES, MESES_LARGOS } from "./grilla";

/**
 * Estadísticas del calendario: totales del período y la temporada (promedio de cada mes del año).
 * Salen de las mismas celdas que la tabla, que queda como su vista en tabla.
 */
export function ResumenCalendario({ celdas }: { celdas: CeldaCalendario[] }) {
  const r = useMemo(() => resumenCalendario(celdas), [celdas]);
  const cuando = (year: number, month: number) => `${MESES_LARGOS[month - 1]} de ${year}`;

  const items = [
    {
      nombre: "Total del período",
      valor: formatear(r.total),
      detalle: `días-celda · ${formatear(r.promedioMensual)} por mes`,
    },
    { nombre: "Mes pico", valor: r.pico ? cuando(r.pico.year, r.pico.month) : "Sin fuego", detalle: r.pico ? formatear(r.pico.value) : undefined },
    { nombre: "Año con más fuego", valor: r.anioMayor ? String(r.anioMayor.year) : "—", detalle: r.anioMayor ? formatear(r.anioMayor.total) : undefined },
    {
      nombre: "Meses sobre lo normal",
      valor: `${r.mesesSobreLoNormal} de ${r.mesesConDato}`,
      detalle: `percentil ≥ 75 · ${r.mesesBajoLoNormal} bajo el 25`,
    },
  ];

  return (
    <section aria-labelledby="titulo-estadisticas" className="flex flex-col gap-3">
      <h3 id="titulo-estadisticas" className="sr-only">
        Estadísticas del calendario
      </h3>
      {/* Va al costado de la grilla en la hoja ancha (F4-D8): dos por fila. */}
      <Indicadores items={items} />
      <Temporada temporada={r.temporada} mesMasActivo={r.mesMasActivo} />
    </section>
  );
}

/** Promedio de cada mes del año, con el mes más activo resaltado. También lo usa la ficha de provincia (F4-D5). */
export function Temporada({ temporada, mesMasActivo }: { temporada: (number | null)[]; mesMasActivo: number | null }) {
  const maximo = Math.max(0, ...temporada.map((v) => v ?? 0));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-tinta-suave">
        {mesMasActivo
          ? `Temporada: en promedio, ${MESES_LARGOS[mesMasActivo - 1]} es el mes con más fuego.`
          : "Temporada: no hubo fuego en el período."}
      </p>
      <ul aria-label="Temporada: promedio de cada mes del año" className="grid h-16 grid-cols-12 items-end gap-0.5">
        {temporada.map((v, i) => {
          const texto = `${MESES_LARGOS[i]}: ${v === null ? "sin dato" : `${formatear(v)} en promedio`}`;
          const alto = v && maximo ? Math.max(4, (v / maximo) * 100) : 0;
          return (
            <li key={MESES[i]} aria-label={texto} title={texto} className="flex h-full flex-col items-stretch justify-end">
              {v === null ? (
                <span className="h-px bg-borde" />
              ) : (
                <span
                  className={`rounded-t-[4px] ${i + 1 === mesMasActivo ? "bg-acento" : "bg-acento/55"}`}
                  style={{ height: `${alto}%`, minHeight: v > 0 ? 2 : 1 }}
                />
              )}
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="grid grid-cols-12 gap-0.5 text-center font-mono text-[10px] text-tinta-suave">
        {MESES.map((m, i) => (
          <span key={i}>{m[0]}</span>
        ))}
      </div>
    </div>
  );
}
