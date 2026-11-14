/**
 * Cliente de la API de Charmy (contrato: packages/contracts/api/openapi.yaml, dueño @BrunoAguinaga0).
 * La URL base sale de VITE_API_URL e incluye el prefijo /api/v1. Si está vacía, la app trabaja con el
 * mock y las muestras: pasar a la API real es solo cambiar esa variable.
 * El navegador solo habla con nuestra API: nunca con FIRMS, Meteomatics ni Copernicus.
 */

export function urlApi(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
}

/** Error de la API. `mensaje` es el texto para la persona que manda la API ({code, message}), si vino. */
export class ErrorApi extends Error {
  constructor(
    readonly ruta: string,
    readonly estado: number,
    readonly codigo?: string,
    readonly mensaje?: string,
  ) {
    super(`La API respondió ${estado} en ${ruta}`);
  }
}

async function leerError(respuesta: Response): Promise<{ code?: string; message?: string }> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (typeof cuerpo === "object" && cuerpo !== null) return cuerpo as { code?: string; message?: string };
  } catch {
    // Sin cuerpo JSON: queda el estado.
  }
  return {};
}

export async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const base = urlApi();
  if (!base) throw new Error("VITE_API_URL no está definida");
  const respuesta = await fetch(`${base}${ruta}`, {
    ...opciones,
    headers: { Accept: "application/json", ...opciones?.headers },
  });
  if (!respuesta.ok) {
    const { code, message } = await leerError(respuesta);
    throw new ErrorApi(ruta, respuesta.status, code, typeof message === "string" ? message : undefined);
  }
  return (await respuesta.json()) as T;
}

/** Respuesta de GET /health según el OpenAPI v0. */
export interface Salud {
  status: string;
  last_nrt_fetch?: string;
  data_version?: string;
}
