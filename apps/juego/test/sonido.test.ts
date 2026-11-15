import { describe, expect, it } from "vitest";
import type { Almacen } from "../src/record";
import { CLAVE_SILENCIO, SONIDOS, crearSonido, guardarSilencio, leerSilencio, type Contexto } from "../src/sonido";

function memoria(): Almacen {
  const datos = new Map<string, string>();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
}

const roto: Almacen = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
};

/** Un AudioContext de mentira que cuenta los osciladores creados. */
function contextoFalso() {
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const nodo = () => ({ connect: (destino: unknown) => destino });
  const contexto = {
    osciladores: 0,
    currentTime: 0,
    state: "running",
    destination: {},
    resume: async () => {},
    createGain: () => ({ ...nodo(), gain: param }),
    createOscillator: () => {
      contexto.osciladores++;
      return { ...nodo(), type: "sine", frequency: param, start() {}, stop() {} };
    },
  };
  return contexto;
}

describe("silencio recordado", () => {
  it("se guarda y se lee entre visitas", () => {
    const almacen = memoria();
    expect(leerSilencio(almacen)).toBe(false);
    guardarSilencio(almacen, true);
    expect(almacen.getItem(CLAVE_SILENCIO)).toBe("1");
    expect(leerSilencio(almacen)).toBe(true);
    guardarSilencio(almacen, false);
    expect(leerSilencio(almacen)).toBe(false);
  });

  it("sin almacenamiento arranca con sonido y no falla", () => {
    expect(leerSilencio(roto)).toBe(false);
    expect(() => guardarSilencio(roto, true)).not.toThrow();
  });
});

describe("sonidos", () => {
  it("cada sonido toca al menos una nota", () => {
    const contexto = contextoFalso();
    const sonido = crearSonido(() => contexto as unknown as Contexto, false);
    for (const nombre of Object.keys(SONIDOS) as (keyof typeof SONIDOS)[]) {
      const antes = contexto.osciladores;
      sonido.tocar(nombre);
      expect(contexto.osciladores).toBeGreaterThan(antes);
    }
  });

  it("con el silencio activo no se crea ningún sonido, ni siquiera el contexto de audio", () => {
    let creados = 0;
    const sonido = crearSonido(() => {
      creados++;
      return contextoFalso() as unknown as Contexto;
    }, true);
    sonido.tocar("apagar");
    sonido.tocar("fin");
    expect(creados).toBe(0);
  });

  it("el contexto de audio se crea recién al primer sonido, y una sola vez", () => {
    let creados = 0;
    const sonido = crearSonido(() => {
      creados++;
      return contextoFalso() as unknown as Contexto;
    }, false);
    expect(creados).toBe(0);
    sonido.tocar("apagar");
    sonido.tocar("combo");
    expect(creados).toBe(1);
  });

  it("silenciar a mitad de partida corta los sonidos siguientes", () => {
    const contexto = contextoFalso();
    const sonido = crearSonido(() => contexto as unknown as Contexto, false);
    sonido.tocar("apagar");
    const antes = contexto.osciladores;
    sonido.silenciar(true);
    sonido.tocar("apagar");
    expect(contexto.osciladores).toBe(antes);
    expect(sonido.silenciado()).toBe(true);
  });

  it("si el navegador no tiene audio, el juego sigue sin sonido", () => {
    const sonido = crearSonido(() => {
      throw new Error("sin Web Audio");
    }, false);
    expect(() => sonido.tocar("apagar")).not.toThrow();
  });
});
