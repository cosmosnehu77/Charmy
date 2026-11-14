/**
 * Los dos perfiles del mapa (RF-MAP-06, decisión D-06): un solo motor, MapLibre.
 * - 2D: estilo vectorial liviano, sin relieve ni inclinación. Para conexiones lentas (RNF-03).
 * - 3D: estilo con más detalle, relieve Terrarium y sombreado.
 * Todo carga sin clave (probado en F0-D1, #9).
 */
import type { StyleSpecification } from "maplibre-gl";
import { paleta } from "@charmy/ui";
import type { PerfilMapa } from "@/estado/app";

export const URL_TERRARIUM = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
const ATRIBUCION_RELIEVE =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles (Mapzen, AWS)</a>';

/** Argentina y Chile (D-17): oeste, sur, este, norte. */
export const LIMITES_MVP: [number, number, number, number] = [-76, -56, -53, -21];

export interface ConfigPerfil {
  estilo: string;
  inclinacion: number;
  inclinacionMax: number;
  relieve: boolean;
}

export const perfiles: Record<PerfilMapa, ConfigPerfil> = {
  "2d": {
    estilo: "https://tiles.openfreemap.org/styles/positron",
    inclinacion: 0,
    inclinacionMax: 0,
    relieve: false,
  },
  "3d": {
    estilo: "https://tiles.openfreemap.org/styles/liberty",
    inclinacion: 55,
    inclinacionMax: 80,
    relieve: true,
  },
};

const fuenteDem = {
  type: "raster-dem" as const,
  tiles: [URL_TERRARIUM],
  encoding: "terrarium" as const,
  tileSize: 256,
  maxzoom: 15,
  attribution: ATRIBUCION_RELIEVE,
};

/**
 * Ajusta el estilo base al perfil. Se usa como `transformStyle` de `map.setStyle`, que es también
 * donde las capas propias (focos, área) se van a volver a agregar al cambiar de perfil.
 */
export function transformarEstilo(perfil: PerfilMapa) {
  return (_anterior: StyleSpecification | undefined, siguiente: StyleSpecification): StyleSpecification => {
    if (!perfiles[perfil].relieve) {
      const { terrain: _t, sky: _s, ...resto } = siguiente;
      return resto;
    }
    // Fuentes separadas para relieve y sombreado: MapLibre lo recomienda por calidad de dibujo.
    const sources = { ...siguiente.sources, relieve: fuenteDem, sombreado: { ...fuenteDem } };
    // El sombreado va debajo de calles y nombres: antes de la primera capa de transporte.
    const capas = [...siguiente.layers];
    const indice = capas.findIndex((c) => "source-layer" in c && c["source-layer"] === "transportation");
    capas.splice(indice === -1 ? capas.length : indice, 0, {
      id: "sombreado",
      type: "hillshade",
      source: "sombreado",
      paint: { "hillshade-shadow-color": paleta.banda, "hillshade-exaggeration": 0.35 },
    });
    return {
      ...siguiente,
      sources,
      layers: capas,
      terrain: { source: "relieve", exaggeration: 1.4 },
      sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0] },
    };
  };
}
