import type { Paso } from "./CharmyGuia";

/**
 * Recorrido de Charmy por el panel de Experto (F4-D9), para quien llega nuevo: para qué sirve cada parte y sus
 * parámetros. Cada `guia` es un `data-guia` del panel; si no está en pantalla (el calendario sin área), se saltea.
 */
export const PASOS_EXPERTO: Paso[] = [
  {
    mood: "saluda",
    titulo: "Experto, paso a paso",
    texto: "Acá mirás a fondo un lugar: sus focos, su calendario de quema y cómo está ahora. Te muestro cada parte; podés salir cuando quieras.",
  },
  {
    guia: "zona-donde",
    mood: "explica",
    titulo: "1 · Dónde",
    texto:
      "Marcá el área de una de cuatro formas. Rectángulo: dos esquinas en el mapa. Polígono: cada vértice y doble clic en el último. Localidad: buscás un pueblo o una ciudad. Punto: latitud, longitud y un radio.",
  },
  {
    guia: "zona-cuando",
    mood: "explica",
    titulo: "2 · Cuándo",
    texto: "Elegí desde y hasta qué día mirar. Hay datos desde noviembre de 2000 hasta hoy.",
  },
  {
    guia: "zona-filtros",
    mood: "explica",
    titulo: "Serie y confianza",
    texto:
      "Tocá Filtros para abrirlos. La serie armonizada lleva MODIS y VIIRS a una misma medida, así podés comparar años; también podés ver cada satélite solo. La confianza deja afuera las detecciones dudosas.",
  },
  {
    guia: "zona-filtros",
    mood: "explica",
    titulo: "Potencia y momento",
    texto:
      "La potencia (FRP, en megavatios) deja solo los focos más intensos. El momento del día separa los de día y los de noche. El resumen de arriba te dice qué tenés elegido.",
  },
  {
    guia: "zona-resultado",
    mood: "explica",
    titulo: "Cuántos focos",
    texto: "Acá ves cuántos focos hay con esos filtros. Con ▶ el mapa los muestra mes a mes.",
  },
  {
    guia: "zona-secciones",
    mood: "explica",
    titulo: "Resumen, Lugar y Validación",
    texto:
      "Resumen: el día con más focos, cuántos fueron de noche y su potencia. Lugar: el tiempo y la imagen satelital del centro del área. Validación: qué tan bien coinciden los satélites al armonizarlos.",
  },
  {
    guia: "calendario",
    mood: "explica",
    titulo: "Calendario de quema",
    texto:
      "Cada celda es un mes. En Anomalía, naranja es más fuego que lo normal para ese mes y violeta, menos; en Cantidad ves los días-celda con fuego. En Descargas bajás los focos y el calendario.",
  },
  {
    mood: "pensando",
    titulo: "Tocá un foco",
    texto: "Con el área marcada, tocá un punto del mapa y te muestro sus datos originales: satélite, hora, confianza y potencia.",
  },
  {
    guia: "zona-reportar",
    mood: "explica",
    titulo: "¿Ves fuego?",
    texto: "Con Reportar un foco nos avisás dónde, sin crear una cuenta. Queda «sin verificar» hasta que alguien lo revise.",
  },
  {
    mood: "festeja",
    titulo: "¡Listo!",
    texto: "Si querés repasar, tocá Guía en el encabezado del panel.",
    emergencia: true,
  },
];
