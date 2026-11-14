/** Forma de data/muestras/dia-juego.json (esquema en packages/contracts/datos/esquema.md). */
export interface FocoDelDia {
  lat: number;
  lon: number;
  hora_utc: string;
  frp: number;
  confidence: string;
}

export interface DiaJuego {
  fecha: string;
  fuente: string;
  provisional: boolean;
  /** [oeste, sur, este, norte] en grados. */
  bbox: [number, number, number, number];
  focos: FocoDelDia[];
}

export interface Area {
  ancho: number;
  alto: number;
}

export interface FocoEnPantalla extends FocoDelDia {
  x: number;
  y: number;
}

/**
 * Pasa los focos del día a coordenadas de pantalla: el recuadro del día ocupa todo el área de juego,
 * con el norte arriba. Los focos fuera del recuadro se descartan.
 */
export function cargarDia(dia: DiaJuego, area: Area): FocoEnPantalla[] {
  const [oeste, sur, este, norte] = dia.bbox;
  return dia.focos
    .filter((f) => f.lon >= oeste && f.lon <= este && f.lat >= sur && f.lat <= norte)
    .map((f) => ({
      ...f,
      x: ((f.lon - oeste) / (este - oeste)) * area.ancho,
      y: ((norte - f.lat) / (norte - sur)) * area.alto,
    }));
}
