import { MapPin, X } from "lucide-react";
import { urlGoogleMaps, urlGoogleMapsEmbed } from "@/lib/enlaces";
import type { FocoReciente } from "./datos";
import { useRelieve } from "./estado";
import { colorFoco, hace, nivelFoco, radioFoco, type RegionResumen } from "./logica";

const num = (v: number, d = 0) => v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const SATELITES: Record<string, string> = { N20: "NOAA-20", N21: "NOAA-21", Terra: "Terra (MODIS)", Aqua: "Aqua (MODIS)" };
const CONFIANZA: Record<string, string> = { low: "baja", nominal: "nominal", high: "alta" };

interface Props {
  focos: FocoReciente[];
  regiones: RegionResumen[];
  disponible: boolean;
  mensaje?: string;
}

/** Panel de En vivo: cuántos focos hay, la ventana de tiempo, la leyenda de tamaños y los más intensos. */
export function PanelEnVivo({ focos, disponible, mensaje, regiones }: Props) {
  const { horasVivo, cambiar } = useRelieve();
  const ultimo = focos.reduce((m, f) => Math.max(m, f.t), 0);
  const visibles = focos.filter((f) => f.t >= ultimo - horasVivo * 3_600_000);
  const nombre = (id: string | null) => regiones.find((r) => r.id === id)?.properties.name ?? "Fuera de las regiones";
  const masIntensos = [...visibles].sort((a, b) => b.frp - a.frp).slice(0, 5);
  const fecha = ultimo ? new Date(ultimo).toISOString() : "";

  return (
    <aside
      aria-label="Resumen en vivo"
      className="vidrio-relieve pointer-events-auto absolute left-3 top-[76px] z-20 w-[min(270px,calc(100%-24px))] rounded-2xl px-4 py-3.5 text-white"
    >
      <h2 className="flex items-center gap-2 font-titulos text-lg font-bold">
        <i aria-hidden="true" className="punto-vivo" />
        En vivo
      </h2>
      {!disponible ? (
        <p className="mt-2 text-sm text-white/70">{mensaje ?? "Los focos recientes no están disponibles ahora."}</p>
      ) : (
        <>
          <p className="mt-1.5 text-[12.5px] leading-snug text-white/60">
            Focos de calor detectados por satélite
            {fecha && ` hasta el ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} a las ${fecha.slice(11, 16)} UTC`}.
          </p>
          {mensaje && <p className="mt-1.5 text-xs text-relieve-brillo">{mensaje}</p>}
          <div className="mt-3 flex items-baseline gap-2">
            <b className="font-titulos text-[34px] font-extrabold leading-none text-relieve-brillo tabular-nums">
              {num(visibles.length)}
            </b>
            <span className="text-[13px] text-white/70">
              {visibles.length === 1 ? "foco" : "focos"} en las últimas {horasVivo} h
            </span>
          </div>
          <div role="group" aria-label="Ventana de tiempo" className="mt-3 flex gap-1 rounded-full bg-white/5 p-[3px]">
            {([6, 24, 48] as const).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={horasVivo === h}
                onClick={() => cambiar({ horasVivo: h, focoVivo: null })}
                className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${horasVivo === h ? "bg-white text-tinta" : "text-white/65"}`}
              >
                {h} h
              </button>
            ))}
          </div>
          <div className="mt-3.5 border-t border-white/10 pt-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Tamaño = intensidad</h3>
            <div className="flex items-end justify-between gap-2">
              {[
                [3, "Bajo", "< 10 MW"],
                [15, "Fuerte", "10–30 MW"],
                [60, "Muy fuerte", "≥ 30 MW"],
              ].map(([v, n, r]) => (
                <div key={n} className="flex flex-col items-center gap-1.5 text-center text-[11.5px] text-white/70">
                  <span
                    className="block rounded-full"
                    style={{ width: radioFoco(Number(v)) * 2, height: radioFoco(Number(v)) * 2, background: colorFoco(Number(v)) }}
                  />
                  {n}
                  <br />
                  {r}
                </div>
              ))}
            </div>
          </div>
          {masIntensos.length > 0 && (
            <div className="mt-3.5 border-t border-white/10 pt-3">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Más intensos</h3>
              <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
                {masIntensos.map((f) => (
                  <li key={f.k}>
                    <button
                      type="button"
                      onClick={() => cambiar({ focoVivo: f.k })}
                      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[13px] hover:bg-white/10"
                    >
                      <span className="size-[9px] rounded-full" style={{ background: colorFoco(f.frp) }} />
                      <span className="truncate">{nombre(f.region)}</span>
                      <b className="font-semibold tabular-nums text-white/85">{num(f.frp, 1)} MW</b>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

/** Ficha de un foco en vivo. */
export function FichaFoco({ foco, regiones }: { foco: FocoReciente; regiones: RegionResumen[] }) {
  const cambiar = useRelieve((s) => s.cambiar);
  const region = regiones.find((r) => r.id === foco.region);
  const ultimo = new Date();
  return (
    <section
      aria-label="Ficha del foco"
      className="ficha-relieve pointer-events-auto absolute inset-x-3 bottom-3 z-30 max-h-[78%] overflow-y-auto rounded-[18px] px-[18px] py-4 text-white md:inset-x-auto md:bottom-auto md:right-3 md:top-[76px] md:max-h-[calc(100%-92px)] md:w-[300px]"
    >
      <header className="flex items-start justify-between gap-2.5">
        <div>
          <span className="text-xs text-white/55">{region?.properties.country ?? "Fuera de las regiones"}</span>
          <h3 className="mt-0.5 text-xl font-bold leading-tight">{region?.properties.name ?? "Sin región asignada"}</h3>
        </div>
        <button
          type="button"
          onClick={() => cambiar({ focoVivo: null })}
          aria-label="Cerrar la ficha del foco"
          className="grid size-[30px] shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="mb-1 mt-3 flex items-baseline gap-2">
        <b className="font-titulos text-[40px] font-extrabold leading-none tabular-nums" style={{ color: colorFoco(foco.frp) }}>
          {num(foco.frp, 1)}
        </b>
        <span className="text-[13px] text-white/70">MW · {nivelFoco(foco.frp)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[13.5px]">
        <dt className="text-white/55">Detectado</dt>
        <dd className="m-0 text-right font-semibold tabular-nums">
          {foco.acq.slice(8, 10)}/{foco.acq.slice(5, 7)} {foco.acq.slice(11, 16)} UTC
          <span className="block font-normal text-white/60">{hace(ultimo, foco.acq)}</span>
        </dd>
        <dt className="text-white/55">Satélite</dt>
        <dd className="m-0 text-right font-semibold">{SATELITES[foco.satelite] ?? foco.satelite}</dd>
        <dt className="text-white/55">Sensor</dt>
        <dd className="m-0 text-right font-semibold">{foco.instrumento}</dd>
        <dt className="text-white/55">Confianza</dt>
        <dd className="m-0 text-right font-semibold">{CONFIANZA[foco.confianza] ?? foco.confianza}</dd>
        <dt className="text-white/55">Momento</dt>
        <dd className="m-0 text-right font-semibold">{foco.momento === "D" ? "De día" : "De noche"}</dd>
        <dt className="text-white/55">Ubicación</dt>
        <dd className="m-0 flex flex-wrap items-center justify-end gap-1.5 text-right font-semibold tabular-nums">
          <span>
            {num(foco.lat, 3)}, {num(foco.lon, 3)}
          </span>
          <a
            href={urlGoogleMaps(foco.lat, foco.lon)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver ubicación en Google Maps"
            title="Ver ubicación en Google Maps"
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-relieve-brillo hover:bg-white/20"
          >
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span>Google Maps</span>
          </a>
        </dd>
      </dl>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <iframe
          title="Previsualización de la ubicación en Google Maps"
          src={urlGoogleMapsEmbed(foco.lat, foco.lon)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-32 w-full border-0"
        />
      </div>
      <p className="mt-3 text-xs leading-snug text-white/55">
        La intensidad (FRP) es la energía que irradia el fuego. Un foco es calor detectado desde el espacio: puede ser un
        incendio, una quema o una fuente fija.
      </p>
      <p className="mt-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-snug text-white/75">
        Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
        <strong className="text-relieve-brillo">100</strong> en Argentina o al{" "}
        <strong className="text-relieve-brillo">132</strong> en Chile.
      </p>
    </section>
  );
}
