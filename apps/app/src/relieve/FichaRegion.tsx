import { Charmy } from "@charmy/charmy";
import { rampaConteo } from "@charmy/ui";
import { ArrowLeft, X } from "lucide-react";
import { useCalendarioRegion } from "./consultas";
import type { FocoReciente } from "./datos";
import { DetalleFoco } from "./EnVivo";
import { NumerosRegion } from "./NumerosRegion";
import { indicadorDe, useRelieve } from "./estado";
import { UltimoMes } from "./UltimoMes";
import { enIngles, localeActual, t, useIdioma } from "./idioma";
import {
  comparacionPrediccion,
  mesSiguiente,
  nivelPercentil,
  nivelRegion,
  nombreMes,
  textoLoNormal,
  porQuePrediccion,
  rankingRegiones,
  type RegionResumen,
  textoPrediccion,
} from "./logica";
import { PrediccionMeses } from "./PrediccionMeses";

const num = (v: number, d = 0) => v.toLocaleString(localeActual(), { minimumFractionDigits: d, maximumFractionDigits: d });
const TONOS = { alto: "nivel-alto", medio: "nivel-medio", bajo: "nivel-bajo", cero: "nivel-cero" } as const;

/**
 * Ficha simple de una provincia o región: estado, un número grande, dos datos explicados y el calendario plegado.
 * Si se elige uno de sus focos, la misma ficha muestra el foco, con una flecha para volver (#236).
 */
export function FichaRegion({
  region,
  regiones,
  foco,
}: {
  region: RegionResumen;
  regiones: RegionResumen[];
  foco?: FocoReciente;
}) {
  useIdioma((s) => s.idioma);
  const alternarRegion = useRelieve((s) => s.alternarRegion);
  const cambiar = useRelieve((s) => s.cambiar);
  const enPrediccion = useRelieve((s) => indicadorDe(s.pestana) === "prediccion");
  const p = region.properties;
  const posicion = rankingRegiones(regiones, "focos", 39).findIndex((r) => r.id === region.id);
  const ultimo = p.last_month;
  // Como el mapa en Focos (#373): el número grande y el nivel son del último mes cerrado.
  const nivel = nivelRegion(ultimo?.value ?? null, posicion);
  const dice = ultimo
    ? t(
        `En ${nombreMes(ultimo.month)} hubo ${num(ultimo.value, 1)} días de fuego acá. Está ${nivelPercentil(ultimo.percentile ?? 50)}.`,
        `In ${nombreMes(ultimo.month)} there were ${num(ultimo.value, 1)} fire days here. That is ${nivelPercentil(ultimo.percentile ?? 50)}.`,
      )
    : p.hotspots
      ? t(
          `En los últimos días hubo ${num(p.hotspots)} focos acá. Mirá el mapa para ver dónde.`,
          `In recent days there were ${num(p.hotspots)} hotspots here. Check the map to see where.`,
        )
      : p.hotspots === 0
        ? t("En los últimos días no hubo focos acá.", "There were no hotspots here in recent days.")
        : t(
            "Los focos recientes no están disponibles ahora. El resto de la ficha sigue andando.",
            "Recent hotspots are not available right now. The rest of the card keeps working.",
          );
  const mes = ultimo ? nombreMes(ultimo.month) : "";
  const loNormal = ultimo ? textoLoNormal(ultimo) : null;

  return (
    <section
      aria-label={t(`Ficha de ${p.name}`, `Card for ${p.name}`)}
      data-guia="ficha"
      className="ficha-relieve pointer-events-auto absolute inset-x-2 bottom-(--relieve-pie) z-30 flex max-h-[52%] flex-col overflow-hidden rounded-[20px] text-white md:inset-x-auto md:bottom-4 md:right-4 md:top-24 md:max-h-none md:w-[380px]"
    >
      {/* El desplazamiento va adentro: así la barra no rompe el redondeo del panel. */}
      <div className="scroll-relieve flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-relieve-panel/95 px-5 pb-2.5 pt-4">
          <div className="flex min-w-0 items-start gap-2.5">
            {foco && (
              <button
                type="button"
                onClick={() => cambiar({ focoVivo: null })}
                aria-label={t(`Volver a ${p.name}`, `Back to ${p.name}`)}
                className="mt-1 grid size-[34px] shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
              </button>
            )}
            <div className="min-w-0">
              <span className="block text-xs text-white/55">{foco ? t(`Foco en ${p.name}`, `Hotspot in ${p.name}`) : p.country}</span>
              <h2 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">{foco ? t("Foco de calor", "Thermal hotspot") : p.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alternarRegion(null)}
            aria-label={t("Cerrar la ficha", "Close card")}
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>
        {foco ? (
          <div className="px-5 pb-5">
            <DetalleFoco foco={foco} avisoEnCelular={false} />
          </div>
        ) : enPrediccion ? (
          <FichaPrediccion region={region} />
        ) : (
          <div className="flex flex-col gap-4 px-5 pb-5 pt-1">
            <span className={`nivel-relieve ${TONOS[nivel.tono]}`}>{nivel.texto}</span>
            <div className="flex items-center gap-3.5">
              <b className="font-titulos text-[56px] font-extrabold leading-[.9] tracking-tight text-relieve-brillo tabular-nums">
                {ultimo ? num(ultimo.value, 1) : "—"}
              </b>
              <span className="text-sm leading-snug text-white/75">
                {t("días de fuego", "fire days")}
                <br />
                {ultimo ? t(`en ${mes}`, `in ${mes}`) : t("sin historial", "no history")}
              </span>
            </div>
            <dl className="m-0 flex flex-col">
              <div className="border-t border-white/10 py-3">
                <dt className="mb-1 text-[11.5px] uppercase tracking-wider text-white/50">{t("Intensidad total", "Total intensity")}</dt>
                <dd className="m-0 flex flex-col gap-1">
                  <b className="text-base font-semibold">{p.frp_mw === null || p.frp_mw === undefined ? "—" : `${num(p.frp_mw)} MW`}</b>
                  <small className="text-[12.5px] leading-snug text-white/55">
                    {t(
                      "Cuánta energía liberó el fuego. Más alto, fuego más fuerte.",
                      "How much energy the fire released. Higher means stronger fire.",
                    )}
                  </small>
                </dd>
              </div>
              <div className="border-t border-white/10 py-3">
                <dt className="mb-1 text-[11.5px] uppercase tracking-wider text-white/50">{t("Comparado con lo normal", "Compared to normal")}</dt>
                {ultimo ? (
                  <dd className="m-0 flex flex-col gap-1">
                    <b className="text-base font-semibold">
                      {mes.charAt(0).toUpperCase() + mes.slice(1)} {ultimo.year}: {nivelPercentil(ultimo.percentile ?? 50)}
                    </b>
                    <span className="medidor-relieve" aria-hidden="true">
                      <i style={{ left: `${Math.min(97, Math.max(3, ultimo.percentile ?? 50))}%` }} />
                    </span>
                    <span className="flex justify-between text-[11px] text-white/50" aria-hidden="true">
                      <span>{t("Menos", "Less")}</span>
                      <span>{t("Normal", "Normal")}</span>
                      <span>{t("Más", "More")}</span>
                    </span>
                    {loNormal && <small className="text-[12.5px] leading-snug text-white/55">{loNormal}</small>}
                  </dd>
                ) : (
                  <dd className="m-0 flex flex-col gap-1">
                    <b className="text-base font-semibold">{t("Sin historial para esta región", "No historical baseline for this region")}</b>
                  </dd>
                )}
              </div>
            </dl>
            <UltimoMes region={region} />
            <NumerosRegion region={region.id} posicion={posicion} total={regiones.length} mes={mes} conHistorial={ultimo != null} />
            <div className="flex items-end gap-2">
              <Charmy size={64} mood="explica" outfit="cientifica" decorative className="shrink-0" />
              <p className="mb-3.5 rounded-[14px] rounded-bl-[4px] bg-white/10 px-3 py-2.5 text-[13.5px] leading-snug">{dice}</p>
            </div>
            {ultimo && <CalendarioPlegado region={region.id} />}
            <AvisoFicha />
          </div>
        )}
      </div>
    </section>
  );
}

/** En celular ya se ve el aviso fijo de abajo; en la ficha se repetía. */
function AvisoFicha() {
  return (
            <p className="hidden rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-snug text-white/75 md:block">
              {t(
                <>
                  Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
                  <strong className="text-relieve-brillo">100</strong> en Argentina o al{" "}
                  <strong className="text-relieve-brillo">132</strong> en Chile.
                </>,
                <>
                  Charmy does not replace emergency services. If you see fire, call{" "}
                  <strong className="text-relieve-brillo">100</strong> in Argentina or{" "}
                  <strong className="text-relieve-brillo">132</strong> in Chile.
                </>,
              )}
            </p>
  );
}

const TONO_SENTIDO = { mas: "nivel-alto", igual: "nivel-medio", menos: "nivel-bajo" } as const;

/**
 * Ficha de una provincia en la pestaña Predicción (F4-D15): solo la predicción, sin los focos, la intensidad ni el
 * calendario, que ya están en las otras pestañas. Dice cuánto se espera contra lo habitual, por qué y cómo predice.
 */
function FichaPrediccion({ region }: { region: RegionResumen }) {
  const p = region.properties;
  const m = mesSiguiente(p);
  if (!m || !p.prediccion) {
    return (
      <div className="flex flex-col gap-4 px-5 pb-5 pt-1">
        <p className="text-sm text-white/65">{t("No hay predicción para esta región.", "There is no forecast for this region.")}</p>
        <AvisoFicha />
      </div>
    );
  }
  const { sentido } = comparacionPrediccion(m);
  const mes = nombreMes(Number(m.month.slice(5, 7)));
  const etiqueta =
    sentido === "mas"
      ? t("Más fuego que lo habitual", "More fire than usual")
      : sentido === "menos"
        ? t("Menos fuego que lo habitual", "Less fire than usual")
        : t("Como lo habitual", "About as usual");
  return (
    <div className="flex flex-col gap-4 px-5 pb-5 pt-1">
      <span className={`nivel-relieve ${TONO_SENTIDO[sentido]}`}>{etiqueta}</span>
      <div className="flex items-center gap-3.5">
        <b className="font-titulos text-[56px] font-extrabold leading-[.9] tracking-tight text-relieve-brillo tabular-nums">{num(m.expected_cells, 1)}</b>
        <span className="text-sm leading-snug text-white/75">
          {t("cuadrados con fuego esperados", "squares with fire expected")}
          <br />
          {t(`en ${mes}; lo habitual es ${num(m.usual_cells, 1)}`, `in ${mes}; the usual is ${num(m.usual_cells, 1)}`)}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <Charmy size={64} mood="explica" outfit="cientifica" decorative className="shrink-0" />
        <p className="mb-3.5 rounded-[14px] rounded-bl-[4px] bg-white/10 px-3 py-2.5 text-[13.5px] leading-snug">{porQuePrediccion(m, p.last_month)}</p>
      </div>
      <div className="border-t border-white/10 pt-3">
        <PrediccionMeses meses={p.prediccion} texto={textoPrediccion} />
      </div>
      <details className="calendario-relieve border-t border-white/10 pt-3">
        <summary>{t("Cómo predice Charmy", "How Charmy forecasts")}</summary>
        <div className="mt-2 flex flex-col gap-2 text-[12.5px] leading-snug text-white/70">
          <p>
            {t(
              "Divide el mapa en cuadrados de unos 11 km (0,1°). Para cada una, un modelo de aprendizaje automático (LightGBM) mira el fuego de los últimos tres meses, el del mismo mes del año pasado y cuánto fuego suele haber en ese mes del año.",
              "It splits the map into squares of about 11 km (0.1°). For each one, a machine-learning model (LightGBM) looks at fire in the last three months, in the same month last year and how much fire that month usually has.",
            )}
          </p>
          <p>
            {t(
              "Con eso calcula la probabilidad de fuego en cada cuadrado y las suma por provincia. «Lo habitual» es el promedio de ese mes en los años anteriores.",
              "From that it estimates the chance of fire in each square and adds them up per province. “The usual” is that month’s average in previous years.",
            )}
          </p>
          <p>
            {t(
              `Se probó contra lo habitual en los últimos dos años: para el mes que viene acierta un ${num(m.skill_vs_climatology * 100)} % mejor. No usa el clima: se probó y no mejoraba. Más allá de dos meses es menos seguro y se acerca a lo habitual.`,
              `It was tested against the usual over the last two years: for next month it scores ${num(m.skill_vs_climatology * 100)} % better. It does not use weather: that was tested and did not help. Beyond two months it is less certain and stays close to the usual.`,
            )}
          </p>
        </div>
      </details>
      <AvisoFicha />
    </div>
  );
}

const MESES_ES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_EN = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function CalendarioPlegado({ region }: { region: string }) {
  return (
    <details className="calendario-relieve border-t border-white/10 pt-3">
      <summary>{t("Ver el calendario de quema", "View burn calendar")}</summary>
      <CalendarioRegion region={region} />
    </details>
  );
}

function CalendarioRegion({ region }: { region: string }) {
  const { data, isPending, isError } = useCalendarioRegion(region);
  if (isPending) return <p className="mt-3 text-xs text-white/55">{t("Cargando el calendario…", "Loading calendar…")}</p>;
  if (isError || !data?.cells.length) {
    return <p className="mt-3 text-xs text-white/55">{t("El calendario de esta región no está disponible ahora.", "The calendar for this region is not available right now.")}</p>;
  }
  const max = Math.max(1, ...data.cells.map((c) => c.value));
  const porAnio = new Map<number, (typeof data.cells)[number][]>();
  for (const c of data.cells) porAnio.set(c.year, [...(porAnio.get(c.year) ?? []), c]);
  const anios = [...porAnio.keys()].sort((a, b) => b - a);
  const meses = enIngles() ? MESES_EN : MESES_ES;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[280px] border-separate border-spacing-0.5 font-mono text-[10px] text-white/55 tabular-nums">
        <caption className="sr-only">{t("Calendario de quema por mes, en días de fuego", "Monthly burn calendar, in fire days")}</caption>
        <thead>
          <tr>
            <th />
            {meses.map((m, i) => (
              <th key={i} scope="col" className="font-normal">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {anios.map((a) => (
            <tr key={a}>
              <th scope="row" className="pr-1.5 text-right font-normal">
                {a}
              </th>
              {Array.from({ length: 12 }, (_, i) => {
                const c = porAnio.get(a)?.find((x) => x.month === i + 1);
                if (!c) return <td key={i} />;
                const tr = Math.sqrt(c.value / max);
                const color = rampaConteo[Math.min(6, Math.floor(tr * 7))];
                return (
                  <td
                    key={i}
                    className="h-3 rounded-sm"
                    style={{ background: color }}
                    title={t(
                      `${nombreMes(i + 1)} ${a}: ${num(c.value, 1)} días de fuego${c.percentile != null ? `, percentil ${num(c.percentile)}` : ""}`,
                      `${nombreMes(i + 1)} ${a}: ${num(c.value, 1)} fire days${c.percentile != null ? `, percentile ${num(c.percentile)}` : ""}`,
                    )}
                  >
                    <span className="sr-only">
                      {t(`${nombreMes(i + 1)} ${a}: ${num(c.value, 1)} días de fuego`, `${nombreMes(i + 1)} ${a}: ${num(c.value, 1)} fire days`)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex h-2 overflow-hidden rounded-sm" aria-hidden="true">
        {rampaConteo.map((c) => (
          <i key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-white/50">
        <span>0</span>
        <span>{t(`${num(max)} días de fuego`, `${num(max)} fire days`)}</span>
      </div>
    </div>
  );
}
