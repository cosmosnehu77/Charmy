import { create } from "zustand";
import type { Indicador } from "./logica";

/** Pestaña de la píldora: un indicador del relieve o la vista de focos en vivo. */
export type Pestana = Indicador | "vivo";

interface EstadoRelieve {
  pestana: Pestana;
  /** Código de la región elegida (`AR-Q`) o null. */
  seleccion: string | null;
  /** Línea de tiempo: en uso, día elegido (índice de `days`) y si está reproduciendo. */
  linea: { activa: boolean; dia: number; play: boolean };
  plano: boolean;
  giro: boolean;
  /** Ventana de En vivo, en horas. */
  horasVivo: 6 | 24 | 48;
  /** Foco elegido en En vivo (índice en la lista de /live). */
  focoVivo: number | null;
  elegirPestana: (p: Pestana) => void;
  /** Elegir de nuevo la región elegida la deselecciona. */
  alternarRegion: (id: string | null) => void;
  usarLinea: (cambio: Partial<EstadoRelieve["linea"]>) => void;
  cambiar: (cambio: Partial<Pick<EstadoRelieve, "plano" | "giro" | "horasVivo" | "focoVivo">>) => void;
}

const LINEA_LIBRE = { activa: false, dia: 0, play: false };

export const useRelieve = create<EstadoRelieve>()((set) => ({
  pestana: "focos",
  seleccion: null,
  linea: LINEA_LIBRE,
  plano: false,
  giro: true,
  horasVivo: 48,
  focoVivo: null,
  elegirPestana: (pestana) =>
    set((s) => (pestana === "vivo" ? { pestana, seleccion: null, linea: LINEA_LIBRE } : { pestana, focoVivo: s.focoVivo })),
  alternarRegion: (id) =>
    set((s) => ({ seleccion: id !== null && id === s.seleccion ? null : id, focoVivo: null, linea: LINEA_LIBRE })),
  usarLinea: (cambio) => set((s) => ({ linea: { ...s.linea, ...cambio } })),
  cambiar: (cambio) => set(cambio),
}));
