import { MapPin, X } from "lucide-react";
import { urlGoogleMaps, urlGoogleMapsEmbed } from "@/lib/enlaces";
import { useEvidencia } from "@/vivo/consultas";
import { useVivo } from "@/vivo/estado";
import { SATELITES_VIVO } from "@/vivo/satelites";
import { ETIQUETAS_EVIDENCIA, TIPOS_EVIDENCIA, veredicto } from "@/vivo/veredictos";
import type { FocoReciente } from "./datos";
import { ComparacionVivo, EstadisticasVivo } from "./ResumenVivo";
import { useRelieve } from "./estado";
import { localeActual, t, useIdioma } from "./idioma";
import { colorFoco, etiquetaNivelFoco, focosVivoVisibles, hace, type NivelFoco, nivelFoco, radioFoco, type RegionResumen } from "./logica";

const num = (v: number, d = 0) => v.toLocaleString(localeActual(), { minimumFractionDigits: d, maximumFractionDigits: d });
const SATELITES: Record<string, string> = { N20: "NOAA-20", N21: "NOAA-21", Terra: "Terra (MODIS)", Aqua: "Aqua (MODIS)" };
function textoConfianza(c: string): string {
  if (c === "low") return t("baja", "low");
  if (c === "high") return t("alta", "high");
  if (c === "nominal") return t("nominal", "nominal");
  return c;
}
/** La lista es la alternativa accesible al mapa (RNF-04): más de esto no se puede recorrer. */
const MAXIMO_LISTA = 50;
function formatearHoraArgentina(ts: number): string {
  return new Intl.DateTimeFormat(localeActual(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(ts);
}

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
  useIdioma((s) => s.idioma);
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
  const nombre = (id: string | null) =>
    regiones.find((r) => r.id === id)?.properties.name ?? t("Fuera de las regiones", "Outside regions");
  const masIntensos = [...visibles].sort((a, b) => b.frp - a.frp).slice(0, 5);
  const masNuevos = [...visibles].sort((a, b) => b.t - a.t);
  const fecha = ultimo ? new Date(ultimo).toISOString() : "";

  return (
    // Con las estadísticas el panel crece: se desplaza adentro para no tapar el aviso de emergencias.
    <aside
      aria-label={t("Resumen en vivo", "Live summary")}
      className="vidrio-relieve scroll-relieve pointer-events-auto absolute left-3 top-[76px] z-20 max-h-[calc(100dvh-140px)] w-[min(270px,calc(100%-24px))] overflow-y-auto rounded-2xl px-4 py-3.5 text-white"
    >
      <h2 className="flex items-center gap-2 font-titulos text-lg font-bold">
        <i aria-hidden="true" className="punto-vivo" />
        {t("En vivo", "Live")}
      </h2>
      {!disponible ? (
        <p className="mt-2 text-sm text-white/70">
          {mensaje ?? t("Los focos recientes no están disponibles ahora.", "Recent hotspots are not available right now.")}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[12.5px] leading-snug text-white/60">
            {t("Focos de calor detectados por satélite", "Thermal hotspots detected by satellite")}
            {fecha &&
              t(
                ` hasta el ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} a las ${fecha.slice(11, 16)} UTC`,
                ` through ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} at ${fecha.slice(11, 16)} UTC`,
              )}
            .
          </p>
          {mensaje && <p className="mt-1.5 text-xs text-relieve-brillo">{mensaje}</p>}
          <div className="mt-3 flex items-baseline gap-2">
            <b className="font-titulos text-[34px] font-extrabold leading-none text-relieve-brillo tabular-nums">
              {num(visibles.length)}
            </b>
            <span className="text-[13px] text-white/70">
              {t(
                `${visibles.length === 1 ? "foco" : "focos"} en las últimas ${horasVivo} h`,
                `${visibles.length === 1 ? "hotspot" : "hotspots"} in the last ${horasVivo} h`,
              )}
            </span>
          </div>
          <ComparacionVivo focos={focos} ultimo={ultimo} horas={horasVivo} niveles={nivelesVivo} />
          <div role="group" aria-label={t("Ventana de tiempo", "Time window")} className="mt-3 flex gap-1 rounded-full bg-white/5 p-[3px]">
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
          <div role="group" aria-label={t("Satélites", "Satellites")} className="mt-2 flex gap-1.5">
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
            <p className="mt-2 text-xs text-relieve-brillo">
              {t("Elegí al menos un satélite para ver los focos.", "Select at least one satellite to view hotspots.")}
            </p>
          )}
          <div className="mt-3.5 border-t border-white/10 pt-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              {t("Tamaño = intensidad", "Size = intensity")}
            </h3>
            {/* Cada nivel filtra: se ven solo los niveles elegidos; sin ninguno, todos (#251). */}
            <div role="group" aria-label={t("Filtrar por intensidad", "Filter by intensity")} className="flex items-end justify-between gap-1">
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
                    {etiquetaNivelFoco(n)}
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
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">{t("Más intensos", "Most intense")}</h3>
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
                {t("Lista de focos", "Hotspot list")} ({num(visibles.length)})
              </summary>
              {visibles.length > MAXIMO_LISTA && (
                <p className="mt-1.5 px-1.5 text-xs text-white/55">
                  {t(
                    `Los ${MAXIMO_LISTA} más nuevos de ${num(visibles.length)}; el mapa los muestra todos.`,
                    `Newest ${MAXIMO_LISTA} of ${num(visibles.length)}; the map shows all of them.`,
                  )}
                </p>
              )}
              <ol aria-label={t("Focos en vivo", "Live hotspots")} className="scroll-relieve m-0 mt-1.5 flex max-h-36 list-none flex-col gap-0.5 overflow-y-auto p-0 md:max-h-56">
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
                          {nombre(f.region)} · {formatearHoraArgentina(f.t)}
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
  useIdioma((s) => s.idioma);
  const cambiar = useRelieve((s) => s.cambiar);
  const region = regiones.find((r) => r.id === foco.region);
  return (
    <section
      aria-label={t("Ficha del foco", "Hotspot card")}
      className="ficha-relieve pointer-events-auto absolute inset-x-3 bottom-3 z-30 flex max-h-[78%] flex-col overflow-hidden rounded-[20px] text-white md:inset-x-auto md:bottom-auto md:right-3 md:top-[76px] md:max-h-[calc(100%-92px)] md:w-[300px]"
    >
      {/* El desplazamiento va adentro: así la barra no rompe el redondeo del panel (#236). */}
      <div className="scroll-relieve overflow-y-auto px-[18px] py-4">
        <header className="flex items-start justify-between gap-2.5">
          <div>
            <span className="text-xs text-white/55">{region?.properties.country ?? t("Fuera de las regiones", "Outside regions")}</span>
            <h3 className="mt-0.5 text-xl font-bold leading-tight">{region?.properties.name ?? t("Sin región asignada", "Unassigned region")}</h3>
          </div>
          <button
            type="button"
            onClick={() => cambiar({ focoVivo: null })}
            aria-label={t("Cerrar la ficha del foco", "Close hotspot card")}
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
  useIdioma((s) => s.idioma);
  const ultimo = new Date();
  return (
    <>
      <div className="mb-1 mt-3 flex items-baseline gap-2">
        <b className="font-titulos text-[40px] font-extrabold leading-none tabular-nums" style={{ color: colorFoco(foco.frp) }}>
          {num(foco.frp, 1)}
        </b>
        <span className="text-[13px] text-white/70">MW · {etiquetaNivelFoco(nivelFoco(foco.frp))}</span>
      </div>
      <Veredicto foco={foco} />
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[13.5px]">
        <dt className="text-white/55">{t("Detectado", "Detected")}</dt>
        <dd className="m-0 text-right font-semibold tabular-nums">
          {foco.acq.slice(8, 10)}/{foco.acq.slice(5, 7)} {foco.acq.slice(11, 16)} UTC
          <span className="block font-normal text-white/60">{hace(ultimo, foco.acq)}</span>
        </dd>
        <dt className="text-white/55">{t("Satélite", "Satellite")}</dt>
        <dd className="m-0 text-right font-semibold">{SATELITES[foco.satelite] ?? foco.satelite}</dd>
        <dt className="text-white/55">{t("Sensor", "Sensor")}</dt>
        <dd className="m-0 text-right font-semibold">{foco.instrumento}</dd>
        <dt className="text-white/55">{t("Confianza", "Confidence")}</dt>
        <dd className="m-0 text-right font-semibold">{textoConfianza(foco.confianza)}</dd>
        <dt className="text-white/55">{t("Momento", "Time of day")}</dt>
        <dd className="m-0 text-right font-semibold">{foco.momento === "D" ? t("De día", "Daytime") : t("De noche", "Nighttime")}</dd>
        <dt className="text-white/55">{t("Ubicación", "Location")}</dt>
        <dd className="m-0 flex flex-wrap items-center justify-end gap-1.5 text-right font-semibold tabular-nums">
          <span>
            {num(foco.lat, 3)}, {num(foco.lon, 3)}
          </span>
          <a
            href={urlGoogleMaps(foco.lat, foco.lon)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("Ver ubicación en Google Maps", "View location on Google Maps")}
            title={t("Ver ubicación en Google Maps", "View location on Google Maps")}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-relieve-brillo hover:bg-white/20"
          >
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span>Google Maps</span>
          </a>
        </dd>
      </dl>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <iframe
          title={t("Previsualización de la ubicación en Google Maps", "Location preview on Google Maps")}
          src={urlGoogleMapsEmbed(foco.lat, foco.lon)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-32 w-full border-0"
        />
      </div>
      <p className="mt-3 text-xs leading-snug text-white/55">
        {t(
          "La intensidad (FRP) es la energía que irradia el fuego. Un foco es calor detectado desde el espacio: puede ser un incendio, una quema o una fuente fija.",
          "Intensity (FRP) is the radiative power emitted by fire. A hotspot is heat detected from space: it may be a wildfire, a burn, or a fixed source.",
        )}
      </p>
      <p
        className={`mt-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-snug text-white/75 ${avisoEnCelular ? "" : "hidden md:block"}`}
      >
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
    </>
  );
}

/**
 * Veredicto del foco y la evidencia que lo sostiene (RF-VIV-02). El veredicto sale de varias señales, nunca de la IA
 * sola (D-09). Si la evidencia no llega, se dice y el resto de la ficha sigue.
 */
function Veredicto({ foco }: { foco: FocoReciente }) {
  useIdioma((s) => s.idioma);
  const evidencia = useEvidencia(foco.id);
  const v = veredicto(evidencia.data?.verdict ?? foco.veredicto);
  return (
    <section aria-label={t("Veredicto", "Verdict")} className="mt-3 rounded-xl bg-white/5 px-3 py-2.5 text-[13px]">
      <p className="flex items-center gap-2">
        <i aria-hidden="true" className="size-2.5 rounded-full" style={{ background: v.color }} />
        <strong>{v.texto}</strong>
      </p>
      <p className="mt-1 text-xs leading-snug text-white/60">
        {t(
          "El veredicto combina satélite, fuentes fijas, noticias y reportes. La IA solo ayuda a leer noticias: que no haya noticias no vuelve falso un foco.",
          "The verdict combines satellite detections, fixed sources, news, and citizen reports. AI only assists in reading news—lack of news does not make a hotspot false.",
        )}
      </p>
      {evidencia.isPending && <p className="mt-2 text-xs text-white/55">{t("Buscando la evidencia…", "Looking up evidence…")}</p>}
      {evidencia.isError && (
        <p className="mt-2 text-xs text-white/70">
          {t("La evidencia de este foco no está disponible ahora.", "Evidence for this hotspot is not available right now.")}
        </p>
      )}
      {evidencia.isSuccess &&
        (evidencia.data.evidence.length === 0 ? (
          <p className="mt-2 text-xs text-white/55">
            {t("Todavía no hay evidencia además del satélite.", "No evidence beyond the satellite detection yet.")}
          </p>
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
