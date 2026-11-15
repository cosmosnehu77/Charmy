import { MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Calendario } from "@/calendario/Calendario";
import { useCalendario } from "@/calendario/useCalendario";
import { Seguro } from "@/components/Seguro";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Area, Fechas, Filtros, Resultado } from "@/consulta/PanelConsulta";
import { useFocos } from "@/consulta/useFocos";
import { PanelContexto } from "@/contexto/PanelContexto";
import { type Modo, useApp } from "@/estado/app";
import { useConsulta } from "@/estado/consulta";
import { PanelValidacion } from "@/experto/PanelValidacion";
import { Reproduccion } from "@/experto/Reproduccion";
import { atributosFoco } from "@/experto/atributos";
import { urlGoogleMaps, urlGoogleMapsEmbed } from "@/lib/enlaces";
import { useRelieve } from "./estado";
import { FormReporte } from "@/vivo/FormReporte";

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

/**
 * Tu zona (#262): la consulta por área y fechas dentro de Relieve. Reúsa las piezas de la consulta (estado, focos,
 * calendario y CSV) con los colores de vidrio oscuro de `.tema-relieve`. El modo experto suma los filtros técnicos,
 * la reproducción por mes, la validación y las descargas extra (RF-MOD-02); cambiar de modo no toca el área ni las
 * fechas (RF-MOD-03).
 */
export function Zona() {
  const { focos, errorFechas, consulta, hayArea } = useFocos();
  const mesReproduccion = useConsulta((s) => s.mesReproduccion);
  const { hayConsulta } = useCalendario();
  const ancho = useEsAncho();
  const { modo, cambiarModo } = useApp();
  const experto = modo === "experto";
  const calendario = hayConsulta && (
    <Seguro nombre="El calendario">
      <Calendario />
    </Seguro>
  );

  return (
    <>
      <aside
        aria-label="Tu zona"
        className="tema-relieve ficha-relieve pointer-events-auto absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] flex-col overflow-hidden rounded-[20px] md:inset-x-auto md:bottom-[76px] md:left-3 md:top-[76px] md:max-h-none md:w-[340px]"
      >
        {/* El desplazamiento va adentro: así la barra no rompe el redondeo del panel (#236). */}
        <div className="scroll-relieve flex flex-col gap-5 overflow-y-auto px-4 pb-20 pt-4 md:pb-5">
          <header>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-titulos text-xl font-bold">Tu zona</h2>
              <ToggleGroup type="single" aria-label="Modo" value={modo} onValueChange={(v) => v && cambiarModo(v as Modo)}>
                <ToggleGroupItem value="novato">Novato</ToggleGroupItem>
                <ToggleGroupItem value="experto">Experto</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-tinta-suave">
              Marcá un área y elegí las fechas: ves sus focos, su calendario de quema y cómo está el lugar ahora.
            </p>
          </header>
          <Area />
          <Fechas error={errorFechas} />
          {/* Serie, confianza y potencia son términos técnicos: solo en el modo experto (RF-MOD-01). */}
          {experto && <Filtros />}
          {experto && hayArea && !errorFechas && <Reproduccion />}
          <Resultado
            focos={focos?.features.length ?? null}
            cargando={consulta.isFetching}
            fallo={consulta.isError}
            hayArea={hayArea && !errorFechas}
            total={consulta.data?.truncated ? (consulta.data.total ?? null) : null}
            mes={mesReproduccion}
          />
          {!ancho && calendario}
          {hayArea && (
            <Seguro nombre="El contexto del lugar">
              <PanelContexto />
            </Seguro>
          )}
          <FormReporte />
          {experto && (
            <Seguro nombre="El panel de validación">
              <div className="-mx-4 shrink-0 overflow-x-auto">
                <PanelValidacion />
              </div>
            </Seguro>
          )}
        </div>
      </aside>
      {experto && <FichaAtributos />}
      {ancho && calendario && (
        <div className="tema-relieve ficha-relieve scroll-relieve pointer-events-auto absolute bottom-11 left-[364px] right-[72px] z-20 max-h-[46%] overflow-y-auto rounded-[20px]">
          {calendario}
        </div>
      )}
    </>
  );
}

/** Atributos originales del foco de la zona que se tocó en el mapa, en el modo experto (RF-MOD-02). */
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
