import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Modo = "novato" | "experto";
export type PerfilMapa = "2d" | "3d";

interface EstadoApp {
  modo: Modo;
  perfilMapa: PerfilMapa;
  /** El recorrido de Charmy se muestra solo la primera vez en modo novato (RF-CHA-05). */
  recorridoVisto: boolean;
  cambiarModo: (modo: Modo) => void;
  marcarRecorrido: (visto: boolean) => void;
  cambiarPerfilMapa: (perfil: PerfilMapa) => void;
}

/** Si el navegador pide ahorrar datos o la red es lenta, se arranca en 2D (RNF-03). */
export function perfilInicial(): PerfilMapa {
  const conexion = (
    globalThis.navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  )?.connection;
  if (conexion?.saveData) return "2d";
  if (conexion?.effectiveType && /(^|-)(2g|3g)$/.test(conexion.effectiveType)) return "2d";
  return "3d";
}

export const useApp = create<EstadoApp>()(
  persist(
    (set) => ({
      modo: "novato",
      perfilMapa: perfilInicial(),
      recorridoVisto: false,
      cambiarModo: (modo) => set({ modo }),
      marcarRecorrido: (recorridoVisto) => set({ recorridoVisto }),
      cambiarPerfilMapa: (perfilMapa) => set({ perfilMapa }),
    }),
    { name: "charmy-app", version: 1 },
  ),
);
