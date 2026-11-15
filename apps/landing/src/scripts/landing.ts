// Recorrido de la landing: mapa ilustrativo en un lienzo fijo, Charmy guía, tema e idioma.
// Los colores salen de los tokens de @charmy/ui (se leen del CSS), nunca de valores sueltos.
import regionesJson from "../data/regiones.json";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { EN } from "./en";
import { conIdioma, idiomaInicial } from "./idioma";
import { ocultarBarra, progresoPaso, suave, tiempoLectura, tramo } from "./recorrido";

type Region = { k: string; n: string; r: number[][]; bb?: number[][] };
const REGIONES = regionesJson as Region[];
const raiz = document.documentElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Scroll suave: suaviza el scroll nativo (no mueve el contenido, así las tarjetas sticky siguen andando).
if (!reducir) new Lenis({ autoRaf: true, anchors: true });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const leerToken = (n: string) => getComputedStyle(raiz).getPropertyValue(n).trim();
const RAMPA = [1, 2, 3, 4, 5, 6, 7].map((n) => leerToken(`--rampa-conteo-${n}`));
const TOPE = RAMPA.length - 1;

/* ---------- Titular partido en palabras para la entrada ---------- */
const TITULO = { es: "Cuando nuestro sur está en <em>peligro.</em>", en: "When our south is in <em>danger.</em>" };
function armarTitulo(idioma: "es" | "en") {
  const h = $("titulo");
  let i = 0;
  h.innerHTML = TITULO[idioma];
  const envolver = (nodo: Node) => {
    [...nodo.childNodes].forEach((n) => {
      if (n.nodeType !== 3) return envolver(n);
      const frag = document.createDocumentFragment();
      (n.textContent ?? "").split(/(\s+)/).forEach((t) => {
        if (!t.trim()) return frag.append(t);
        const s = document.createElement("span");
        s.className = "pal";
        s.style.setProperty("--i", String(i++));
        s.textContent = t;
        frag.append(s);
      });
      n.replaceWith(frag);
    });
  };
  envolver(h);
}

/* ---------- Geometría ---------- */
const COSL = Math.cos((36 * Math.PI) / 180);
const BBOX = { x0: -80, x1: -52, y0: -56, y1: -17 };
REGIONES.forEach((r) => {
  r.bb = r.r.map((a) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < a.length; i += 2) {
      x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]);
    }
    return [x0, y0, x1, y1];
  });
});
function enAnillo(a: number[], x: number, y: number) {
  let d = false;
  for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
    const xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
function region(x: number, y: number): Region | null {
  for (const r of REGIONES)
    for (let k = 0; k < r.r.length; k++) {
      const b = r.bb![k];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (enAnillo(r.r[k], x, y)) return r;
    }
  return null;
}
const ruido = (x: number, y: number) =>
  0.5 + 0.18 * Math.sin(x * 1.7 + y * 0.9) + 0.14 * Math.sin(x * 0.55 - y * 2.1 + 1.3) + 0.09 * Math.sin(x * 3.3 + y * 2.7 + 0.4) + 0.05 * Math.sin(x * 6.1 - y * 5.3);
// Relieve ilustrativo: una cordillera aproximada, no un modelo de elevación.
function elev(x: number, y: number) {
  const t = Math.min(1, Math.max(0, (-y - 22) / 30));
  const cresta = -67.6 + (-73.4 + 67.6) * Math.pow(t, 1.15);
  const ancho = 1.25 + 1.5 * Math.exp(-Math.pow((y + 24) / 5, 2));
  const alto = 1 - 0.55 * Math.min(1, Math.max(0, (-y - 37) / 16));
  let e = Math.exp(-Math.pow((x - cresta) / ancho, 2)) * alto * (0.72 + 0.4 * ruido(x * 0.9, y * 0.9));
  e += 0.45 * Math.exp(-(Math.pow((x + 64.6) / 0.55, 2) + Math.pow((y + 31.6) / 1.6, 2)));
  e += 0.22 * Math.exp(-(Math.pow((x + 61.5) / 1.2, 2) + Math.pow((y + 38) / 0.45, 2)));
  e += 0.07 * ruido(x * 2.2, y * 2.2);
  return Math.min(1, e);
}

const PUNTOS: number[] = [];
for (let y = BBOX.y0; y < BBOX.y1; y += 0.27)
  for (let x = BBOX.x0; x < BBOX.x1; x += (0.27 / COSL) * 0.8) {
    const jx = x + ((y * 13) % 1) * 0.05;
    if (region(jx, y)) PUNTOS.push(jx, y, elev(jx, y));
  }
const NIVELES = [0.18, 0.32, 0.46, 0.6, 0.74, 0.88];
const CURVAS: number[] = [];
{
  const s = 0.32, nx = Math.ceil((BBOX.x1 - BBOX.x0) / s), ny = Math.ceil((BBOX.y1 - BBOX.y0) / s);
  const v = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = elev(BBOX.x0 + i * s, BBOX.y0 + j * s);
  const L = (a: number, b: number, l: number) => (l - a) / (b - a || 1e-9);
  NIVELES.forEach((l) => {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = v[j * (nx + 1) + i], b = v[j * (nx + 1) + i + 1], c = v[(j + 1) * (nx + 1) + i + 1], d = v[(j + 1) * (nx + 1) + i];
        const x = BBOX.x0 + i * s, y = BBOX.y0 + j * s, pts: number[][] = [];
        if (a < l !== b < l) pts.push([x + s * L(a, b, l), y]);
        if (b < l !== c < l) pts.push([x + s, y + s * L(b, c, l)]);
        if (c < l !== d < l) pts.push([x + s * (1 - L(c, d, l)), y + s]);
        if (d < l !== a < l) pts.push([x, y + s * (1 - L(d, a, l))]);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          if (region((pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2)) CURVAS.push(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], l);
        }
      }
  });
}

/* ---------- Focos ilustrativos, deterministas (semilla fija) ---------- */
function prng(s: number) {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = prng(20261114);
const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = azar();
  while (!v) v = azar();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
type Nucleo = { x: number; y: number; s: number; w: number; m: number[]; pico?: { a: number; m: number[]; f: number } };
const NUCLEOS: Nucleo[] = [
  { x: -62, y: -24.8, s: 1.5, w: 1, m: [7, 8, 9] }, { x: -59.6, y: -25, s: 0.8, w: 0.45, m: [7, 8] }, { x: -64.3, y: -23.4, s: 0.7, w: 0.45, m: [7, 8, 9] },
  { x: -57.8, y: -28.5, s: 0.8, w: 0.7, m: [0, 1, 7], pico: { a: 2022, m: [0, 1], f: 4 } }, { x: -59.4, y: -33.1, s: 0.45, w: 0.4, m: [6, 7, 8], pico: { a: 2020, m: [7, 8], f: 4 } },
  { x: -64.6, y: -31.4, s: 0.6, w: 0.35, m: [7, 8, 9] }, { x: -65, y: -37, s: 1.1, w: 0.32, m: [11, 0, 1] }, { x: -54.8, y: -27, s: 0.5, w: 0.28, m: [7, 8] },
  { x: -72.1, y: -36.4, s: 0.55, w: 0.55, m: [0, 1], pico: { a: 2023, m: [1], f: 4 } }, { x: -71.6, y: -35.2, s: 0.45, w: 0.3, m: [0, 1], pico: { a: 2017, m: [0], f: 4 } },
  { x: -71.3, y: -33.1, s: 0.35, w: 0.18, m: [0, 1, 11] }, { x: -71.3, y: -41.4, s: 0.7, w: 0.22, m: [0, 1, 2] }, { x: -68, y: -39, s: 0.9, w: 0.15, m: [0, 1, 11] },
  { x: -67.7, y: -45.8, s: 0.35, w: 0.22, m: [0, 1, 11], pico: { a: 2019, m: [0, 1], f: 4 } }, { x: -71.4, y: -42.2, s: 0.4, w: 0.3, m: [0, 1, 2], pico: { a: 2025, m: [0, 1], f: 4 } },
];
type Foco = { x: number; y: number; a: number; m: number; i: number; modis: boolean; f: number; jx: number; jy: number; dl: number };
const FOCOS: Foco[] = [];
for (let a = 2001; a <= 2025; a++) {
  const fa = 0.75 + 0.5 * azar();
  NUCLEOS.forEach((n) => {
    for (let m = 0; m < 12; m++) {
      const d = Math.min(...n.m.map((p) => Math.min(Math.abs(m - p), 12 - Math.abs(m - p))));
      let c = n.w * fa * 15 * Math.exp((-d * d) / 1.1);
      if (n.pico && n.pico.a === a && n.pico.m.includes(m)) c *= n.pico.f;
      let k = Math.floor(c + azar());
      while (k-- > 0) {
        let x = 0, y = 0, t = 0;
        do { x = n.x + ((gauss() * n.s) / COSL) * 0.8; y = n.y + gauss() * n.s; t++; } while (!region(x, y) && t < 8);
        if (t >= 8) continue;
        FOCOS.push({ x, y, a, m, i: Math.min(TOPE, Math.floor(Math.pow(azar(), 1.6) * RAMPA.length)), modis: azar() < 0.3, f: azar() * 6.28, jx: (azar() - 0.5) * 0.84, jy: (azar() - 0.5) * 0.84, dl: azar() * 0.25 });
      }
    }
  });
}
const CHUBUT = REGIONES.find((r) => r.k === "AR-U")!;
$("zona-total").textContent = FOCOS.filter((p) => region(p.x, p.y) === CHUBUT).length.toLocaleString("es-AR");
const CUENTA: Record<number, number> = {};
FOCOS.forEach((p) => { const k = p.a * 12 + p.m; CUENTA[k] = (CUENTA[k] || 0) + 1; });
const MAXC = Math.max(...Object.values(CUENTA));
const CELDAS: Record<string, number> = {};
FOCOS.forEach((p) => { const k = Math.round(p.x) + "," + Math.round(p.y); CELDAS[k] = (CELDAS[k] || 0) + 1; });
const COLUMNAS = Object.entries(CELDAS).map(([k, c]) => { const [x, y] = k.split(",").map(Number); return { x, y, c }; });
const MAXCOL = Math.max(...COLUMNAS.map((c) => c.c));
const VIVOS = [[-71.9, -35.6], [-72.3, -36.9], [-70.6, -38.9], [-69.9, -37.6], [-64.4, -31.2], [-64.9, -31.9], [-71.4, -40.6], [-63.9, -30.6], [-72.6, -37.6], [-68.6, -38.2]];

/* ---------- Colores del lienzo, resueltos desde los tokens del tema ---------- */
const sonda = document.createElement("span");
sonda.hidden = true;
document.body.append(sonda);
const resolver = (expr: string) => { sonda.style.color = expr; return getComputedStyle(sonda).color; };
type Paleta = ReturnType<typeof armarPaleta>;
function armarPaleta() {
  const oscuro = raiz.dataset.tema === "oscuro";
  const mezcla = (a: string, n: number, b: string) => resolver(`color-mix(in srgb,var(${a}) ${n}%,${b})`);
  return {
    fondo: resolver("var(--l-fondo)"), tierra: resolver("var(--l-panel)"), borde: resolver("var(--l-linea)"),
    grat: mezcla("--l-linea", 60, "var(--l-fondo)"), gratTxt: resolver("var(--l-tenue)"),
    curvaA: mezcla("--l-texto", 55, "var(--l-fondo)"), curvaB: mezcla("--l-texto", 28, "var(--l-fondo)"),
    tonos: [16, 26, 38, 52].map((n) => mezcla("--l-texto", n, "var(--l-panel)")),
    celda: resolver("var(--l-elevado)"), calTxt: resolver("var(--l-tenue)"),
    zonaF: mezcla("--l-ambar-txt", 8, "transparent"), zonaL: resolver("var(--l-ambar-txt)"), zonaT: resolver("var(--l-titulo)"),
    franjaF: mezcla("--l-titulo", 4, "transparent"), franjaL: mezcla("--l-titulo", 18, "transparent"),
    mezclaOp: (oscuro ? "lighter" : "multiply") as GlobalCompositeOperation, sube: oscuro ? 0 : 1,
  };
}
let CT: Paleta = armarPaleta();

const lienzo = $<HTMLCanvasElement>("mapa"), ctx = lienzo.getContext("2d")!;
let W = 0, H = 0, movil = false;
function medir() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight; movil = W < 900;
  lienzo.width = W * dpr; lienzo.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", medir);
medir();
const FUENTE_MONO = leerToken("--fuente-mono");

const SPRITES = RAMPA.map((c) => {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, RAMPA[0]); gr.addColorStop(0.12, c); gr.addColorStop(0.38, c + "66"); gr.addColorStop(1, c + "00");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return s;
});

/* Cámara por paso: centro, zoom relativo, inclinación, rumbo y foco en pantalla. */
type Llave = { x: number; y: number; z: number; p: number; b: number; cx: number; cy: number };
const LLAVES: Llave[] = [
  { x: -64.5, y: -38, z: 1.15, p: 50, b: -6, cx: 0.5, cy: 0.9 },
  { x: -63.5, y: -35.5, z: 1.02, p: 0, b: 0, cx: 0.5, cy: 0.5 },
  { x: -64, y: -33.5, z: 1.45, p: 58, b: -24, cx: 0.58, cy: 0.58 },
  { x: -68.6, y: -44.3, z: 2.9, p: 44, b: -12, cx: 0.6, cy: 0.52 },
  { x: -63.5, y: -35.5, z: 0.95, p: 0, b: 0, cx: 0.65, cy: 0.5 },
  { x: -69.5, y: -36.2, z: 2.7, p: 38, b: 14, cx: 0.6, cy: 0.52 },
  { x: -64, y: -37.5, z: 1, p: 52, b: 28, cx: 0.5, cy: 0.45 },
];
const pasos = [...document.querySelectorAll<HTMLElement>(".paso")];
function progreso() {
  const mid = innerHeight * 0.5;
  let p = 0;
  pasos.forEach((s, i) => { const r = s.getBoundingClientRect(); if (r.top <= mid) p = progresoPaso(i, (mid - r.top) / r.height); });
  return Math.min(6, p);
}
type Camara = Llave & { k: number; F: number; cp: number; sp: number; cb: number; sb: number; px: number; py: number; z0: number };
function camara(p: number, tiempo: number): Camara {
  const i = Math.min(LLAVES.length - 1, Math.floor(p)), j = Math.min(LLAVES.length - 1, i + 1), e = suave(0.5, 1, p - i);
  const A = LLAVES[i], B = LLAVES[j];
  const c = {} as Camara;
  (Object.keys(A) as (keyof Llave)[]).forEach((k) => (c[k] = lerp(A[k], B[k], e)));
  if (movil) { c.cx = 0.5; c.cy = p < 0.5 ? 0.86 : 0.27; c.z *= 0.92; }
  if (!reducir) c.b += Math.sin(tiempo * 0.00012) * 3 * tramo(p, 0) + ((tiempo * 0.0025) % 360) * suave(5.5, 6, p);
  const z0 = Math.min((H * 0.86) / 39, (W * 0.95) / (28 * COSL));
  c.k = z0 * c.z; c.F = 1.7 * Math.max(H, 600);
  const pr = (c.p * Math.PI) / 180, br = (c.b * Math.PI) / 180;
  c.cp = Math.cos(pr); c.sp = Math.sin(pr); c.cb = Math.cos(br); c.sb = Math.sin(br);
  c.px = W * c.cx; c.py = H * c.cy; c.z0 = z0;
  return c;
}
const OUT = [0, 0, 0];
function proy(c: Camara, x: number, y: number, z: number) {
  const X = (x - c.x) * c.k * COSL, Y = -(y - c.y) * c.k;
  const xr = X * c.cb - Y * c.sb, yr = X * c.sb + Y * c.cb;
  const d = -yr * c.sp - z * c.cp, f = c.F / (c.F + d);
  OUT[0] = c.px + xr * f; OUT[1] = c.py + (yr * c.cp - z * c.sp) * f; OUT[2] = f;
  return f > 0.05;
}
function calGrid() {
  if (movil) return { x0: W * 0.1, y0: H * 0.13, cw: (W * 0.84) / 12, ch: (H * 0.32) / 25 };
  const w = Math.min(W * 0.44, H * 1.05);
  return { x0: W * 0.42, y0: H * 0.15, cw: w / 12, ch: (H * 0.72) / 25 };
}
const contorno = (c: Camara, anillos: number[][]) => {
  for (const a of anillos) {
    for (let i = 0; i < a.length; i += 2) { proy(c, a[i], a[i + 1], 0); i ? ctx.lineTo(OUT[0], OUT[1]) : ctx.moveTo(OUT[0], OUT[1]); }
    ctx.closePath();
  }
};

let pVista = 0, previo = 0, anioMostrado = 0;
const t0 = performance.now();
const hud = $("hud"), hudAnio = $("hud-anio"), hudSensor = $("hud-sensor");

function dibujar(ahora: number) {
  const dt = Math.min(64, ahora - (previo || ahora));
  previo = ahora;
  const pObjetivo = progreso();
  pVista = reducir ? pObjetivo : pVista + (pObjetivo - pVista) * (1 - Math.exp(-dt * 0.006));
  const p = pVista, tiempo = ahora - t0, c = camara(p, tiempo);
  const wAnio = tramo(p, 1), wCol = tramo(p, 2), wZona = tramo(p, 3), wCal = suave(3.5, 4, p) * (1 - suave(4.5, 5, p)), wVivo = tramo(p, 5), wFin = suave(5.5, 6, p);
  const relieve = c.sp * c.k * 1.15;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CT.fondo; ctx.fillRect(0, 0, W, H);
  const aMapa = (1 - 0.82 * wCal) * (1 - 0.55 * wFin);
  const mono = (peso: number, px: number) => `${peso} ${px}px ${FUENTE_MONO}`;

  // Retícula
  ctx.globalAlpha = 0.55 * aMapa; ctx.strokeStyle = CT.grat; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = -55; y <= -20; y += 5) for (let x = -80; x <= -50; x += 1) { proy(c, x, y, 0); x === -80 ? ctx.moveTo(OUT[0], OUT[1]) : ctx.lineTo(OUT[0], OUT[1]); }
  for (let x = -80; x <= -50; x += 5) for (let y = -56; y <= -18; y += 1) { proy(c, x, y, 0); y === -56 ? ctx.moveTo(OUT[0], OUT[1]) : ctx.lineTo(OUT[0], OUT[1]); }
  ctx.stroke();
  ctx.fillStyle = CT.gratTxt; ctx.font = mono(500, 10);
  for (let y = -50; y <= -20; y += 10) { proy(c, -79, y, 0); ctx.fillText(Math.abs(y) + "°S", OUT[0] + 4, OUT[1] - 4); }

  // Tierra
  ctx.globalAlpha = aMapa; ctx.beginPath();
  for (const r of REGIONES) contorno(c, r.r);
  ctx.fillStyle = CT.tierra; ctx.fill(); ctx.strokeStyle = CT.borde; ctx.lineWidth = 0.8; ctx.stroke();
  if (proy(c, -59.6, -50.75, 0)) {
    ctx.font = mono(500, 10); ctx.fillStyle = CT.gratTxt; ctx.textAlign = "center"; ctx.letterSpacing = "2px";
    ctx.fillText("ISLAS MALVINAS", OUT[0], OUT[1]); ctx.letterSpacing = "0px"; ctx.textAlign = "left";
  }

  // Curvas de nivel
  ctx.globalAlpha = 0.75 * aMapa; ctx.lineWidth = 1;
  NIVELES.forEach((l) => {
    ctx.strokeStyle = l > 0.6 ? CT.curvaA : CT.curvaB; ctx.beginPath();
    for (let i = 0; i < CURVAS.length; i += 5) {
      if (CURVAS[i + 4] !== l) continue;
      const z = l * relieve;
      proy(c, CURVAS[i], CURVAS[i + 1], z); ctx.moveTo(OUT[0], OUT[1]);
      proy(c, CURVAS[i + 2], CURVAS[i + 3], z); ctx.lineTo(OUT[0], OUT[1]);
    }
    ctx.stroke();
  });

  // Semitono del relieve
  const tam = Math.max(0.9, Math.min(2.4, (c.k / c.z0) * 0.9));
  for (let t = 0; t < 4; t++) {
    ctx.fillStyle = CT.tonos[t]; ctx.globalAlpha = (0.55 + t * 0.12) * aMapa;
    for (let i = 0; i < PUNTOS.length; i += 3) {
      const e = PUNTOS[i + 2];
      if (Math.min(3, Math.floor(e * 4.2)) !== t || !proy(c, PUNTOS[i], PUNTOS[i + 1], e * relieve)) continue;
      if (OUT[0] < -4 || OUT[0] > W + 4 || OUT[1] < -4 || OUT[1] > H + 4) continue;
      const s = tam * OUT[2] * (0.8 + e);
      ctx.fillRect(OUT[0] - s / 2, OUT[1] - s / 2, s, s);
    }
  }

  // Zona: Chubut y Comodoro Rivadavia
  if (wZona > 0.01) {
    ctx.globalAlpha = wZona; ctx.beginPath(); contorno(c, CHUBUT.r);
    ctx.fillStyle = CT.zonaF; ctx.fill(); ctx.setLineDash([7, 6]); ctx.lineDashOffset = -tiempo * 0.02;
    ctx.strokeStyle = CT.zonaL; ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]);
    proy(c, -69.6, -43.6, 0); ctx.font = mono(500, 12); ctx.fillStyle = CT.zonaT; ctx.letterSpacing = "3px"; ctx.fillText("CHUBUT", OUT[0] - 30, OUT[1] + 4);
    proy(c, -67.48, -45.86, 0); ctx.fillStyle = CT.zonaL; ctx.beginPath(); ctx.arc(OUT[0], OUT[1], 4.5, 0, 6.283); ctx.fill();
    ctx.strokeStyle = CT.zonaT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(OUT[0], OUT[1], 9 + 3 * Math.sin(tiempo * 0.004), 0, 6.283); ctx.stroke();
    ctx.font = mono(600, 12); ctx.letterSpacing = "1px"; ctx.fillStyle = CT.zonaT; ctx.fillText("Comodoro Rivadavia", OUT[0] + 16, OUT[1] + 4); ctx.letterSpacing = "0px";
  }

  // Calendario: celdas y etiquetas
  const G = calGrid();
  if (wCal > 0.01) {
    ctx.globalAlpha = wCal; ctx.font = mono(500, 10); ctx.fillStyle = CT.calTxt; ctx.textAlign = "center";
    (idioma === "en" ? "JFMAMJJASOND" : "EFMAMJJASOND").split("").forEach((m, i) => ctx.fillText(m, G.x0 + (i + 0.5) * G.cw, G.y0 - 10));
    ctx.textAlign = "right";
    for (let a = 2001; a <= 2025; a += 4) ctx.fillText(String(a), G.x0 - 10, G.y0 + (a - 2001 + 0.7) * G.ch);
    ctx.fillText("2025", G.x0 - 10, G.y0 + 24.7 * G.ch); ctx.textAlign = "left";
    const lleno = suave(0.75, 1, wCal);
    for (let a = 0; a < 25; a++)
      for (let m = 0; m < 12; m++) {
        const n = CUENTA[(2001 + a) * 12 + m] || 0;
        ctx.globalAlpha = wCal * 0.9; ctx.fillStyle = CT.celda; ctx.fillRect(G.x0 + m * G.cw + 1, G.y0 + a * G.ch + 1, G.cw - 2, G.ch - 2);
        if (n && lleno > 0) {
          ctx.globalAlpha = lleno * 0.92; ctx.fillStyle = RAMPA[Math.min(TOPE, Math.floor(Math.pow(n / MAXC, 0.55) * RAMPA.length))];
          ctx.fillRect(G.x0 + m * G.cw + 1, G.y0 + a * G.ch + 1, G.cw - 2, G.ch - 2);
        }
      }
  }

  // Columnas armonizadas
  if (wCol > 0.01) {
    const orden = COLUMNAS.map((q) => { proy(c, q.x, q.y, 0); return [q, OUT[1]] as const; }).sort((u, v) => u[1] - v[1]);
    ctx.globalCompositeOperation = CT.mezclaOp;
    for (const [q] of orden) {
      const r = Math.sqrt(q.c / MAXCOL), h = r * 3.6 * c.k * wCol * c.sp, e = elev(q.x, q.y) * relieve;
      if (!proy(c, q.x, q.y, e)) continue;
      const x0 = OUT[0], y0 = OUT[1], f = OUT[2];
      proy(c, q.x, q.y, e + h);
      const x1 = OUT[0], y1 = OUT[1], ic = Math.min(TOPE, 1 + Math.floor(r * 6)), col = RAMPA[ic];
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, col + "22"); g.addColorStop(1, col);
      ctx.globalAlpha = wCol; ctx.strokeStyle = g; ctx.lineWidth = Math.max(2, 4.5 * f * Math.min(2, c.k / c.z0)); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const sr = 10 * f * (0.6 + r);
      ctx.drawImage(SPRITES[ic], x1 - sr, y1 - sr, sr * 2, sr * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // Focos
  const anio = 2001 + 24 * Math.min(1, Math.max(0, (p - 1) / 0.46));
  const escala = Math.min(1.5, Math.sqrt(c.k / c.z0));
  ctx.globalCompositeOperation = CT.mezclaOp;
  for (const q of FOCOS) {
    let a = (reducir ? 0.4 : 0.26 + 0.2 * Math.sin(tiempo * 0.0016 + q.f)) * (1 - 0.45 * tramo(p, 0));
    if (wAnio > 0) {
      let b = 0;
      const d = anio - q.a;
      if (d >= 0 && d < 1) b = 1; else if (d >= 1) b = Math.pow(0.42, d);
      if (q.a < 2012 && !q.modis) b = 0;
      a = lerp(a, b, wAnio);
    }
    a *= 1 - 0.88 * wCol;
    if (wZona > 0 && Math.abs(q.x + 58.3) > 2.2) a *= 1 - 0.8 * wZona;
    a *= (1 - 0.85 * wVivo) * (1 - 0.9 * wFin);
    if (!proy(c, q.x, q.y, elev(q.x, q.y) * relieve)) continue;
    let x = OUT[0], y = OUT[1], f = OUT[2];
    if (wCal > 0) {
      const tt = suave(q.dl, q.dl + 0.75, wCal), gx = G.x0 + (q.m + 0.5 + q.jx) * G.cw, gy = G.y0 + (q.a - 2001 + 0.5 + q.jy * 0.8) * G.ch;
      x = lerp(x, gx, tt); y = lerp(y, gy, tt); a = lerp(a, 0.75, tt); f = lerp(f, 0.7, tt);
    }
    if (a < 0.02 || x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    const r = (2.4 + q.i * 0.7) * f * escala * (1 - 0.4 * wCal);
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(SPRITES[Math.min(TOPE, q.i + CT.sube)], x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";

  // En vivo: pasada del satélite y focos recientes
  if (wVivo > 0.01) {
    const fase = reducir ? 0.5 : (tiempo * 0.00006) % 1, cl = -80 + fase * 30;
    ctx.globalAlpha = wVivo * 0.9; ctx.beginPath();
    [[cl - 1.6, -18], [cl + 1.6, -18], [cl + 1.6 - 6.5, -55], [cl - 1.6 - 6.5, -55]].forEach((v, i) => { proy(c, v[0], v[1], 0); i ? ctx.lineTo(OUT[0], OUT[1]) : ctx.moveTo(OUT[0], OUT[1]); });
    ctx.closePath(); ctx.fillStyle = CT.franjaF; ctx.fill(); ctx.strokeStyle = CT.franjaL; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalCompositeOperation = CT.mezclaOp;
    VIVOS.forEach(([x, y], i) => {
      if (!proy(c, x, y, elev(x, y) * relieve)) return;
      const ph = reducir ? 0.3 : (tiempo * 0.0007 + i * 0.137) % 1;
      ctx.globalAlpha = wVivo; ctx.drawImage(SPRITES[4], OUT[0] - 14 * OUT[2], OUT[1] - 14 * OUT[2], 28 * OUT[2], 28 * OUT[2]);
      ctx.globalAlpha = wVivo * (1 - ph); ctx.strokeStyle = RAMPA[3]; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(OUT[0], OUT[1], 6 + ph * 30 * OUT[2], 0, 6.283); ctx.stroke();
    });
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;

  // Año y sensor
  hud.style.opacity = wAnio.toFixed(3);
  const ai = Math.floor(anio);
  if (anioMostrado !== ai) {
    anioMostrado = ai;
    hudAnio.textContent = String(ai);
    hudSensor.textContent = ai < 2012 ? "MODIS" : "MODIS + VIIRS";
    hudSensor.className = ai < 2012 ? "" : "viirs";
  }
  guia(p);
  requestAnimationFrame(dibujar);
}

/* ---------- Charmy guía: entra en cada paso, queda el tiempo de leer y se va ---------- */
const GUION = {
  es: [
    "¡Hola! Soy Charmy. Te muestro cuándo y dónde se quema el sur.",
    "Mirá 2012: no hay más fuego, llegó un satélite que ve más.",
    "Ahora las dos series usan la misma medida. Cada columna es una zona con fuego.",
    "Elegí tu zona y te cuento si este mes es normal ahí.",
    "Cada fila es un año. Los meses más oscuros tuvieron más fuego.",
    "Estos focos son de las últimas horas. Si ves un incendio, llamá al 100 o al 132.",
    "¿Jugamos? Apaguemos los focos del mapa.",
  ],
  en: [
    "Hi! I'm Charmy. I'll show you when and where the south burns.",
    "Look at 2012: there's no more fire, a satellite that sees more arrived.",
    "Now both series use the same measure. Each column is a zone with fire.",
    "Pick your zone and I'll tell you if this month is normal there.",
    "Each row is a year. The darker months had more fire.",
    "These hotspots are from the last few hours. If you see a fire, call 100 or 132.",
    "Shall we play? Let's put out the hotspots on the map.",
  ],
};
let idioma: "es" | "en" = "es";
const guiaEl = $("guia"), figura = $("guia-figura"), globo = $("guia-globo");
let pasoGuia = -1, tEntra = 0, tSale = 0;
function guia(p: number) {
  const n = Math.min(6, Math.floor(p + 0.35));
  if (n === pasoGuia) return;
  const primera = pasoGuia < 0;
  pasoGuia = n;
  clearTimeout(tEntra); clearTimeout(tSale);
  const mostrar = () => {
    figura.replaceChildren($<HTMLTemplateElement>(`charmy-${n}`).content.cloneNode(true));
    globo.textContent = GUION[idioma][n];
    guiaEl.classList.toggle("portada-g", n === 0);
    requestAnimationFrame(() => requestAnimationFrame(() => guiaEl.classList.add("visible")));
    tSale = window.setTimeout(() => { guiaEl.classList.remove("visible"); tEntra = window.setTimeout(mostrar, 9000); }, tiempoLectura(globo.textContent));
  };
  if (guiaEl.classList.contains("visible")) { guiaEl.classList.remove("visible"); tEntra = window.setTimeout(mostrar, reducir ? 200 : 700); }
  else tEntra = window.setTimeout(mostrar, primera ? 1600 : 450);
}
// La guía se aparta sobre las cards de modos y del juego, para no tapar sus gráficos ni la captura.
const tapadas = new Set<Element>();
const aparta = new IntersectionObserver((es) => {
  es.forEach((e) => tapadas[e.isIntersecting ? "add" : "delete"](e.target));
  guiaEl.classList.toggle("aparte", tapadas.size > 0);
}, { threshold: 0.15 });
[$("modos"), $("juego"), $("avisos"), $("gracias")].forEach((s) => aparta.observe(s));
// Entrada de cada tarjeta al llegar a su paso.
if (!reducir) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("entra"); io.unobserve(e.target); } }), { threshold: 0.25 });
  document.querySelectorAll(".tarjeta").forEach((t) => io.observe(t));
}

/* ---------- Tema e idioma ---------- */
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no se recuerda */ } };
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const btnTema = $("btn-tema"), btnIdioma = $("btn-idioma");
function etiquetaTema() {
  const claro = raiz.dataset.tema !== "oscuro";
  btnTema.setAttribute("aria-label", idioma === "en" ? (claro ? "Switch to dark theme" : "Switch to light theme") : claro ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
}
function aplicarTema(id: string) {
  raiz.dataset.tema = id === "oscuro" ? "oscuro" : "claro";
  CT = armarPaleta();
  etiquetaTema();
  guardar("charmy-tema", raiz.dataset.tema);
}
const NODOS: [Text, string][] = [];
{
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => n.parentElement?.closest("script,style,template,#guia,#titulo,.hud-anio") ? 2 : EN[(n.nodeValue ?? "").trim().replace(/\s+/g, " ")] ? 1 : 2,
  });
  let n: Node | null;
  while ((n = w.nextNode())) NODOS.push([n as Text, n.nodeValue ?? ""]);
}
function aplicarIdioma(id: string) {
  idioma = id === "en" ? "en" : "es";
  raiz.lang = idioma;
  NODOS.forEach(([n, es]) => { n.nodeValue = idioma === "en" ? es.replace(es.trim(), EN[es.trim().replace(/\s+/g, " ")]) : es; });
  armarTitulo(idioma);
  if (pasoGuia >= 0) globo.textContent = GUION[idioma][pasoGuia];
  btnIdioma.querySelectorAll<HTMLElement>("span").forEach((s) => s.classList.toggle("on", s.dataset.l === idioma));
  btnIdioma.setAttribute("aria-label", idioma === "en" ? "Cambiar a español" : "Switch to English");
  etiquetaTema();
  // El juego está en otro origen: el idioma le llega en el enlace.
  document.querySelectorAll<HTMLAnchorElement>("a[data-juego]").forEach((a) => { a.href = conIdioma(a.href, idioma); });
  guardar("charmy-idioma", idioma);
}
btnTema.addEventListener("click", () => aplicarTema(raiz.dataset.tema === "oscuro" ? "claro" : "oscuro"));
btnIdioma.addEventListener("click", () => aplicarIdioma(idioma === "en" ? "es" : "en"));
aplicarIdioma(idiomaInicial(location.search, leer("charmy-idioma")));
aplicarTema(raiz.dataset.tema ?? "claro");
requestAnimationFrame(dibujar);

/* ---------- Barra que se oculta al bajar; vuelve al subir, con hover o con foco (CSS) ---------- */
const barra = document.querySelector<HTMLElement>(".nav")!;
let yAnterior = scrollY;
addEventListener("scroll", () => {
  barra.classList.toggle("oculta", ocultarBarra(scrollY, yAnterior));
  yAnterior = scrollY;
}, { passive: true });

/* ---------- Agradecimientos: abanico y foco ---------- */
// El foco va con JS porque la card se corre al medio y deja de estar bajo el cursor: con :hover parpadea.
{
  const panel = $("gracias"), abanico = $("abanico"), boton = panel.querySelector<HTMLElement>(".abrir")!;
  let foco: Element | null = null, dentro = false, quieto = 0, cand: Element | null = null, espera = 0;
  const enfocar = (c: Element | null) => {
    clearTimeout(espera); cand = null;
    if (foco === c) return;
    foco?.classList.remove("foco"); foco = c; dentro = false;
    c?.classList.add("foco"); abanico.classList.toggle("con-foco", !!c);
    if (!c) quieto = performance.now() + 500; // deja reabrir el abanico antes de elegir otra
  };
  boton.addEventListener("click", () => boton.setAttribute("aria-expanded", String(panel.classList.toggle("abierto"))));
  panel.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const c = (e.target as Element).closest(".persona");
    if (!foco) {
      // Recién hace foco si el cursor se queda en la misma card: cruzar el abanico de lado a lado no dispara nada.
      if (c === cand || performance.now() < quieto) return;
      clearTimeout(espera); cand = c;
      if (c) espera = window.setTimeout(() => enfocar(c), 220);
    }
    else if (c === foco) dentro = true;
    else if (dentro) enfocar(null); // la siguió hasta el medio y salió
  });
  panel.addEventListener("pointerleave", () => enfocar(null));
  panel.addEventListener("click", (e) => { const c = (e.target as Element).closest(".persona"); enfocar(c === foco ? null : c); });
  abanico.addEventListener("focusin", (e) => { if ((e.target as Element).matches(".persona:focus-visible")) enfocar(e.target as Element); });
  abanico.addEventListener("focusout", () => enfocar(null));
}
