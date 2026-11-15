import { Charmy } from "@charmy/charmy";
import { rampaConteo } from "@charmy/ui";
import { X } from "lucide-react";
import { useCalendarioRegion } from "./consultas";
import { useRelieve } from "./estado";
import {
  nivelPercentil,
  nivelRegion,
  nombreMes,
  rankingRegiones,
  type RegionResumen,
} from "./logica";

const num = (v: number, d = 0) => v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const TONOS = { alto: "nivel-alto", medio: "nivel-medio", bajo: "nivel-bajo", cero: "nivel-cero" } as const;

/** Ficha simple de una provincia o región: estado, un número grande, dos datos explicados y el calendario plegado. */
export function FichaRegion({ region, regiones }: { region: RegionResumen; regiones: RegionResumen[] }) {
  const alternarRegion = useRelieve((s) => s.alternarRegion);
  const p = region.properties;
  const posicion = rankingRegiones(regiones, "focos", 39).findIndex((r) => r.id === region.id);
  const nivel = nivelRegion(p.hotspots ?? null, posicion);
  const ultimo = p.last_month;
  const dice = ultimo
    ? `En ${nombreMes(ultimo.month)} hubo ${num(ultimo.value, 1)} días-celda con fuego acá. Está ${nivelPercentil(ultimo.percentile ?? 50)}.`
    : p.hotspots
      ? `En los últimos días hubo ${num(p.hotspots)} focos acá. Mirá el mapa para ver dónde.`
      : p.hotspots === 0
        ? "En los últimos días no hubo focos acá."
        : "Los focos recientes no están disponibles ahora. El resto de la ficha sigue andando.";
  const mes = ultimo ? nombreMes(ultimo.month) : "";

  return (
    <section
      aria-label={`Ficha de ${p.name}`}
      data-guia="ficha"
      className="ficha-relieve pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex max-h-[72%] flex-col overflow-y-auto rounded-t-[20px] text-white md:inset-x-auto md:bottom-4 md:right-4 md:top-24 md:max-h-none md:w-[380px] md:rounded-[20px]"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-relieve-panel/95 px-5 pb-2.5 pt-4">
        <div className="min-w-0">
          <span className="block text-xs text-white/55">{p.country}</span>
          <h2 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">{p.name}</h2>
        </div>
        <button
          type="button"
          onClick={() => alternarRegion(null)}
          aria-label="Cerrar la ficha"
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      {/* En celular el aviso de emergencias queda encima del final de la hoja: este espacio deja leer lo último. */}
      <div className="flex flex-col gap-4 px-5 pb-20 pt-1 md:pb-5">
        <span className={`nivel-relieve ${TONOS[nivel.tono]}`}>{nivel.texto}</span>
        <div className="flex items-center gap-3.5">
          <b className="font-titulos text-[56px] font-extrabold leading-[.9] tracking-tight text-relieve-brillo tabular-nums">
            {p.hotspots === null || p.hotspots === undefined ? "—" : num(p.hotspots)}
          </b>
          <span className="text-sm leading-snug text-white/75">
            {p.hotspots === 1 ? "foco de calor" : "focos de calor"}
            <br />
            en los últimos días
          </span>
        </div>
        <dl className="m-0 flex flex-col">
          <div className="border-t border-white/10 py-3">
            <dt className="mb-1 text-[11.5px] uppercase tracking-wider text-white/50">Intensidad total</dt>
            <dd className="m-0 flex flex-col gap-1">
              <b className="text-base font-semibold">{p.frp_mw === null || p.frp_mw === undefined ? "—" : `${num(p.frp_mw)} MW`}</b>
              <small className="text-[12.5px] leading-snug text-white/55">
                Cuánta energía liberó el fuego. Más alto, fuego más fuerte.
              </small>
            </dd>
          </div>
          <div className="border-t border-white/10 py-3">
            <dt className="mb-1 text-[11.5px] uppercase tracking-wider text-white/50">Comparado con lo normal</dt>
            {ultimo ? (
              <dd className="m-0 flex flex-col gap-1">
                <b className="text-base font-semibold">
                  {mes.charAt(0).toUpperCase() + mes.slice(1)} {ultimo.year}: {nivelPercentil(ultimo.percentile ?? 50)}
                </b>
                <span className="medidor-relieve" aria-hidden="true">
                  <i style={{ left: `${Math.min(97, Math.max(3, ultimo.percentile ?? 50))}%` }} />
                </span>
                <span className="flex justify-between text-[11px] text-white/50" aria-hidden="true">
                  <span>Menos</span>
                  <span>Normal</span>
                  <span>Más</span>
                </span>
              </dd>
            ) : (
              <dd className="m-0 flex flex-col gap-1">
                <b className="text-base font-semibold">Sin historial para esta región</b>
              </dd>
            )}
          </div>
        </dl>
        <div className="flex items-end gap-2">
          <Charmy size={64} mood="explica" outfit="cientifica" decorative className="shrink-0" />
          <p className="mb-3.5 rounded-[14px] rounded-bl-[4px] bg-white/10 px-3 py-2.5 text-[13.5px] leading-snug">{dice}</p>
        </div>
        {ultimo && <CalendarioPlegado region={region.id} />}
        {/* En celular ya se ve el aviso fijo de abajo; acá se repetía. */}
        <p className="hidden rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-snug text-white/75 md:block">
          Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
          <strong className="text-relieve-brillo">100</strong> en Argentina o al{" "}
          <strong className="text-relieve-brillo">132</strong> en Chile.
        </p>
      </div>
    </section>
  );
}

const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function CalendarioPlegado({ region }: { region: string }) {
  return (
    <details className="calendario-relieve border-t border-white/10 pt-3">
      <summary>Ver el calendario de quema</summary>
      <CalendarioRegion region={region} />
    </details>
  );
}

function CalendarioRegion({ region }: { region: string }) {
  const { data, isPending, isError } = useCalendarioRegion(region);
  if (isPending) return <p className="mt-3 text-xs text-white/55">Cargando el calendario…</p>;
  if (isError || !data?.cells.length) {
    return <p className="mt-3 text-xs text-white/55">El calendario de esta región no está disponible ahora.</p>;
  }
  const max = Math.max(1, ...data.cells.map((c) => c.value));
  const porAnio = new Map<number, (typeof data.cells)[number][]>();
  for (const c of data.cells) porAnio.set(c.year, [...(porAnio.get(c.year) ?? []), c]);
  const anios = [...porAnio.keys()].sort((a, b) => b - a);
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[280px] border-separate border-spacing-0.5 font-mono text-[10px] text-white/55 tabular-nums">
        <caption className="sr-only">Calendario de quema por mes, en días-celda con fuego</caption>
        <thead>
          <tr>
            <th />
            {MESES.map((m, i) => (
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
                const t = Math.sqrt(c.value / max);
                const color = rampaConteo[Math.min(6, Math.floor(t * 7))];
                return (
                  <td
                    key={i}
                    className="h-3 rounded-sm"
                    style={{ background: color }}
                    title={`${nombreMes(i + 1)} ${a}: ${num(c.value, 1)} días-celda${c.percentile != null ? `, percentil ${num(c.percentile)}` : ""}`}
                  >
                    <span className="sr-only">
                      {nombreMes(i + 1)} {a}: {num(c.value, 1)} días-celda
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
        <span>{num(max)} días-celda</span>
      </div>
    </div>
  );
}
