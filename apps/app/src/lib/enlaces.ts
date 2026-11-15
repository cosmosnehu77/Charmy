/** La landing de Charmy en producción (Cloudflare Pages, deploy-web.yml). */
export const URL_LANDING = "https://charmy.earth";

/** Enlace directo y previsualización embebida de una coordenada en Google Maps. */
export function urlGoogleMaps(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

export function urlGoogleMapsEmbed(lat: number, lon: number): string {
  return `https://maps.google.com/maps?q=${lat},${lon}&z=13&output=embed`;
}
