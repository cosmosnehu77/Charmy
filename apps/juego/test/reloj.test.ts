import { describe, expect, it } from "vitest";
import {
  MULTIPLICADOR_VICTORIA,
  PREMIO_MS,
  RITMO_MAXIMO,
  TIEMPO_INICIAL_MS,
  TIEMPO_MAX_MS,
  premioDeTiempo,
  puntosDeVictoria,
  ritmoDelReloj,
  sumarTiempo,
} from "../src/reloj";

describe("reloj de la partida", () => {
  it("sin focos prendidos corre a velocidad normal", () => {
    expect(ritmoDelReloj(0)).toBe(1);
  });

  it("más focos prendidos, más rápido, hasta un tope", () => {
    expect(ritmoDelReloj(5)).toBeGreaterThan(ritmoDelReloj(1));
    expect(ritmoDelReloj(1000)).toBe(RITMO_MAXIMO);
  });

  it("apagar suma tiempo, y el combo suma un poco más (hasta combo 5)", () => {
    expect(premioDeTiempo(1, 1)).toBeGreaterThan(PREMIO_MS);
    expect(premioDeTiempo(1, 4)).toBeGreaterThan(premioDeTiempo(1, 1));
    expect(premioDeTiempo(1, 9)).toBe(premioDeTiempo(1, 5));
    expect(premioDeTiempo(3, 1)).toBe(3 * premioDeTiempo(1, 1));
    expect(premioDeTiempo(0, 5)).toBe(0);
  });

  it("el reloj nunca pasa del máximo", () => {
    expect(sumarTiempo(TIEMPO_MAX_MS - 500, 2000)).toBe(TIEMPO_MAX_MS);
    expect(sumarTiempo(TIEMPO_INICIAL_MS, 1000)).toBe(TIEMPO_INICIAL_MS + 1000);
  });

  it("ganar multiplica los puntos y paga los segundos que sobraron", () => {
    expect(puntosDeVictoria(300, 0)).toBe(300 * MULTIPLICADOR_VICTORIA);
    expect(puntosDeVictoria(300, 12_400)).toBe(300 * MULTIPLICADOR_VICTORIA + 120);
    expect(puntosDeVictoria(300, -50)).toBe(300 * MULTIPLICADOR_VICTORIA);
  });
});
