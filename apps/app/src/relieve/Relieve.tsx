import { rampaAnomalia, rampaConteo } from "@charmy/ui";
import { ChevronRight } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useConsulta } from "@/estado/consulta";
import { useVivo } from "@/vivo/estado";
import { CharmyGuia } from "./CharmyGuia";
import { ControlesMapa } from "./ControlesMapa";
import { useDatosRelieve } from "./datos";
import { FichaFoco, PanelEnVivo } from "./EnVivo";
import { indicadorDe, useRelieve } from "./estado";
import { FichaRegion } from "./FichaRegion";
import { pasosDe } from "./guiaPestanas";
import { localeActual, t, useIdioma } from "./idioma";
import { LineaTiempo } from "./LineaTiempo";
import { INDICADORES, rankingRegiones, serieDelIndicador, tendencia, valorIndicador } from "./logica";
import { Pildora } from "./Pildora";
import { TendenciaRegion } from "./TendenciaRegion";
import { Zona } from "./Zona";
import "./estilos.css";

// MapLibre pesa: el mapa se carga aparte para que el resto aparezca enseguida (RNF-03).
const MapaRelieve = lazy(() => import("./MapaRelieve"));
/** Segundos que el ranking queda abierto sin el cursor encima antes de esconderse (#251). */
const RANKING_ABIERTO_MS = 6000;
const num = (v: number, d = 0) => v.toLocaleString(localeActual(), { minimumFractionDigits: d, maximumFractionDigits: d });

/** Vista Relieve (F4-R1): el país en relieve por provincia, con paneles de vidrio flotando sobre el mapa. */
export function Relieve() {
  const { idioma, tema, alternarIdioma, alternarTema } = useIdioma();
  const { resumen, vivo, prediccion, regiones, focos } = useDatosRelieve();
  const estado = useRelieve();
  const [sobre, setSobre] = useState<{ id: string | null; foco: number | null; x: number; y: number }>({
    id: null,
    foco: null,
    x: 0,
    y: 0,
  });
  const enVivo = estado.pestana === "vivo";
  const zona = estado.pestana === "zona";
  const indicador = indicadorDe(estado.pestana);
  const info = INDICADORES.find((i) => i.id === indicador);
  // La predicción sale de otro servicio: si no responde, solo esta pestaña lo dice (F4-D12).
  const sinPrediccion = indicador === "prediccion" && prediccion.isError;
  const region = regiones.find((r) => r.id === estado.seleccion) ?? null;
  const dias = resumen.data?.days ?? [];
  const ranking = rankingRegiones(regiones, indicador, 5);
  // Los días-celda del mes tienen decimales (#373); los conteos y la potencia van enteros.
  const decimales = indicador === "focos" ? 1 : 0;
  // Hoy (UTC, como `days`) todavía no terminó: la tendencia no lo cuenta (F4-D6).
  const hoy = new Date().toISOString().slice(0, 10);
  const masFuego = rankingRegiones(regiones, "focos", 1)[0]?.id ?? null;
  const live = resumen.data?.live;
  // En En vivo, solo los focos de los satélites elegidos: en el panel, en el mapa y en la ficha (#271).
  const satelites = useVivo((s) => s.satelites);
  const focosVivo = useMemo(() => focos.filter((f) => satelites.includes(f.satelite)), [focos, satelites]);
  const focoElegido =
    estado.focoVivo !== null ? (enVivo ? focosVivo : focos).find((f) => f.k === estado.focoVivo) : undefined;
  const regionSobre = regiones.find((r) => r.id === sobre.id);
  const focoSobre = sobre.foco !== null ? focos.find((f) => f.k === sobre.foco) : undefined;
  const [sobreRanking, setSobreRanking] = useState(false);
  const { ranking: rankingAbierto, guia, cambiar } = estado;

  // Fuera de Tu zona no queda una herramienta de dibujo activa en el mapa.
  useEffect(() => {
    if (!zona) useConsulta.getState().cambiar({ dibujando: null });
  }, [zona]);
  // Al cambiar de indicador el ranking se vuelve a abrir, para ver el nuevo orden.
  useEffect(() => {
    cambiar({ ranking: true });
  }, [indicador, cambiar]);
  // Se esconde solo, salvo con el cursor encima o durante el recorrido de Charmy.
  useEffect(() => {
    if (!rankingAbierto || sobreRanking || guia) return;
    const timer = setTimeout(() => cambiar({ ranking: false }), RANKING_ABIERTO_MS);
    return () => clearTimeout(timer);
  }, [rankingAbierto, sobreRanking, guia, cambiar]);
  useEffect(() => {
    useIdioma.getState().sincronizarPreferencias();
  }, []);

  return (
    <div className="relieve relative h-full min-h-[560px] overflow-hidden bg-relieve-fondo text-white">
      <div aria-hidden="true" className="relieve-brillo-fondo pointer-events-none absolute inset-0" />
      <Suspense
        fallback={
          <p className="absolute inset-0 grid place-items-center text-sm text-white/60">
            {t("Cargando el mapa…", "Loading map…")}
          </p>
        }
      >
        <MapaRelieve regiones={regiones} dias={dias} focos={enVivo ? focosVivo : focos} onHover={setSobre} />
      </Suspense>

      {(regionSobre || focoSobre) && (
        <div className="relieve-tip" style={{ left: sobre.x, top: sobre.y }}>
          {regionSobre ? (
            <>
              {regionSobre.properties.name}
              <span>
                {(() => {
                  const v = valorIndicador(regionSobre.properties, indicador);
                  return v === null ? t("sin dato", "no data") : `${num(v, decimales)} ${info?.unidad ?? ""}`;
                })()}
              </span>
            </>
          ) : focoSobre ? (
            `${num(focoSobre.frp, 1)} MW · ${focoSobre.acq.slice(11, 16)} UTC`
          ) : null}
        </div>
      )}

      <Pildora regiones={regiones} />

      <div className="nav-acc pointer-events-auto absolute right-4 top-3 z-30">
        <button
          className="nav-btn"
          id="btn-tema"
          type="button"
          aria-label={
            tema === "oscuro"
              ? t("Cambiar a tema claro", "Switch to light theme")
              : t("Cambiar a tema oscuro", "Switch to dark theme")
          }
          title={
            tema === "oscuro"
              ? t("Cambiar a tema claro", "Switch to light theme")
              : t("Cambiar a tema oscuro", "Switch to dark theme")
          }
          onClick={alternarTema}
        >
          <svg
            aria-hidden="true"
            className="i-sol"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
          </svg>
          <svg
            aria-hidden="true"
            className="i-luna"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
          </svg>
        </button>
        <button
          className="nav-btn idioma"
          id="btn-idioma"
          type="button"
          aria-label={idioma === "es" ? "Switch to English" : "Cambiar a español"}
          onClick={alternarIdioma}
        >
          <span data-l="es" className={idioma === "es" ? "on" : undefined}>
            ES
          </span>
          <span data-l="en" className={idioma === "en" ? "on" : undefined}>
            EN
          </span>
        </button>
      </div>

      {resumen.isError && (
        <p role="alert" className="vidrio-relieve absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm">
          {t(
            "Los datos por provincia no están disponibles ahora. Probá en un rato.",
            "Provincial data is not available right now. Try again shortly.",
          )}
        </p>
      )}

      {enVivo ? (
        <>
          <PanelEnVivo
            focos={focosVivo}
            regiones={regiones}
            disponible={!vivo.isError && live?.available !== false}
            mensaje={live?.message}
          />
          {focoElegido && <FichaFoco foco={focoElegido} regiones={regiones} />}
        </>
      ) : zona ? (
        <Zona />
      ) : (
        <>
          {!rankingAbierto && (
            // Escondido queda una pestaña en el borde: acercar el cursor (o tocarla) lo vuelve a abrir.
            <button
              type="button"
              aria-label={t("Mostrar el ranking", "Show ranking")}
              onMouseEnter={() => cambiar({ ranking: true })}
              onClick={() => cambiar({ ranking: true })}
              className="pestana-ranking pointer-events-auto absolute left-0 top-[68px] z-10 hidden h-[120px] w-10 items-center md:flex"
            >
              <span className="vidrio-relieve flex h-16 w-6 items-center justify-center rounded-r-xl text-white/70">
                <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </button>
          )}
          {/* Sobre vidrio: al acercar el mapa quedan regiones de color debajo y el texto blanco se perdía (#214).
              Escondido sigue montado, inerte y oculto para los lectores, así entra y sale con una transición (#281). */}
          <section
            data-guia="ranking"
            data-abierto={rankingAbierto}
            aria-label="Ranking"
            aria-hidden={!rankingAbierto || undefined}
            inert={!rankingAbierto}
            onMouseEnter={() => setSobreRanking(true)}
            onMouseLeave={() => setSobreRanking(false)}
            className="ranking-relieve vidrio-relieve absolute left-4 top-[76px] z-10 hidden w-[250px] rounded-2xl px-2 pb-2 pt-3 md:block"
          >
            <div className="mb-2 flex items-baseline justify-between px-2 text-[11px] uppercase tracking-[.14em] text-white/45">
              <span>Ranking · {info?.nombre.toLowerCase()}</span>
              <span className="normal-case tracking-normal">{info?.unidad}</span>
            </div>
            {!info?.disponible ? (
              <p className="px-2 text-sm text-white/50">{info?.ayuda}</p>
            ) : sinPrediccion ? (
              <p className="px-2 text-sm text-white/50">
                {t("La predicción no está disponible ahora. Probá en un rato.", "Forecast is not available right now. Try again shortly.")}
              </p>
            ) : ranking.length === 0 ? (
              <p className="px-2 text-sm text-white/50">
                {resumen.isPending || (indicador === "prediccion" && prediccion.isPending)
                  ? t("Cargando…", "Loading…")
                  : t("Sin datos de este indicador ahora.", "No data for this indicator right now.")}
              </p>
            ) : (
              <ol className="m-0 flex list-none flex-col p-0">
                {ranking.map((r, i) => {
                  const props = regiones.find((x) => x.id === r.id)?.properties;
                  const serie = props ? serieDelIndicador(props, indicador) : null;
                  const tend = tendencia(serie, dias, hoy);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-pressed={estado.seleccion === r.id}
                        onClick={() => estado.alternarRegion(r.id)}
                        className="grid w-full grid-cols-[18px_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10"
                      >
                        <span className="text-xs tabular-nums text-white/35">{i + 1}</span>
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-white/90">{r.nombre}</span>
                          <span
                            className="h-1.5 rounded-full"
                            style={{ width: `${Math.max(4, (r.valor / (ranking[0]?.valor ?? 1)) * 100)}%`, background: r.color }}
                          />
                        </span>
                        {serie && tend ? <TendenciaRegion serie={serie} tendencia={tend} /> : <span />}
                        <span className="w-12 text-right tabular-nums text-white/80">{num(r.valor, decimales)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {!region && (
            // Más arriba que el borde: abajo a la derecha queda el botón de atribución del mapa (#251).
            <div data-guia="leyenda" className="vidrio-relieve absolute bottom-11 right-4 z-10 hidden max-w-[300px] rounded-xl p-3 text-xs md:block">
              <div className="mb-1 font-titulos font-semibold">{t("Cómo leer el mapa", "How to read the map")}</div>
              <p className="mb-2 text-white/60">
                {info?.disponible && indicador === "prediccion"
                  ? t(
                      "La altura son los cuadrados con fuego que espera el modelo el mes que viene. El color, cómo se compara con lo habitual para ese mes: naranja, más fuego; violeta, menos; claro, lo de siempre.",
                      "Height is the squares with fire the model expects next month. Color is how that compares with the usual for that month: orange, more fire; purple, less; light, as usual.",
                    )
                  : info?.disponible
                  ? t(
                      `${info.ayuda} Cuanto más alta y más oscura la región, ${indicador === "anomalia" ? "más se aleja de lo normal" : "más fuego"}.${indicador === "focos" ? " El color compara las provincias entre sí, no con lo normal: eso está en la ficha de cada una y en Anomalía." : ""}`,
                      `${info.ayuda} The taller and darker the region, ${indicador === "anomalia" ? "the further from normal" : "the more fire"}.${indicador === "focos" ? " Color compares provinces with each other, not with normal: that is in each province's card and in Anomaly." : ""}`,
                    )
                  : t(`${info?.ayuda} El resto del mapa sigue andando.`, `${info?.ayuda} The rest of the map keeps working.`)}
              </p>
              {info?.disponible && (
                <>
                  <div className="flex h-2 overflow-hidden rounded-sm" aria-hidden="true">
                    {(indicador === "anomalia" || indicador === "prediccion" ? rampaAnomalia : rampaConteo).map((c) => (
                      <i key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-white/50">
                    <span>
                      {indicador === "anomalia"
                        ? t("menos que lo normal", "below normal")
                        : indicador === "prediccion"
                          ? t("menos que lo habitual", "less than usual")
                          : t("menos", "less")}
                    </span>
                    <span>{indicador === "prediccion" ? t("más que lo habitual", "more than usual") : t("más", "more")}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {region && (
            <>
              <FichaRegion region={region} regiones={regiones} foco={focoElegido} />
              {/* Focos es un mes (#373): la línea de días va con Intensidad. */}
              {indicador !== "focos" && <LineaTiempo region={region} dias={dias} />}
            </>
          )}
          {/* Con una provincia abierta, el foco va dentro de su ficha: una sola ficha a la vez (#236). */}
          {focoElegido && !region && <FichaFoco foco={focoElegido} regiones={regiones} />}
        </>
      )}

      {/* Los controles van en todas las pestañas: En vivo y Experto también se ven en 3D. En escritorio, arriba para no
          tapar la leyenda de abajo a la derecha (#402); en celular no hay leyenda. */}
      <ControlesMapa conGiro={!enVivo && !zona} />

      {/* z-20: la ayuda de Charmy y el aviso de emergencias quedan por encima del ranking, la leyenda y la línea de tiempo.
          En celular la ficha sale como hoja desde abajo: Charmy se guarda y el aviso queda encima (#218).
          En Tu zona el panel ocupa la izquierda: queda solo el aviso, debajo del panel. */}
      <div
        className={`pointer-events-auto absolute bottom-4 left-4 z-20 flex flex-col items-start gap-2 ${region || zona ? "max-md:right-4 max-md:bottom-3 max-md:z-40" : ""} ${zona ? "md:max-w-[340px]" : ""}`}
      >
        {!enVivo && !zona && (
          <div className={region ? "max-md:hidden" : ""}>
            {/* Cada pestaña tiene su recorrido: qué muestra y cómo se usa. Focos lleva el general del mapa. */}
            <CharmyGuia
              regionMasFuego={masFuego}
              pasos={pasosDe(indicador)}
              etiqueta={
                indicador === "focos"
                  ? undefined
                  : t(
                      `Charmy: ¿necesitás ayuda? Tocá para ver cómo se usa ${info?.nombre}`,
                      `Charmy: need help? Tap to see how to use ${info?.nombre}`,
                    )
              }
            />
          </div>
        )}
        {/* Sobre la ficha, en celular, el aviso va con fondo sólido para que no se mezcle con su texto. */}
        <p
          className={`rounded-full bg-relieve-vidrio/60 px-3 py-1 text-[11px] text-white/70 ring-1 ring-white/10 ${region || zona ? "max-md:rounded-xl max-md:bg-relieve-panel max-md:shadow-lg" : ""} ${zona ? "md:rounded-xl" : ""}`}
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
      </div>
    </div>
  );
}
