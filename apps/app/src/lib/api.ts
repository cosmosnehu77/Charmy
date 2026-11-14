/**
 * Cliente de la API de Charmy (contrato: packages/contracts/api/openapi.yaml, dueño @BrunoAguinaga0).
 * La URL base sale de VITE_API_URL e incluye el prefijo /api/v1. Si está vacía, la app trabaja con el
 * mock y las muestras: pasar a la API real es solo cambiar esa variable.
 * El navegador solo habla con nuestra API: nunca con FIRMS, Meteomatics ni Copernicus.
 */

export const urlApi: string = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export class ErrorApi extends Error {
  constructor(
    readonly ruta: string,
    readonly estado: number,
  ) {
    super(`La API respondió ${estado} en ${ruta}`);
  }
}

export async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  if (!urlApi) throw new Error("VITE_API_URL no está definida");
  const respuesta = await fetch(`${urlApi}${ruta}`, {
    ...opciones,
    headers: { Accept: "application/json", ...opciones?.headers },
  });
  if (!respuesta.ok) throw new ErrorApi(ruta, respuesta.status);
  return (await respuesta.json()) as T;
}

/** Respuesta de GET /health según el OpenAPI v0. */
export interface Salud {
  status: string;
  last_nrt_fetch?: string;
  data_version?: string;
}
