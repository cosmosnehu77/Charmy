import { describe, expect, it } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import { cargarDia, type DiaJuego } from "../src/datos";

const AREA = { ancho: 800, alto: 600 };

describe("cargarDia", () => {
  it("devuelve los focos de dia-juego.json con coordenadas de pantalla dentro del área de juego", () => {
    const focos = cargarDia(dia as DiaJuego, AREA);

    expect(focos.length).toBeGreaterThan(0);
    for (const foco of focos) {
      expect(foco.x).toBeGreaterThanOrEqual(0);
      expect(foco.x).toBeLessThanOrEqual(AREA.ancho);
      expect(foco.y).toBeGreaterThanOrEqual(0);
      expect(foco.y).toBeLessThanOrEqual(AREA.alto);
    }
  });

  it("pone el norte arriba y el oeste a la izquierda", () => {
    const base: DiaJuego = {
      fecha: "2026-11-12",
      fuente: "muestra de prueba",
      provisional: true,
      bbox: [-76, -56, -62, -35],
      focos: [
        { lat: -35, lon: -76, hora_utc: "04:00", frp: 1, confidence: "nominal" },
        { lat: -56, lon: -62, hora_utc: "04:00", frp: 1, confidence: "nominal" },
      ],
    };

    const [noroeste, sureste] = cargarDia(base, AREA);

    expect(noroeste).toMatchObject({ x: 0, y: 0 });
    expect(sureste).toMatchObject({ x: AREA.ancho, y: AREA.alto });
  });

  it("descarta los focos fuera del recuadro del día", () => {
    const base: DiaJuego = {
      fecha: "2026-11-12",
      fuente: "muestra de prueba",
      provisional: true,
      bbox: [-76, -56, -62, -35],
      focos: [
        { lat: -40, lon: -70, hora_utc: "04:00", frp: 1, confidence: "nominal" },
        { lat: -20, lon: -70, hora_utc: "04:00", frp: 1, confidence: "nominal" },
      ],
    };

    expect(cargarDia(base, AREA)).toHaveLength(1);
  });
});
