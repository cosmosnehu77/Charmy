import type { components, paths } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { pedir } from "@/lib/api";
import { LIMITES_MVP } from "@/mapa/perfiles";
import { useVivo } from "./estado";

export type RespuestaVivo =
  paths["/live"]["get"]["responses"]["200"]["content"]["application/geo+json"];
export type Evidencia = components["schemas"]["Verification"];

/** Focos de las últimas 48 horas en Argentina y Chile. El worker consulta FIRMS cada 30 minutos (D-13). */
export function useFocosVivo() {
  const visible = useVivo((s) => s.visible);
  return useQuery({
    queryKey: ["vivo"],
    queryFn: ({ signal }) =>
      pedir<RespuestaVivo>(`/live?bbox=${LIMITES_MVP.join(",")}&hours=48`, {
        signal,
        headers: { Accept: "application/geo+json" },
      }),
    enabled: visible,
    refetchInterval: 10 * 60_000,
  });
}

export function useEvidencia(id: string | null) {
  return useQuery({
    queryKey: ["evidencia", id],
    queryFn: ({ signal }) => pedir<Evidencia>(`/live/${encodeURIComponent(id as string)}/evidence`, { signal }),
    enabled: id !== null,
  });
}
