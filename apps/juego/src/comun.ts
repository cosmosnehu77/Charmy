import { charmySvg, type Mood, type Outfit } from "@charmy/charmy/core";
import { interfaz } from "@charmy/ui";
import Phaser from "phaser";
import dia from "../../../data/muestras/dia-juego.json";
import { proyectar, type Anillo, type Contorno } from "./contorno";
import type { Area, DiaJuego } from "./datos";
import fondo from "./fondo.json";
import { dimensiones } from "./pantalla";
import type { Almacen } from "./record";
import type { Desafio } from "./desafio";
import { crearSonido, leerSilencio } from "./sonido";

export const { ancho: ANCHO, alto: ALTO } = dimensiones(window.innerWidth, window.innerHeight);
/** Las posiciones verticales se pensaron para 600 de alto: se escalan al alto real del lienzo. */
export const Y = (y: number) => Math.round((y / 600) * ALTO);
/** Ancho de los textos largos, para que se corten en líneas dentro del lienzo. */
export const LINEAS = { wordWrap: { width: ANCHO - 80 }, align: "center" } as const;
export const TEXTO = { fontFamily: "monospace", color: interfaz.tinta } as const;

/** El día que se juega: la muestra hasta que main.ts carga el desafío del día (F4-E8). */
export let DIA = dia as DiaJuego;
/** Qué decir en el inicio si se juega la muestra en lugar del desafío. */
export let AVISO_DIA: string | null = null;

export function usarDesafio(d: Desafio) {
  DIA = d.dia;
  AVISO_DIA = d.aviso;
}
export const FONDO = fondo as Contorno;
export const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Acceder a localStorage puede fallar (modo privado o almacenamiento bloqueado): sin él, un almacén vacío. */
export function almacen(): Almacen {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

/** Sonido del juego. El contexto de audio se crea con el primer sonido, después de que el jugador tocó algo. */
export const SONIDO = crearSonido(() => new AudioContext(), leerSilencio(almacen()));

/** Clave de la textura de Charmy con un vestuario y un estado. */
export const claveCharmy = (outfit: Outfit, mood: Mood) => `charmy-${outfit}-${mood}`;

export function cargarCharmy(escena: Phaser.Scene, outfit: Outfit, mood: Mood) {
  const clave = claveCharmy(outfit, mood);
  const svg = charmySvg({ mood, outfit, size: 128 });
  // El cargador de Phaser solo acepta data URI en base64; el SVG puede traer caracteres no ASCII.
  const base64 = btoa(Array.from(new TextEncoder().encode(svg), (b) => String.fromCharCode(b)).join(""));
  escena.load.svg(clave, `data:image/svg+xml;base64,${base64}`, { width: 128, height: 128 });
}

/** El contorno de las regiones, con la misma proyección (y el mismo recuadro) que los focos, corrido al origen del mapa. */
export function dibujarFondo(escena: Phaser.Scene, origen: { x: number; y: number }, area: Area) {
  const g = escena.add.graphics().setDepth(-1);
  g.fillStyle(color(interfaz.superficie));
  g.lineStyle(1, color(interfaz.borde));
  for (const anillo of FONDO.anillos as Anillo[]) {
    const puntos = anillo.map((p) => {
      const { x, y } = proyectar(p, DIA.bbox, area);
      return new Phaser.Math.Vector2(x + origen.x, y + origen.y);
    });
    g.fillPoints(puntos, true);
    g.strokePoints(puntos, true);
  }
}

export function boton(escena: Phaser.Scene, x: number, y: number, texto: string, alTocar: () => void) {
  const etiqueta = escena.add
    .text(x, y, texto, {
      ...TEXTO,
      fontSize: "20px",
      color: interfaz.superficie,
      backgroundColor: interfaz.acento,
      padding: { x: 20, y: 10 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  etiqueta.on("pointerdown", alTocar);
  // También con el teclado: Enter o Espacio (RNF-04). Un solo botón por escena.
  escena.input.keyboard?.once("keydown-ENTER", alTocar);
  escena.input.keyboard?.once("keydown-SPACE", alTocar);
}
