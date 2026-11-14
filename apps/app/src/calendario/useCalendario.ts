import { useQuery } from "@tanstack/react-query";
import { useConsulta } from "@/estado/consulta";
import { pedir } from "@/lib/api";
import { validarFechas } from "@/consulta/consulta";
import type { RespuestaCalendario } from "./calendario";

/** POST /calendar con el área y los años del período elegido. */
export function useCalendario() {
  const { area, desde, hasta, hoy } = useConsulta();
  const valido = area !== null && validarFechas(desde, hasta, hoy) === null;
  const cuerpo = valido
    ? { area, from_year: Number(desde.slice(0, 4)), to_year: Number(hasta.slice(0, 4)), resolution: "month" as const }
    : null;

  const consulta = useQuery({
    queryKey: ["calendario", cuerpo],
    queryFn: ({ signal }) =>
      pedir<RespuestaCalendario>("/calendar", {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      }),
    enabled: cuerpo !== null,
  });
  return { consulta, desdeAnio: cuerpo?.from_year ?? 0, hastaAnio: cuerpo?.to_year ?? 0, hayConsulta: cuerpo !== null };
}
