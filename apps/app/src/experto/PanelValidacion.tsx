import type { paths } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { pedir } from "@/lib/api";
import { localeActual, t, useIdioma } from "@/relieve/idioma";

type Metricas =
  paths["/harmonization/metrics"]["get"]["responses"]["200"]["content"]["application/json"];

const TRAMOS: Record<string, string> = { modis_snpp: "MODIS → S-NPP", noaa20_snpp: "NOAA-20 → S-NPP" };

/** Evidencia de que la armonización funciona: métricas por región y tramo (RF-ARM-04). */
export function PanelValidacion() {
  useIdioma((s) => s.idioma);
  const dos = new Intl.NumberFormat(localeActual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const uno = new Intl.NumberFormat(localeActual(), { maximumFractionDigits: 1 });
  const numero = (n: number, f = dos) => (n < 0 ? `−${f.format(-n)}` : f.format(n));

  const consulta = useQuery({
    queryKey: ["metricas"],
    queryFn: ({ signal }) => pedir<Metricas>("/harmonization/metrics", { signal }),
  });
  // Una respuesta con otra forma no rompe la app: se trata como sin datos.
  const regiones = Array.isArray(consulta.data?.regions) ? consulta.data.regions : [];

  return (
    <section aria-label={t("Validación de la armonización", "Harmonization validation")} className="flex flex-col gap-2 p-4 pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{t("Validación de la armonización", "Harmonization validation")}</h2>
        {regiones.some((r) => r.provisional) && (
          <span className="rounded-pildora border border-aviso-borde px-2 py-0.5 text-xs font-medium text-aviso-texto">
            {t("Dato de ejemplo", "Sample data")}
          </span>
        )}
      </div>
      {consulta.isPending && <p className="text-sm text-tinta-suave">{t("Cargando las métricas…", "Loading metrics…")}</p>}
      {consulta.isError && (
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          {t(
            "Las métricas de validación no están disponibles ahora. El resto sigue funcionando.",
            "Validation metrics are not available right now. Everything else keeps working.",
          )}
        </p>
      )}
      {consulta.isSuccess && (
        <>
          <p className="text-xs text-tinta-suave">
            {t(
              `Método: ${consulta.data.method}. Solape de cada tramo: ${consulta.data.overlap}.`,
              `Method: ${consulta.data.method}. Overlap per pair: ${consulta.data.overlap}.`,
            )}
          </p>
          {/* Muchas regiones: la tabla se desplaza dentro de su caja, con el encabezado fijo. */}
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[32rem] text-left font-mono text-xs">
              <caption className="sr-only">
                {t("Métricas de validación por región y tramo de calibración", "Validation metrics by region and calibration pair")}
              </caption>
              <thead className="sticky top-0 bg-card text-tinta-suave">
                <tr>
                  <th scope="col" className="py-1 font-medium">{t("Región", "Region")}</th>
                  <th scope="col" className="py-1 font-medium">{t("Tramo", "Pair")}</th>
                  <th scope="col" className="py-1 font-medium">R²</th>
                  <th scope="col" className="py-1 font-medium">{t("Sesgo", "Bias")}</th>
                  <th scope="col" className="py-1 font-medium">{t("Error medio (MAE)", "Mean error (MAE)")}</th>
                  <th scope="col" className="py-1 font-medium">{t("Meses", "Months")}</th>
                </tr>
              </thead>
              <tbody>
                {regiones.map((r) => (
                  <tr key={`${r.region}-${r.pair}`} className="border-t border-borde-suave">
                    <th scope="row" className="py-1 font-medium">{r.region}</th>
                    <td className="py-1">{TRAMOS[r.pair] ?? r.pair}</td>
                    {r.r2 === null || r.bias === null ? (
                      <td className="py-1 text-tinta-suave" colSpan={2}>{t("sin fuego en el solape", "no fire during overlap")}</td>
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
