import type { components } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { pedir, urlApi } from "@/lib/api";
import type { RespuestaVivo } from "@/vivo/consultas";
import { LIMITES_MVP } from "@/mapa/perfiles";
import type { Resumen } from "./logica";

export type Calendario = components["schemas"]["Calendar"];

/** Las 39 regiones con sus focos de los últimos 5 días (el máximo de /live) y su último mes. */
export function useResumen() {
  return useQuery({
    queryKey: ["regiones", "resumen"],
    queryFn: ({ signal }) => pedir<Resumen>("/regions/summary?hours=120", { signal }),
    enabled: urlApi() !== "",
    refetchInterval: 10 * 60_000,
  });
}

/** Focos en vivo de las últimas 48 horas: las agujas del relieve y los círculos de En vivo. */
export function useFocosRecientes() {
  return useQuery({
    queryKey: ["vivo", "relieve"],
    queryFn: ({ signal }) =>
      pedir<RespuestaVivo>(`/live?bbox=${LIMITES_MVP.join(",")}&hours=48`, {
        signal,
        headers: { Accept: "application/geo+json" },
      }),
    enabled: urlApi() !== "",
    refetchInterval: 10 * 60_000,
  });
}

/** Calendario de quema de una región, desde 2012 (la ficha lo muestra plegado). */
export function useCalendarioRegion(region: string | null) {
  return useQuery({
    queryKey: ["calendario", "region", region],
    queryFn: ({ signal }) =>
      pedir<Calendario>("/calendar", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, from_year: 2012 }),
      }),
    enabled: region !== null && urlApi() !== "",
  });
}
