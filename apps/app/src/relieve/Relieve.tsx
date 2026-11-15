import { rampaAnomalia, rampaConteo } from "@charmy/ui";
import { ChevronRight, Compass, Minus, Plus, RotateCw } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useConsulta } from "@/estado/consulta";
import { useVivo } from "@/vivo/estado";
import { CharmyGuia } from "./CharmyGuia";
import { controlMapa } from "./controlMapa";
import { useDatosRelieve } from "./datos";
import { FichaFoco, PanelEnVivo } from "./EnVivo";
import { indicadorDe, useRelieve } from "./estado";
import { FichaRegion } from "./FichaRegion";
import { LineaTiempo } from "./LineaTiempo";
import { INDICADORES, rankingRegiones, valorIndicador } from "./logica";
import { Pildora } from "./Pildora";
import { Zona } from "./Zona";
import "./estilos.css";

// MapLibre pesa: el mapa se carga aparte para que el resto aparezca enseguida (RNF-03).
const MapaRelieve = lazy(() => import("./MapaRelieve"));
/** Segundos que el ranking queda abierto sin el cursor encima antes de esconderse (#251). */
const RANKING_ABIERTO_MS = 6000;
const num = (v: number, d = 0) => v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Vista Relieve (F4-R1): el país en relieve por provincia, con paneles de vidrio flotando sobre el mapa. */
export function Relieve() {
  const { resumen, vivo, regiones, focos } = useDatosRelieve();
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
  const region = regiones.find((r) => r.id === estado.seleccion) ?? null;
  const dias = resumen.data?.days ?? [];
  const ranking = rankingRegiones(regiones, indicador, 5);
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
    const t = setTimeout(() => cambiar({ ranking: false }), RANKING_ABIERTO_MS);
    return () => clearTimeout(t);
  }, [rankingAbierto, sobreRanking, guia, cambiar]);

  return (
    <div className="relieve relative h-full min-h-[560px] overflow-hidden bg-relieve-fondo text-white">
      <div aria-hidden="true" className="relieve-brillo-fondo pointer-events-none absolute inset-0" />
      <Suspense fallback={<p className="absolute inset-0 grid place-items-center text-sm text-white/60">Cargando el mapa…</p>}>
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
                  return v === null ? "sin dato" : `${num(v)} ${info?.unidad ?? ""}`;
                })()}
              </span>
            </>
          ) : focoSobre ? (
            `${num(focoSobre.frp, 1)} MW · ${focoSobre.acq.slice(11, 16)} UTC`
          ) : null}
        </div>
      )}

      <Pildora regiones={regiones} />

      {resumen.isError && (
        <p role="alert" className="vidrio-relieve absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm">
          Los datos por provincia no están disponibles ahora. Probá en un rato.
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
              aria-label="Mostrar el ranking"
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
            ) : ranking.length === 0 ? (
              <p className="px-2 text-sm text-white/50">{resumen.isPending ? "Cargando…" : "Sin datos de este indicador ahora."}</p>
            ) : (
              <ol className="m-0 flex list-none flex-col p-0">
                {ranking.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={estado.seleccion === r.id}
                      onClick={() => estado.alternarRegion(r.id)}
                      className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10"
                    >
                      <span className="text-xs tabular-nums text-white/35">{i + 1}</span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-white/90">{r.nombre}</span>
                        <span
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(4, (r.valor / (ranking[0]?.valor ?? 1)) * 100)}%`, background: r.color }}
                        />
                      </span>
                      <span className="w-14 text-right tabular-nums text-white/80">{num(r.valor)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {!region && (
            // Más arriba que el borde: abajo a la derecha queda el botón de atribución del mapa (#251).
            <div data-guia="leyenda" className="vidrio-relieve absolute bottom-11 right-4 z-10 hidden max-w-[300px] rounded-xl p-3 text-xs md:block">
              <div className="mb-1 font-titulos font-semibold">Cómo leer el mapa</div>
              <p className="mb-2 text-white/60">
                {info?.disponible
                  ? `${info.ayuda} Cuanto más alta y más oscura la región, ${indicador === "anomalia" ? "más se aleja de lo normal" : "más fuego"}.`
                  : `${info?.ayuda} El resto del mapa sigue andando.`}
              </p>
              {info?.disponible && (
                <>
                  <div className="flex h-2 overflow-hidden rounded-sm" aria-hidden="true">
                    {(indicador === "anomalia" ? rampaAnomalia : rampaConteo).map((c) => (
                      <i key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-white/50">
                    <span>{indicador === "anomalia" ? "menos que lo normal" : "menos"}</span>
                    <span>{indicador === "anomalia" ? "más" : "más"}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {region && (
            <>
              <FichaRegion region={region} regiones={regiones} foco={focoElegido} />
              <LineaTiempo region={region} dias={dias} />
            </>
          )}
          {/* Con una provincia abierta, el foco va dentro de su ficha: una sola ficha a la vez (#236). */}
          {focoElegido && !region && <FichaFoco foco={focoElegido} regiones={regiones} />}
        </>
      )}

      {!enVivo && (
        <div data-guia="controles" className="pointer-events-auto absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          <BotonRedondo etiqueta="Acercar" onClick={() => controlMapa.zoom(0.75)}>
            <Plus aria-hidden="true" className="size-4" />
          </BotonRedondo>
          <BotonRedondo etiqueta="Alejar" onClick={() => controlMapa.zoom(1.33)}>
            <Minus aria-hidden="true" className="size-4" />
          </BotonRedondo>
          <BotonRedondo etiqueta="Mirar al norte" onClick={() => controlMapa.norte()}>
            <Compass aria-hidden="true" className="size-4 text-relieve-brillo" />
          </BotonRedondo>
          {/* Tu zona va siempre en plano, para dibujar sobre el mapa sin inclinación. */}
          {!zona && (
            <>
              <BotonRedondo
                etiqueta={estado.plano ? "Ver en 3D" : "Ver en 2D, más liviano"}
                onClick={() => estado.cambiar({ plano: !estado.plano })}
              >
                <span className="text-[10px] font-bold">{estado.plano ? "3D" : "2D"}</span>
              </BotonRedondo>
              <BotonRedondo
                etiqueta={estado.giro ? "Detener el giro" : "Girar el mapa"}
                activo={estado.giro}
                onClick={() => estado.cambiar({ giro: !estado.giro })}
              >
                <RotateCw aria-hidden="true" className="size-4" />
              </BotonRedondo>
            </>
          )}
        </div>
      )}

      {/* z-20: la ayuda de Charmy y el aviso de emergencias quedan por encima del ranking, la leyenda y la línea de tiempo.
          En celular la ficha sale como hoja desde abajo: Charmy se guarda y el aviso queda encima (#218).
          En Tu zona el panel ocupa la izquierda: queda solo el aviso, debajo del panel. */}
      <div
        className={`pointer-events-auto absolute bottom-4 left-4 z-20 flex flex-col items-start gap-2 ${region || zona ? "max-md:right-4 max-md:bottom-3 max-md:z-40" : ""} ${zona ? "md:max-w-[340px]" : ""}`}
      >
        {!enVivo && !zona && (
          <div className={region ? "max-md:hidden" : ""}>
            <CharmyGuia regionMasFuego={masFuego} />
          </div>
        )}
        {/* Sobre la ficha, en celular, el aviso va con fondo sólido para que no se mezcle con su texto. */}
        <p
          className={`rounded-full bg-relieve-vidrio/60 px-3 py-1 text-[11px] text-white/70 ring-1 ring-white/10 ${region || zona ? "max-md:rounded-xl max-md:bg-relieve-panel max-md:shadow-lg" : ""} ${zona ? "md:rounded-xl" : ""}`}
        >
          Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
          <strong className="text-relieve-brillo">100</strong> en Argentina o al{" "}
          <strong className="text-relieve-brillo">132</strong> en Chile.
        </p>
      </div>
    </div>
  );
}

function BotonRedondo({
  etiqueta,
  onClick,
  activo,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  activo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      onClick={onClick}
      className={`grid size-10 place-items-center rounded-full ring-1 backdrop-blur-md transition ${
        activo ? "bg-white/15 ring-white/30" : "bg-relieve-vidrio/70 ring-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
