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
  /** Mes (AAAA-MM) que muestra la reproducción temporal, o null para todo el período (RF-MAP-07). */
  mesReproduccion: string | null;
}

interface AccionesConsulta {
  cambiar: (parcial: Partial<DatosConsulta>) => void;
}

export const hoyUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Por defecto: los últimos 5 años calendario (el calendario necesita varios años para comparar),
 * serie armonizada y confianza nominal o alta (D-04).
 */
export function estadoInicialConsulta(hoy: string): DatosConsulta {
  return {
    hoy,
    area: null,
    desde: `${Number(hoy.slice(0, 4)) - 4}-01-01`,
    hasta: hoy,
    fuente: "harmonized",
    confianzaMin: "nominal",
    frpMin: 0,
    momento: "todos",
    dibujando: null,
    mesReproduccion: null,
  };
}

export const useConsulta = create<DatosConsulta & AccionesConsulta>()((set) => ({
  ...estadoInicialConsulta(hoyUtc()),
  cambiar: (parcial) => set(parcial),
}));
