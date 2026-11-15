/** Textos y colores de los veredictos y la evidencia (RF-VIV-02). El color nunca va solo: siempre con texto. */
import { interfaz, paleta } from "@charmy/ui";
import { t } from "@/relieve/idioma";

export const VEREDICTOS: Record<string, { texto: string; color: string }> = {
  confirmado: {
    get texto() {
      return t("Confirmado", "Confirmed");
    },
    color: interfaz.peligro,
  },
  probable: {
    get texto() {
      return t("Probable", "Probable");
    },
    color: interfaz.acento,
  },
  sin_confirmar: {
    get texto() {
      return t("Sin confirmar", "Unconfirmed");
    },
    color: interfaz.tintaSuave,
  },
  fuente_fija: {
    get texto() {
      return t("Probable fuente fija", "Probable fixed source");
    },
    color: paleta.chaqueta,
  },
};

export const veredicto = (v?: string) => VEREDICTOS[v ?? "sin_confirmar"] ?? VEREDICTOS.sin_confirmar!;

export const TIPOS_EVIDENCIA: Record<string, string> = {
  get satelite() {
    return t("Satélite", "Satellite");
  },
  get noticia() {
    return t("Noticia", "News");
  },
  get reporte() {
    return t("Reporte ciudadano", "Citizen report");
  },
  get entidad() {
    return t("Entidad", "Agency");
  },
};

export const ETIQUETAS_EVIDENCIA: Record<string, string> = {
  get apoya() {
    return t("Apoya", "Supports");
  },
  get contradice() {
    return t("Contradice", "Contradicts");
  },
  get sin_informacion() {
    return t("Sin información", "No info");
  },
};
