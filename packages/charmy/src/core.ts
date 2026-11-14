// Núcleo sin dependencias: sirve para React, Astro, HTML plano o el juego.
import { CAPAS, type Capa, dibujo } from "./dibujo.js";

export const MOODS = ["idle", "saluda", "explica", "alerta", "festeja", "pensando"] as const;
export const OUTFITS = ["base", "bombero", "piloto", "cientifica", "guia"] as const;
export type Mood = (typeof MOODS)[number];
export type Outfit = (typeof OUTFITS)[number];

/** Por debajo de este tamaño se dibuja solo la cabeza (guía de uso de docs/charmy-base/Paleta.dc.html). */
export const TAMANO_MINIMO_CUERPO = 40;

/** Paleta de la mascota. Los tokens de la interfaz viven en packages/ui. */
export const PALETA = {
  pelaje: "#E8833A",
  pelajeOscuro: "#C4612A",
  hocico: "#FCE9CF",
  banda: "#4A2A1E",
  llama: "#FF6B1A",
  nucleo: "#FFC53D",
  acento: "#C2410C",
  casco: "#F2B705",
  chaqueta: "#2E3B4E",
  guia: "#4F7A55",
  cielo: "#EEF2F4",
  tinta: "#1B2430",
} as const;

const NOMBRE_MOOD: Record<Mood, string> = {
  idle: "en reposo",
  saluda: "saludando",
  explica: "explicando",
  alerta: "en alerta",
  festeja: "festejando",
  pensando: "pensando",
};
const NOMBRE_OUTFIT: Record<Outfit, string> = {
  base: "",
  bombero: "de bombero",
  piloto: "de piloto",
  cientifica: "de científica",
  guia: "de guía",
};

export interface OpcionesCharmy {
  mood?: Mood;
  outfit?: Outfit;
  /** Lado en píxeles. Por defecto 240. */
  size?: number;
  /** Si hay texto, el globo de puntos del dibujo se apaga: el texto lo muestra quien llama. */
  say?: string;
  /** Texto alternativo. Por defecto describe estado y vestuario. */
  label?: string;
  /** Oculta el dibujo a los lectores de pantalla cuando el texto de al lado ya lo dice todo. */
  decorative?: boolean;
  /** "cabeza" recorta a la cabeza. Por defecto se elige solo según el tamaño. */
  variant?: "completo" | "cabeza";
  /** Por defecto true. false deja a Charmy quieto (listas, avatares). Con movimiento reducido, siempre quieto. */
  animate?: boolean;
  /** Dónde va el globo de `say` respecto del dibujo. Por defecto "derecha". */
  sayPosition?: "derecha" | "arriba";
}

export function esMood(x: unknown): x is Mood {
  return typeof x === "string" && (MOODS as readonly string[]).includes(x);
}
export function esOutfit(x: unknown): x is Outfit {
  return typeof x === "string" && (OUTFITS as readonly string[]).includes(x);
}

/** Qué capas se ven en cada combinación. Misma tabla que renderVals() del diseño base. */
export function capasVisibles(mood: Mood, outfit: Outfit, conTexto = false): Record<Capa, 0 | 1> {
  const es = (...ms: Mood[]): 0 | 1 => (ms.includes(mood) ? 1 : 0);
  const viste = (o: Outfit): 0 | 1 => (outfit === o ? 1 : 0);
  const v: Record<Capa, 0 | 1> = {
    armL: es("idle", "saluda", "explica", "alerta", "pensando"),
    armR: es("idle", "alerta"),
    armLUp: es("festeja"),
    armRUp: es("saluda", "festeja"),
    armRPoint: es("explica"),
    armChin: es("pensando"),
    eyesOpen: es("idle", "saluda", "explica"),
    eyesHappy: es("festeja"),
    eyesAlert: es("alerta"),
    eyesThink: es("pensando"),
    mouthW: es("idle", "pensando"),
    mouthOpen: es("saluda", "explica"),
    mouthBig: es("festeja"),
    mouthO: es("alerta"),
    alert: es("alerta"),
    think: es("pensando"),
    sparkle: es("festeja"),
    wave: es("saluda"),
    speech: conTexto ? 0 : es("explica"),
    bombero: viste("bombero"),
    piloto: viste("piloto"),
    cientifica: viste("cientifica"),
    guia: viste("guia"),
    belly: outfit === "base" || outfit === "piloto" || outfit === "guia" ? 1 : 0,
  };
  for (const c of CAPAS) if (v[c] === undefined) throw new Error(`capa sin definir: ${c}`);
  return v;
}

/** Nombres de las capas prendidas en una combinación. Útil para animar o depurar. */
export function CAPAS_DE(mood: Mood, outfit: Outfit, conTexto = false): Capa[] {
  const v = capasVisibles(mood, outfit, conTexto);
  return CAPAS.filter((c) => v[c] === 1);
}

export { CAPAS, type Capa };

export function escaparTexto(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function etiqueta(mood: Mood, outfit: Outfit): string {
  return ["Charmy", NOMBRE_OUTFIT[outfit], NOMBRE_MOOD[mood]].filter(Boolean).join(" ");
}

/** Normaliza las opciones: valores inválidos vuelven al valor por defecto en lugar de romper la página. */
export function normalizar(op: OpcionesCharmy = {}) {
  const mood: Mood = esMood(op.mood) ? op.mood : "idle";
  const outfit: Outfit = esOutfit(op.outfit) ? op.outfit : "base";
  const size = Number.isFinite(op.size) && (op.size as number) > 0 ? Math.round(op.size as number) : 240;
  const variant = op.variant ?? (size < TAMANO_MINIMO_CUERPO ? "cabeza" : "completo");
  const conTexto = typeof op.say === "string" && op.say.trim() !== "";
  const animate = op.animate !== false;
  const sayPosition = op.sayPosition === "arriba" ? "arriba" : "derecha";
  return {
    mood, outfit, size, variant, conTexto, animate, sayPosition,
    label: op.label ?? etiqueta(mood, outfit),
    decorative: !!op.decorative,
  };
}

/** Recuadro de la cabeza con orejas y sombrero, en el sistema de 240 × 240. */
export const VIEWBOX = { completo: "0 0 240 240", cabeza: "50 4 140 140" } as const;

/** Devuelve el SVG de Charmy como texto. Seguro de insertar: el único texto libre (label) se escapa. */
export function charmySvg(op: OpcionesCharmy = {}): string {
  const n = normalizar(op);
  const accesible = n.decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${escaparTexto(n.label)}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="charmy" width="${n.size}" height="${n.size}" ` +
    `viewBox="${VIEWBOX[n.variant]}" ${accesible} data-mood="${n.mood}" data-outfit="${n.outfit}"` +
    `${n.animate ? "" : ' data-animado="no"'}>` +
    dibujo(capasVisibles(n.mood, n.outfit, n.conTexto)) +
    `</svg>`
  );
}

/**
 * Charmy con su globo como HTML, para páginas sin React (Astro estático). Necesita CHARMY_CSS o charmy.css en la página.
 * Seguro de insertar: el texto de `say` y el de `label` se escapan.
 */
export function charmyHtml(op: OpcionesCharmy = {}): string {
  const n = normalizar(op);
  const dibujo = `<span class="charmy-dibujo" style="display:inline-block;line-height:0">${charmySvg(op)}</span>`;
  const anim = n.animate ? "" : ' data-animado="no"';
  if (!n.conTexto) return `<span class="charmy-raiz"${anim}>${dibujo}</span>`;
  return (
    `<span class="charmy-raiz charmy-con-globo" data-globo="${n.sayPosition}"${anim}>${dibujo}` +
    `<span class="charmy-globo" role="status" aria-live="polite">${escaparTexto(op.say as string)}</span></span>`
  );
}

export { CHARMY_CSS } from "./estilos.js";
