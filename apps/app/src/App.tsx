import { AvisoEmergencias } from "@/components/AvisoEmergencias";
import { Encabezado } from "@/components/Encabezado";
import { useApp } from "@/estado/app";

export default function App() {
  const perfilMapa = useApp((s) => s.perfilMapa);
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
          className="order-2 flex flex-col gap-4 border-t bg-card p-4 md:order-1 md:w-80 md:border-t-0 md:border-r"
        >
          <section className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Área y período</h2>
            <p className="text-sm text-tinta-suave">
              Elegí una zona en el mapa y un rango de fechas para ver su calendario de quema.
            </p>
          </section>
          <div className="mt-auto">
            <AvisoEmergencias />
          </div>
        </aside>
        <main
          id="mapa"
          aria-label={`Mapa ${perfilMapa.toUpperCase()}`}
          className="relative order-1 min-h-[50vh] flex-1 bg-charmy-cielo md:order-2 md:min-h-0"
        >
          <div className="absolute inset-0 grid place-items-center text-sm text-tinta-suave">
            Mapa en preparación
          </div>
        </main>
      </div>
    </div>
  );
}
