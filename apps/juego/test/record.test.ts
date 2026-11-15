import { describe, expect, it } from "vitest";
import {
  CLAVE_MEJORES,
  CLAVE_RECORD,
  CLAVE_RECORD_VIEJA,
  CUANTAS_MEJORES,
  cuando,
  guardarMejores,
  guardarRecord,
  leerMejores,
  leerRecord,
  sumarMejor,
  type Almacen,
} from "../src/record";

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

describe("mejores partidas", () => {
  const DIA = 86_400_000;
  const ahora = new Date(2026, 10, 15, 18, 30).getTime();

  it("sin nada guardado, la lista está vacía", () => {
    expect(leerMejores(almacen())).toEqual([]);
  });

  it("si solo hay un récord viejo, entra como una marca sin fecha", () => {
    expect(leerMejores(almacen(), 170)).toEqual([{ p: 170, t: 0 }]);
  });

  it("guarda y lee la lista", () => {
    const a = almacen();
    guardarMejores(a, [{ p: 900, t: ahora }]);
    expect(a.datos[CLAVE_MEJORES]).toBeDefined();
    expect(leerMejores(a, 50)).toEqual([{ p: 900, t: ahora }]);
  });

  it("descarta lo que no es una marca y un valor roto", () => {
    expect(leerMejores(almacen({ [CLAVE_MEJORES]: '[{"p":5,"t":1},{"p":"x"},null]' }))).toEqual([{ p: 5, t: 1 }]);
    expect(leerMejores(almacen({ [CLAVE_MEJORES]: "{roto" }), 30)).toEqual([{ p: 30, t: 0 }]);
  });

  it("deja las tres mejores, de más a menos; a igual puntaje, la más nueva primero", () => {
    let l = sumarMejor([], 500, 1);
    l = sumarMejor(l, 900, 2);
    l = sumarMejor(l, 500, 3);
    l = sumarMejor(l, 100, 4);
    expect(l).toEqual([{ p: 900, t: 2 }, { p: 500, t: 3 }, { p: 500, t: 1 }]);
    expect(CUANTAS_MEJORES).toBe(3);
  });

  it("dice cuándo fue cada partida", () => {
    expect(cuando(ahora - 60_000, ahora)).toBe("Hoy");
    expect(cuando(ahora - DIA, ahora)).toBe("Ayer");
    expect(cuando(ahora - 3 * DIA, ahora)).toBe("Hace 3 días");
    expect(cuando(0, ahora)).toBe("Antes");
  });
});

describe("cuándo, en inglés", () => {
  const ahora = new Date(2026, 10, 15, 12).getTime(), DIA = 86_400_000;
  it("dice cuándo fue cada partida", () => {
    expect(cuando(ahora - 60_000, ahora, "en")).toBe("Today");
    expect(cuando(ahora - DIA, ahora, "en")).toBe("Yesterday");
    expect(cuando(ahora - 3 * DIA, ahora, "en")).toBe("3 days ago");
    expect(cuando(0, ahora, "en")).toBe("Earlier");
  });
});
