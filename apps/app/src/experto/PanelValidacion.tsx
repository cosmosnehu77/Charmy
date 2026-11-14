import type { paths } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { pedir } from "@/lib/api";

type Metricas =
  paths["/harmonization/metrics"]["get"]["responses"]["200"]["content"]["application/json"];

const TRAMOS: Record<string, string> = { modis_snpp: "MODIS → S-NPP", noaa20_snpp: "NOAA-20 → S-NPP" };

const dos = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uno = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
/** Con el signo menos tipográfico. */
const numero = (n: number, f = dos) => (n < 0 ? `−${f.format(-n)}` : f.format(n));

/** Evidencia de que la armonización funciona: métricas por región y tramo (RF-ARM-04). */
export function PanelValidacion() {
  const consulta = useQuery({
    queryKey: ["metricas"],
    queryFn: ({ signal }) => pedir<Metricas>("/harmonization/metrics", { signal }),
  });
  // Una respuesta con otra forma no rompe la app: se trata como sin datos.
  const regiones = Array.isArray(consulta.data?.regions) ? consulta.data.regions : [];

  return (
    <section aria-label="Validación de la armonización" className="flex flex-col gap-2 p-4 pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Validación de la armonización</h2>
        {regiones.some((r) => r.provisional) && (
          <span className="rounded-pildora border border-aviso-borde px-2 py-0.5 text-xs font-medium text-aviso-texto">
            Dato de ejemplo
          </span>
        )}
      </div>
      {consulta.isPending && <p className="text-sm text-tinta-suave">Cargando las métricas…</p>}
      {consulta.isError && (
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          Las métricas de validación no están disponibles ahora. El resto sigue funcionando.
        </p>
      )}
      {consulta.isSuccess && (
        <>
          <p className="text-xs text-tinta-suave">
            Método: {consulta.data.method}. Solape de cada tramo: {consulta.data.overlap}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left font-mono text-xs">
              <caption className="sr-only">Métricas de validación por región y tramo de calibración</caption>
              <thead className="text-tinta-suave">
                <tr>
                  <th scope="col" className="py-1 font-medium">Región</th>
                  <th scope="col" className="py-1 font-medium">Tramo</th>
                  <th scope="col" className="py-1 font-medium">R²</th>
                  <th scope="col" className="py-1 font-medium">Sesgo</th>
                  <th scope="col" className="py-1 font-medium">Error medio (MAE)</th>
                  <th scope="col" className="py-1 font-medium">Meses</th>
                </tr>
              </thead>
              <tbody>
                {regiones.map((r) => (
                  <tr key={`${r.region}-${r.pair}`} className="border-t border-borde-suave">
                    <th scope="row" className="py-1 font-medium">{r.region}</th>
                    <td className="py-1">{TRAMOS[r.pair] ?? r.pair}</td>
                    {r.r2 === null || r.bias === null ? (
                      <td className="py-1 text-tinta-suave" colSpan={2}>sin fuego en el solape</td>
                    ) : (
                      <>
                        <td className="py-1">{numero(r.r2)}</td>
                        <td className="py-1">{numero(r.bias)}</td>
                      </>
                    )}
                    <td className="py-1">{numero(r.mae, uno)}</td>
                    <td className="py-1">{r.n_months}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
