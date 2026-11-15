/** Satélites que publican focos en vivo (D-13): S-NPP no publica datos nuevos desde el 2/11/2026. */
export const SATELITES_VIVO = [
  { codigo: "N20", nombre: "NOAA-20" },
  { codigo: "N21", nombre: "NOAA-21" },
] as const;

/** Deja solo los focos de los satélites elegidos, como el filtro por satélite de FIRMS. */
export function filtrarPorSatelite<F extends { properties: { satellite: string } }>(
  focos: readonly F[],
  satelites: readonly string[],
): F[] {
  return focos.filter((f) => satelites.includes(f.properties.satellite));
}
