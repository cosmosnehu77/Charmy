import { colorSinDato, rampaAnomalia, rampaConteo } from "@charmy/ui";
import { ChevronDown, Download } from "lucide-react";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bboxDeArea, rutaCsv } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";
import { Descargas } from "@/experto/Descargas";
import { ErrorApi, urlApi } from "@/lib/api";
import {
  armarGrilla,
  CORTES_CANTIDAD,
  CORTES_PERCENTIL,
  colorCelda,
  colorTexto,
  describirCelda,
  formatear,
  MESES,
  type Vista,
} from "./grilla";
import { ResumenCalendario } from "./ResumenCalendario";
import { useCalendario } from "./useCalendario";
import { t, useIdioma } from "@/relieve/idioma";

function Leyenda({ vista }: { vista: Vista }) {
  useIdioma((s) => s.idioma);
  const rampa = vista === "anomalia" ? rampaAnomalia : rampaConteo;
  const [izquierda, derecha] =
    vista === "anomalia"
      ? [t("Menos que lo normal", "Below normal"), t("Más que lo normal", "Above normal")]
      : ["0", t(`${CORTES_CANTIDAD.at(-1)} o más`, `${CORTES_CANTIDAD.at(-1)} or more`)];
  const cortes = vista === "anomalia" ? CORTES_PERCENTIL : CORTES_CANTIDAD;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-suave">
      <span>{izquierda}</span>
      <span className="flex" aria-hidden="true">
        {rampa.map((c, i) => (
          <span key={c} className="h-3 w-5 first:rounded-l-sm last:rounded-r-sm" style={{ backgroundColor: c }} title={i < cortes.length ? `< ${cortes[i]}` : undefined} />
        ))}
      </span>
      <span>{derecha}</span>
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="inline-grid h-3 w-5 place-items-center rounded-sm text-[9px]" style={{ backgroundColor: colorSinDato }}>
          —
        </span>
        {t("Sin dato", "No data")}
      </span>
    </div>
  );
}

/** Con `onMinimizar`, la hoja del calendario se puede plegar a una barra (F4-R2): lo decide quien la muestra. */
export function Calendario({ onMinimizar }: { onMinimizar?: () => void } = {}) {
  useIdioma((s) => s.idioma);
  const [vista, setVista] = useState<Vista>("anomalia");
  // Estadísticas es la tercera opción (F4-R2); la grilla recuerda si estaba en Anomalía o Cantidad (y las descargas también).
  const [verEstadisticas, setVerEstadisticas] = useState(false);
  const { area, desde, hasta, fuente, confianzaMin } = useConsulta();
  const { consulta, desdeAnio, hastaAnio, hayConsulta } = useCalendario();

  if (!hayConsulta) return null;

  const csv = area ? `${urlApi()}${rutaCsv({ bbox: bboxDeArea(area), desde, hasta, fuente, confianzaMin })}` : null;

  return (
    <section aria-labelledby="titulo-calendario" data-guia="calendario" className="@container flex flex-col gap-3 p-4">
      {/* En la hoja de escritorio el encabezado queda fijo arriba: el botón de minimizar no se va con el scroll. */}
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${
          onMinimizar ? "cabecera-fija sticky top-0 z-10 -mx-4 -mt-4 px-4 pb-2 pt-4" : ""
        }`}
      >
        <h2 id="titulo-calendario" className="text-lg font-semibold">
          {t("Calendario de quema", "Burn calendar")}
        </h2>
        {consulta.data?.provisional && (
          <span className="rounded-pildora border border-aviso-borde px-2 py-0.5 text-xs font-medium text-aviso-texto">
            {t("Dato de ejemplo", "Sample data")}
          </span>
        )}
        <ToggleGroup
          type="single"
          aria-label={t("Qué mostrar en el calendario", "Calendar view")}
          value={verEstadisticas ? "estadisticas" : vista}
          onValueChange={(v) => {
            if (!v) return;
            setVerEstadisticas(v === "estadisticas");
            if (v !== "estadisticas") setVista(v as Vista);
          }}
        >
          <ToggleGroupItem value="anomalia">{t("Anomalía", "Anomaly")}</ToggleGroupItem>
          <ToggleGroupItem value="cantidad">{t("Cantidad", "Count")}</ToggleGroupItem>
          <ToggleGroupItem value="estadisticas">{t("Estadísticas", "Statistics")}</ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex items-center gap-2">
        {consulta.isSuccess && consulta.data.cells.length > 0 ? (
          <Descargas calendario={consulta.data} desdeAnio={desdeAnio} hastaAnio={hastaAnio} vista={vista} csv={csv} />
        ) : (
          // Sin calendario igual se pueden bajar los focos (el mapa y la descarga siguen funcionando).
          csv && (
            <a href={csv} download className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-full border border-borde px-3 text-sm hover:bg-white/10">
              <Download aria-hidden="true" className="size-4" />
              {t("Focos (CSV)", "Hotspots (CSV)")}
            </a>
          )
        )}
        {onMinimizar && (
          <button
            type="button"
            onClick={onMinimizar}
            aria-label={t("Minimizar el calendario", "Minimize the calendar")}
            title={t("Minimizar", "Minimize")}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-borde hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
        )}
        </div>
      </div>

      {consulta.isPending && <p className="text-sm text-tinta-suave">{t("Armando el calendario…", "Building calendar…")}</p>}
      {consulta.isError && (
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          {consulta.error instanceof ErrorApi && consulta.error.estado === 400 && consulta.error.mensaje
            ? consulta.error.mensaje
            : t(
                "El calendario no está disponible ahora. El mapa y la descarga siguen funcionando.",
                "The calendar is not available right now. The map and downloads keep working.",
              )}
        </p>
      )}
      {consulta.isSuccess && consulta.data.cells.length === 0 && (
        // Sin celdas, la API explica el motivo en message (fuera de cobertura, región sin calendario).
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          {consulta.data.message ?? t("No hay calendario para esta área y estos años.", "No calendar available for this area and period.")}
        </p>
      )}
      {consulta.isSuccess && consulta.data.cells.length > 0 && (
        <>
          <p className="text-xs text-tinta-suave">
            {t(
              <>
                Cada casilla es un mes: días de fuego, en equivalente VIIRS. La anomalía compara con la{" "}
                {consulta.data.baseline}
                {consulta.data.region ? `, región ${consulta.data.region}` : ""}.
              </>,
              <>
                Each box is a month: fire days in VIIRS equivalent. Anomaly compares against the{" "}
                {consulta.data.baseline}
                {consulta.data.region ? `, region ${consulta.data.region}` : ""}.
              </>,
            )}
          </p>
          {verEstadisticas ? (
            <ResumenCalendario celdas={consulta.data.cells} />
          ) : (
            <>
          <Leyenda vista={vista} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] table-fixed border-separate border-spacing-0.5 text-center font-mono text-[11px]">
              <caption className="sr-only">
                {t("Calendario de quema por año y mes", "Burn calendar by year and month")},{" "}
                {vista === "cantidad" ? t("cantidad", "count") : t("anomalía", "anomaly")}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-12 text-left font-medium text-tinta-suave">
                    {t("Año", "Year")}
                  </th>
                  {MESES.map((m) => (
                    <th key={m} scope="col" className="font-medium text-tinta-suave">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {armarGrilla(consulta.data.cells, desdeAnio, hastaAnio).map((fila) => (
                  <tr key={fila.year}>
                    <th scope="row" className="text-left font-medium">
                      {fila.year}
                    </th>
                    {fila.meses.map((celda, i) => {
                      const fondo = colorCelda(celda, vista);
                      const descripcion = describirCelda(celda, fila.year, i);
                      return (
                        <td
                          key={MESES[i]}
                          aria-label={descripcion}
                          title={descripcion}
                          className="h-7 rounded-sm"
                          style={{ backgroundColor: fondo, color: colorTexto(fondo) }}
                        >
                          {celda ? formatear(celda.value) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

