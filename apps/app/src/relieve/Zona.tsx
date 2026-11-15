import { Flag, MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Calendario } from "@/calendario/Calendario";
import { useCalendario } from "@/calendario/useCalendario";
import { Seguro } from "@/components/Seguro";
import { Area, Fechas, Filtros, Resultado } from "@/consulta/PanelConsulta";
import { ResumenFocos } from "@/consulta/ResumenFocos";
import { useFocos } from "@/consulta/useFocos";
import { PanelContexto } from "@/contexto/PanelContexto";
import { useConsulta } from "@/estado/consulta";
import { PanelValidacion } from "@/experto/PanelValidacion";
import { Reproduccion } from "@/experto/Reproduccion";
import { atributosFoco } from "@/experto/atributos";
import { urlGoogleMaps, urlGoogleMapsEmbed } from "@/lib/enlaces";
import { useVivo } from "@/vivo/estado";
import { FormReporte } from "@/vivo/FormReporte";
import { useRelieve } from "./estado";

const ANCHO = "(min-width: 768px)";

/** En escritorio el calendario va en su propia hoja; en celular, dentro del panel de la zona. */
function useEsAncho() {
  const [ancho, setAncho] = useState(() => globalThis.matchMedia?.(ANCHO).matches ?? true);
  useEffect(() => {
    const mq = globalThis.matchMedia?.(ANCHO);
    if (!mq) return;
    const cambio = () => setAncho(mq.matches);
    mq.addEventListener("change", cambio);
    return () => mq.removeEventListener("change", cambio);
  }, []);
  return ancho;
}

const SECCIONES = [
  { id: "resumen", nombre: "Resumen" },
  { id: "lugar", nombre: "Lugar" },
  { id: "validacion", nombre: "Validación" },
] as const;
type Seccion = (typeof SECCIONES)[number]["id"];

/**
 * Experto (ex Tu zona, #262): la consulta por área y fechas dentro de Relieve, con los colores de vidrio oscuro de
 * `.tema-relieve`. Va por pasos (dónde, cuándo y filtros plegados), una franja con el resultado y la reproducción, y
 * pestañas para el resumen, el lugar y la validación (F4-D8). Reportar un foco va en el encabezado.
 */
export function Zona() {
  const { focos, errorFechas, consulta, hayArea } = useFocos();
  const mesReproduccion = useConsulta((s) => s.mesReproduccion);
  const dibujando = useConsulta((s) => s.dibujando);
  const { hayConsulta } = useCalendario();
  const { reportando, cambiar: cambiarVivo } = useVivo();
  const ancho = useEsAncho();
  const calendario = hayConsulta && (
    <Seguro nombre="El calendario">
      <Calendario />
    </Seguro>
  );

  return (
    <>
      <aside
        aria-label="Experto"
        className="tema-relieve ficha-relieve pointer-events-auto absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] flex-col overflow-hidden rounded-[20px] md:inset-x-auto md:bottom-[76px] md:left-3 md:top-[76px] md:max-h-none md:w-[340px]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 pb-3 pt-4">
          <h2 className="font-titulos text-xl font-bold">Experto</h2>
          {!reportando && (
            <button
              type="button"
              onClick={() => cambiarVivo({ reportando: true })}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/20 px-3 text-[12.5px] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Flag aria-hidden="true" className="size-3.5" />
              Reportar un foco
            </button>
          )}
        </header>
        {/* El desplazamiento va adentro: así la barra no rompe el redondeo del panel (#236). */}
        <div className="scroll-relieve flex flex-col gap-4 overflow-y-auto px-4 pb-20 pt-3.5 md:pb-5">
          <FormReporte />
          <Area />
          <Fechas error={errorFechas} />
          <Filtros />
          <div className="flex items-center gap-2 rounded-control bg-charmy-llama/10 px-3 py-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--charmy-llama)_35%,transparent)]">
            <Resultado
              focos={focos?.features.length ?? null}
              cargando={consulta.isFetching}
              fallo={consulta.isError}
              hayArea={hayArea && !errorFechas}
              total={consulta.data?.truncated ? (consulta.data.total ?? null) : null}
              mes={mesReproduccion}
            />
            {hayArea && !errorFechas && <Reproduccion />}
          </div>
          <Secciones
            resumen={
              <>
                {focos && !consulta.isFetching ? (
                  <Seguro nombre="El resumen de los focos">
                    <ResumenFocos focos={focos} />
                  </Seguro>
                ) : (
                  !hayArea && <p className="text-xs text-tinta-suave">Elegí un área para ver el resumen de sus focos.</p>
                )}
                {!ancho && calendario}
              </>
            }
            lugar={
              hayArea ? (
                <Seguro nombre="El contexto del lugar">
                  <PanelContexto />
                </Seguro>
              ) : (
                <p className="text-xs text-tinta-suave">Elegí un área para ver cómo está el lugar ahora.</p>
              )
            }
            validacion={
              <Seguro nombre="El panel de validación">
                <div className="-mx-4 shrink-0 overflow-x-auto">
                  <PanelValidacion />
                </div>
              </Seguro>
            }
          />
        </div>
      </aside>
      {dibujando && (
        // Sobre el mapa, para que se vea dónde se dibuja. El panel ya lo anuncia a los lectores de pantalla.
        <div
          aria-hidden="true"
          className="tema-relieve ficha-relieve pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-charmy-llama/60 px-3 py-1.5 text-xs font-medium text-white md:left-[calc(50%+170px)] md:top-[76px]"
        >
          <span className="size-2 animate-pulse rounded-full bg-charmy-llama motion-reduce:animate-none" />
          {dibujando === "rectangle" ? "Marcá el rectángulo en el mapa" : "Marcá el polígono en el mapa"}
        </div>
      )}
      <FichaAtributos />
      {ancho && calendario && (
        <div className="tema-relieve ficha-relieve scroll-relieve pointer-events-auto absolute bottom-11 left-[364px] right-[72px] z-20 max-h-[46%] overflow-y-auto rounded-[20px]">
          {calendario}
        </div>
      )}
    </>
  );
}

/** Pestañas del panel: una sección por vez, en lugar de apilarlas (F4-D8). Las flechas pasan de una a otra. */
function Secciones(contenido: Record<Seccion, React.ReactNode>) {
  const [actual, setActual] = useState<Seccion>("resumen");
  const id = useId();
  const lista = useRef<HTMLDivElement>(null);

  const moverConFlechas = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = SECCIONES.findIndex((s) => s.id === actual);
    const siguiente = SECCIONES[(i + (e.key === "ArrowRight" ? 1 : -1) + SECCIONES.length) % SECCIONES.length];
    if (!siguiente) return;
    setActual(siguiente.id);
    lista.current?.querySelector<HTMLButtonElement>(`[data-seccion="${siguiente.id}"]`)?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={lista} role="tablist" aria-label="Qué ver del área" onKeyDown={moverConFlechas} className="flex gap-0.5 border-b border-white/10">
        {SECCIONES.map((s) => {
          const activa = s.id === actual;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`${id}-${s.id}`}
              data-seccion={s.id}
              aria-selected={activa}
              aria-controls={`${id}-${s.id}-panel`}
              tabIndex={activa ? 0 : -1}
              onClick={() => setActual(s.id)}
              className={`px-2.5 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activa ? "font-semibold text-tinta shadow-[inset_0_-2px_0_var(--charmy-llama)]" : "text-tinta-suave hover:text-tinta"
              }`}
            >
              {s.nombre}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-${actual}-panel`} aria-labelledby={`${id}-${actual}`} className="flex flex-col gap-4">
        {contenido[actual]}
      </div>
    </div>
  );
}

/** Atributos originales del foco de la zona que se tocó en el mapa (RF-MOD-02). */
function FichaAtributos() {
  const { focoZona, cambiar } = useRelieve();
  if (!focoZona) return null;
  const { lat, lon, propiedades } = focoZona;
  return (
    <section
      aria-label="Atributos del foco"
      className="ficha-relieve pointer-events-auto absolute inset-x-3 bottom-3 z-40 flex max-h-[70%] flex-col overflow-hidden rounded-[20px] text-white md:inset-x-auto md:bottom-auto md:right-3 md:top-[76px] md:w-[300px]"
    >
      <div className="scroll-relieve overflow-y-auto px-[18px] py-4">
        <header className="flex items-start justify-between gap-2.5">
          <h3 className="text-lg font-bold leading-tight">Foco de la zona</h3>
          <button
            type="button"
            onClick={() => cambiar({ focoZona: null })}
            aria-label="Cerrar los atributos del foco"
            className="grid size-[30px] shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 font-mono text-xs">
          {atributosFoco(propiedades as Parameters<typeof atributosFoco>[0]).map(([nombre, valor]) => (
            <div key={nombre} className="contents">
              <dt className="text-white/55">{nombre}</dt>
              <dd className="m-0 text-right">{valor}</dd>
            </div>
          ))}
        </dl>
        <a
          href={urlGoogleMaps(lat, lon)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver ubicación en Google Maps"
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-relieve-brillo hover:bg-white/20"
        >
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span>Google Maps</span>
        </a>
        <iframe
          title="Previsualización de la ubicación en Google Maps"
          src={urlGoogleMapsEmbed(lat, lon)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mt-3 block h-28 w-full rounded-xl border-0"
        />
      </div>
    </section>
  );
}
