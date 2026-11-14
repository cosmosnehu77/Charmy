import { create } from "zustand";

export type EstiloImagen = "color_real" | "falso_color";

interface EstadoContexto {
  estilo: EstiloImagen;
  /** Imagen satelital como capa del mapa: URL y bbox (oeste, sur, este, norte), o null. */
  capa: { url: string; bbox: [number, number, number, number] } | null;
  cambiar: (parcial: Partial<Omit<EstadoContexto, "cambiar">>) => void;
}

export const useContexto = create<EstadoContexto>()((set) => ({
  estilo: "color_real",
  capa: null,
  cambiar: (parcial) => set(parcial),
}));
