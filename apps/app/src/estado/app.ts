import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Modo = "novato" | "experto";
export type PerfilMapa = "2d" | "3d";

interface EstadoApp {
  modo: Modo;
  perfilMapa: PerfilMapa;
  cambiarModo: (modo: Modo) => void;
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
      cambiarModo: (modo) => set({ modo }),
      cambiarPerfilMapa: (perfilMapa) => set({ perfilMapa }),
    }),
    { name: "charmy-app", version: 1 },
  ),
);
