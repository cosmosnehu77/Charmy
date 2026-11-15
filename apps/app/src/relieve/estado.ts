import { create } from "zustand";
import type { Indicador, NivelFoco } from "./logica";

/** Pestaña de la píldora: un indicador del relieve, la vista de focos en vivo o la consulta por zona (#262). */
export type Pestana = Indicador | "vivo" | "zona";

/** En En vivo y en Tu zona, las regiones (si se ven) van por focos. */
export const indicadorDe = (p: Pestana): Indicador => (p === "vivo" || p === "zona" ? "focos" : p);

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
  /** Niveles de intensidad que se ven en En vivo; vacío, todos. */
  nivelesVivo: NivelFoco[];
  /** Ranking abierto: se esconde solo a los segundos y vuelve al acercar el cursor. */
  ranking: boolean;
  /** Recorrido de Charmy guía en curso: mientras dura, el ranking no se esconde. */
  guia: boolean;
  elegirPestana: (p: Pestana) => void;
  /** Elegir de nuevo la región elegida la deselecciona. */
  alternarRegion: (id: string | null) => void;
  usarLinea: (cambio: Partial<EstadoRelieve["linea"]>) => void;
  cambiar: (
    cambio: Partial<Pick<EstadoRelieve, "plano" | "giro" | "horasVivo" | "focoVivo" | "nivelesVivo" | "ranking" | "guia">>,
  ) => void;
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
  nivelesVivo: [],
  ranking: true,
  guia: false,
  elegirPestana: (pestana) =>
    set((s) =>
      pestana === "vivo" || pestana === "zona"
        ? { pestana, seleccion: null, linea: LINEA_LIBRE, focoVivo: pestana === "zona" ? null : s.focoVivo }
        : { pestana, focoVivo: s.focoVivo },
    ),
  alternarRegion: (id) =>
    set((s) => ({ seleccion: id !== null && id === s.seleccion ? null : id, focoVivo: null, linea: LINEA_LIBRE })),
  usarLinea: (cambio) => set((s) => ({ linea: { ...s.linea, ...cambio } })),
  cambiar: (cambio) => set(cambio),
}));
