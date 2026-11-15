import { describe, expect, it } from "vitest";
import dia from "../../../data/muestras/dia-juego.json";
import { cargarDia, type DiaJuego } from "../src/datos";
import {
  PUNTOS_BASE,
  VENTANA_COMBO_MS,
  apagar,
  apagarFoco,
  dejarEscapar,
  encenderFoco,
  escaparFoco,
  marcadorInicial,
  nuevaPartida,
  planDeNivel,
} from "../src/partida";

describe("puntaje y combo", () => {
  it("el primer foco apagado suma los puntos base con combo 1", () => {
    const m = apagar(marcadorInicial(), 1000);
    expect(m).toMatchObject({ puntos: PUNTOS_BASE, combo: 1, apagados: 1 });
  });

  it("apagar en racha suma más", () => {
    let m = apagar(marcadorInicial(), 1000);
    m = apagar(m, 1000 + VENTANA_COMBO_MS - 1);
    m = apagar(m, 1000 + 2 * VENTANA_COMBO_MS - 2);
    expect(m.combo).toBe(3);
    expect(m.puntos).toBe(PUNTOS_BASE * (1 + 2 + 3));
    expect(m.mejorCombo).toBe(3);
  });

  it("el combo se corta si pasa la ventana sin apagar", () => {
    let m = apagar(marcadorInicial(), 1000);
    m = apagar(m, 1500);
    m = apagar(m, 1500 + VENTANA_COMBO_MS + 1);
    expect(m.combo).toBe(1);
    expect(m.mejorCombo).toBe(2);
  });

  it("el combo se corta si un foco se escapa", () => {
    let m = apagar(marcadorInicial(), 1000);
    m = apagar(m, 1200);
    m = dejarEscapar(m);
    expect(m).toMatchObject({ combo: 0, escapados: 1 });
    expect(apagar(m, 1300).combo).toBe(1);
  });
});

describe("planDeNivel", () => {
  const focos = cargarDia(dia as DiaJuego, { ancho: 800, alto: 600 });

  it("usa todos los focos de dia-juego.json, ordenados por hora y dentro de la duración", () => {
    const plan = planDeNivel(focos, 60_000);
    expect(plan).toHaveLength(focos.length);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.apareceMs).toBeGreaterThanOrEqual(plan[i - 1]!.apareceMs);
      expect(plan[i]!.hora_utc >= plan[i - 1]!.hora_utc).toBe(true);
    }
    expect(plan[0]!.apareceMs).toBe(0);
    expect(plan.at(-1)!.apareceMs).toBeLessThanOrEqual(60_000);
  });

  it("con un solo foco aparece al principio", () => {
    expect(planDeNivel(focos.slice(0, 1), 60_000)[0]!.apareceMs).toBe(0);
  });
});

describe("ritmo del nivel", () => {
  it("reparte los focos parejo aunque las pasadas de los satélites estén agrupadas", () => {
    const base = { lat: -40, lon: -70, frp: 1, confidence: "nominal", x: 0, y: 0 };
    const focos = ["04:00", "04:01", "18:00", "18:01"].map((hora_utc) => ({ ...base, hora_utc }));
    expect(planDeNivel(focos, 3000).map((f) => f.apareceMs)).toEqual([0, 1000, 2000, 3000]);
  });
});

describe("estado de la partida", () => {
  const foco = { id: 1, x: 10, y: 20, frp: 2 };

  it("un foco encendido queda activo hasta que se apaga", () => {
    let p = encenderFoco(nuevaPartida(), foco);
    expect(p.activos).toEqual([foco]);
    p = apagarFoco(p, 1, 1000);
    expect(p.activos).toEqual([]);
    expect(p.marcador).toMatchObject({ apagados: 1, puntos: PUNTOS_BASE });
  });

  it("un foco que se escapa deja de estar activo y corta el combo", () => {
    let p = encenderFoco(encenderFoco(nuevaPartida(), foco), { ...foco, id: 2 });
    p = apagarFoco(p, 2, 500);
    p = escaparFoco(p, 1);
    expect(p.activos).toEqual([]);
    expect(p.marcador).toMatchObject({ combo: 0, escapados: 1, apagados: 1 });
  });

  it("apagar o dejar escapar un foco que ya no está activo no cambia nada", () => {
    const p = apagarFoco(encenderFoco(nuevaPartida(), foco), 1, 500);
    expect(apagarFoco(p, 1, 600)).toBe(p);
    expect(escaparFoco(p, 1)).toBe(p);
  });
});
