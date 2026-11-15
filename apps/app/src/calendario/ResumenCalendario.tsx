import { useMemo } from "react";
import { Indicadores } from "@/components/Indicadores";
import { localeActual, t, useIdioma } from "@/relieve/idioma";
import { anioContraLoNormal, porAnio, porOrigen, resumenCalendario } from "./estadisticas";
import { type CeldaCalendario, formatear, MESES, MESES_LARGOS, textoOrigen } from "./grilla";

/** «enero de 2026»: el mes y el año de una celda, en palabras. */
export const textoMes = (year: number, month: number) =>
  t(`${MESES_LARGOS[month - 1]} de ${year}`, `${MESES_LARGOS[month - 1]} ${year}`);

/** La frase de la temporada: qué mes del año tiene, en promedio, más fuego. */
export const textoTemporada = (mesMasActivo: number | null) =>
  mesMasActivo
    ? t(
        `Temporada: en promedio, ${MESES_LARGOS[mesMasActivo - 1]} es el mes con más fuego.`,
        `Season: on average, ${MESES_LARGOS[mesMasActivo - 1]} is the month with the most fire.`,
      )
    : t("Temporada: no hubo fuego en el período.", "Season: there was no fire in the period.");

/** Por debajo de esta diferencia, el año se dice «parecido» a los anteriores: no se exagera un cambio chico. */
const PARECIDO = 10;

/** Un año contra el promedio de los anteriores, en porcentaje o en palabras si la diferencia es chica. */
export function textoComparacion(acumulado: number, promedio: number): string {
  if (promedio === 0) return acumulado > 0 ? t("Más que otros años", "More than other years") : t("Igual que otros años", "Same as other years");
  const diferencia = Math.round((acumulado / promedio - 1) * 100);
  if (Math.abs(diferencia) < PARECIDO) return t("Parecido a otros años", "Similar to other years");
  return `${diferencia > 0 ? "+" : "−"}${Math.abs(diferencia).toLocaleString(localeActual())} %`;
}

/**
 * Estadísticas del calendario (F4-R2): la tercera vista, después de Anomalía y Cantidad. Salen de las mismas celdas
 * que la grilla, sin otra consulta: los totales del período, cada año, la temporada y de dónde sale cada mes.
 */
export function ResumenCalendario({ celdas }: { celdas: CeldaCalendario[] }) {
  useIdioma((s) => s.idioma);
  const r = useMemo(() => resumenCalendario(celdas), [celdas]);
  const anio = useMemo(() => anioContraLoNormal(celdas), [celdas]);

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
      valor: r.pico ? textoMes(r.pico.year, r.pico.month) : t("Sin fuego", "No fire"),
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
    anio
      ? {
          nombre: t(`Año ${anio.anio}`, `Year ${anio.anio}`),
          valor: textoComparacion(anio.acumulado, anio.promedio),
          detalle: t(
            `hasta ${MESES_LARGOS[anio.hastaMes - 1]}, contra ${anio.desde === anio.hasta ? anio.desde : `${anio.desde}–${anio.hasta}`}`,
            `through ${MESES_LARGOS[anio.hastaMes - 1]}, vs. ${anio.desde === anio.hasta ? anio.desde : `${anio.desde}–${anio.hasta}`}`,
          ),
        }
      : {
          nombre: t("Contra otros años", "Vs. other years"),
          valor: "—",
          detalle: t("hace falta más de un año", "needs more than one year"),
        },
    {
      nombre: t("Meses sin fuego", "Months without fire"),
      valor: t(`${r.mesesSinFuego} de ${r.mesesConDato}`, `${r.mesesSinFuego} of ${r.mesesConDato}`),
    },
  ];

  return (
    <section aria-labelledby="titulo-estadisticas" className="flex flex-col gap-4">
      <h3 id="titulo-estadisticas" className="sr-only">
        {t("Estadísticas del calendario", "Calendar statistics")}
      </h3>
      {/* Dos por fila en el panel angosto; tres cuando la hoja es ancha. */}
      <Indicadores items={items} className="@2xl:grid-cols-3" />
      <div className="grid gap-4 @2xl:grid-cols-2">
        <Bloque titulo={t("Cada año", "Each year")}>
          <Anios celdas={celdas} />
        </Bloque>
        <div className="flex flex-col gap-4">
          <Bloque titulo={t("Temporada", "Season")}>
            <Temporada temporada={r.temporada} mesMasActivo={r.mesMasActivo} />
          </Bloque>
          <Bloque titulo={t("De dónde sale cada mes", "Where each month comes from")}>
            <Origenes celdas={celdas} />
          </Bloque>
        </div>
      </div>
    </section>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-control bg-superficie-2 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">{titulo}</h4>
      {children}
    </div>
  );
}

/** Total de cada año como barra, con sus meses fuera de lo normal; el año con más fuego, resaltado. */
function Anios({ celdas }: { celdas: CeldaCalendario[] }) {
  const anios = useMemo(() => porAnio(celdas), [celdas]);
  const maximo = Math.max(0, ...anios.map((a) => a.total));
  return (
    <ul aria-label={t("Total de cada año", "Total for each year")} className="flex flex-col gap-1.5">
      {anios.map((a) => {
        const mayor = a.total > 0 && a.total === maximo;
        return (
          <li key={a.year} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-mono font-medium">{a.year}</span>
            <span aria-hidden="true" className="h-2.5 rounded-full bg-white/5">
              <span
                className={`block h-full rounded-full ${mayor ? "bg-acento" : "bg-acento/55"}`}
                style={{ width: maximo ? `${Math.max(2, (a.total / maximo) * 100)}%` : 0 }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums">{formatear(a.total)}</span>
            <span className="col-start-2 col-end-4 text-[11px] text-tinta-suave">
              {t(
                `${a.sobre} sobre lo normal · ${a.bajo} bajo lo normal · ${a.sinFuego} sin fuego · ${a.meses} ${a.meses === 1 ? "mes" : "meses"}`,
                `${a.sobre} above normal · ${a.bajo} below normal · ${a.sinFuego} without fire · ${a.meses} ${a.meses === 1 ? "month" : "months"}`,
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Cuántos meses salen de cada origen: medido por el satélite o convertido a equivalente VIIRS. */
function Origenes({ celdas }: { celdas: CeldaCalendario[] }) {
  const origenes = useMemo(() => porOrigen(celdas), [celdas]);
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {origenes.map((o) => (
        <li key={o.origin} className="flex justify-between gap-2">
          <span>
            {textoOrigen(o.origin)}: {t(`${o.meses} ${o.meses === 1 ? "mes" : "meses"}`, `${o.meses} ${o.meses === 1 ? "month" : "months"}`)}
          </span>
          <span className="tabular-nums text-tinta-suave">{Math.round((o.meses / celdas.length) * 100)} %</span>
        </li>
      ))}
    </ul>
  );
}

/** Promedio de cada mes del año, con el mes más activo resaltado. También lo usa la ficha de provincia (F4-D5). */
export function Temporada({ temporada, mesMasActivo }: { temporada: (number | null)[]; mesMasActivo: number | null }) {
  useIdioma((s) => s.idioma);
  const maximo = Math.max(0, ...temporada.map((v) => v ?? 0));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-tinta-suave">{textoTemporada(mesMasActivo)}</p>
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
