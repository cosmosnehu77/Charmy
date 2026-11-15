import { rampaAnomalia, rampaConteo } from "@charmy/ui";
import { Compass, Minus, Plus, RotateCw } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useApp } from "@/estado/app";
import { URL_JUEGO, URL_LANDING } from "@/lib/enlaces";
import { CharmyGuia } from "./CharmyGuia";
import { controlMapa } from "./controlMapa";
import { useDatosRelieve } from "./datos";
import { FichaFoco, PanelEnVivo } from "./EnVivo";
import { useRelieve } from "./estado";
import { FichaRegion } from "./FichaRegion";
import { LineaTiempo } from "./LineaTiempo";
import { INDICADORES, rankingRegiones, valorIndicador } from "./logica";
import { Pildora } from "./Pildora";
import "./estilos.css";

// MapLibre pesa: el mapa se carga aparte para que el resto aparezca enseguida (RNF-03).
const MapaRelieve = lazy(() => import("./MapaRelieve"));
const num = (v: number, d = 0) => v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Vista Relieve (F4-R1): el país en relieve por provincia, con paneles de vidrio flotando sobre el mapa. */
export function Relieve() {
  const { resumen, vivo, regiones, focos } = useDatosRelieve();
  const estado = useRelieve();
  const irAConsulta = useApp((s) => s.cambiarVista);
  const [sobre, setSobre] = useState<{ id: string | null; foco: number | null; x: number; y: number }>({
    id: null,
    foco: null,
    x: 0,
    y: 0,
  });
  const enVivo = estado.pestana === "vivo";
  const indicador = estado.pestana === "vivo" ? "focos" : estado.pestana;
  const info = INDICADORES.find((i) => i.id === indicador);
  const region = regiones.find((r) => r.id === estado.seleccion) ?? null;
  const dias = resumen.data?.days ?? [];
  const ranking = rankingRegiones(regiones, indicador, 5);
  const masFuego = rankingRegiones(regiones, "focos", 1)[0]?.id ?? null;
  const live = resumen.data?.live;
  const focoElegido = estado.focoVivo !== null ? focos.find((f) => f.k === estado.focoVivo) : undefined;
  const regionSobre = regiones.find((r) => r.id === sobre.id);
  const focoSobre = sobre.foco !== null ? focos.find((f) => f.k === sobre.foco) : undefined;

  return (
    <div className="relieve relative h-full min-h-[560px] overflow-hidden bg-relieve-fondo text-white">
      <div aria-hidden="true" className="relieve-brillo-fondo pointer-events-none absolute inset-0" />
      <Suspense fallback={<p className="absolute inset-0 grid place-items-center text-sm text-white/60">Cargando el mapa…</p>}>
        <MapaRelieve regiones={regiones} dias={dias} focos={focos} onHover={setSobre} />
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
            focos={focos}
            regiones={regiones}
            disponible={!vivo.isError && live?.available !== false}
            mensaje={live?.message}
          />
          {focoElegido && <FichaFoco foco={focoElegido} regiones={regiones} />}
        </>
      ) : (
        <>
          {/* Sobre vidrio: al acercar el mapa quedan regiones de color debajo y el texto blanco se perdía (#214). */}
          <section
            data-guia="ranking"
            aria-label="Ranking"
            className="vidrio-relieve pointer-events-auto absolute left-4 top-[76px] z-10 hidden w-[250px] rounded-2xl px-2 pb-2 pt-3 md:block"
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
          </div>

          {!region && (
            <div data-guia="leyenda" className="vidrio-relieve absolute bottom-4 right-4 z-10 hidden max-w-[300px] rounded-xl p-3 text-xs md:block">
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
              <FichaRegion region={region} regiones={regiones} />
              <LineaTiempo region={region} dias={dias} />
            </>
          )}
        </>
      )}

      {/* z-20: la ayuda de Charmy y el aviso de emergencias quedan por encima del ranking, la leyenda y la línea de tiempo.
          En celular la ficha sale como hoja desde abajo: Charmy y los enlaces se guardan y el aviso queda encima (#218). */}
      <div
        className={`pointer-events-auto absolute bottom-4 left-4 z-20 flex flex-col items-start gap-2 ${region ? "max-md:right-4 max-md:bottom-3 max-md:z-40" : ""}`}
      >
        <div className={`flex flex-col items-start gap-2 ${region ? "max-md:hidden" : ""}`}>
          {!enVivo && <CharmyGuia regionMasFuego={masFuego} />}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-relieve-vidrio/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[.16em] text-white/55 ring-1 ring-white/10">
              Argentina y Chile · {regiones.length || 39} regiones
            </span>
            <button
              type="button"
              onClick={() => irAConsulta("consulta")}
              className="rounded-full bg-relieve-vidrio/60 px-3 py-1 text-xs text-white/80 ring-1 ring-white/10 hover:text-white"
            >
              Consulta por área y fechas
            </button>
            <a href={URL_LANDING} className="rounded-full px-2 py-1 text-xs text-white/60 underline-offset-2 hover:text-white hover:underline">
              Qué es Charmy
            </a>
            <a href={URL_JUEGO} className="rounded-full px-2 py-1 text-xs text-white/60 underline-offset-2 hover:text-white hover:underline">
              Charmy Brigada
            </a>
          </div>
        </div>
        {/* Sobre la ficha, en celular, el aviso va con fondo sólido para que no se mezcle con su texto. */}
        <p
          className={`rounded-full bg-relieve-vidrio/60 px-3 py-1 text-[11px] text-white/70 ring-1 ring-white/10 ${region ? "max-md:rounded-xl max-md:bg-relieve-panel max-md:shadow-lg" : ""}`}
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
