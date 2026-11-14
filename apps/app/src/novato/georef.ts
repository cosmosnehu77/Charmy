/**
 * Búsqueda de localidades con la API Georef de datos.gob.ar (PLAN §1.1). Es pública, sin clave y con CORS
 * abierto, así que se consulta desde el navegador. Cubre solo localidades de Argentina.
 */
const URL_GEOREF = "https://apis.datos.gob.ar/georef/api/localidades";

export interface Localidad {
  id: string;
  nombre: string;
  provincia: string;
  lat: number;
  lon: number;
}

interface RespuestaGeoref {
  localidades: { id: string; nombre: string; provincia: { nombre: string }; centroide: { lat: number; lon: number } }[];
}

export async function buscarLocalidades(nombre: string, signal?: AbortSignal): Promise<Localidad[]> {
  const q = new URLSearchParams({ nombre, max: "5", campos: "id,nombre,provincia.nombre,centroide" });
  const respuesta = await fetch(`${URL_GEOREF}?${q}`, { signal });
  if (!respuesta.ok) throw new Error(`Georef respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as RespuestaGeoref;
  return datos.localidades.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    provincia: l.provincia.nombre,
    lat: l.centroide.lat,
    lon: l.centroide.lon,
  }));
}
