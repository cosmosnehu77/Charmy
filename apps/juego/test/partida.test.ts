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
  AGUA_SIN_VERIFICAR,
  MAX_CORTAFUEGOS,
  COSTOS,
  HERRAMIENTAS,
  PREMIO_CORTAFUEGOS,
  PREMIO_FALSA_ALARMA,
  PROB_FALSA_ALARMA,
  RADIO_AVION,
  buscar,
  cobrar,
  descartarFalsaAlarma,
  premiarCortafuegos,
  RECARGA_AVION_MS,
  TANQUE,
  elegirHerramienta,
  lanzarAvion,
  ponerCortafuegos,
  recargar,
  tocarFoco,
  type Partida,
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
    return golpearFoco(p, 1, 1000);
  };

  it("un foco de confianza baja apagado sin verificar gasta agua de más", () => {
    const p = apagarUno({ confidence: "low" });
    expect(p.agua).toBe(TANQUE - 1 - AGUA_SIN_VERIFICAR);
    expect(p.marcador).toMatchObject({ puntos: PUNTOS_BASE, sinVerificar: 1 });
  });

  it("verificado no gasta de más", () => {
    const p = apagarUno({ confidence: "low" }, true);
    expect(p.agua).toBe(TANQUE - 1);
    expect(p.marcador.sinVerificar).toBe(0);
  });

  it("nominal y high no gastan de más", () => {
    expect(apagarUno({ confidence: "nominal" }).agua).toBe(TANQUE - 1);
    expect(apagarUno({ confidence: "high" }).agua).toBe(TANQUE - 1);
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
    expect(p.agua).toBe(TANQUE);
  });

  it("los puntos nunca bajan de cero", () => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato({ fuente_fija: true })));
    p = golpearFoco(p, 1, 100);
    expect(p.marcador.puntos).toBe(0);
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
      toques: 1,
      confianza: "nominal",
      verificado: false,
      fuenteFija: false,
    });
  });
});

describe("agua", () => {
  it("cada toque gasta una carga del tanque", () => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato({ frp: 15 })));
    expect(p.agua).toBe(TANQUE);
    p = golpearFoco(p, 1, 100);
    p = golpearFoco(p, 1, 200);
    expect(p.agua).toBe(TANQUE - 2);
  });

  it("con el tanque vacío, tocar no apaga ni gasta", () => {
    const p: Partida = { ...encenderFoco(nuevaPartida(), focoActivo(1, dato())), agua: 0 };
    expect(golpearFoco(p, 1, 100)).toBe(p);
  });

  it("con agua para un toque pero no para el extra de un foco dudoso, apaga y deja el tanque en cero", () => {
    let p: Partida = { ...encenderFoco(nuevaPartida(), focoActivo(1, dato({ confidence: "low" }))), agua: 1 };
    p = golpearFoco(p, 1, 100);
    expect(p.agua).toBe(0);
    expect(p.marcador.apagados).toBe(1);
  });

  it("un lago llena el tanque", () => {
    expect(recargar({ ...nuevaPartida(), agua: 2 }).agua).toBe(TANQUE);
  });

  it("un foco que se escapa hace perder una carga, pero nunca deja el tanque por debajo de la mitad", () => {
    const mitad = Math.ceil(TANQUE / 2);
    let p = encenderFoco(encenderFoco(nuevaPartida(), focoActivo(1, dato())), focoActivo(2, dato()));
    p = escaparFoco(p, 1);
    expect(p.agua).toBe(TANQUE - 1);
    p = escaparFoco({ ...p, agua: mitad }, 2);
    expect(p.agua).toBe(mitad);
    const seco = escaparFoco({ ...encenderFoco(nuevaPartida(), focoActivo(3, dato())), agua: 1 }, 3);
    expect(seco.agua).toBe(1);
  });
});

describe("herramientas", () => {
  const conFocos = (...focos: Partial<FocoEnPantalla>[]) =>
    focos.reduce((p, f, i) => encenderFoco(p, focoActivo(i + 1, dato(f))), nuevaPartida());

  it("bombero: tocar un foco lo apaga con agua", () => {
    const p = tocarFoco(conFocos({}), 1, 100);
    expect(p.activos).toEqual([]);
    expect(p.agua).toBe(TANQUE - 1);
  });

  it("científica: tocar un foco dudoso lo verifica sin gastar agua", () => {
    const p = tocarFoco(elegirHerramienta(conFocos({ confidence: "low" }), "cientifica"), 1, 100);
    expect(p.activos[0]!.verificado).toBe(true);
    expect(p.agua).toBe(TANQUE);
  });

  it("piloto: el avión apaga los focos de la zona, no los de afuera ni las fuentes fijas, sin gastar agua", () => {
    let p = conFocos({ x: 100, y: 100 }, { x: 100 + RADIO_AVION - 1, y: 100 }, { x: 100 + RADIO_AVION + 5, y: 100 }, { x: 100, y: 110, fuente_fija: true });
    p = lanzarAvion(elegirHerramienta(p, "piloto"), 100, 100, 1000);
    expect(p.activos.map((f) => f.id)).toEqual([3, 4]);
    expect(p.marcador.apagados).toBe(2);
    expect(p.agua).toBe(TANQUE);
  });

  it("piloto: tocar un foco lanza el avión sobre él", () => {
    const p = tocarFoco(elegirHerramienta(conFocos({ x: 50, y: 50 }, { x: 60, y: 50 }), "piloto"), 1, 1000);
    expect(p.activos).toEqual([]);
  });

  it("el avión respeta su tiempo de recarga", () => {
    let p = elegirHerramienta(conFocos({ x: 10, y: 10 }, { x: 500, y: 500 }), "piloto");
    p = lanzarAvion(p, 10, 10, 1000);
    const antes = encenderFoco(p, focoActivo(9, dato({ x: 300, y: 300 })));
    expect(lanzarAvion(antes, 300, 300, 1000 + RECARGA_AVION_MS - 1)).toBe(antes);
    expect(lanzarAvion(antes, 300, 300, 1000 + RECARGA_AVION_MS).activos.map((f) => f.id)).toEqual([2]);
  });

  it("guía: pone cortafuegos, como mucho MAX_CORTAFUEGOS (se va el más viejo)", () => {
    let p = elegirHerramienta(nuevaPartida(), "guia");
    for (let i = 0; i <= MAX_CORTAFUEGOS; i++) p = ponerCortafuegos(p, { col: i, fila: 0 });
    expect(p.cortafuegos).toHaveLength(MAX_CORTAFUEGOS);
    expect(p.cortafuegos[0]).toEqual({ col: 1, fila: 0 });
    expect(ponerCortafuegos(p, { col: 2, fila: 0 })).toBe(p);
  });

  it("guía y piloto no golpean al tocar un foco: la escena usa el toque como un toque en el mapa", () => {
    const p = elegirHerramienta(conFocos({}), "guia");
    expect(tocarFoco(p, 1, 100)).toBe(p);
  });
});

describe("un foco fuerte vale más", () => {
  it("apagar suma los puntos base por los toques que costó, por el combo", () => {
    expect(apagar(marcadorInicial(), 1000, 3).puntos).toBe(PUNTOS_BASE * 3);
    const m = apagar(apagar(marcadorInicial(), 1000, 1), 1500, 2);
    expect(m.puntos).toBe(PUNTOS_BASE * 1 + PUNTOS_BASE * 2 * 2);
  });

  it("el último toque a un foco de 2 toques paga doble", () => {
    let p = encenderFoco(nuevaPartida(), focoActivo(1, dato({ frp: 5 })));
    expect(buscar(p, 1)?.toques).toBe(2);
    p = golpearFoco(golpearFoco(p, 1, 1000), 1, 1100);
    expect(p.marcador.puntos).toBe(PUNTOS_BASE * 2);
  });
});

describe("las unidades cuestan puntos", () => {
  const conPuntos = (puntos: number): Partida => ({ ...nuevaPartida(), marcador: { ...marcadorInicial(), puntos } });

  it("las seis herramientas tienen tecla, y el avión es la más cara", () => {
    expect(HERRAMIENTAS).toEqual(["bombero", "piloto", "cientifica", "guia", "brigada", "aguatero"]);
    const costos = Object.values(COSTOS);
    expect(COSTOS.piloto).toBe(Math.max(...costos));
    expect(COSTOS.bombero).toBeUndefined();
  });

  it("cobrar descuenta el costo si alcanzan los puntos", () => {
    expect(cobrar(conPuntos(100), "piloto")?.marcador.puntos).toBe(100 - COSTOS.piloto!);
    expect(cobrar(conPuntos(COSTOS.brigada!), "brigada")?.marcador.puntos).toBe(0);
  });

  it("si no alcanzan, no cobra nada", () => {
    expect(cobrar(conPuntos(COSTOS.piloto! - 1), "piloto")).toBeNull();
  });

  it("el agua y la verificación no cuestan puntos", () => {
    expect(cobrar(conPuntos(0), "bombero")?.marcador.puntos).toBe(0);
    expect(cobrar(conPuntos(0), "cientifica")?.marcador.puntos).toBe(0);
  });
});

describe("falsas alarmas y cortafuegos", () => {
  it("una falsa alarma desaparece, no gasta agua y suma su premio", () => {
    const p = encenderFoco(nuevaPartida(), focoActivo(4, dato({ confidence: "low" })));
    const q = descartarFalsaAlarma(p, 4);
    expect(q.activos).toEqual([]);
    expect(q.agua).toBe(p.agua);
    expect(q.marcador.puntos).toBe(PREMIO_FALSA_ALARMA);
    expect(q.marcador.apagados).toBe(0);
  });

  it("descartar un foco que ya no está no cambia nada", () => {
    const p = nuevaPartida();
    expect(descartarFalsaAlarma(p, 9)).toBe(p);
  });

  it("la mayoría de los focos con \"?\" son falsa alarma", () => {
    expect(PROB_FALSA_ALARMA).toBeGreaterThan(0.5);
    expect(PROB_FALSA_ALARMA).toBeLessThan(1);
  });

  it("cada vez que un cortafuegos frena al fuego, suma su premio", () => {
    expect(premiarCortafuegos(nuevaPartida(), 2).marcador.puntos).toBe(2 * PREMIO_CORTAFUEGOS);
    const p = nuevaPartida();
    expect(premiarCortafuegos(p, 0)).toBe(p);
  });
});
