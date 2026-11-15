/**
 * Idioma del juego, el mismo que eligió la persona en la landing. La landing y el juego están en orígenes distintos
 * y no comparten el almacenamiento: el idioma viaja en el enlace (`?idioma=en`) y cada uno lo guarda con la misma clave.
 */
export type Idioma = "es" | "en";

export const CLAVE_IDIOMA = "charmy-idioma";

type Almacen = Pick<Storage, "getItem" | "setItem">;

const valido = (v: string | null | undefined): Idioma | null => (v === "es" || v === "en" ? v : null);

/** El del enlace; si no, el guardado; si no, español. */
export function idiomaInicial(search: string, almacen: Almacen): Idioma {
  const delEnlace = valido(new URLSearchParams(search).get("idioma"));
  if (delEnlace) return delEnlace;
  try {
    return valido(almacen.getItem(CLAVE_IDIOMA)) ?? "es";
  } catch {
    return "es";
  }
}

export function guardarIdioma(almacen: Almacen, idioma: Idioma): void {
  try {
    almacen.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    // Sin almacenamiento el idioma dura solo esta visita.
  }
}

/** El enlace con `?idioma=` puesto, sin tocar el resto. */
export function conIdioma(href: string, idioma: Idioma): string {
  const url = new URL(href);
  url.searchParams.set("idioma", idioma);
  return url.toString();
}

/** Para `toLocaleString`: 1.240 en español, 1,240 en inglés. */
export const localeDe = (idioma: Idioma) => (idioma === "en" ? "en-US" : "es-AR");
