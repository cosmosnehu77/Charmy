import { describe, expect, it } from "vitest";
import { estadoDeCharmy, estadoDelCierre, factorDeTramo, FOCOS_SUELTOS_ALERTA } from "../src/ritmo";
import { encenderFoco, focoActivo, marcadorInicial, nuevaPartida, verificarFoco, type Partida } from "../src/partida";

const foco = (id: number, confidence = "nominal", fuente_fija = false) =>
  focoActivo(id, { lat: -40, lon: -70, hora_utc: "04:00", frp: 1, confidence, fuente_fija, x: 0, y: 0 });
const con = (...focos: ReturnType<typeof foco>[]): Partida => focos.reduce(encenderFoco, nuevaPartida());

describe("estado de Charmy durante la partida", () => {
  it("sin nada especial, en reposo", () => {
    expect(estadoDeCharmy(nuevaPartida())).toBe("idle");
    expect(estadoDeCharmy(con(foco(1)))).toBe("idle");
  });

  it("ante un foco dudoso sin verificar, pensando", () => {
    expect(estadoDeCharmy(con(foco(1), foco(2, "low")))).toBe("pensando");
    expect(estadoDeCharmy(verificarFoco(con(foco(2, "low")), 2))).toBe("idle");
  });

  it("con muchos focos sueltos, en alerta (aunque haya uno dudoso)", () => {
    const muchos = Array.from({ length: FOCOS_SUELTOS_ALERTA }, (_, i) => foco(i + 1));
    expect(estadoDeCharmy(con(...muchos, foco(99, "low")))).toBe("alerta");
  });

  it("las fuentes fijas no cuentan como focos sueltos", () => {
    const fijas = Array.from({ length: FOCOS_SUELTOS_ALERTA }, (_, i) => foco(i + 1, "nominal", true));
    expect(estadoDeCharmy(con(...fijas))).toBe("idle");
  });
});

describe("estado de Charmy en el cierre", () => {
  it("festeja si apagaste más de los que se escaparon, o si hiciste récord", () => {
    expect(estadoDelCierre({ ...marcadorInicial(), apagados: 10, escapados: 3 }, false)).toBe("festeja");
    expect(estadoDelCierre({ ...marcadorInicial(), apagados: 1, escapados: 9 }, true)).toBe("festeja");
  });

  it("si no, explica", () => {
    expect(estadoDelCierre({ ...marcadorInicial(), apagados: 3, escapados: 3 }, false)).toBe("explica");
    expect(estadoDelCierre(marcadorInicial(), false)).toBe("explica");
  });
});

describe("curva de dificultad", () => {
  it("el ritmo crece por tramo: los focos se escapan cada vez más rápido", () => {
    const dur = 60_000;
    const [a, b, c] = [factorDeTramo(0, dur), factorDeTramo(dur / 2, dur), factorDeTramo(dur - 1, dur)];
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBe(1);
  });

  it("dentro de un tramo el factor no cambia y fuera de la partida se queda en el último", () => {
    expect(factorDeTramo(0, 60_000)).toBe(factorDeTramo(19_999, 60_000));
    expect(factorDeTramo(90_000, 60_000)).toBe(1);
  });
});
