import type { FocoReciente } from "@/relieve/datos";
import { compararVentanas, porVeredicto, regionesConMasFocos } from "@/relieve/estadisticasVivo";

const HORA = 3_600_000;
const ULTIMO = Date.UTC(2026, 10, 14, 12);

// Valores inventados con la forma de FocoReciente.
let k = 0;
const foco = (horasAntes: number, frp: number, region: string | null, veredicto?: string): FocoReciente => ({
  k: k++,
  id: `f${k}`,
  lon: -70,
  lat: -39,
  frp,
  t: ULTIMO - horasAntes * HORA,
  dia: "2026-11-14",
  acq: "",
  satelite: "N20",
  instrumento: "VIIRS",
  confianza: "high",
  momento: "N",
  veredicto,
  region,
});

describe("compararVentanas", () => {
  const focos = [foco(0, 5, "AR-U"), foco(3, 5, "AR-U"), foco(7, 5, "AR-U"), foco(20, 40, "AR-H"), foco(30, 5, null)];

  it("cuenta la ventana actual y la anterior del mismo largo", () => {
    expect(compararVentanas(focos, ULTIMO, 6, [])).toEqual({ actual: 2, anterior: 1 });
    expect(compararVentanas(focos, ULTIMO, 24, [])).toEqual({ actual: 4, anterior: 1 });
  });

  it("aplica el mismo filtro de intensidad en las dos ventanas", () => {
    expect(compararVentanas(focos, ULTIMO, 24, ["Muy fuerte"])).toEqual({ actual: 1, anterior: 0 });
  });

  it("con 48 h no compara: /live no trae las 48 h anteriores", () => {
    expect(compararVentanas(focos, ULTIMO, 48, [])).toBeNull();
  });
});

describe("regionesConMasFocos", () => {
  it("ordena de más a menos, sin los focos fuera de las regiones, hasta el tope", () => {
    const focos = [foco(0, 1, "AR-U"), foco(0, 1, "AR-H"), foco(0, 1, "AR-U"), foco(0, 1, null), foco(0, 1, null), foco(0, 1, "CL-AI")];
    expect(regionesConMasFocos(focos, 2)).toEqual([
      { region: "AR-U", cantidad: 2 },
      { region: "AR-H", cantidad: 1 },
    ]);
  });
  it("sin focos devuelve una lista vacía", () => {
    expect(regionesConMasFocos([], 3)).toEqual([]);
  });
});

describe("porVeredicto", () => {
  it("cuenta cada veredicto y toma un foco sin veredicto como «sin confirmar»", () => {
    const focos = [foco(0, 1, null, "confirmado"), foco(0, 1, null, "probable"), foco(0, 1, null, "probable"), foco(0, 1, null)];
    expect(porVeredicto(focos)).toEqual({ confirmado: 1, probable: 2, sin_confirmar: 1, fuente_fija: 0 });
  });
});
