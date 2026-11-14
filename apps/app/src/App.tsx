import { lazy, Suspense } from "react";
import { Calendario } from "@/calendario/Calendario";
import { AvisoEmergencias } from "@/components/AvisoEmergencias";
import { Encabezado } from "@/components/Encabezado";
import { PanelConsulta } from "@/consulta/PanelConsulta";
import { useApp } from "@/estado/app";
import { Recorrido } from "@/novato/Recorrido";

// MapLibre pesa: se carga aparte para que el resto de la app aparezca enseguida (RNF-03).
const Mapa = lazy(() => import("@/mapa/Mapa"));

export default function App() {
  const perfilMapa = useApp((s) => s.perfilMapa);
  const mostrarRecorrido = useApp((s) => s.modo === "novato" && !s.recorridoVisto);
  return (
    <div className="flex h-full flex-col">
      <a
        href="#mapa"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-card focus:p-2"
      >
        Ir al mapa
      </a>
      <Encabezado />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          aria-label="Área y período"
          className="order-2 flex flex-col gap-4 border-t bg-card p-4 md:order-1 md:w-80 md:overflow-y-auto md:border-t-0 md:border-r"
        >
          <PanelConsulta />
          <div className="mt-auto">
            <AvisoEmergencias />
          </div>
        </aside>
        <div className="order-1 flex min-h-0 flex-1 flex-col md:order-2">
        <main
          id="mapa"
          aria-label={`Mapa ${perfilMapa.toUpperCase()}`}
          className="relative min-h-[50vh] flex-1 bg-charmy-cielo md:min-h-0"
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
        <div className="border-t bg-card md:max-h-[45%] md:overflow-y-auto">
          <Calendario />
        </div>
        </div>
      </div>
    </div>
  );
}
