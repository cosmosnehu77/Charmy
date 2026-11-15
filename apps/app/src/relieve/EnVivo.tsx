import { MapPin, X } from "lucide-react";
import { urlGoogleMaps, urlGoogleMapsEmbed } from "@/lib/enlaces";
import { useEvidencia } from "@/vivo/consultas";
import { useVivo } from "@/vivo/estado";
import { SATELITES_VIVO } from "@/vivo/satelites";
import { ETIQUETAS_EVIDENCIA, TIPOS_EVIDENCIA, veredicto } from "@/vivo/veredictos";
import type { FocoReciente } from "./datos";
import { ComparacionVivo, EstadisticasVivo } from "./ResumenVivo";
import { useRelieve } from "./estado";
import { colorFoco, focosVivoVisibles, hace, type NivelFoco, nivelFoco, radioFoco, type RegionResumen } from "./logica";

const num = (v: number, d = 0) => v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const SATELITES: Record<string, string> = { N20: "NOAA-20", N21: "NOAA-21", Terra: "Terra (MODIS)", Aqua: "Aqua (MODIS)" };
const CONFIANZA: Record<string, string> = { low: "baja", nominal: "nominal", high: "alta" };
/** La lista es la alternativa accesible al mapa (RNF-04): más de esto no se puede recorrer. */
const MAXIMO_LISTA = 50;
const horaArgentina = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Argentina/Buenos_Aires",
});

interface Props {
  focos: FocoReciente[];
  regiones: RegionResumen[];
  disponible: boolean;
  mensaje?: string;
}

/**
 * Panel de En vivo: cuántos focos hay, la ventana de tiempo, los satélites, la leyenda de tamaños y los más intensos.
 * `focos` llega ya filtrado por satélite.
 */
export function PanelEnVivo({ focos, disponible, mensaje, regiones }: Props) {
  const { horasVivo, nivelesVivo, focoVivo, cambiar } = useRelieve();
  const { satelites, cambiar: cambiarVivo } = useVivo();
  const alternarSatelite = (codigo: string, si: boolean) => {
    cambiarVivo({ satelites: si ? [...satelites, codigo] : satelites.filter((c) => c !== codigo) });
    cambiar({ focoVivo: null });
  };
  const ultimo = focos.reduce((m, f) => Math.max(m, f.t), 0);
  const visibles = focosVivoVisibles(focos, horasVivo, nivelesVivo);
  const alternarNivel = (n: NivelFoco) =>
    cambiar({
      nivelesVivo: nivelesVivo.includes(n) ? nivelesVivo.filter((x) => x !== n) : [...nivelesVivo, n],
      focoVivo: null,
    });
  const nombre = (id: string | null) => regiones.find((r) => r.id === id)?.properties.name ?? "Fuera de las regiones";
  const masIntensos = [...visibles].sort((a, b) => b.frp - a.frp).slice(0, 5);
  const masNuevos = [...visibles].sort((a, b) => b.t - a.t);
  const fecha = ultimo ? new Date(ultimo).toISOString() : "";

  return (
    // Con las estadísticas el panel crece: se desplaza adentro para no tapar el aviso de emergencias.
    <aside
      aria-label="Resumen en vivo"
      className="vidrio-relieve scroll-relieve pointer-events-auto absolute left-3 top-[76px] z-20 max-h-[calc(100dvh-140px)] w-[min(270px,calc(100%-24px))] overflow-y-auto rounded-2xl px-4 py-3.5 text-white"
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
          <ComparacionVivo focos={focos} ultimo={ultimo} horas={horasVivo} niveles={nivelesVivo} />
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
          {/* Como el filtro por satélite de FIRMS (#261): solo los que publican en vivo (D-13). */}
          <div role="group" aria-label="Satélites" className="mt-2 flex gap-1.5">
            {SATELITES_VIVO.map((s) => {
              const elegido = satelites.includes(s.codigo);
              return (
                <label
                  key={s.codigo}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold ring-1 transition ${
                    elegido ? "bg-white/15 text-white ring-relieve-brillo/60" : "text-white/60 ring-white/10 hover:bg-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-relieve-brillo"
                    checked={elegido}
                    onChange={(e) => alternarSatelite(s.codigo, e.target.checked)}
                  />
                  {s.nombre}
                </label>
              );
            })}
          </div>
          {satelites.length === 0 && (
            <p className="mt-2 text-xs text-relieve-brillo">Elegí al menos un satélite para ver los focos.</p>
          )}
          <div className="mt-3.5 border-t border-white/10 pt-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Tamaño = intensidad</h3>
            {/* Cada nivel filtra: se ven solo los niveles elegidos; sin ninguno, todos (#251). */}
            <div role="group" aria-label="Filtrar por intensidad" className="flex items-end justify-between gap-1">
              {(
                [
                  [3, "Bajo", "< 10 MW"],
                  [15, "Fuerte", "10–30 MW"],
                  [60, "Muy fuerte", "≥ 30 MW"],
                ] as const
              ).map(([v, n, r]) => {
                const elegido = nivelesVivo.includes(n);
                const apagado = nivelesVivo.length > 0 && !elegido;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => alternarNivel(n)}
                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center text-[11.5px] transition ${
                      elegido ? "bg-white/15 text-white ring-1 ring-relieve-brillo/60" : "text-white/70 hover:bg-white/10"
                    } ${apagado ? "opacity-45" : ""}`}
                  >
                    <span
                      className="block rounded-full"
                      style={{ width: radioFoco(v) * 2, height: radioFoco(v) * 2, background: colorFoco(v) }}
                    />
                    {n}
                    <br />
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
          <EstadisticasVivo visibles={visibles} nombre={nombre} />
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
          {/* Con teclado o lector de pantalla, los focos se recorren acá; en el mapa solo se tocan (RNF-04). */}
          {visibles.length > 0 && (
            <details className="mt-3.5 border-t border-white/10 pt-3">
              <summary className="cursor-pointer rounded-lg px-1.5 py-1 text-[13px] font-semibold text-white/80 hover:bg-white/10">
                Lista de focos ({num(visibles.length)})
              </summary>
              {visibles.length > MAXIMO_LISTA && (
                <p className="mt-1.5 px-1.5 text-xs text-white/55">
                  Los {MAXIMO_LISTA} más nuevos de {num(visibles.length)}; el mapa los muestra todos.
                </p>
              )}
              <ol aria-label="Focos en vivo" className="scroll-relieve m-0 mt-1.5 flex max-h-36 list-none flex-col gap-0.5 overflow-y-auto p-0 md:max-h-56">
                {masNuevos.slice(0, MAXIMO_LISTA).map((f) => {
                  const v = veredicto(f.veredicto);
                  return (
                    <li key={f.k}>
                      <button
                        type="button"
                        aria-pressed={focoVivo === f.k}
                        onClick={() => cambiar({ focoVivo: f.k })}
                        className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-2 rounded-lg px-1.5 py-1.5 text-left text-[13px] hover:bg-white/10 aria-pressed:bg-white/15"
                      >
                        {/* El color nunca va solo: el veredicto también va en texto. */}
                        <span aria-hidden="true" className="size-[9px] rounded-full ring-1 ring-white/40" style={{ background: v.color }} />
                        <b className="font-semibold">{v.texto}</b>
                        <span className="col-start-2 text-xs text-white/60">
                          {nombre(f.region)} · {horaArgentina.format(f.t)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </details>
          )}
        </>
      )}
    </aside>
  );
}

/** Ficha de un foco en vivo, sola: en En vivo o cuando no hay una provincia abierta. */
export function FichaFoco({ foco, regiones }: { foco: FocoReciente; regiones: RegionResumen[] }) {
  const cambiar = useRelieve((s) => s.cambiar);
  const region = regiones.find((r) => r.id === foco.region);
  return (
    <section
      aria-label="Ficha del foco"
      className="ficha-relieve pointer-events-auto absolute inset-x-3 bottom-3 z-30 flex max-h-[78%] flex-col overflow-hidden rounded-[20px] text-white md:inset-x-auto md:bottom-auto md:right-3 md:top-[76px] md:max-h-[calc(100%-92px)] md:w-[300px]"
    >
      {/* El desplazamiento va adentro: así la barra no rompe el redondeo del panel (#236). */}
      <div className="scroll-relieve overflow-y-auto px-[18px] py-4">
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
        <DetalleFoco foco={foco} />
      </div>
    </section>
  );
}

/**
 * Lo que se sabe de un foco. Va en su propia ficha o dentro de la ficha de su provincia; ahí, en celular, el aviso
 * de emergencias ya está fijo abajo y no se repite.
 */
export function DetalleFoco({ foco, avisoEnCelular = true }: { foco: FocoReciente; avisoEnCelular?: boolean }) {
  const ultimo = new Date();
  return (
    <>
      <div className="mb-1 mt-3 flex items-baseline gap-2">
        <b className="font-titulos text-[40px] font-extrabold leading-none tabular-nums" style={{ color: colorFoco(foco.frp) }}>
          {num(foco.frp, 1)}
        </b>
        <span className="text-[13px] text-white/70">MW · {nivelFoco(foco.frp)}</span>
      </div>
      <Veredicto foco={foco} />
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
      <p
        className={`mt-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-snug text-white/75 ${avisoEnCelular ? "" : "hidden md:block"}`}
      >
        Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
        <strong className="text-relieve-brillo">100</strong> en Argentina o al{" "}
        <strong className="text-relieve-brillo">132</strong> en Chile.
      </p>
    </>
  );
}

/**
 * Veredicto del foco y la evidencia que lo sostiene (RF-VIV-02). El veredicto sale de varias señales, nunca de la IA
 * sola (D-09). Si la evidencia no llega, se dice y el resto de la ficha sigue.
 */
function Veredicto({ foco }: { foco: FocoReciente }) {
  const evidencia = useEvidencia(foco.id);
  const v = veredicto(evidencia.data?.verdict ?? foco.veredicto);
  return (
    <section aria-label="Veredicto" className="mt-3 rounded-xl bg-white/5 px-3 py-2.5 text-[13px]">
      <p className="flex items-center gap-2">
        <i aria-hidden="true" className="size-2.5 rounded-full" style={{ background: v.color }} />
        <strong>{v.texto}</strong>
      </p>
      <p className="mt-1 text-xs leading-snug text-white/60">
        El veredicto combina satélite, fuentes fijas, noticias y reportes. La IA solo ayuda a leer noticias: que no haya
        noticias no vuelve falso un foco.
      </p>
      {evidencia.isPending && <p className="mt-2 text-xs text-white/55">Buscando la evidencia…</p>}
      {evidencia.isError && <p className="mt-2 text-xs text-white/70">La evidencia de este foco no está disponible ahora.</p>}
      {evidencia.isSuccess &&
        (evidencia.data.evidence.length === 0 ? (
          <p className="mt-2 text-xs text-white/55">Todavía no hay evidencia además del satélite.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {evidencia.data.evidence.map((e) => (
              <li key={`${e.kind}-${e.title}`} className="flex flex-col">
                <span className="text-[11px] text-white/50">
                  {TIPOS_EVIDENCIA[e.kind] ?? e.kind} · {ETIQUETAS_EVIDENCIA[e.label] ?? e.label}
                </span>
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-relieve-brillo underline underline-offset-2">
                    {e.title}
                  </a>
                ) : (
                  <span>{e.title}</span>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
