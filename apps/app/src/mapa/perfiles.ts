/**
 * Mapa base de Charmy: límites del MVP y nombres de lugares en español. Lo usa la vista Relieve (F4-R1).
 */
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

/** Argentina y Chile (D-17): oeste, sur, este, norte. */
export const LIMITES_MVP: [number, number, number, number] = [-76, -56, -53, -21];

/**
 * Etiqueta de lugares en español: `name:es` de OpenStreetMap o el nombre local. Las Malvinas se nombran siempre así,
 * aunque a la tesela le falte `name:es`.
 */
export const NOMBRE_ES: ExpressionSpecification = [
  "match",
  ["get", "name"],
  "Falkland Islands",
  "Islas Malvinas",
  ["coalesce", ["get", "name:es"], ["get", "name"]],
];

/** Los estilos de OpenFreeMap etiquetan en inglés (`name_en`): se pasan a español. Las rutas (`ref`) no se tocan. */
export function nombresEnEspanol(estilo: StyleSpecification): StyleSpecification {
  return {
    ...estilo,
    layers: estilo.layers.map((c) =>
      c.type === "symbol" && JSON.stringify(c.layout?.["text-field"] ?? "").includes('"name_en"')
        ? { ...c, layout: { ...c.layout, "text-field": NOMBRE_ES } }
        : c,
    ),
  };
}
