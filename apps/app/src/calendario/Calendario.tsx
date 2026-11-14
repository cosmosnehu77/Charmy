import { colorSinDato, rampaAnomalia, rampaConteo } from "@charmy/ui";
import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bboxDeArea, rutaCsv } from "@/consulta/consulta";
import { useApp } from "@/estado/app";
import { useConsulta } from "@/estado/consulta";
import { Descargas } from "@/experto/Descargas";
import { conclusionDelArea } from "@/novato/conclusion";
import { ErrorApi, urlApi } from "@/lib/api";
import {
  armarGrilla,
  CORTES_CANTIDAD,
  CORTES_PERCENTIL,
  colorCelda,
  colorTexto,
  describirCelda,
  describirCeldaSimple,
  formatear,
  MESES,
  type Vista,
} from "./grilla";
import { useCalendario } from "./useCalendario";

function Leyenda({ vista }: { vista: Vista }) {
  const rampa = vista === "anomalia" ? rampaAnomalia : rampaConteo;
  const [izquierda, derecha] =
    vista === "anomalia" ? ["Menos que lo normal", "Más que lo normal"] : ["0", `${CORTES_CANTIDAD.at(-1)} o más`];
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
        Sin dato
      </span>
    </div>
  );
}

export function Calendario() {
  const [vista, setVista] = useState<Vista>("anomalia");
  const { area, desde, hasta, fuente, confianzaMin } = useConsulta();
  const { consulta, desdeAnio, hastaAnio, hayConsulta } = useCalendario();
  const novato = useApp((s) => s.modo === "novato");

  if (!hayConsulta) return null;

  const csv = area ? `${urlApi()}${rutaCsv({ bbox: bboxDeArea(area), desde, hasta, fuente, confianzaMin })}` : null;

  return (
    <section aria-labelledby="titulo-calendario" className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="titulo-calendario" className="text-lg font-semibold">
          Calendario de quema
        </h2>
        {consulta.data?.provisional && (
          <span className="rounded-pildora border border-aviso-borde px-2 py-0.5 text-xs font-medium text-aviso-texto">
            Dato de ejemplo
          </span>
        )}
        <ToggleGroup type="single" aria-label="Qué mostrar en el calendario" value={vista} onValueChange={(v) => v && setVista(v as Vista)}>
          <ToggleGroupItem value="anomalia">{novato ? "Comparado con lo normal" : "Anomalía"}</ToggleGroupItem>
          <ToggleGroupItem value="cantidad">Cantidad</ToggleGroupItem>
        </ToggleGroup>
        {csv && (
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <a href={csv} download>
              <Download aria-hidden="true" />
              Descargar CSV
            </a>
          </Button>
        )}
      </div>

      {consulta.isPending && <p className="text-sm text-tinta-suave">Armando el calendario…</p>}
      {consulta.isError && (
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          {consulta.error instanceof ErrorApi && consulta.error.estado === 400 && consulta.error.mensaje
            ? consulta.error.mensaje
            : "El calendario no está disponible ahora. El mapa y la descarga siguen funcionando."}
        </p>
      )}
      {consulta.isSuccess && novato && consulta.data.cells.length > 0 && (
        <p className="rounded-control bg-superficie-2 p-2 text-sm">{conclusionDelArea(consulta.data)}</p>
      )}
      {consulta.isSuccess && consulta.data.cells.length === 0 && (
        // Sin celdas, la API explica el motivo en message (fuera de cobertura, región sin calendario).
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          {consulta.data.message ?? "No hay calendario para esta área y estos años."}
        </p>
      )}
      {consulta.isSuccess && consulta.data.cells.length > 0 && (
        <>
          {novato ? (
            <p className="text-xs text-tinta-suave">
              Cada cuadrito es un mes y el número dice cuánto fuego hubo. Naranja es más fuego que lo normal para ese
              mes; violeta, menos.
            </p>
          ) : (
            <p className="text-xs text-tinta-suave">
              Cada celda es un mes: días-celda con fuego, en equivalente VIIRS. La anomalía compara con la{" "}
              {consulta.data.baseline}
              {consulta.data.region ? `, región ${consulta.data.region}` : ""}.
            </p>
          )}
          <Leyenda vista={vista} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-0.5 text-center font-mono text-[11px]">
              <caption className="sr-only">
                Calendario de quema por año y mes,{" "}
                {vista === "cantidad" ? "cantidad" : novato ? "comparado con lo normal" : "anomalía"}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-12 text-left font-medium text-tinta-suave">
                    Año
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
                      const descripcion = novato
                        ? describirCeldaSimple(celda, fila.year, i)
                        : describirCelda(celda, fila.year, i);
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
          {!novato && <Descargas calendario={consulta.data} desdeAnio={desdeAnio} hastaAnio={hastaAnio} vista={vista} />}
        </>
      )}
    </section>
  );
}
