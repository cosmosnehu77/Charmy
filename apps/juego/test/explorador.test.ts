import { describe, expect, it } from "vitest";
import { REGLAS, ordenDeRecorrido, siguiente, textoDeFoco } from "../src/explorador";
import { focoActivo, type FocoActivo } from "../src/partida";

const foco = (id: number, x: number, y: number, extra: { frp?: number; confidence?: string; fuente_fija?: boolean } = {}) =>
  focoActivo(id, { lat: -40, lon: -70, frp: 1, confidence: "nominal", x, y, ...extra });

describe("recorrido por teclado", () => {
  const focos: FocoActivo[] = [foco(3, 50, 200), foco(1, 300, 100), foco(2, 10, 100), foco(4, 10, 100)];

  it("va de norte a sur y de oeste a este; los empates, por número de foco", () => {
    expect(ordenDeRecorrido(focos)).toEqual([2, 4, 1, 3]);
  });

  it("es estable: no depende del orden en que llegan", () => {
    expect(ordenDeRecorrido([...focos].reverse())).toEqual(ordenDeRecorrido(focos));
  });

  it("hacia adelante vuelve al principio al final, y hacia atrás al final desde el principio", () => {
    const orden = [2, 4, 1, 3];
    expect(siguiente(orden, 1, 1)).toBe(3);
    expect(siguiente(orden, 3, 1)).toBe(2);
    expect(siguiente(orden, 2, -1)).toBe(3);
  });

  it("sin foco elegido empieza por el primero (o el último hacia atrás); si no quedan, null", () => {
    expect(siguiente([2, 4], null, 1)).toBe(2);
    expect(siguiente([2, 4], null, -1)).toBe(4);
    expect(siguiente([2, 4], 99, 1)).toBe(2);
    expect(siguiente([], null, 1)).toBeNull();
  });
});

describe("texto que se anuncia por foco", () => {
  it("dice el número, la región aproximada, la potencia y los toques", () => {
    const t = textoDeFoco(foco(1, 0, 0, { frp: 4.77 }), 3, 142, "Neuquén, Argentina");
    expect(t).toBe("Foco 3 de 142, en Neuquén, Argentina (aproximado). Potencia 4,8 megavatios: hacen falta 2 toques.");
  });

  it("si es de confianza baja, avisa que puede ser una falsa alarma y cómo verificarlo", () => {
    const t = textoDeFoco(foco(1, 0, 0, { confidence: "low" }), 1, 5, null);
    expect(t).toContain("fuera de las regiones del mapa");
    expect(t).toContain("1 toque.");
    expect(t).toMatch(/falsa alarma.*tecla V/);
  });

  it("si ya se verificó, lo dice", () => {
    const f = { ...foco(1, 0, 0, { confidence: "low" }), verificado: true };
    expect(textoDeFoco(f, 1, 5, null)).toContain("Verificado");
  });

  it("si es una fuente fija, avisa que no hay que apagarla", () => {
    expect(textoDeFoco(foco(1, 0, 0, { fuente_fija: true }), 1, 5, null)).toMatch(/fuente fija.*no hay que apagarla/i);
  });
});

describe("reglas del modo explorador", () => {
  it("en modo explorador no hay reloj, ningún foco se escapa ni se propaga, no se gasta agua y no suma récord", () => {
    expect(REGLAS.explorador).toEqual({ reloj: false, escapes: false, gastaAgua: false, sumaRecord: false });
  });

  it("en el modo normal, todo eso sí", () => {
    expect(REGLAS.normal).toEqual({ reloj: true, escapes: true, gastaAgua: true, sumaRecord: true });
  });
});
