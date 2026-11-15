import type { components, paths } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { pedir } from "@/lib/api";

export type RespuestaVivo =
  paths["/live"]["get"]["responses"]["200"]["content"]["application/geo+json"];
export type Evidencia = components["schemas"]["Verification"];

export function useEvidencia(id: string | null) {
  return useQuery({
    queryKey: ["evidencia", id],
    queryFn: ({ signal }) => pedir<Evidencia>(`/live/${encodeURIComponent(id as string)}/evidence`, { signal }),
    enabled: id !== null,
  });
}
