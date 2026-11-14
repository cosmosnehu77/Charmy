/**
 * Capas propias del mapa: el área elegida y los focos. Se agregan en cada `style.load`,
 * así sobreviven al cambio entre 2D y 3D.
 */
import { colorSinDato, interfaz, rampaConteo } from "@charmy/ui";
import type { ExpressionSpecification, Map as MapaMapLibre } from "maplibre-gl";
import type { ColeccionFocos, Poligono } from "@/consulta/consulta";
import { VEREDICTOS } from "@/vivo/veredictos";

/** Cortes de potencia radiativa (MW) para el color de los focos, con la rampa YlOrRd de 7 clases. */
export const CORTES_FRP = [5, 10, 20, 50, 100, 300] as const;

/** Hay focos sin FRP (FIRMS no siempre lo trae): esos van con el color de «sin dato» y el tamaño mínimo. */
const tieneFrp: ExpressionSpecification = ["==", ["typeof", ["get", "frp"]], "number"];

const colorPorFrp = [
  "case",
  tieneFrp,
  ["step", ["get", "frp"], rampaConteo[0], ...CORTES_FRP.flatMap((corte, i) => [corte, rampaConteo[i + 1] as string])],
  colorSinDato,
] as unknown as ExpressionSpecification;

const vacio = { type: "FeatureCollection" as const, features: [] };

export function datosArea(area: Poligono | null) {
  return area ? { type: "Feature" as const, geometry: area, properties: {} } : vacio;
}

/** Color de cada foco reciente según su veredicto (RF-VIV-02); en la lista va también en texto. */
const colorPorVeredicto = [
  "match",
  ["get", "verdict"],
  ...Object.entries(VEREDICTOS).flatMap(([clave, v]) => [clave, v.color]),
  VEREDICTOS.sin_confirmar?.color ?? interfaz.tintaSuave,
] as unknown as ExpressionSpecification;

export function agregarCapas(
  m: MapaMapLibre,
  area: Poligono | null,
  focos: ColeccionFocos | null,
  vivo: ColeccionFocos | null,
) {
  if (m.getSource("area")) return;
  m.addSource("area", { type: "geojson", data: datosArea(area) });
  m.addSource("focos", { type: "geojson", data: focos ?? vacio });
  m.addSource("vivo", { type: "geojson", data: vivo ?? vacio, promoteId: "id" });
  m.addLayer({
    id: "area-relleno",
    type: "fill",
    source: "area",
    paint: { "fill-color": interfaz.acento, "fill-opacity": 0.08 },
  });
  m.addLayer({
    id: "area-borde",
    type: "line",
    source: "area",
    paint: { "line-color": interfaz.acento, "line-width": 2, "line-dasharray": [2, 1] },
  });
  m.addLayer({
    id: "focos",
    type: "circle",
    source: "focos",
    paint: {
      "circle-color": colorPorFrp,
      // El tamaño también crece con la potencia: el color no va solo (RNF-04).
      "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 0], 0, 3, 50, 6, 300, 10],
      "circle-stroke-color": interfaz.tinta,
      "circle-stroke-width": 0.75,
      "circle-opacity": 0.9,
    },
  });
  // Focos de las últimas 48 horas: más grandes, con borde blanco, para distinguirlos del histórico.
  m.addLayer({
    id: "vivo",
    type: "circle",
    source: "vivo",
    paint: {
      "circle-color": colorPorVeredicto,
      "circle-radius": 7,
      "circle-stroke-color": interfaz.superficie,
      "circle-stroke-width": 2,
    },
  });
}

type Capa = { url: string; bbox: [number, number, number, number] } | null;

/** Imagen satelital del lugar como capa del mapa (RF-CTX-03), debajo del área y los focos. */
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
    primerTexto ?? "area-relleno",
  );
}
