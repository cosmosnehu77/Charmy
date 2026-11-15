import { create } from "zustand";

interface EstadoVivo {
  /** Capa de focos de las últimas 48 horas visible (RF-VIV-01). */
  visible: boolean;
  /** Id del foco reciente elegido, para ver su evidencia. */
  seleccionado: string | null;
  /** Formulario de reporte abierto (RF-ALE-01). */
  reportando: boolean;
  /** Satélites cuyos focos se muestran, en la lista y en el mapa (códigos de FIRMS: `N20`, `N21`). */
  satelites: string[];
  cambiar: (parcial: Partial<Omit<EstadoVivo, "cambiar">>) => void;
}

export const useVivo = create<EstadoVivo>()((set) => ({
  visible: false,
  seleccionado: null,
  reportando: false,
  satelites: ["N20", "N21"],
  cambiar: (parcial) => set(parcial),
}));
