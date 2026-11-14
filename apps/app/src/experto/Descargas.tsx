import { Download } from "lucide-react";
import { armarGrilla, type RespuestaCalendario, type Vista } from "@/calendario/grilla";
import { Button } from "@/components/ui/button";
import { bboxDeArea, rutaFocos } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";
import { urlApi } from "@/lib/api";
import { calendarioCsv, calendarioSvg, descargarArchivo } from "./archivos";

/** Descargas extra del modo experto (RF-EXP-02). */
export function Descargas({
  calendario,
  desdeAnio,
  hastaAnio,
  vista,
}: {
  calendario: RespuestaCalendario;
  desdeAnio: number;
  hastaAnio: number;
  vista: Vista;
}) {
  const { area, desde, hasta, fuente, confianzaMin } = useConsulta();
  const geojson = area ? `${urlApi()}${rutaFocos({ bbox: bboxDeArea(area), desde, hasta, fuente, confianzaMin })}` : null;
  const nombre = `charmy-calendario-${desdeAnio}-${hastaAnio}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-tinta-suave">Más descargas:</span>
      {geojson && (
        <Button asChild variant="outline" size="sm">
          <a href={geojson} download="charmy-focos.geojson">
            <Download aria-hidden="true" />
            Focos (GeoJSON)
          </a>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => descargarArchivo(calendarioCsv(calendario), `${nombre}.csv`, "text/csv;charset=utf-8")}
      >
        <Download aria-hidden="true" />
        Calendario (CSV)
      </Button>
      <Button
        variant="outline"
        size="sm"
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
      </Button>
    </div>
  );
}
