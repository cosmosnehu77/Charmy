/** Un foco simulado: dónde está, cuánta potencia tiene (FRP, en MW) y con qué confianza se detectó. */
export interface FocoDelDia {
  lat: number;
  lon: number;
  frp: number;
  confidence: string;
  /** Industria, antorcha de gas o volcán: calor de todos los días, no un incendio. */
  fuente_fija?: boolean;
}

export interface Area {
  ancho: number;
  alto: number;
}

/** Un foco ya ubicado en el mundo del juego. */
export interface FocoEnPantalla extends FocoDelDia {
  x: number;
  y: number;
}
