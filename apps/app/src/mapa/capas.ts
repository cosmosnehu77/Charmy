/** Capas propias del mapa que comparte Tu zona: el contorno del área y la imagen satelital del contexto. */
import type { Map as MapaMapLibre } from "maplibre-gl";
import type { Poligono } from "@/consulta/consulta";

const vacio = { type: "FeatureCollection" as const, features: [] };

export function datosArea(area: Poligono | null) {
  return area ? { type: "Feature" as const, geometry: area, properties: {} } : vacio;
}

type Capa = { url: string; bbox: [number, number, number, number] } | null;

/** Imagen satelital del lugar como capa del mapa (RF-CTX-03), debajo de los nombres. */
export function ponerImagen(m: MapaMapLibre, capa: Capa) {
  if (m.getLayer("imagen")) m.removeLayer("imagen");
  if (m.getSource("imagen")) m.removeSource("imagen");
  if (!capa) return;
  const [o, s, e, n] = capa.bbox;
  m.addSource("imagen", {
    type: "image",
    url: capa.url,
    coordinates: [
      [o, n],
      [e, n],
      [e, s],
      [o, s],
    ],
  });
  // Debajo de los nombres del mapa base, para que se sigan leyendo.
  const primerTexto = m.getStyle().layers.find((c) => c.type === "symbol")?.id;
  m.addLayer(
    { id: "imagen", type: "raster", source: "imagen", paint: { "raster-opacity": 0.9 } },
    primerTexto,
  );
}
