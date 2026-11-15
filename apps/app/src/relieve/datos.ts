import { useMemo } from "react";
import { useFocosRecientes, useResumen } from "./consultas";
import { regionDePunto, type RegionResumen } from "./logica";

export interface FocoReciente {
  k: number;
  id: string;
  lon: number;
  lat: number;
  frp: number;
  /** Momento de detección en milisegundos. */
  t: number;
  /** Día UTC (`2026-11-13`), como en `days` de /regions/summary. */
  dia: string;
  acq: string;
  satelite: string;
  instrumento: string;
  confianza: string;
  momento: string;
  /** Veredicto de la verificación (D-09); falta en un foco recién llegado. */
  veredicto?: string;
  region: string | null;
}

/** Regiones y focos recientes de la vista Relieve, con la región de cada foco ya calculada. */
export function useDatosRelieve() {
  const resumen = useResumen();
  const vivo = useFocosRecientes();
  const regiones: RegionResumen[] = useMemo(() => resumen.data?.features ?? [], [resumen.data]);
  const focos: FocoReciente[] = useMemo(() => {
    const features = vivo.data?.features ?? [];
    return features.map((f, k) => {
      const [lon = 0, lat = 0] = f.geometry.coordinates;
      const p = f.properties;
      const acq = p.acq_datetime;
      return {
        k,
        id: String(f.id ?? k),
        lon,
        lat,
        frp: p.frp ?? 0,
        t: new Date(acq).getTime(),
        dia: acq.slice(0, 10),
        acq,
        satelite: p.satellite,
        instrumento: p.instrument,
        confianza: p.confidence,
        momento: p.daynight ?? "",
        veredicto: p.verdict,
        region: regiones.length ? regionDePunto(regiones, lon, lat) : null,
      };
    });
  }, [vivo.data, regiones]);
  return { resumen, vivo, regiones, focos };
}
