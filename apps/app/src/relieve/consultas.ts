import type { components } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { pedir, urlApi } from "@/lib/api";
import type { RespuestaVivo } from "@/vivo/consultas";
import { LIMITES_MVP } from "@/mapa/perfiles";
import type { ColeccionFocos, Poligono } from "@/consulta/consulta";
import { periodoUltimoMes, type PrediccionRegiones, type Resumen } from "./logica";

export type PrediccionZona = components["schemas"]["ZoneForecast"];

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

/**
 * Predicción de las regiones para los próximos seis meses (F4-D12, D-40). Cambia una vez por mes: no se vuelve a
 * pedir sola. Si el servicio de predicción está dormido la API da 503 y la pestaña lo dice.
 */
export function usePrediccionRegiones() {
  return useQuery({
    queryKey: ["regiones", "prediccion"],
    queryFn: ({ signal }) => pedir<PrediccionRegiones>("/regions/forecast", { signal }),
    enabled: urlApi() !== "",
    staleTime: 60 * 60_000,
  });
}

/** Predicción del área dibujada en Experto (F4-D12, D-40). */
export function usePrediccionZona(area: Poligono | null) {
  return useQuery({
    queryKey: ["prediccion", "zona", area],
    queryFn: ({ signal }) =>
      pedir<PrediccionZona>("/forecast/zone", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: area }),
      }),
    enabled: area !== null && urlApi() !== "",
    staleTime: 60 * 60_000,
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

/**
 * Focos del histórico armonizado de una región en los últimos 30 días (F4-D15): se piden con la caja de la región
 * y la ficha cuenta solo los que caen dentro de su contorno. `hoy` es el día UTC de hoy (YYYY-MM-DD).
 */
export function useUltimoMes(caja: [number, number, number, number] | null, hoy: string) {
  const { desde, hasta } = periodoUltimoMes(hoy);
  return useQuery({
    queryKey: ["ultimo-mes", caja, desde, hasta],
    queryFn: ({ signal }) =>
      pedir<ColeccionFocos>(`/hotspots?bbox=${caja!.join(",")}&from=${desde}&to=${hasta}`, {
        signal,
        headers: { Accept: "application/geo+json" },
      }),
    enabled: caja !== null && urlApi() !== "",
    staleTime: 60 * 60_000,
  });
}
