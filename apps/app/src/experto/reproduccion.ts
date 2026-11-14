/** Reproducción temporal de los focos mes a mes (RF-MAP-07). Lógica sin React. */
import type { ColeccionFocos } from "@/consulta/consulta";

/** Meses (AAAA-MM) entre dos fechas AAAA-MM-DD, ambos incluidos. */
export function mesesDelPeriodo(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let anio = Number(desde.slice(0, 4));
  let mes = Number(desde.slice(5, 7));
  const fin = hasta.slice(0, 7);
  for (;;) {
    const actual = `${anio}-${String(mes).padStart(2, "0")}`;
    if (actual > fin) break;
    meses.push(actual);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}

/** Solo los focos del mes (AAAA-MM); con null, todos. */
export function filtrarPorMes(coleccion: ColeccionFocos, mes: string | null): ColeccionFocos {
  if (!mes) return coleccion;
  return { ...coleccion, features: coleccion.features.filter((f) => f.properties.acq_datetime.startsWith(mes)) };
}
