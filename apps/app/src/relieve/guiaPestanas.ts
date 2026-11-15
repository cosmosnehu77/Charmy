import type { Paso } from "./CharmyGuia";
import type { Pestana } from "./estado";
import { t } from "./idioma";

/**
 * Recorridos de Charmy guía, uno por pestaña de la píldora: qué muestra cada una y cómo se usa. Focos lleva el
 * recorrido general del mapa; Experto tiene el suyo en `guiaExperto.ts`. Cada `guia` es un `data-guia` de la vista;
 * si no está en pantalla, ese paso se saltea.
 */
type Texto = [es: string, en: string];

function paso({ titulo, texto, ...resto }: Omit<Paso, "titulo" | "texto"> & { titulo: Texto; texto: Texto }): Paso {
  return {
    ...resto,
    get titulo() {
      return t(titulo[0], titulo[1]);
    },
    get texto() {
      return t(texto[0], texto[1]);
    },
  };
}

const LISTO_MAPA = paso({
  cerrarRegion: true,
  mood: "festeja",
  titulo: ["¡Listo!", "All set!"],
  texto: [
    "Si necesitás ayuda de nuevo, tocame: estoy abajo a la izquierda. Cada pestaña tiene su propia guía: elegila y tocame.",
    "If you need help again, tap me—I’m in the bottom-left corner. Each tab has its own guide: pick it and tap me.",
  ],
  emergencia: true,
});

const DIA_POR_DIA = paso({
  guia: "linea",
  mood: "explica",
  titulo: ["Día por día", "Day by day"],
  texto: [
    "Con el play ves cómo suben y bajan los focos de esa provincia. También podés tocar un día.",
    "Press play to watch hotspots rise and fall across days in that province, or tap any day directly.",
  ],
});

export const PASOS_FOCOS: Paso[] = [
  paso({
    mood: "saluda",
    titulo: ["¡Hola! Soy Charmy", "Hi! I’m Charmy"],
    texto: [
      "Te muestro en un minuto cómo mirar el fuego en Argentina y Chile. Podés salir cuando quieras.",
      "I’ll show you in a minute how to explore fire activity in Argentina and Chile. You can exit anytime.",
    ],
  }),
  paso({
    guia: "indicadores",
    mood: "explica",
    titulo: ["Elegí qué mirar", "Choose what to view"],
    texto: [
      "Focos, intensidad, anomalía o predicción: cada provincia sube según ese dato. En vivo muestra los focos de las últimas horas.",
      "Hotspots, intensity, anomaly, or forecast: each province rises according to that metric. Live shows hotspots from recent hours.",
    ],
  }),
  paso({
    guia: "zona",
    mood: "explica",
    titulo: ["Marcá tu zona", "Mark your area"],
    texto: [
      "En Experto marcás un área en el mapa: un rectángulo, un polígono, un punto con radio o una localidad. Te muestro cuánto fuego hubo ahí mes a mes y qué hay cerca.",
      "In Expert you mark an area on the map: a rectangle, a polygon, a point with radius, or a locality. I’ll show you how much fire occurred there month by month and what is nearby.",
    ],
  }),
  paso({
    guia: "lupa",
    mood: "explica",
    titulo: ["Buscá tu lugar", "Find your place"],
    texto: ["Tocá la lupa y escribí el nombre de una provincia o región.", "Tap the search icon and type the name of a province or region."],
  }),
  paso({
    guia: "ranking",
    mood: "explica",
    titulo: ["Las que más arden", "Top burning regions"],
    texto: [
      "El ranking ordena las regiones con más fuego según el indicador. Tocá una para ver su ficha.",
      "The ranking orders the regions with the most fire by the selected indicator. Tap one to open its card.",
    ],
  }),
  paso({
    guia: "controles",
    mood: "explica",
    titulo: ["Mové el mapa", "Move the map"],
    texto: [
      "Acercá, alejá, mirá al norte, pasá a 2D si tu conexión es lenta y frená el giro. También podés arrastrar el mapa.",
      "Zoom in, zoom out, reset north, switch to 2D on slower connections, and pause rotation. You can also drag the map.",
    ],
  }),
  paso({
    guia: "leyenda",
    mood: "pensando",
    titulo: ["¿Qué significan los colores?", "What do the colors mean?"],
    texto: [
      "Cuanto más alta y más oscura la región, más fuego. Si dudás, mirá acá.",
      "The taller and darker the region, the more fire. Whenever in doubt, check here.",
    ],
  }),
  paso({
    guia: "ficha",
    abrirRegion: true,
    mood: "explica",
    titulo: ["La ficha de una provincia", "A province’s card"],
    texto: [
      "Al tocar una provincia se abre su ficha y las demás se apagan para que la veas sola. Para volver, tocala de nuevo.",
      "Tapping a province opens its card and dims the others so you can focus on it. Tap it again to go back.",
    ],
  }),
  DIA_POR_DIA,
  LISTO_MAPA,
];

const PASOS_INTENSIDAD: Paso[] = [
  paso({
    mood: "saluda",
    titulo: ["Intensidad, paso a paso", "Intensity, step by step"],
    texto: [
      "Acá no contás focos: ves cuánta energía liberó el fuego (FRP, en megavatios). Sirve para separar muchas quemas chicas de pocos incendios fuertes.",
      "Here you don’t count hotspots: you see how much energy the fire released (FRP, in megawatts). It helps tell many small burns apart from a few strong fires.",
    ],
  }),
  paso({
    guia: "ranking",
    mood: "explica",
    titulo: ["Las que más energía liberan", "Most energy released"],
    texto: [
      "El ranking ordena las provincias por la potencia sumada de sus focos de los últimos días. Una con pocos focos puede quedar arriba si son muy fuertes. Tocá una para ver su ficha.",
      "The ranking orders provinces by the total power of their hotspots in recent days. One with few hotspots can rank high if they are very strong. Tap one to open its card.",
    ],
  }),
  paso({
    guia: "leyenda",
    mood: "pensando",
    titulo: ["Cómo leer el mapa", "How to read the map"],
    texto: [
      "Cuanto más alta y más oscura la provincia, más potencia. Pasá el cursor por una para ver sus megavatios.",
      "The taller and darker the province, the more power. Hover over one to see its megawatts.",
    ],
  }),
  paso({
    guia: "ficha",
    abrirRegion: true,
    mood: "explica",
    titulo: ["Intensidad en la ficha", "Intensity on the card"],
    texto: [
      "En la ficha, «Intensidad total» te dice los megavatios de esa provincia, junto a sus focos y cómo viene contra lo normal.",
      "On the card, “Total intensity” shows that province’s megawatts, next to its hotspots and how it compares to normal.",
    ],
  }),
  DIA_POR_DIA,
  LISTO_MAPA,
];

const PASOS_ANOMALIA: Paso[] = [
  paso({
    mood: "saluda",
    titulo: ["Anomalía, paso a paso", "Anomaly, step by step"],
    texto: [
      "Acá comparás el último mes con el mismo mes de otros años. No te dice cuánto fuego hubo, sino si fue más o menos que lo normal.",
      "Here you compare last month with the same month in other years. It doesn’t tell you how much fire there was, but whether it was more or less than normal.",
    ],
  }),
  paso({
    guia: "ranking",
    mood: "explica",
    titulo: ["Las más fuera de lo normal", "Furthest from normal"],
    texto: [
      "Cada provincia lleva un percentil: 50 es un mes típico y cerca de 100, uno de los que más fuego tuvieron para esa época. El ranking muestra las más altas.",
      "Each province gets a percentile: 50 is a typical month, and close to 100 is one of the months with the most fire for that time of year. The ranking shows the highest.",
    ],
  }),
  paso({
    guia: "leyenda",
    mood: "pensando",
    titulo: ["Cómo leer el mapa", "How to read the map"],
    texto: [
      "Cuanto más alta y más oscura la provincia, más se aleja de lo normal. Una baja tuvo menos fuego que de costumbre.",
      "The taller and darker the province, the further from normal. A low one had less fire than usual.",
    ],
  }),
  paso({
    guia: "ficha",
    abrirRegion: true,
    mood: "explica",
    titulo: ["Comparado con lo normal", "Compared to normal"],
    texto: [
      "En la ficha, la barra marca dónde cae el último mes, de menos a más. Más abajo abrís el calendario de quema para ver todos los meses.",
      "On the card, the bar shows where last month falls, from less to more. Further down you can open the burn calendar to see every month.",
    ],
  }),
  LISTO_MAPA,
];

const PASOS_PREDICCION: Paso[] = [
  paso({
    mood: "saluda",
    titulo: ["Predicción, paso a paso", "Forecast, step by step"],
    texto: [
      "Acá ves cuánto fuego espera un modelo para el mes que viene, según la historia de cada provincia. Es una estimación, no un aviso.",
      "Here you see how much fire a model expects next month, based on each province’s history. It’s an estimate, not a warning.",
    ],
  }),
  paso({
    guia: "ranking",
    mood: "explica",
    titulo: ["Dónde se espera más fuego", "Where more fire is expected"],
    texto: [
      "El ranking ordena las provincias por las celdas con fuego que espera el modelo. Cada celda mide 0,1°, unos 11 km de lado.",
      "The ranking orders provinces by the cells with fire the model expects. Each cell is 0.1°, about 11 km across.",
    ],
  }),
  paso({
    guia: "leyenda",
    mood: "pensando",
    titulo: ["Cómo leer el mapa", "How to read the map"],
    texto: [
      "Cuanto más alta y más oscura la provincia, más celdas con fuego espera el modelo.",
      "The taller and darker the province, the more cells with fire the model expects.",
    ],
  }),
  paso({
    guia: "ficha",
    abrirRegion: true,
    mood: "explica",
    titulo: ["Los próximos meses", "Upcoming months"],
    texto: [
      "En la ficha ves los dos meses de pronóstico. En «Más adelante», lo habitual ajustado para los meses siguientes.",
      "On the card you see the two forecast months. Under “Further ahead”, the adjusted usual for the following months.",
    ],
  }),
  paso({
    guia: "zona",
    cerrarRegion: true,
    mood: "explica",
    titulo: ["¿Y tu zona?", "What about your area?"],
    texto: [
      "En Experto marcás un área chica y te digo la probabilidad de fuego ahí en los próximos meses.",
      "In Expert you mark a small area and I’ll tell you the chance of fire there in the coming months.",
    ],
  }),
  LISTO_MAPA,
];

export const PASOS_VIVO: Paso[] = [
  paso({
    mood: "saluda",
    titulo: ["En vivo, paso a paso", "Live, step by step"],
    texto: [
      "Acá ves los focos de calor que detectaron los satélites NOAA-20 y NOAA-21 en las últimas horas. Cada punto del mapa es un foco.",
      "Here you see the thermal hotspots detected by the NOAA-20 and NOAA-21 satellites in recent hours. Each dot on the map is a hotspot.",
    ],
  }),
  paso({
    guia: "vivo-total",
    mood: "explica",
    titulo: ["Cuántos hay", "How many"],
    texto: [
      "El número grande cuenta los focos de la ventana elegida. Abajo te digo si son más o menos que en la ventana anterior.",
      "The big number counts hotspots in the selected window. Below it I tell you whether there are more or fewer than in the previous window.",
    ],
  }),
  paso({
    guia: "vivo-ventana",
    mood: "explica",
    titulo: ["Cuánto hacia atrás", "How far back"],
    texto: ["Elegí mirar las últimas 6, 24 o 48 horas.", "Choose to view the last 6, 24, or 48 hours."],
  }),
  paso({
    guia: "vivo-satelites",
    mood: "explica",
    titulo: ["Qué satélites", "Which satellites"],
    texto: [
      "Tildá o destildá cada satélite para ver solo sus focos. Tiene que quedar al menos uno.",
      "Check or uncheck each satellite to see only its hotspots. At least one must stay selected.",
    ],
  }),
  paso({
    guia: "vivo-intensidad",
    mood: "explica",
    titulo: ["Tamaño = intensidad", "Size = intensity"],
    texto: [
      "Cuanto más grande el punto, más potente el foco. Tocá un nivel para ver solo esos; tocalo de nuevo para ver todos.",
      "The bigger the dot, the more powerful the hotspot. Tap a level to see only those; tap it again to see all.",
    ],
  }),
  paso({
    guia: "vivo-estadisticas",
    mood: "explica",
    titulo: ["Dónde hay más", "Where there are more"],
    texto: [
      "Las regiones con más focos ahora y cuántos hay de cada veredicto.",
      "The regions with the most hotspots right now and how many there are of each verdict.",
    ],
  }),
  paso({
    guia: "vivo-intensos",
    mood: "explica",
    titulo: ["Los más intensos", "Most intense"],
    texto: [
      "Tocá uno, o un punto del mapa, y se abre su ficha: hora, satélite, confianza y dónde queda en Google Maps.",
      "Tap one, or a dot on the map, to open its card: time, satellite, confidence, and where it is on Google Maps.",
    ],
  }),
  paso({
    guia: "vivo-lista",
    mood: "explica",
    titulo: ["Lista de focos", "Hotspot list"],
    texto: [
      "Abrí la lista para recorrer todos los focos, del más nuevo al más viejo. Sirve también con teclado o lector de pantalla.",
      "Open the list to go through every hotspot, newest first. It also works with a keyboard or screen reader.",
    ],
  }),
  paso({
    mood: "pensando",
    titulo: ["¿Es un incendio?", "Is it a wildfire?"],
    texto: [
      "No todo foco es un incendio: puede ser una quema o una fuente fija. El veredicto de cada foco junta satélite, fuentes fijas, noticias y reportes.",
      "Not every hotspot is a wildfire: it may be a burn or a fixed source. Each hotspot’s verdict combines satellite data, fixed sources, news, and reports.",
    ],
  }),
  paso({
    mood: "festeja",
    titulo: ["¡Listo!", "All set!"],
    texto: [
      "Si querés repasar, tocá Guía en el panel. Cada pestaña tiene su propia guía.",
      "If you want a refresher, tap Guide in the panel. Each tab has its own guide.",
    ],
    emergencia: true,
  }),
];

/** Recorrido de cada pestaña del mapa. Experto lleva el suyo en su panel (`PASOS_EXPERTO`). */
export function pasosDe(pestana: Exclude<Pestana, "zona" | "vivo">): Paso[] {
  if (pestana === "frp") return PASOS_INTENSIDAD;
  if (pestana === "anomalia") return PASOS_ANOMALIA;
  if (pestana === "prediccion") return PASOS_PREDICCION;
  return PASOS_FOCOS;
}
