import { useMemo } from "react";
import { Indicadores } from "@/components/Indicadores";
import { t, useIdioma } from "@/relieve/idioma";
import { resumenCalendario } from "./estadisticas";
import { type CeldaCalendario, formatear, MESES, MESES_LARGOS } from "./grilla";

/**
 * Estadísticas del calendario: totales del período y la temporada (promedio de cada mes del año).
 * Salen de las mismas celdas que la tabla, que queda como su vista en tabla.
 */
export function ResumenCalendario({ celdas }: { celdas: CeldaCalendario[] }) {
  useIdioma((s) => s.idioma);
  const r = useMemo(() => resumenCalendario(celdas), [celdas]);
  const cuando = (year: number, month: number) => t(`${MESES_LARGOS[month - 1]} de ${year}`, `${MESES_LARGOS[month - 1]} ${year}`);

  const items = [
    {
      nombre: t("Total del período", "Period total"),
      valor: formatear(r.total),
      detalle: t(
        `días de fuego · ${formatear(r.promedioMensual)} por mes`,
        `fire days · ${formatear(r.promedioMensual)} per month`,
      ),
    },
    {
      nombre: t("Mes pico", "Peak month"),
      valor: r.pico ? cuando(r.pico.year, r.pico.month) : t("Sin fuego", "No fire"),
      detalle: r.pico ? formatear(r.pico.value) : undefined,
    },
    {
      nombre: t("Año con más fuego", "Peak fire year"),
      valor: r.anioMayor ? String(r.anioMayor.year) : "—",
      detalle: r.anioMayor ? formatear(r.anioMayor.total) : undefined,
    },
    {
      nombre: t("Meses sobre lo normal", "Months above normal"),
      valor: t(`${r.mesesSobreLoNormal} de ${r.mesesConDato}`, `${r.mesesSobreLoNormal} of ${r.mesesConDato}`),
      detalle: t(
        `percentil ≥ 75 · ${r.mesesBajoLoNormal} bajo el 25`,
        `percentile ≥ 75 · ${r.mesesBajoLoNormal} below 25`,
      ),
    },
  ];

  return (
    <section aria-labelledby="titulo-estadisticas" className="flex flex-col gap-3">
      <h3 id="titulo-estadisticas" className="sr-only">
        {t("Estadísticas del calendario", "Calendar statistics")}
      </h3>
      {/* Va al costado de la grilla en la hoja ancha (F4-D8): dos por fila. */}
      <Indicadores items={items} />
      <Temporada temporada={r.temporada} mesMasActivo={r.mesMasActivo} />
    </section>
  );
}

/** Promedio de cada mes del año, con el mes más activo resaltado. También lo usa la ficha de provincia (F4-D5). */
export function Temporada({ temporada, mesMasActivo }: { temporada: (number | null)[]; mesMasActivo: number | null }) {
  useIdioma((s) => s.idioma);
  const maximo = Math.max(0, ...temporada.map((v) => v ?? 0));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-tinta-suave">
        {mesMasActivo
          ? t(
              `Temporada: en promedio, ${MESES_LARGOS[mesMasActivo - 1]} es el mes con más fuego.`,
              `Season: on average, ${MESES_LARGOS[mesMasActivo - 1]} is the month with the most fire.`,
            )
          : t("Temporada: no hubo fuego en el período.", "Season: there was no fire in the period.")}
      </p>
      <ul aria-label={t("Temporada: promedio de cada mes del año", "Season: average for each month of the year")} className="grid h-16 grid-cols-12 items-end gap-0.5">
        {temporada.map((v, i) => {
          const texto = `${MESES_LARGOS[i]}: ${v === null ? t("sin dato", "no data") : t(`${formatear(v)} en promedio`, `${formatear(v)} on average`)}`;
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
