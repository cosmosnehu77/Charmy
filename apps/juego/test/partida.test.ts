import { describe, expect, it } from "vitest";
import {
  PUNTOS_BASE,
  VENTANA_COMBO_MS,
  apagar,
  PENALIDAD,
  dejarEscapar,
  encenderFoco,
  escaparFoco,
  focoActivo,
  focoPropagado,
  golpearFoco,
  marcadorInicial,
  nuevaPartida,
  verificarFoco,
} from "../src/partida";
import type { FocoEnPantalla } from "../src/datos";

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

const dato = (extra: Partial<FocoEnPantalla> = {}): FocoEnPantalla => ({
  lat: -40,
  lon: -70,
  hora_utc: "04:00",
  frp: 1,
  confidence: "nominal",
  x: 10,
  y: 20,
  ...extra,
});

describe("estado de la partida", () => {
  const foco = focoActivo(1, dato());

  it("un foco encendido queda activo hasta que se apaga", () => {
    let p = encenderFoco(nuevaPartida(), foco);
    expect(p.activos).toEqual([foco]);
    p = golpearFoco(p, 1, 1000);
    expect(p.activos).toEqual([]);
    expect(p.marcador).toMatchObject({ apagados: 1, puntos: PUNTOS_BASE });
  });

  it("un foco potente necesita varios toques", () => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato({ frp: 15 })));
    p = golpearFoco(p, 1, 100);
    p = golpearFoco(p, 1, 200);
    expect(p.activos).toHaveLength(1);
    expect(p.activos[0]!.golpes).toBe(1);
    expect(p.marcador.apagados).toBe(0);
    p = golpearFoco(p, 1, 300);
    expect(p.activos).toEqual([]);
    expect(p.marcador.apagados).toBe(1);
  });

  it("un foco que se escapa deja de estar activo y corta el combo", () => {
    let p = encenderFoco(encenderFoco(nuevaPartida(), foco), { ...foco, id: 2 });
    p = golpearFoco(p, 2, 500);
    p = escaparFoco(p, 1);
    expect(p.activos).toEqual([]);
    expect(p.marcador).toMatchObject({ combo: 0, escapados: 1, apagados: 1 });
  });

  it("golpear o dejar escapar un foco que ya no está activo no cambia nada", () => {
    const p = golpearFoco(encenderFoco(nuevaPartida(), foco), 1, 500);
    expect(golpearFoco(p, 1, 600)).toBe(p);
    expect(escaparFoco(p, 1)).toBe(p);
    expect(verificarFoco(p, 1)).toBe(p);
  });
});

describe("confianza del satélite", () => {
  const apagarUno = (extra: Partial<FocoEnPantalla>, verificar = false) => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato(extra)));
    if (verificar) p = verificarFoco(p, 1);
    return golpearFoco(p, 1, 1000).marcador;
  };

  it("un foco de confianza baja apagado sin verificar descuenta", () => {
    expect(apagarUno({ confidence: "low" })).toMatchObject({ puntos: PUNTOS_BASE - PENALIDAD, sinVerificar: 1 });
  });

  it("verificado no descuenta", () => {
    expect(apagarUno({ confidence: "low" }, true)).toMatchObject({ puntos: PUNTOS_BASE, sinVerificar: 0 });
  });

  it("nominal y high no descuentan", () => {
    expect(apagarUno({ confidence: "nominal" }).puntos).toBe(PUNTOS_BASE);
    expect(apagarUno({ confidence: "high" }).puntos).toBe(PUNTOS_BASE);
  });

  it("los puntos nunca bajan de cero", () => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato({ frp: 15, confidence: "low" })));
    p = golpearFoco(p, 1, 100);
    expect(p.marcador.puntos).toBe(0);
  });
});

describe("fuentes fijas", () => {
  it("tocar una fuente fija resta y corta el combo", () => {
    let p = encenderFoco(encenderFoco(nuevaPartida(), focoActivo(1, dato())), focoActivo(2, dato({ fuente_fija: true })));
    p = golpearFoco(p, 1, 100);
    p = golpearFoco(p, 1, 100);
    p = encenderFoco(p, focoActivo(3, dato()));
    p = golpearFoco(p, 3, 200);
    const antes = p.marcador.puntos;
    p = golpearFoco(p, 2, 300);
    expect(p.activos).toEqual([]);
    expect(p.marcador).toMatchObject({ puntos: antes - PENALIDAD, combo: 0, fijasTocadas: 1, apagados: 2 });
  });

  it("dejarla no castiga", () => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato({ fuente_fija: true })));
    p = escaparFoco(p, 1);
    expect(p.activos).toEqual([]);
    expect(p.marcador).toEqual(marcadorInicial());
  });

  it("sin el campo, ningún foco es fuente fija", () => {
    expect(focoActivo(1, dato()).fuenteFija).toBe(false);
    expect(focoActivo(1, dato({ fuente_fija: false })).fuenteFija).toBe(false);
  });
});

describe("focos propagados", () => {
  it("un foco propagado se apaga de un toque, es de confianza nominal y no es fuente fija", () => {
    expect(focoPropagado(7, 30, 40)).toEqual({
      id: 7,
      x: 30,
      y: 40,
      frp: 1,
      golpes: 1,
      confianza: "nominal",
      verificado: false,
      fuenteFija: false,
    });
  });
});
