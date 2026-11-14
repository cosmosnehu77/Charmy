import { useQuery } from "@tanstack/react-query";
import { pedir, type Salud, urlApi } from "./api";

export type EstadoApi = "sin-configurar" | "conectando" | "conectada" | "no-disponible";

/** Estado de la API para mostrarlo en la interfaz. Si falla, el resto de la app sigue andando. */
export function useEstadoApi(): EstadoApi {
  const salud = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => pedir<Salud>("/health", { signal }),
    enabled: urlApi !== "",
    retry: 1,
    refetchInterval: 5 * 60_000,
  });
  if (!urlApi) return "sin-configurar";
  if (salud.isPending) return "conectando";
  return salud.isSuccess && salud.data.status === "ok" ? "conectada" : "no-disponible";
}
