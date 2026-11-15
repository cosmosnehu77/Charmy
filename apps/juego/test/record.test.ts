import { describe, expect, it } from "vitest";
import { CLAVE_RECORD, CLAVE_RECORD_VIEJA, guardarRecord, leerRecord, type Almacen } from "../src/record";

function almacen(inicial: Record<string, string> = {}): Almacen & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => datos[k] ?? null,
    setItem: (k, v) => {
      datos[k] = v;
    },
  };
}

describe("récord", () => {
  it("sin nada guardado es 0", () => {
    expect(leerRecord(almacen())).toBe(0);
  });

  it("lee el récord guardado con el nombre nuevo", () => {
    expect(leerRecord(almacen({ [CLAVE_RECORD]: "120" }))).toBe(120);
  });

  it("sigue leyendo el récord de cuando el juego se llamaba Charmy Kids", () => {
    expect(CLAVE_RECORD_VIEJA).toBe("charmy-kids-record");
    expect(leerRecord(almacen({ [CLAVE_RECORD_VIEJA]: "90" }))).toBe(90);
  });

  it("si están los dos, vale el más alto", () => {
    expect(leerRecord(almacen({ [CLAVE_RECORD]: "50", [CLAVE_RECORD_VIEJA]: "90" }))).toBe(90);
  });

  it("guarda con el nombre nuevo", () => {
    const a = almacen();
    guardarRecord(a, 200);
    expect(a.datos[CLAVE_RECORD]).toBe("200");
  });

  it("sin almacenamiento disponible no falla", () => {
    const roto: Almacen = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(leerRecord(roto)).toBe(0);
    expect(() => guardarRecord(roto, 10)).not.toThrow();
  });
});
