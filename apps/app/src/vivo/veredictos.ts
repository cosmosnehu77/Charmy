/** Textos y colores de los veredictos y la evidencia (RF-VIV-02). El color nunca va solo: siempre con texto. */
import { interfaz, paleta } from "@charmy/ui";

export const VEREDICTOS: Record<string, { texto: string; color: string }> = {
  confirmado: { texto: "Confirmado", color: interfaz.peligro },
  probable: { texto: "Probable", color: interfaz.acento },
  sin_confirmar: { texto: "Sin confirmar", color: interfaz.tintaSuave },
  fuente_fija: { texto: "Probable fuente fija", color: paleta.chaqueta },
};

export const veredicto = (v?: string) => VEREDICTOS[v ?? "sin_confirmar"] ?? VEREDICTOS.sin_confirmar!;

export const TIPOS_EVIDENCIA: Record<string, string> = {
  satelite: "Satélite",
  noticia: "Noticia",
  reporte: "Reporte ciudadano",
  entidad: "Entidad",
};

export const ETIQUETAS_EVIDENCIA: Record<string, string> = {
  apoya: "Apoya",
  contradice: "Contradice",
  sin_informacion: "Sin información",
};
