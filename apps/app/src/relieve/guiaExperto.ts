import type { Paso } from "./CharmyGuia";
import { t } from "./idioma";

/**
 * Recorrido de Charmy por el panel de Experto (F4-D9), para quien llega nuevo: para qué sirve cada parte y sus
 * parámetros. Cada `guia` es un `data-guia` del panel; si no está en pantalla (el calendario sin área), se saltea.
 */
export const PASOS_EXPERTO: Paso[] = [
  {
    mood: "saluda",
    get titulo() {
      return t("Experto, paso a paso", "Expert mode, step by step");
    },
    get texto() {
      return t(
        "Acá mirás a fondo un lugar: sus focos, su calendario de quema y cómo está ahora. Te muestro cada parte; podés salir cuando quieras.",
        "Here you can inspect a place in depth: its hotspots, burn calendar, and current conditions. I’ll walk you through each section; you can exit anytime.",
      );
    },
  },
  {
    guia: "zona-donde",
    mood: "explica",
    get titulo() {
      return t("1 · Dónde", "1 · Where");
    },
    get texto() {
      return t(
        "Marcá el área de una de cuatro formas. Rectángulo: dos esquinas en el mapa. Polígono: cada vértice y doble clic en el último. Localidad: buscás un pueblo o una ciudad. Punto: latitud, longitud y un radio.",
        "Mark the area in one of four ways. Rectangle: two corners on the map. Polygon: each vertex and double-click the last one. Locality: search for a town or city. Point: latitude, longitude, and radius.",
      );
    },
  },
  {
    guia: "zona-cuando",
    mood: "explica",
    get titulo() {
      return t("2 · Cuándo", "2 · When");
    },
    get texto() {
      return t(
        "Elegí desde y hasta qué día mirar. Hay datos desde noviembre de 2000 hasta hoy.",
        "Choose the start and end dates. Data is available from November 2000 through today.",
      );
    },
  },
  {
    guia: "zona-filtros",
    mood: "explica",
    get titulo() {
      return t("Serie y confianza", "Series and confidence");
    },
    get texto() {
      return t(
        "Tocá Filtros para abrirlos. La serie armonizada lleva MODIS y VIIRS a una misma medida, así podés comparar años; también podés ver cada satélite solo. La confianza deja afuera las detecciones dudosas.",
        "Tap Filters to expand them. The harmonized series brings MODIS and VIIRS onto a common scale so you can compare across years; you can also view each sensor alone. Confidence filters out uncertain detections.",
      );
    },
  },
  {
    guia: "zona-filtros",
    mood: "explica",
    get titulo() {
      return t("Potencia y momento", "Power and time of day");
    },
    get texto() {
      return t(
        "La potencia (FRP, en megavatios) deja solo los focos más intensos. El momento del día separa los de día y los de noche. El resumen de arriba te dice qué tenés elegido.",
        "Fire radiative power (FRP, in megawatts) keeps only the most intense hotspots. Time of day separates daytime and nighttime detections. The summary above shows your active filters.",
      );
    },
  },
  {
    guia: "zona-resultado",
    mood: "explica",
    get titulo() {
      return t("Cuántos focos", "How many hotspots");
    },
    get texto() {
      return t(
        "Acá ves cuántos focos hay con esos filtros. Con ▶ el mapa los muestra mes a mes.",
        "Here you see how many hotspots match your filters. Press ▶ to play them month by month on the map.",
      );
    },
  },
  {
    guia: "zona-secciones",
    mood: "explica",
    get titulo() {
      return t("Resumen, Lugar y Validación", "Summary, Place, and Validation");
    },
    get texto() {
      return t(
        "Resumen: el día con más focos, cuántos fueron de noche y su potencia. Lugar: el tiempo y la imagen satelital del centro del área. Validación: qué tan bien coinciden los satélites al armonizarlos.",
        "Summary: peak day, nighttime share, and radiative power. Place: weather and satellite imagery for the area center. Validation: how well the sensors agree after harmonization.",
      );
    },
  },
  {
    guia: "calendario",
    mood: "explica",
    get titulo() {
      return t("Calendario de quema", "Burn calendar");
    },
    get texto() {
      return t(
        "Cada celda es un mes. En Anomalía, naranja es más fuego que lo normal para ese mes y violeta, menos; en Cantidad ves los días-celda con fuego. En Descargas bajás los focos y el calendario.",
        "Each cell is a month. In Anomaly, orange means more fire than normal for that month and purple means less; in Count you see fire cell-days. Under Downloads you can export hotspots and the calendar.",
      );
    },
  },
  {
    mood: "pensando",
    get titulo() {
      return t("Tocá un foco", "Tap a hotspot");
    },
    get texto() {
      return t(
        "Con el área marcada, tocá un punto del mapa y te muestro sus datos originales: satélite, hora, confianza y potencia.",
        "With an area selected, tap any point on the map to see its raw attributes: satellite, time, confidence, and power.",
      );
    },
  },
  {
    guia: "zona-reportar",
    mood: "explica",
    get titulo() {
      return t("¿Ves fuego?", "Do you see fire?");
    },
    get texto() {
      return t(
        "Con Reportar un foco nos avisás dónde, sin crear una cuenta. Queda «sin verificar» hasta que alguien lo revise.",
        "Use Report a hotspot to let us know where, without creating an account. It stays “unverified” until reviewed.",
      );
    },
  },
  {
    mood: "festeja",
    get titulo() {
      return t("¡Listo!", "All set!");
    },
    get texto() {
      return t(
        "Si querés repasar, tocá Guía en el encabezado del panel.",
        "If you want a refresher, tap Guide in the panel header.",
      );
    },
    emergencia: true,
  },
];
