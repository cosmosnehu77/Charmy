import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConsulta } from "@/estado/consulta";
import { pedir } from "@/lib/api";
import { bboxDeArea, type ColeccionFocos, filtrarFocos, rutaFocos, validarFechas } from "./consulta";

/**
 * Focos del área y el período elegidos. Consulta solo si hay área y las fechas son válidas.
 * Intensidad y momento del día se aplican sobre la respuesta, sin volver a pedir.
 */
export function useFocos() {
  const { hoy, area, desde, hasta, fuente, confianzaMin, frpMin, momento } = useConsulta();
  const errorFechas = validarFechas(desde, hasta, hoy);
  const ruta =
    area && !errorFechas ? rutaFocos({ bbox: bboxDeArea(area), desde, hasta, fuente, confianzaMin }) : null;

  const consulta = useQuery({
    queryKey: ["focos", ruta],
    queryFn: ({ signal }) =>
      pedir<ColeccionFocos>(ruta as string, { signal, headers: { Accept: "application/geo+json" } }),
    enabled: ruta !== null,
  });

  const focos = useMemo(
    () => (consulta.data ? filtrarFocos(consulta.data, { frpMin, momento }) : null),
    [consulta.data, frpMin, momento],
  );

  return { focos, errorFechas, consulta, hayArea: area !== null };
}
