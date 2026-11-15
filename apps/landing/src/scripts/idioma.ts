/**
 * Idioma de la landing. El juego vive en otro origen y no ve este almacenamiento: el idioma viaja en el enlace
 * (`?idioma=en`), en los dos sentidos, y cada sitio lo guarda con la clave `charmy-idioma`.
 */
export type Idioma = "es" | "en";

const valido = (v: string | null): Idioma | null => (v === "es" || v === "en" ? v : null);

/** El del enlace; si no, el guardado; si no, español. */
export const idiomaInicial = (search: string, guardado: string | null): Idioma =>
  valido(new URLSearchParams(search).get("idioma")) ?? valido(guardado) ?? "es";

/** El enlace con `?idioma=` puesto, sin tocar el resto. */
export function conIdioma(href: string, idioma: Idioma): string {
  const url = new URL(href);
  url.searchParams.set("idioma", idioma);
  return url.toString();
}
