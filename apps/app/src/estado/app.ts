import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Modo = "novato" | "experto";
export type PerfilMapa = "2d" | "3d";
/** Vista principal: el país en relieve por provincia (F4-R1) o la consulta por área y fechas. */
export type Vista = "relieve" | "consulta";

interface EstadoApp {
  vista: Vista;
  modo: Modo;
  perfilMapa: PerfilMapa;
  /** El recorrido de Charmy se muestra solo la primera vez en modo novato (RF-CHA-05). */
  recorridoVisto: boolean;
  cambiarVista: (vista: Vista) => void;
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
      vista: "relieve",
      modo: "novato",
      perfilMapa: perfilInicial(),
      recorridoVisto: false,
      cambiarVista: (vista) => set({ vista }),
      cambiarModo: (modo) => set({ modo }),
      marcarRecorrido: (recorridoVisto) => set({ recorridoVisto }),
      cambiarPerfilMapa: (perfilMapa) => set({ perfilMapa }),
    }),
    { name: "charmy-app", version: 1 },
  ),
);
