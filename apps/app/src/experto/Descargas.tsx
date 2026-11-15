import { ChevronDown, Download } from "lucide-react";
import { armarGrilla, type RespuestaCalendario, type Vista } from "@/calendario/grilla";
import { bboxDeArea, rutaFocos } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";
import { urlApi } from "@/lib/api";
import { calendarioCsv, calendarioSvg, descargarArchivo } from "./archivos";

const item =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0";

/** Todas las descargas del calendario en un menú (F4-D8): focos en CSV (RF-EXP-01) y GeoJSON, y el calendario en CSV e imagen (RF-EXP-02). */
export function Descargas({
  calendario,
  desdeAnio,
  hastaAnio,
  vista,
  csv,
}: {
  calendario: RespuestaCalendario;
  desdeAnio: number;
  hastaAnio: number;
  vista: Vista;
  /** URL del CSV de focos de /hotspots, con los mismos filtros. */
  csv: string | null;
}) {
  const { area, desde, hasta, fuente, confianzaMin } = useConsulta();
  const geojson = area ? `${urlApi()}${rutaFocos({ bbox: bboxDeArea(area), desde, hasta, fuente, confianzaMin })}` : null;
  const nombre = `charmy-calendario-${desdeAnio}-${hastaAnio}`;

  return (
    <details className="relative ml-auto">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border border-borde px-3 text-sm hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <Download aria-hidden="true" className="size-4" />
        Descargas
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div className="ficha-relieve absolute right-0 z-10 mt-1 flex w-56 flex-col gap-0.5 rounded-xl p-1">
        {csv && (
          <a href={csv} download className={item}>
            <Download aria-hidden="true" />
            Focos (CSV)
          </a>
        )}
        {geojson && (
          <a href={geojson} download="charmy-focos.geojson" className={item}>
            <Download aria-hidden="true" />
            Focos (GeoJSON)
          </a>
        )}
        <button
          type="button"
          className={item}
          onClick={() => descargarArchivo(calendarioCsv(calendario), `${nombre}.csv`, "text/csv;charset=utf-8")}
        >
          <Download aria-hidden="true" />
          Calendario (CSV)
        </button>
        <button
          type="button"
          className={item}
          onClick={() =>
            descargarArchivo(
              calendarioSvg(
                armarGrilla(calendario.cells, desdeAnio, hastaAnio),
                vista,
                `Calendario de quema ${desdeAnio}–${hastaAnio}${calendario.region ? `, región ${calendario.region}` : ""}${calendario.provisional ? " (dato de ejemplo)" : ""}`,
              ),
              `${nombre}.svg`,
              "image/svg+xml",
            )
          }
        >
          <Download aria-hidden="true" />
          Calendario (imagen)
        </button>
      </div>
    </details>
  );
}
