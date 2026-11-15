import type { FocoActivo } from "./partida";

/** Qué cambia entre el modo normal y el modo explorador (accesibilidad, RF-KID-11). */
export interface Reglas {
  /** La partida termina cuando se acaba el tiempo. */
  reloj: boolean;
  /** Los focos sin apagar se escapan y se propagan. */
  escapes: boolean;
  gastaAgua: boolean;
  /** El puntaje cuenta para el récord (y, cuando exista, para la tabla del desafío). */
  sumaRecord: boolean;
}

export const REGLAS: Record<"normal" | "explorador", Reglas> = {
  normal: { reloj: true, escapes: true, gastaAgua: true, sumaRecord: true },
  explorador: { reloj: false, escapes: false, gastaAgua: false, sumaRecord: false },
};

/** Orden de recorrido con el teclado: de norte a sur, de oeste a este y, si empatan, por número de foco. */
export function ordenDeRecorrido(focos: FocoActivo[]): number[] {
  return [...focos].sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id).map((f) => f.id);
}

/** El foco siguiente (paso 1) o anterior (paso −1); al pasar el final vuelve al principio. */
export function siguiente(orden: number[], actual: number | null, paso: 1 | -1): number | null {
  if (orden.length === 0) return null;
  const i = actual === null ? -1 : orden.indexOf(actual);
  if (i === -1) return paso === 1 ? orden[0]! : orden.at(-1)!;
  return orden[(i + paso + orden.length) % orden.length]!;
}

const megavatios = (frp: number) => frp.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Lo que el lector de pantalla dice de un foco: dónde está, su potencia y si es dudoso. Corto y sin jerga. */
export function textoDeFoco(foco: FocoActivo, posicion: number, total: number, region: string | null): string {
  const donde = region ? `en ${region} (aproximado)` : "fuera de las regiones del mapa";
  const partes = [`Foco ${posicion} de ${total}, ${donde}.`];
  if (foco.fuenteFija) {
    partes.push("Es una fuente fija, como una industria o un volcán: no es un incendio y no hay que apagarla.");
    return partes.join(" ");
  }
  const toques = foco.golpes === 1 ? "1 toque" : `${foco.golpes} toques`;
  partes.push(`Potencia ${megavatios(foco.frp)} megavatios: hacen falta ${toques}.`);
  if (foco.confianza === "low") {
    partes.push(
      foco.verificado
        ? "Verificado."
        : "Confianza baja: puede ser una falsa alarma. Verificalo con la tecla V.",
    );
  }
  return partes.join(" ");
}
