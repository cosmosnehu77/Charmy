import { useEffect, useState } from "react";
import { Calendario } from "@/calendario/Calendario";
import { useCalendario } from "@/calendario/useCalendario";
import { Seguro } from "@/components/Seguro";
import { Area, Fechas, Filtros, Resultado } from "@/consulta/PanelConsulta";
import { useFocos } from "@/consulta/useFocos";
import { PanelContexto } from "@/contexto/PanelContexto";
import { useConsulta } from "@/estado/consulta";
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
 * calendario y CSV) con los colores de vidrio oscuro de `.tema-relieve`.
 */
export function Zona() {
  const { focos, errorFechas, consulta, hayArea } = useFocos();
  const mesReproduccion = useConsulta((s) => s.mesReproduccion);
  const { hayConsulta } = useCalendario();
  const ancho = useEsAncho();
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
            <h2 className="font-titulos text-xl font-bold">Tu zona</h2>
            <p className="mt-1 text-[12.5px] leading-snug text-tinta-suave">
              Marcá un área y elegí las fechas: ves sus focos, su calendario de quema y cómo está el lugar ahora.
            </p>
          </header>
          <Area />
          <Fechas error={errorFechas} />
          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold text-tinta-suave hover:text-tinta">Más filtros</summary>
            <div className="mt-3">
              <Filtros />
            </div>
          </details>
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
        </div>
      </aside>
      {ancho && calendario && (
        <div className="tema-relieve ficha-relieve scroll-relieve pointer-events-auto absolute bottom-11 left-[364px] right-[72px] z-20 max-h-[46%] overflow-y-auto rounded-[20px]">
          {calendario}
        </div>
      )}
    </>
  );
}
