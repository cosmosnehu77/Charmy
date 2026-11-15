import { lazy, Suspense } from "react";
import { Calendario } from "@/calendario/Calendario";
import { AvisoEmergencias } from "@/components/AvisoEmergencias";
import { Encabezado } from "@/components/Encabezado";
import { Seguro } from "@/components/Seguro";
import { PanelConsulta } from "@/consulta/PanelConsulta";
import { useApp } from "@/estado/app";
import { PanelValidacion } from "@/experto/PanelValidacion";
import { PanelContexto } from "@/contexto/PanelContexto";
import { Recorrido } from "@/novato/Recorrido";
import { FormReporte } from "@/vivo/FormReporte";
import { PanelVivo } from "@/vivo/PanelVivo";
import { Relieve } from "@/relieve/Relieve";

// MapLibre pesa: se carga aparte para que el resto de la app aparezca enseguida (RNF-03).
const Mapa = lazy(() => import("@/mapa/Mapa"));

export default function App() {
  const vista = useApp((s) => s.vista);
  // Vista principal (F4-R1): el país en relieve por provincia. La consulta por área sigue a un toque.
  if (vista === "relieve") return <Relieve />;
  return <Consulta />;
}

function Consulta() {
  const perfilMapa = useApp((s) => s.perfilMapa);
  const modo = useApp((s) => s.modo);
  const mostrarRecorrido = useApp((s) => s.modo === "novato" && !s.recorridoVisto);
  return (
    <div className="flex min-h-full flex-col md:h-full">
      <a
        href="#mapa"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-card focus:p-2"
      >
        Ir al mapa
      </a>
      <Encabezado />
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <aside
          aria-label="Área y período"
          className="order-2 flex flex-col gap-4 border-t bg-card p-4 md:order-1 md:w-80 md:overflow-y-auto md:border-t-0 md:border-r"
        >
          <PanelConsulta />
          <Seguro nombre="La sección «En vivo»">
            <PanelVivo />
          </Seguro>
          <Seguro nombre="El contexto del lugar">
            <PanelContexto />
          </Seguro>
          <FormReporte />
          <div className="mt-auto">
            <AvisoEmergencias />
          </div>
        </aside>
        {/* En móvil la columna se «disuelve» (contents) para ordenar: mapa, controles, calendario. */}
        <div className="contents md:order-2 md:flex md:min-h-0 md:flex-1 md:flex-col">
        <main
          id="mapa"
          aria-label={`Mapa ${perfilMapa.toUpperCase()}`}
          className="relative order-1 h-[55vh] bg-charmy-cielo md:order-none md:h-auto md:min-h-0 md:flex-1"
        >
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-sm text-tinta-suave">Cargando el mapa…</div>
            }
          >
            <Mapa />
          </Suspense>
          {mostrarRecorrido && <Recorrido />}
        </main>
        <div className="order-3 border-t bg-card md:order-none md:max-h-[45%] md:overflow-y-auto">
          <Seguro nombre="El calendario">
            <Calendario />
          </Seguro>
          {modo === "experto" && (
            <Seguro nombre="El panel de validación">
              <PanelValidacion />
            </Seguro>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
