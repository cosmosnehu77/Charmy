import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Modo = "novato" | "experto";

interface EstadoApp {
  modo: Modo;
  cambiarModo: (modo: Modo) => void;
}

/**
 * Modo de la app (RF-MOD-01, RF-MOD-02). Se guarda en el navegador. La versión 2 deja solo el modo: la vista, el
 * perfil del mapa y el recorrido eran de la página Consulta, que pasó a Tu zona en Relieve (#276).
 */
export const useApp = create<EstadoApp>()(
  persist(
    (set) => ({
      modo: "novato",
      cambiarModo: (modo) => set({ modo }),
    }),
    {
      name: "charmy-app",
      version: 2,
      migrate: (guardado) => ({ modo: (guardado as { modo?: Modo } | undefined)?.modo ?? "novato" }) as EstadoApp,
    },
  ),
);
