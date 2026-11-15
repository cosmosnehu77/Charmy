import { create } from "zustand";

interface EstadoVivo {
  /** Formulario de reporte abierto (RF-ALE-01). */
  reportando: boolean;
  /** Satélites cuyos focos se muestran en En vivo (códigos de FIRMS: `N20`, `N21`). */
  satelites: string[];
  cambiar: (parcial: Partial<Omit<EstadoVivo, "cambiar">>) => void;
}

export const useVivo = create<EstadoVivo>()((set) => ({
  reportando: false,
  satelites: ["N20", "N21"],
  cambiar: (parcial) => set(parcial),
}));
