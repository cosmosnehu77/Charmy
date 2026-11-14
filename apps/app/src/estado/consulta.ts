import { create } from "zustand";
import type { Confianza, Fuente, Momento, Poligono } from "@/consulta/consulta";

export type ModoDibujo = "rectangle" | "polygon";

export interface DatosConsulta {
  /** Fecha de hoy (UTC, AAAA-MM-DD). Se fija al iniciar para que las pruebas no dependan del reloj. */
  hoy: string;
  area: Poligono | null;
  desde: string;
  hasta: string;
  fuente: Fuente;
  confianzaMin: Confianza;
  frpMin: number;
  momento: Momento;
  /** Herramienta de dibujo activa en el mapa, o null. */
  dibujando: ModoDibujo | null;
}

interface AccionesConsulta {
  cambiar: (parcial: Partial<DatosConsulta>) => void;
}

const restarDias = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};

export const hoyUtc = () => new Date().toISOString().slice(0, 10);

/** Por defecto: la última semana, serie armonizada y confianza nominal o alta (D-04). */
export function estadoInicialConsulta(hoy: string): DatosConsulta {
  return {
    hoy,
    area: null,
    desde: restarDias(hoy, 7),
    hasta: hoy,
    fuente: "harmonized",
    confianzaMin: "nominal",
    frpMin: 0,
    momento: "todos",
    dibujando: null,
  };
}

export const useConsulta = create<DatosConsulta & AccionesConsulta>()((set) => ({
  ...estadoInicialConsulta(hoyUtc()),
  cambiar: (parcial) => set(parcial),
}));
