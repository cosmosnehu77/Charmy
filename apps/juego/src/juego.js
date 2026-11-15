// Charmy Brigada: maqueta 3D de Sudamérica en PixiJS. La lógica de la partida vive en módulos puros con pruebas
// (partida, propagación, reloj, récord…); este archivo arma el mundo, dibuja y conecta la interfaz.
import { charmySvg } from "@charmy/charmy/core";
import "@charmy/charmy/charmy.css";
import { paleta as PALETA, rampaConteo } from "@charmy/ui";
import "@charmy/ui/fonts.css";
import "@charmy/ui/tokens.css";
import { Application, Container, Graphics, Mesh, MeshGeometry, Particle, ParticleContainer, Sprite, Text, Texture } from "pixi.js";
import "./estilo.css";
import { crearAzar } from "./azar";
import { AYUDAS } from "./barra";
import { AVISO_SIMULADOS, CONSEJOS, cierreDePartida, focos as focosTxt, fraseDelFinal, miles } from "./cierre";
import { adentro, contornoDe, encuadre, proyectar, regionEn } from "./contorno";
import { REGLAS, ordenDeRecorrido, siguiente, textoDeFoco } from "./explorador";
import { aCelda, centroDe, crearGrilla } from "./grilla";
import { LAGOS, RIOS, lagoTocado } from "./lagos";
import { potencia } from "./mecanica";
import {
  COSTOS, HERRAMIENTAS, PREMIO_CORTAFUEGOS, PREMIO_FALSA_ALARMA, PROB_FALSA_ALARMA, RADIO_AVION, TANQUE, VENTANA_COMBO_MS,
  apagar, buscar, cobrar, descartarFalsaAlarma, elegirHerramienta, encenderFoco, escaparFoco, focoActivo, focoPropagado,
  lanzarAvion, nuevaPartida, ponerCortafuegos, premiarCortafuegos, recargar, sin, tocarFoco, verificarFoco,
} from "./partida";
import { CELDAS_POR_ESCAPE, propagar } from "./propagacion";
import { guardarMejores, guardarRecord, leerMejores, leerRecord, sumarMejor, cuando } from "./record";
import {
  CASTIGO_ESCAPE_MS, TIEMPO_INICIAL_MS, premioDeTiempo, puntosDeVictoria, ritmoDelReloj, sumarTiempo,
} from "./reloj";
import { estadoDeCharmy, estadoDelCierre } from "./ritmo";
import { crearSonido, guardarSilencio, leerSilencio } from "./sonido";
import sudamerica from "./sudamerica.json";

/** El almacenamiento del navegador, o uno vacío si está bloqueado (modo privado, permisos). */
function almacen() {
  try { const s = window.localStorage; s.getItem("x"); return s; } catch { return { getItem: () => null, setItem: () => {} }; }
}
/** Rampa de potencia de los focos: las clases más fuertes de la YlOrRd de @charmy/ui. */
const RAMPA = rampaConteo.slice(2);

// ===== Mundo 3D con PixiJS v8: maqueta en relieve, fuego, partículas y cámara orbital. =====

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const num = (h) => parseInt(h.slice(1), 16);
const mezcla = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const tintaMezcla = (a, b, t) => { const c = mezcla([a >> 16, (a >> 8) & 255, a & 255], [b >> 16, (b >> 8) & 255, b & 255], t); return (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]); };
const MOVIMIENTO_REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Geometría del juego (las mismas unidades que el lienzo del juego original) ----------
// Sudamérica entera. Los contornos salen de geo.js (Natural Earth).
const BBOX = [-82, -56, -34, 13];
const FONDO = contornoDe(sudamerica);
const REGIONES = FONDO.anillos;
const [OESTE, SUR, ESTE, NORTE] = BBOX;
const MAPA = encuadre(BBOX, { ancho: 760, alto: 520 });
const A = MAPA.ancho, H = MAPA.alto, AREA = { ancho: A, alto: H };
const LADO_CELDA = 16, RADIO_LAGO = 12, VERIFICAR_MS = 500;
const GRILLA = crearGrilla(AREA, LADO_CELDA);
const LAGOS_P = LAGOS.map((l, i) => ({ nombre: l.nombre, i, ...proyectar([l.lon, l.lat], BBOX, AREA) }));
const lonDe = (x) => OESTE + (x / A) * (ESTE - OESTE);
const latDe = (z) => NORTE - (z / H) * (NORTE - SUR);

// ---------- Relieve ilustrativo (no es un modelo de elevación real) ----------
const METROS_POR_UNIDAD = (111_000 * (NORTE - SUR)) / H;
const ESC_ALT = 20 / 4700; // unidades del mundo por metro
const EXAGERACION = Math.round(METROS_POR_UNIDAD * ESC_ALT);
/** El mundo dibujado: más grande que el área de juego, con el mar y el resto del país alrededor. */
const LIMITES = { oeste: -100, este: -17, norte: 30, sur: -72 };
const X0 = ((LIMITES.oeste - OESTE) / (ESTE - OESTE)) * A, X1 = ((LIMITES.este - OESTE) / (ESTE - OESTE)) * A;
const Z0 = ((NORTE - LIMITES.norte) / (NORTE - SUR)) * H, Z1 = ((NORTE - LIMITES.sur) / (NORTE - SUR)) * H;
const MW = X1 - X0, MH = Z1 - Z0;

function hash2(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function ruido(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * ruido(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
function crestas(x, y, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * (1 - Math.abs(2 * ruido(x * f + 17, y * f - 9) - 1)) ** 2; n += a; a *= 0.5; f *= 2.1; } return s / n; }
function tabla(t, x) {
  if (x >= t[0][0]) return t[0][1];
  for (let k = 1; k < t.length; k++) if (x >= t[k][0]) return lerp(t[k - 1][1], t[k][1], (x - t[k - 1][0]) / (t[k][0] - t[k - 1][0]));
  return t.at(-1)[1];
}
// Los Andes de punta a punta: por dónde va la cresta, cuánto sube, qué tan ancha es y dónde empieza la nieve.
const CRESTA = [[11, -73.2], [7, -73.0], [4, -74.5], [1, -77.5], [-2, -78.7], [-5, -79.0], [-8, -77.8], [-11, -76.0], [-14, -73.0], [-16, -70.0], [-18, -69.0], [-22, -68.0], [-26, -68.3], [-30, -69.8], [-33, -70.0], [-35, -70.3], [-38, -71.0], [-41, -71.8], [-44, -72.1], [-47, -73.0], [-50, -73.3], [-52, -72.6], [-54, -70.2], [-56, -67.5]];
const PICO = [[11, 3200], [7, 3800], [4, 4300], [0, 5200], [-5, 3800], [-9, 5800], [-13, 5600], [-16, 5900], [-20, 5600], [-24, 5800], [-28, 6200], [-32, 6300], [-35, 4300], [-38, 3100], [-41, 2400], [-45, 2100], [-48, 2900], [-51, 2400], [-54, 1300], [-56, 700]];
const ANCHO = [[11, 0.9], [2, 0.9], [-8, 1.0], [-14, 1.5], [-18, 1.9], [-23, 1.7], [-28, 1.1], [-34, 0.7], [-56, 0.62]];
const NIEVE = [[11, 4800], [0, 4900], [-15, 5200], [-25, 5600], [-32, 4300], [-35, 3900], [-40, 2500], [-45, 1700], [-50, 1250], [-55, 900]];
// Macizos fuera de los Andes: [lat, lon, radio en lat, radio en lon, altura].
const MACIZOS = [[-18, -45, 7, 6, 950], [-22.5, -44.5, 1.5, 2.5, 900], [4.5, -62, 2.2, 4.5, 1100], [-31.6, -64.8, 1.2, 0.5, 1500], [-12, -41.5, 3, 1.5, 700], [-27, -50.5, 2.5, 3, 800], [10.8, -73.7, 0.5, 0.5, 3500]];
const VOLCANES = [[-0.68, -78.44, 5900], [-1.47, -78.82, 6260], [-9.12, -77.6, 6760], [-16.63, -67.79, 6400], [-27.1, -68.54, 6890], [-32.65, -70.01, 6960], [-36.63, -70.43, 4700], [-39.42, -71.93, 2850], [-41.16, -71.88, 3480], [-46.6, -73.35, 4050], [-49.27, -73.04, 3400], [5.14, -60.76, 2800]];
function elevacion(lon, lat) {
  const c = Math.cos((lat * Math.PI) / 180);
  const d = (lon - tabla(CRESTA, lat)) * c;
  const n = fbm(lon * 0.45, lat * 0.45, 4);
  const r = crestas(lon * 0.7, lat * 0.7, 4);
  let e = tabla(PICO, lat) * Math.exp(-((d / tabla(ANCHO, lat)) ** 2)) * (0.4 + 0.85 * r);
  const llano = d > 0 ? 700 * Math.exp(-d / 3) + 120 : 150 + 400 * Math.exp(-(((d + 1.3) / 0.5) ** 2));
  e += llano * (0.45 + 1.1 * n);
  for (const [ml, mo, rl, ro, mh] of MACIZOS) e += mh * Math.exp(-((((lon - mo) * c) / ro) ** 2 + ((lat - ml) / rl) ** 2)) * (0.5 + r);
  for (const [vl, vo, vh] of VOLCANES) {
    const dd = ((lon - vo) * c) ** 2 + (lat - vl) ** 2;
    e += vh * 0.45 * Math.exp(-dd / 0.06);
  }
  return e;
}
/** Qué tan húmedo es un lugar (0 desierto, 1 selva o bosque): decide el color de la maqueta. Es ilustrativo. */
function humedad(lon, lat, d) {
  if (d < 0) return Math.max(0.03, suave(30, 38, -lat), 0.8 * suave(-6, -2, lat));
  const caatinga = Math.exp(-(((lon + 40.5) / 5) ** 2 + ((lat + 9) / 5) ** 2));
  const selva = suave(-17, -10, lat) * (1 - suave(6, 10, lat)) * suave(0.3, 1.5, d) * (1 - 0.85 * caatinga);
  const pampa = 0.55 * suave(-62, -57, lon) * suave(-40, -36, lat) * (1 - suave(-24, -20, lat));
  const bosqueAndino = suave(36, 39, -lat) * clamp(1 - (d - 0.15) / 1.1, 0, 1);
  const estepa = lat < -38 ? 0.15 : 0.3;
  return Math.max(estepa, selva, pampa, bosqueAndino);
}

function desenfocar(src, w, h, r, pasadas) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let p = 0; p < pasadas; p++) {
    for (let j = 0; j < h; j++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[j * w + clamp(i, 0, w - 1)];
      for (let i = 0; i < w; i++) { b[j * w + i] = s / (2 * r + 1); s += a[j * w + clamp(i + r + 1, 0, w - 1)] - a[j * w + clamp(i - r, 0, w - 1)]; }
    }
    for (let i = 0; i < w; i++) {
      let s = 0;
      for (let j = -r; j <= r; j++) s += b[clamp(j, 0, h - 1) * w + i];
      for (let j = 0; j < h; j++) { a[j * w + i] = s / (2 * r + 1); s += b[clamp(j + r + 1, 0, h - 1) * w + i] - b[clamp(j - r, 0, h - 1) * w + i]; }
    }
  }
  return a;
}

const HW = 480, HH = Math.round((HW * MH) / MW);
const ALT = new Float32Array(HW * HH), MAR = new Float32Array(HW * HH), LAGO = new Float32Array(HW * HH), COSTA = new Float32Array(HW * HH);
let ALTURA_MAX = 0;
const RADIOS_LAGO = LAGOS.map((l) => l.r);

function generarRelieve() {
  const c = document.createElement("canvas");
  c.width = HW; c.height = HH;
  const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, HW, HH); x.fillStyle = "#fff";
  for (const anillo of REGIONES) {
    x.beginPath();
    anillo.forEach((p, k) => { const q = proyectar(p, BBOX, AREA); const px = ((q.x - X0) / MW) * (HW - 1), py = ((q.y - Z0) / MH) * (HH - 1); k ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.closePath(); x.fill();
  }
  const img = x.getImageData(0, 0, HW, HH).data;
  const mascara = new Float32Array(HW * HH);
  for (let k = 0; k < HW * HH; k++) mascara[k] = img[k * 4] / 255;
  const tierra = desenfocar(mascara, HW, HH, 1, 2);
  const costa = desenfocar(mascara, HW, HH, 6, 3);
  const niveles = LAGOS_P.map((l) => elevacion(LAGOS[l.i].lon, LAGOS[l.i].lat) * 0.55);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) {
    const k = j * HW + i;
    const wx = X0 + (i / (HW - 1)) * MW, wz = Z0 + (j / (HH - 1)) * MH;
    const t = suave(0.3, 0.7, tierra[k]);
    let e = elevacion(lonDe(wx), latDe(wz)) * t;
    let lago = 0;
    for (const l of LAGOS_P) {
      const dx = wx - l.x, dz = wz - l.y, d = Math.hypot(dx, dz), R = RADIOS_LAGO[l.i];
      if (d > R * 1.8) continue;
      const ang = Math.atan2(dz, dx * 1.6);
      const rr = R * (0.62 + 0.7 * fbm(Math.cos(ang) * 1.8 + l.i * 11, Math.sin(ang) * 1.8 + l.i * 5, 3));
      const w = 1 - suave(rr * 0.82, rr, d);
      if (w > lago) lago = w;
      e = lerp(e, Math.min(e, niveles[l.i]), suave(0, 1, (1 - suave(rr, rr * 1.7, d))));
      if (w > 0) e = lerp(e, niveles[l.i] * t, w);
    }
    ALT[k] = Math.max(0, e) * ESC_ALT;
    MAR[k] = 1 - t; LAGO[k] = lago * t; COSTA[k] = costa[k];
    if (ALT[k] > ALTURA_MAX) ALTURA_MAX = ALT[k];
  }
}

function muestra(arr, x, z) {
  const fx = clamp(((x - X0) / MW) * (HW - 1), 0, HW - 1.001), fz = clamp(((z - Z0) / MH) * (HH - 1), 0, HH - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * HW + i;
  return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + HW], arr[k + HW + 1], u), v);
}
const altura = (x, z) => muestra(ALT, x, z);

// ---------- Textura de la maqueta ----------
const TW = 1000, TH = Math.round((TW * MH) / MW);
const aTexX = (x) => ((x - X0) / MW) * TW, aTexY = (z) => ((z - Z0) / MH) * TH;
/** Los bordes del mundo se funden con la noche: no hay un rectángulo cortado. */
const FUNDIDO = 0.14;
const fundido = (x, z) => suave(0, FUNDIDO * MW, Math.min(x - X0, X1 - x)) * suave(0, FUNDIDO * MH, Math.min(z - Z0, Z1 - z));
let lienzoTerreno, ctxTerreno, texTerreno;
const C = {
  mar: rgb("#0e1714"), marClaro: rgb("#1f3133"), lago: rgb("#3d6f80"), lagoBorde: rgb("#7cbcd6"),
  estepa: rgb("#a39c78"), estepaSeca: rgb("#847d5f"), bosque: rgb("#34481c"), valle: rgb("#5d7236"),
  roca: rgb("#7a8569"), rocaOscura: rgb("#4a5540"), nieve: rgb("#e6e4da"),
};
function hornearTerreno() {
  lienzoTerreno = document.createElement("canvas");
  lienzoTerreno.width = TW; lienzoTerreno.height = TH;
  ctxTerreno = lienzoTerreno.getContext("2d");
  const datos = ctxTerreno.createImageData(TW, TH), px = datos.data;
  const Lx = -0.55, Ly = 0.72, Lz = -0.42, Ln = Math.hypot(Lx, Ly, Lz);
  const dx = MW / (HW - 1), dz = MH / (HH - 1);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const wx = X0 + ((i + 0.5) / TW) * MW, wz = Z0 + ((j + 0.5) / TH) * MH;
    const h = altura(wx, wz), mar = muestra(MAR, wx, wz), lago = muestra(LAGO, wx, wz);
    const gx = (altura(wx + dx, wz) - altura(wx - dx, wz)) / (2 * dx), gz = (altura(wx, wz + dz) - altura(wx, wz - dz)) / (2 * dz);
    const nl = Math.hypot(gx * 1.6, 1, gz * 1.6);
    const luz = Math.max(0, (-gx * 1.6 * Lx + Ly - gz * 1.6 * Lz) / (nl * Ln));
    const sombra = 0.5 + 0.72 * luz;
    const lon = lonDe(wx), lat = latDe(wz), m = h / ESC_ALT;
    const d = (lon - tabla(CRESTA, lat)) * Math.cos((lat * Math.PI) / 180);
    const grano = fbm(wx * 0.9, wz * 0.9, 3) - 0.5;
    const humedo = clamp(humedad(lon, lat, d) + grano * 0.25, 0, 1);
    let col = mezcla(mezcla(C.estepa, C.estepaSeca, clamp(0.5 + grano * 2 + (0.2 - humedo), 0, 1)), mezcla(C.valle, C.bosque, suave(0.5, 0.85, humedo)), suave(0.1, 0.6, humedo));
    col = mezcla(col, mezcla(C.roca, C.rocaOscura, clamp(0.5 - grano * 2, 0, 1)), suave(1500, 2300, m) * (0.55 + 0.45 * humedo) + suave(1900, 2800, m) * 0.4);
    col = mezcla(col, C.nieve, suave(tabla(NIEVE, lat) - 150, tabla(NIEVE, lat) + 250, m + grano * 500));
    col = col.map((v) => v * sombra * (1 + grano * 0.18));
    const prof = clamp(1 - muestra(COSTA, wx, wz) * 1.6, 0, 1);
    const marCol = mezcla(C.marClaro, C.mar, suave(0, 0.8, prof)).map((v) => v * (0.92 + grano * 0.12));
    col = mezcla(col, marCol, suave(0.35, 0.65, mar));
    col = mezcla(col, mezcla(C.lagoBorde, C.lago, suave(0.2, 0.7, lago)), suave(0.05, 0.35, lago));
    const k = (j * TW + i) * 4;
    px[k] = clamp(col[0], 0, 255); px[k + 1] = clamp(col[1], 0, 255); px[k + 2] = clamp(col[2], 0, 255); px[k + 3] = Math.round(255 * fundido(wx, wz));
  }
  ctxTerreno.putImageData(datos, 0, 0);
  ctxTerreno.lineJoin = "round"; ctxTerreno.lineCap = "round";
  ctxTerreno.globalCompositeOperation = "source-atop";
  // Los grandes ríos: trazo ilustrativo, más ancho hacia la desembocadura.
  for (const rio of RIOS) {
    for (let k = 1; k < rio.length; k++) {
      const a = proyectar(rio[k - 1], BBOX, AREA), b = proyectar(rio[k], BBOX, AREA);
      ctxTerreno.strokeStyle = `rgb(${C.lago.map(Math.round).join(",")})`;
      ctxTerreno.lineWidth = 1.2 + (2.2 * k) / rio.length;
      ctxTerreno.beginPath(); ctxTerreno.moveTo(aTexX(a.x), aTexY(a.y)); ctxTerreno.lineTo(aTexX(b.x), aTexY(b.y)); ctxTerreno.stroke();
    }
  }
  // Límites de los países y paralelos: la misma proyección que los focos.
  ctxTerreno.strokeStyle = T.limites;
  ctxTerreno.lineWidth = 1.1;
  ctxTerreno.globalCompositeOperation = "source-atop";
  for (const anillo of REGIONES) {
    ctxTerreno.beginPath();
    anillo.forEach((p, k) => { const q = proyectar(p, BBOX, AREA); const x = aTexX(q.x), y = aTexY(q.y); k ? ctxTerreno.lineTo(x, y) : ctxTerreno.moveTo(x, y); });
    ctxTerreno.closePath(); ctxTerreno.stroke();
  }
  ctxTerreno.setLineDash([4, 6]);
  ctxTerreno.strokeStyle = T.grilla;
  for (let lat = 10; lat >= -50; lat -= 10) { const y = aTexY(((NORTE - lat) / (NORTE - SUR)) * H); ctxTerreno.beginPath(); ctxTerreno.moveTo(0, y); ctxTerreno.lineTo(TW, y); ctxTerreno.stroke(); }
  for (let lon = -80; lon <= -40; lon += 10) { const x = aTexX(((lon - OESTE) / (ESTE - OESTE)) * A); ctxTerreno.beginPath(); ctxTerreno.moveTo(x, 0); ctxTerreno.lineTo(x, TH); ctxTerreno.stroke(); }
  ctxTerreno.setLineDash([]);
  ctxTerreno.globalCompositeOperation = "source-over";
  texTerreno = Texture.from(lienzoTerreno);
}
/** Una marca de quemado en la maqueta: queda hasta el final de la partida. */
function quemar(x, z, radio, fuerza) {
  const g = ctxTerreno.createRadialGradient(aTexX(x), aTexY(z), 0, aTexX(x), aTexY(z), (radio / MW) * TW);
  g.addColorStop(0, `rgba(24, 16, 12, ${0.75 * fuerza})`);
  g.addColorStop(0.6, `rgba(45, 30, 22, ${0.45 * fuerza})`);
  g.addColorStop(1, "rgba(45, 30, 22, 0)");
  ctxTerreno.fillStyle = g;
  ctxTerreno.globalCompositeOperation = "source-atop";
  ctxTerreno.beginPath(); ctxTerreno.arc(aTexX(x), aTexY(z), (radio / MW) * TW, 0, Math.PI * 2); ctxTerreno.fill();
  ctxTerreno.globalCompositeOperation = "source-over";
  texTerreno.source.update();
}
let copiaTerreno = null;
const guardarTerreno = () => { copiaTerreno = ctxTerreno.getImageData(0, 0, TW, TH); };
let limpiarQuemados = () => { if (copiaTerreno) { ctxTerreno.putImageData(copiaTerreno, 0, 0); texTerreno.source.update(); } };

// ---------- Texturas de efectos, dibujadas en canvas ----------
function lienzo(w, h, dibujar) { const c = document.createElement("canvas"); c.width = w; c.height = h; dibujar(c.getContext("2d"), w, h); return Texture.from(c); }
const radial = (paradas) => (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); paradas.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); };
let TEX = {};
function crearTexturas() {
  TEX.brillo = lienzo(128, 128, radial([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]));
  TEX.humo = lienzo(64, 64, radial([[0, "rgba(255,255,255,0.9)"], [0.5, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]));
  TEX.chispa = lienzo(16, 16, radial([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.8)"], [1, "rgba(255,255,255,0)"]]));
  TEX.gota = lienzo(12, 24, (x) => { x.fillStyle = "#fff"; x.beginPath(); x.moveTo(6, 0); x.quadraticCurveTo(12, 14, 6, 24); x.quadraticCurveTo(0, 14, 6, 0); x.fill(); });
  TEX.llama = lienzo(64, 96, (x, w, h) => {
    const g = x.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.moveTo(w / 2, 2);
    x.bezierCurveTo(w * 0.78, h * 0.32, w * 0.98, h * 0.62, w * 0.86, h * 0.82);
    x.bezierCurveTo(w * 0.74, h * 1.0, w * 0.26, h * 1.0, w * 0.14, h * 0.82);
    x.bezierCurveTo(w * 0.02, h * 0.62, w * 0.22, h * 0.32, w / 2, 2);
    x.fill();
  });
  TEX.avion = lienzo(192, 192, (x) => dibujarHidrante(x, false));
  TEX.sombraAvion = lienzo(192, 192, (x) => dibujarHidrante(x, true));
  TEX.satelite = lienzo(80, 40, (x) => {
    x.fillStyle = "#2f5d8a"; x.strokeStyle = "#cfe6f5"; x.lineWidth = 1.5;
    for (const ox of [2, 52]) { x.fillRect(ox, 12, 26, 16); x.strokeRect(ox, 12, 26, 16); x.beginPath(); x.moveTo(ox + 13, 12); x.lineTo(ox + 13, 28); x.stroke(); }
    x.fillStyle = "#e9e2d0"; x.fillRect(30, 8, 20, 24); x.fillStyle = "#c2410c"; x.fillRect(36, 32, 8, 6);
  });
  TEX.fondo = lienzo(512, 512, pintarFondo);
  TEX.estela = lienzo(64, 8, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.7, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.roundRect(0, 2, w, 4, 2); x.fill();
  });
  // Autobomba vista de costado, mirando a la derecha. El sprite se da vuelta según hacia dónde va.
  TEX.camion = lienzo(96, 64, (x) => {
    const tinta = "#1b2430";
    x.lineJoin = "round"; x.lineWidth = 2.5; x.strokeStyle = tinta;
    x.fillStyle = "rgba(0,0,0,0.3)"; x.beginPath(); x.ellipse(48, 56, 40, 5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#c2410c"; x.beginPath(); x.roundRect(8, 24, 54, 24, 4); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(62, 30, 26, 18, [8, 6, 3, 3]); x.fill(); x.stroke();
    x.fillStyle = "#9fd2e8"; x.beginPath(); x.roundRect(70, 33, 13, 8, 2); x.fill(); x.stroke();
    x.fillStyle = "#e9e2d0"; x.fillRect(10, 36, 50, 4);
    x.strokeStyle = "#e9e2d0"; x.lineWidth = 3; x.beginPath(); x.moveTo(12, 20); x.lineTo(58, 14); x.moveTo(12, 14); x.lineTo(58, 8); x.stroke();
    x.lineWidth = 1.5; for (let n = 0; n < 6; n++) { x.beginPath(); x.moveTo(16 + n * 8, 19.5 - n); x.lineTo(16 + n * 8, 13.5 - n); x.stroke(); }
    x.strokeStyle = tinta; x.lineWidth = 2.5;
    x.fillStyle = "#f2b705"; x.beginPath(); x.roundRect(66, 24, 8, 6, 2); x.fill(); x.stroke();
    for (const cx of [24, 72]) { x.fillStyle = tinta; x.beginPath(); x.arc(cx, 49, 8, 0, Math.PI * 2); x.fill(); x.fillStyle = "#a9b0a1"; x.beginPath(); x.arc(cx, 49, 3, 0, Math.PI * 2); x.fill(); }
  });
}

/**
 * Avión hidrante anfibio visto desde arriba: ala alta y recta, dos turbohélices, flotadores en las puntas,
 * casco de bote y cola en T. Amarillo con franjas rojas, como los de la brigada. La sombra es la misma silueta.
 */
function dibujarHidrante(x, sombra) {
  x.translate(96, 96);
  const amarillo = sombra ? "#000" : "#f2b705", rojo = sombra ? "#000" : "#c2410c", tinta = "#1b2430";
  const trazo = () => { if (!sombra) { x.strokeStyle = tinta; x.lineWidth = 2.2; x.stroke(); } };
  const forma = (color, dibujar) => { x.fillStyle = color; x.beginPath(); dibujar(); x.closePath(); x.fill(); trazo(); };
  // Cola en T.
  forma(amarillo, () => { x.moveTo(-34, 58); x.lineTo(34, 58); x.lineTo(30, 70); x.lineTo(-30, 70); });
  if (!sombra) { x.fillStyle = rojo; x.fillRect(-34, 58, 9, 12); x.fillRect(25, 58, 9, 12); }
  // Casco de bote: ancho adelante, angosto en la cola.
  forma(amarillo, () => { x.moveTo(0, -82); x.bezierCurveTo(10, -82, 11, -70, 11, -56); x.lineTo(10, 30); x.lineTo(5, 74); x.lineTo(-5, 74); x.lineTo(-10, 30); x.lineTo(-11, -56); x.bezierCurveTo(-11, -70, -10, -82, 0, -82); });
  if (!sombra) {
    x.fillStyle = rojo; x.fillRect(-10.5, 18, 21, 7);
    x.fillStyle = "#2f4a66"; x.beginPath(); x.ellipse(0, -66, 7, 6, 0, Math.PI, 0); x.lineTo(7, -62); x.lineTo(-7, -62); x.closePath(); x.fill();
    x.strokeStyle = tinta; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 30); x.lineTo(0, 72); x.stroke(); // aleta vertical
    x.fillStyle = "#9fd2e8"; x.fillRect(-5, -6, 10, 14); x.strokeStyle = tinta; x.lineWidth = 1.2; x.strokeRect(-5, -6, 10, 14); // compuertas del tanque
  }
  // Ala alta y recta, con puntas rojas.
  forma(amarillo, () => { x.moveTo(-88, -20); x.lineTo(88, -20); x.lineTo(86, 2); x.lineTo(-86, 2); });
  if (!sombra) { x.fillStyle = rojo; x.fillRect(-88, -20, 13, 22); x.fillRect(75, -20, 13, 22); }
  // Flotadores en las puntas.
  for (const lado of [-1, 1]) forma(sombra ? "#000" : "#e9e2d0", () => x.ellipse(lado * 72, -6, 5, 15, 0, 0, Math.PI * 2));
  // Turbohélices con el disco de la hélice girando.
  for (const lado of [-1, 1]) {
    forma(sombra ? "#000" : "#e9e2d0", () => { x.moveTo(lado * 30, -46); x.lineTo(lado * 38, -46); x.lineTo(lado * 39, 10); x.lineTo(lado * 29, 10); });
    if (sombra) continue;
    x.fillStyle = "rgba(210, 220, 230, 0.35)"; x.beginPath(); x.ellipse(lado * 34, -49, 21, 4, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(27, 36, 48, 0.75)"; x.lineWidth = 2; x.beginPath(); x.moveTo(lado * 34 - 19, -49); x.lineTo(lado * 34 + 19, -49); x.stroke();
    x.fillStyle = rojo; x.beginPath(); x.arc(lado * 34, -49, 3.2, 0, Math.PI * 2); x.fill();
  }
}

// ---------- Cámara: proyección en perspectiva hecha a mano (vista desde arriba o en diagonal) ----------
/** Inclinaciones de la cámara: isométrica (la de entrada), más alta y cenital. */
const VISTAS = [0.6, 0.9, 1.35];
const GIRO = { inicial: -0.55 };
const PITCH = { min: 0.35, max: 1.45 };
const giroInicial = () => (innerHeight > innerWidth * 1.1 ? -0.22 : -0.55);
const ZOOM = { min: 1, max: 6 };
const cam = { yaw: GIRO.inicial, pitch: VISTAS[0], zoom: 1, panX: 0, panZ: 0, dist: 600, distAjuste: 600, focal: 800, cx: 0, cy: 0, offX: 0, offY: 0, sucia: true,
  f: [0, 0, 0], r: [1, 0, 0], u: [0, 1, 0], C: [0, 0, 0] };
const objetivo = { yaw: cam.yaw, pitch: cam.pitch, zoom: 1 };
const FOV = 0.34; // estrecho: casi sin fuga, como una vista isométrica
let margenArriba = 70, margenAbajo = 110;

function base(c, tx, tz, dist) {
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  c.f = [sy * cp, -sp, -cy * cp];
  c.r = [cy, 0, sy];
  const [fx, fy, fz] = c.f, [rx, , rz] = c.r;
  c.u = [-rz * fy, rz * fx - rx * fz, rx * fy];
  c.C = [tx - dist * fx, -dist * fy, tz - dist * fz];
}
function proy(c, x, y, z, out) {
  const vx = x - c.C[0], vy = y - c.C[1], vz = z - c.C[2];
  const zc = Math.max(1, vx * c.f[0] + vy * c.f[1] + vz * c.f[2]);
  const k = c.focal / zc;
  out.x = c.cx + (vx * c.r[0] + vz * c.r[2]) * k;
  out.y = c.cy - (vx * c.u[0] + vy * c.u[1] + vz * c.u[2]) * k;
  out.k = k;
  return out;
}
const ESQUINAS = [];
for (const x of [0, A]) for (const z of [0, H]) for (const y of [0, 1]) ESQUINAS.push([x, y, z]);

function ajustarCamara() {
  const W = app.screen.width, Hs = app.screen.height;
  const libreW = Math.max(120, W - 120), libreH = Math.max(120, Hs - margenArriba - margenAbajo);
  const t = { yaw: cam.yaw, pitch: cam.pitch, focal: Hs / 2 / Math.tan(FOV / 2), cx: 0, cy: 0 };
  let dist = H * 2.2;
  const p = {};
  let caja;
  for (let it = 0; it < 7; it++) {
    base(t, A / 2, H / 2, dist);
    caja = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y, z] of ESQUINAS) {
      proy(t, x, y * ALTURA_MAX * 0.4, z, p);
      caja[0] = Math.min(caja[0], p.x); caja[1] = Math.min(caja[1], p.y); caja[2] = Math.max(caja[2], p.x); caja[3] = Math.max(caja[3], p.y);
    }
    dist *= Math.max((caja[2] - caja[0]) / libreW, (caja[3] - caja[1]) / libreH);
  }
  cam.focal = t.focal;
  cam.distAjuste = dist;
  cam.offX = -(caja[0] + caja[2]) / 2;
  cam.offY = -(caja[1] + caja[3]) / 2;
}
function actualizarCamara() {
  // El mapa se desplaza libre, pero el centro de la vista nunca sale del área de juego.
  cam.panX = clamp(cam.panX, -A / 2, A / 2);
  cam.panZ = clamp(cam.panZ, -H / 2, H / 2);
  cam.dist = cam.distAjuste / cam.zoom;
  base(cam, A / 2 + cam.panX, H / 2 + cam.panZ, cam.dist);
  const W = app.screen.width, Hs = app.screen.height;
  cam.cx = W / 2 + cam.offX * cam.zoom;
  cam.cy = margenArriba + (Hs - margenArriba - margenAbajo) / 2 + cam.offY * cam.zoom;
}
/** Del toque en la pantalla al punto del suelo (rayo contra el relieve). */
function sueloEn(sx, sy) {
  const a = (sx - cam.cx) / cam.focal, b = -(sy - cam.cy) / cam.focal;
  const d = [cam.f[0] + cam.r[0] * a + cam.u[0] * b, cam.f[1] + cam.u[1] * b, cam.f[2] + cam.r[2] * a + cam.u[2] * b];
  if (d[1] >= -1e-4) return null;
  let t = -cam.C[1] / d[1], x = 0, z = 0;
  for (let it = 0; it < 8; it++) {
    x = cam.C[0] + t * d[0]; z = cam.C[2] + t * d[2];
    t = (altura(x, z) - cam.C[1]) / d[1];
  }
  return { x, z };
}

// ---------- Escena de Pixi ----------
let app;
const capas = {};
let terreno, geo, posiciones, WX, WY, WZ, NV, INDICES, ordenActual = "";
const MX = 160, MZ = Math.round((MX * MH) / MW);

function crearMalla() {
  NV = MX * MZ;
  posiciones = new Float32Array(NV * 2);
  const uvs = new Float32Array(NV * 2);
  WX = new Float32Array(NV); WY = new Float32Array(NV); WZ = new Float32Array(NV);
  for (let j = 0; j < MZ; j++) for (let i = 0; i < MX; i++) {
    const k = j * MX + i;
    WX[k] = X0 + (i / (MX - 1)) * MW; WZ[k] = Z0 + (j / (MZ - 1)) * MH; WY[k] = altura(WX[k], WZ[k]);
    uvs[k * 2] = i / (MX - 1); uvs[k * 2 + 1] = j / (MZ - 1);
  }
  // Sin prueba de profundidad: los triángulos se dibujan del fondo hacia la cámara.
  // Como la cámara gira 360°, hay un orden por cada combinación (norte o sur primero, oeste o este primero).
  const armar = (norteASur, oesteAEste) => {
    const idx = new Uint32Array((MX - 1) * (MZ - 1) * 6);
    let n = 0;
    for (let t = 0; t < MZ - 1; t++) for (let s = 0; s < MX - 1; s++) {
      const j = norteASur ? t : MZ - 2 - t, i = oesteAEste ? s : MX - 2 - s;
      const a = j * MX + i, b = a + 1, c = a + MX, d = c + 1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
    return idx;
  };
  INDICES = { nsoe: armar(true, true), nseo: armar(true, false), snoe: armar(false, true), sneo: armar(false, false) };
  geo = new MeshGeometry({ positions: posiciones, uvs, indices: INDICES.nsoe });
  ordenActual = "nsoe";
  terreno = new Mesh({ geometry: geo, texture: texTerreno });
  capas.mundo.addChild(terreno);
}
const P = {};
function proyectarMundo() {
  for (let k = 0; k < NV; k++) {
    proy(cam, WX[k], WY[k], WZ[k], P);
    posiciones[k * 2] = P.x; posiciones[k * 2 + 1] = P.y;
  }
  geo.getBuffer("aPosition").update();
  const orden = (cam.f[2] <= 0 ? "ns" : "sn") + (cam.f[0] > 0 ? "eo" : "oe");
  if (orden !== ordenActual) { geo.indices = INDICES[orden]; ordenActual = orden; }
  dibujarCortafuegos();
  // Solo llevan nombre las fuentes de agua que están activas.
  for (const r of rotulos) { proy(cam, r.x, r.y, r.z, P); r.texto.position.set(P.x, P.y); r.texto.alpha = r.lago === undefined ? 1 : fuentes.has(r.lago) ? 0.95 : 0; }
}

// ---------- Partículas ----------
function pool(tex, n, blend) {
  const pc = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, rotation: true, color: true } });
  if (blend) pc.blendMode = blend;
  const lista = [];
  for (let i = 0; i < n; i++) { const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0 }); pc.addParticle(p); lista.push({ p, vivo: false }); }
  return { pc, lista, i: 0 };
}
function emitir(pl, o) {
  const it = pl.lista[pl.i]; pl.i = (pl.i + 1) % pl.lista.length;
  Object.assign(it, { vivo: true, edad: 0, vx: 0, vy: 0, vz: 0, g: 0, s0: 1, s1: 1, a0: 1, rot: 0, vr: 0, estirar: 1 }, o);
  it.p.tint = o.tint ?? 0xffffff; it.p.rotation = it.rot;
  return it;
}
function moverParticulas(pl, dt) {
  for (const it of pl.lista) {
    if (!it.vivo) continue;
    it.edad += dt;
    const t = it.edad / it.vida;
    if (t >= 1) { it.vivo = false; it.p.alpha = 0; continue; }
    it.vy += it.g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
    if (it.suelo && it.y < altura(it.x, it.z)) { it.vivo = false; it.p.alpha = 0; it.alTocar?.(it); continue; }
    proy(cam, it.x, it.y, it.z, P);
    const s = lerp(it.s0, it.s1, t) * P.k;
    it.p.x = P.x; it.p.y = P.y; it.p.scaleX = s; it.p.scaleY = s * it.estirar;
    it.p.rotation = it.rot + it.vr * it.edad;
    it.p.alpha = it.a0 * Math.min(1, t * 6) * (1 - t);
  }
}
let humo, chispas, agua, brillos;

// ---------- Estado ----------
let estado = "cargando", modo = "normal", reglas = REGLAS.normal;
let partida = nuevaPartida(), reloj = 0, eventos = [], dibujos = new Map(), proximoId = 0, regiones = new Map(), elegido = null;
let azar = crearAzar("inicio"), ventanas = [], noche = 0, tiempoReal = 0;
const efectos = [];
const rotulos = [];
const SONIDO = crearSonido(() => new AudioContext(), leerSilencio(almacen()));
const anunciar = (t) => { document.querySelector("#anuncio").textContent = t; };

function programar(ms, fn) { const e = { t: reloj + ms, fn, vivo: true }; eventos.push(e); return e; }
function correrEventos() {
  const listos = eventos.filter((e) => e.vivo && e.t <= reloj).sort((a, b) => a.t - b.t);
  for (const e of listos) { e.vivo = false; e.fn(); }
  if (listos.length) eventos = eventos.filter((e) => e.vivo);
}

const colorDe = (foco) => foco.fuenteFija ? 0xb8c2cc : num(RAMPA[Math.min(RAMPA.length - 1, Math.floor(Math.log2(1 + foco.frp)))]);
const ladoDe = (golpes) => 5.5 + 2.2 * golpes;

// ---------- Focos en el mapa ----------
function encender(foco) {
  partida = encenderFoco(partida, foco);
  const { id, x, y, frp } = foco;
  const cont = new Container();
  const anillo = new Graphics();
  const piso = new Container(); piso.addChild(anillo);
  const resplandor = new Sprite(TEX.brillo); resplandor.anchor.set(0.5); resplandor.blendMode = "add"; resplandor.tint = colorDe(foco);
  const llamas = [0, 1, 2].map((n) => { const s = new Sprite(TEX.llama); s.anchor.set(0.5, 0.95); s.blendMode = "add"; s.tint = n === 2 ? num(PALETA.llamaNucleo) : colorDe(foco); return s; });
  const pips = new Graphics();
  let duda = null;
  if (foco.confianza === "low") {
    duda = new Container();
    const fondo = new Graphics().circle(0, 0, 9).fill({ color: 0x131611, alpha: 0.9 }).stroke({ width: 1.5, color: 0xe89d5b });
    const t = new Text({ text: "?", style: { fontFamily: "IBM Plex Mono, monospace", fontSize: 13, fontWeight: "600", fill: 0xe89d5b } });
    t.anchor.set(0.5); duda.addChild(fondo, t); duda.texto = t; duda.fondo = fondo;
  }
  cont.addChild(piso, resplandor, ...llamas, pips);
  if (duda) cont.addChild(duda);
  capas.focos.addChild(cont);
  const escapeMs = potencia(frp).escapeMs * Math.max(0.7, 1.2 - 0.05 * barridaN);
  const dibujo = { id, x, z: y, cont, piso, anillo, resplandor, llamas, pips, duda, nacio: reloj, escapeMs, fase: Math.random() * 10, golpes: -1, muere: null, fija: foco.fuenteFija };
  dibujo.escape = reglas.escapes
    ? programar(escapeMs, () => {
        partida = escaparFoco(partida, id);
        sincronizar("escapado");
        if (foco.fuenteFija) return;
        SONIDO.tocar("escape");
        if (reglas.reloj) { tiempoMs -= CASTIGO_ESCAPE_MS; tiempoExtra(-CASTIGO_ESCAPE_MS); }
        sismo(0.6);
        reaccionar("alerta", "¡Se escapó uno!");
        propagarFuego(foco);
      })
    : null;
  dibujos.set(id, dibujo);
  // Al nacer: una chispa que cae del cielo, como la detección del satélite.
  const h = altura(x, y);
  for (let n = 0; n < 10; n++) emitir(chispas, { x, y: h + 1, z: y, vx: (Math.random() - 0.5) * 18, vy: 10 + Math.random() * 16, vz: (Math.random() - 0.5) * 18, g: -30, vida: 0.7, s0: 0.25, s1: 0.05, tint: colorDe(foco) });
  sincronizar();
}

function sincronizar(causa = "apagado", demora = 0) {
  const activos = new Map(partida.activos.map((f) => [f.id, f]));
  for (const [id, d] of dibujos) {
    const foco = activos.get(id);
    if (!foco) {
      if (!d.muere) { d.escape && (d.escape.vivo = false); d.muere = { causa, desde: tiempoReal + demora }; }
      continue;
    }
    if (foco.golpes !== d.golpes) {
      d.golpes = foco.golpes;
      const g = d.pips.clear();
      if (!d.fija) for (let n = 0; n < foco.golpes; n++) g.circle((n - (foco.golpes - 1) / 2) * 6, 0, 2.2).fill({ color: 0xffffff, alpha: 0.95 }).stroke({ width: 1, color: 0x131611 });
    }
    if (d.duda && foco.verificado && !d.verificado) {
      d.verificado = true; d.duda.texto.text = "✓"; d.duda.texto.style.fill = 0x9bbf6a;
      d.duda.fondo.clear().circle(0, 0, 9).fill({ color: 0x131611, alpha: 0.9 }).stroke({ width: 1.5, color: 0x9bbf6a });
    }
  }
}

function dibujarFocos(dt) {
  const sp = Math.sin(cam.pitch);
  // El viento inclina las llamas y se lleva el humo.
  const vp = vientoEnPantalla(), vw = haciaViento();
  const inclina = clamp(vp.x * viento.velocidadMs * 0.035, -0.5, 0.5), empuje = viento.velocidadMs * 0.55;
  for (const [id, d] of dibujos) {
    const h = altura(d.x, d.z);
    proy(cam, d.x, h, d.z, P);
    const k = Math.max(P.k, 0.55);
    d.cont.position.set(P.x, P.y);
    d.cont.zIndex = P.k * 1000;
    const golpes = Math.max(1, d.golpes);
    const lado = ladoDe(golpes) * k;
    const t = tiempoReal + d.fase;
    let escala = 1, alfa = 1;
    if (d.muere) {
      const m = (tiempoReal - d.muere.desde) / 0.5;
      if (m < 0) { /* espera a que llegue el avión */ }
      else {
        if (!d.muere.efecto) {
          d.muere.efecto = true;
          if (d.muere.causa === "falsa") {
            // Falsa alarma: no deja marca de quemado, solo un soplido.
            for (let n = 0; n < 6; n++) emitir(humo, { x: d.x, y: h + 1, z: d.z, vx: (Math.random() - 0.5) * 8, vy: 7, vz: (Math.random() - 0.5) * 8, vida: 0.9, s0: 0.08, s1: 0.3, a0: 0.45, tint: 0xf3f5f7 });
          } else if (d.muere.causa === "escapado") {
            quemar(d.x, d.z, 9, 1);
            for (let n = 0; n < 26; n++) emitir(chispas, { x: d.x, y: h + 1, z: d.z, vx: (Math.random() - 0.5) * 40, vy: 15 + Math.random() * 30, vz: (Math.random() - 0.5) * 40, g: -40, vida: 0.9, s0: 0.35, s1: 0.05, tint: 0xff6b1a });
            for (let n = 0; n < 6; n++) emitir(humo, { x: d.x, y: h + 2, z: d.z, vx: (Math.random() - 0.5) * 6, vy: 8 + Math.random() * 6, vz: (Math.random() - 0.5) * 6, vida: 2.6, s0: 0.12, s1: 0.5, a0: 0.55, tint: 0x2a2420 });
          } else {
            quemar(d.x, d.z, d.fija ? 3 : 5, 0.7);
            for (let n = 0; n < 9; n++) emitir(humo, { x: d.x + (Math.random() - 0.5) * 3, y: h + 1, z: d.z + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 5, vy: 9 + Math.random() * 8, vz: (Math.random() - 0.5) * 5, vida: 1.6, s0: 0.1, s1: 0.42, a0: 0.75, tint: 0xf3f5f7 });
          }
        }
        if (m >= 1) { d.cont.destroy({ children: true }); dibujos.delete(id); continue; }
        escala = d.muere.causa === "escapado" ? 1 + m * 0.8 : 1 - m;
        alfa = 1 - m;
      }
    }
    d.cont.alpha = alfa;
    const brillo = 0.55 + noche * 0.45;
    d.resplandor.scale.set((lado * (3.2 + noche * 1.4) * escala) / 128, ((lado * (3.2 + noche * 1.4) * escala) / 128) * (0.45 + sp * 0.55));
    d.resplandor.alpha = brillo * (d.fija ? 0.55 : 0.85 + 0.15 * Math.sin(t * 9));
    d.llamas.forEach((s, n) => {
      const parpadeo = d.fija ? 1 : 1 + 0.16 * Math.sin(t * (11 + n * 3)) + 0.08 * Math.sin(t * 23 + n);
      const ancho = lado * [1.25, 0.9, 0.5][n] * escala, alto = lado * [1.9, 1.5, 0.95][n] * parpadeo * escala * (d.fija ? 0.6 : 1);
      s.scale.set(ancho / 64, alto / 96);
      s.x = Math.sin(t * 5 + n * 2) * lado * 0.06;
      s.rotation = d.fija ? 0 : inclina * (0.7 + n * 0.25);
      s.alpha = [0.75, 0.9, 1][n];
    });
    d.pips.position.set(0, -lado * 2.25 - 4);
    d.pips.scale.set(clamp(k, 0.8, 1.4));
    if (d.duda) { d.duda.position.set(lado * 0.9 + 6, -lado * 1.6); d.duda.scale.set(clamp(k, 0.85, 1.4)); }
    // Anillo en el suelo: cuánto falta para que el foco se escape.
    d.piso.scale.set(1, 0.35 + sp * 0.65);
    const a = d.anillo.clear();
    a.ellipse(0, 0, lado * 1.25, lado * 1.25).fill({ color: 0x000000, alpha: 0.28 });
    if (d.escape && !d.muere) {
      const p = clamp((reloj - d.nacio) / d.escapeMs, 0, 1);
      const col = tintaMezcla(0xf2f0e8, 0xff3b2f, suave(0.4, 1, p));
      a.moveTo(0, -lado * 1.5).arc(0, 0, lado * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p)).stroke({ width: 2.5 / (0.35 + sp * 0.65) * 0.8, color: col, alpha: 0.95 });
    }
    // Humo y brasas según la potencia.
    if (!d.muere) {
      const tasa = d.fija ? 1.2 : 2.2 + Math.min(4, d.golpes * 1.1);
      if (Math.random() < tasa * dt) emitir(humo, { x: d.x + (Math.random() - 0.5) * 2, y: h + 3, z: d.z + (Math.random() - 0.5) * 2, vx: vw.x * empuje + (Math.random() - 0.5) * 3, vy: 6 + Math.random() * 5, vz: vw.z * empuje + (Math.random() - 0.5) * 3, vida: 3.2, s0: 0.1, s1: 0.48 + golpes * 0.06, a0: d.fija ? 0.4 : 0.5, rot: Math.random() * 6, vr: 0.4, tint: d.fija ? 0xe6ebf0 : tintaMezcla(0x3b332e, 0x8a5a3a, noche * 0.6) });
      if (!d.fija && Math.random() < (1.5 + golpes) * dt) emitir(chispas, { x: d.x, y: h + 2, z: d.z, vx: (Math.random() - 0.5) * 8, vy: 10 + Math.random() * 12, vz: (Math.random() - 0.5) * 8, g: -4, vida: 1.1, s0: 0.22, s1: 0.04, tint: num(PALETA.llamaNucleo) });
    }
  }
}

function propagarFuego(foco, maximo = CELDAS_POR_ESCAPE) {
  const celda = (f) => aCelda(GRILLA, f.x, f.y);
  const encendidas = partida.activos.filter((f) => !f.fuenteFija).map(celda);
  // Un cortafuegos pegado al foco le cierra el paso: eso también suma puntos.
  const c0 = celda(foco);
  const frenos = partida.cortafuegos.filter((c) => Math.abs(c.col - c0.col) <= 1 && Math.abs(c.fila - c0.fila) <= 1);
  if (frenos.length && reglas.gastaAgua) {
    const m = partida.marcador;
    partida = premiarCortafuegos(partida, frenos.length);
    for (const c of frenos) { const p = centroDe(GRILLA, c); flotar(p.x, p.y, `Frenado +${PREMIO_CORTAFUEGOS}`, 0x9bbf6a, 1); }
    reaccionar("festeja", "¡El cortafuegos lo frenó!");
  }
  // El fuego no salta al mar.
  const nuevas = propagar(GRILLA, celda(foco), encendidas, azar, viento, partida.cortafuegos)
    .filter((c) => { const p = centroDe(GRILLA, c); return muestra(MAR, p.x, p.y) < 0.4; }).slice(0, maximo);
  const h0 = altura(foco.x, foco.y);
  for (const nueva of nuevas) {
    const { x, y } = centroDe(GRILLA, nueva);
    // Brasas que vuelan del foco escapado a la celda vecina.
    for (let n = 0; n < 8; n++) {
      const t = 0.55;
      emitir(chispas, { x: foco.x, y: h0 + 2, z: foco.y, vx: (x - foco.x) / t, vy: 28 + n, vz: (y - foco.y) / t, g: -90, vida: t, s0: 0.3, s1: 0.15, tint: 0xff6b1a });
    }
    encender(focoPropagado(proximoId++, x, y));
  }
}

// ---------- Cortafuegos, lagos, pasadas y avión ----------
function dibujarCortafuegos() {
  const g = capas.cortafuegos.clear();
  for (const c of partida.cortafuegos) {
    const x0 = c.col * LADO_CELDA + 3, z0 = c.fila * LADO_CELDA + 3, l = LADO_CELDA - 6;
    const borde = [];
    const pasos = 5;
    for (let s = 0; s < pasos; s++) borde.push([x0 + (l * s) / pasos, z0]);
    for (let s = 0; s < pasos; s++) borde.push([x0 + l, z0 + (l * s) / pasos]);
    for (let s = 0; s < pasos; s++) borde.push([x0 + l - (l * s) / pasos, z0 + l]);
    for (let s = 0; s < pasos; s++) borde.push([x0, z0 + l - (l * s) / pasos]);
    const pts = borde.flatMap(([x, z]) => { proy(cam, x, altura(x, z) + 0.4, z, P); return [P.x, P.y]; });
    g.poly(pts).fill({ color: num(PALETA.banda), alpha: 0.88 }).stroke({ width: 1.6, color: num(PALETA.pelaje), alpha: 0.9 });
    for (let s = 1; s < 4; s++) {
      const za = z0 + (l * s) / 4;
      const a = proy(cam, x0 + 2, altura(x0 + 2, za) + 0.5, za, {}), b = proy(cam, x0 + l - 2, altura(x0 + l - 2, za) + 0.5, za, {});
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: num(PALETA.pelaje), alpha: 0.45 });
    }
  }
}

function dibujarLagos() {
  const g = capas.lagos.clear();
  const bajo = partida.agua <= 3 && estado === "jugando";
  const pulso = 0.5 + 0.5 * Math.sin(tiempoReal * (bajo ? 6 : 2.5));
  const sp = Math.sin(cam.pitch);
  for (const l of lagosActivos()) {
    proy(cam, l.x, altura(l.x, l.y) + 0.3, l.y, P);
    const r = (RADIO_LAGO * 0.65 + pulso * 2) * P.k;
    g.ellipse(P.x, P.y, r, r * (0.3 + sp * 0.7)).stroke({ width: bajo ? 2.5 : 1.5, color: bajo ? 0xbfe9fb : 0xdff3fb, alpha: (bajo ? 0.9 : 0.55) * (0.5 + pulso * 0.5) });
  }
}

function dibujarPasada() {
  const g = capas.pasada.clear();
  const v = ventanas.find((w) => reloj >= w.desdeMs && reloj < w.hastaMs);
  capas.satelite.visible = Boolean(v) && estado === "jugando";
  rotuloPasada.visible = capas.satelite.visible;
  if (!v || estado !== "jugando") return;
  const p = (reloj - v.desdeMs) / (v.hastaMs - v.desdeMs);
  const z = (v.haciaElSur ? p : 1 - p) * H;
  const pts = [];
  for (let s = 0; s <= 28; s++) { const x = (s / 28) * A; proy(cam, x, altura(x, z) + 0.6, z, P); pts.push(P.x, P.y); }
  proy(cam, A / 2, 95, z + (v.haciaElSur ? -14 : 14), P);
  const sat = { x: P.x, y: P.y, k: P.k };
  g.poly([sat.x, sat.y, pts[0], pts[1], pts.at(-2), pts.at(-1)]).fill({ color: num(PALETA.llama), alpha: 0.07 });
  g.poly(pts, false).stroke({ width: 10, color: num(PALETA.llama), alpha: 0.2 });
  g.poly(pts, false).stroke({ width: 2, color: num(PALETA.llamaNucleo), alpha: 0.9 });
  capas.satelite.position.set(sat.x, sat.y);
  capas.satelite.scale.set(clamp(sat.k * 0.55, 0.45, 0.85));
  rotuloPasada.position.set(Math.max(pts[0] - 6, rotuloPasada.width + 8), pts[1]);
  rotuloPasada.text = `Barrida ${v.n} · ${v.sat}`;
}

function lanzarVueloDelAvion(x, z) {
  const ang = -0.6 + Math.random() * 1.2;
  const dx = Math.cos(ang), dz = -Math.sin(ang);
  const avion = new Sprite(TEX.avion), sombra = new Sprite(TEX.sombraAvion);
  avion.anchor.set(0.5); sombra.anchor.set(0.5); sombra.alpha = 0.28;
  capas.cielo.addChild(sombra, avion);
  const dur = 1.3;
  let soltó = false;
  efectos.push({
    t: 0,
    paso(dt) {
      this.t += dt;
      const u = this.t / dur, s = (u - 0.5) * 360;
      const px = x + dx * s, pz = z + dz * s, py = 46;
      proy(cam, px, py, pz, P); avion.position.set(P.x, P.y); avion.scale.set(clamp(P.k * 0.32, 0.18, 0.8));
      const a = proy(cam, px + dx, py, pz + dz, {}); avion.rotation = Math.atan2(a.y - P.y, a.x - P.x) + Math.PI / 2;
      proy(cam, px, altura(clamp(px, 0, A), clamp(pz, 0, H)) + 0.2, pz, P); sombra.position.set(P.x, P.y); sombra.scale.set(avion.scale.x * 0.9, avion.scale.y * 0.9 * Math.sin(cam.pitch)); sombra.rotation = avion.rotation;
      if (!soltó && u >= 0.42) {
        soltó = true;
        for (let n = 0; n < 160; n++) {
          const r = Math.sqrt(Math.random()) * RADIO_AVION, an = Math.random() * Math.PI * 2;
          emitir(agua, { x: x + Math.cos(an) * r, y: 40 + Math.random() * 10, z: z + Math.sin(an) * r, vx: dx * 30, vy: -40 - Math.random() * 30, vz: dz * 30, g: -60, vida: 2, s0: 0.35, s1: 0.3, estirar: 2, tint: 0x9fd8f2, suelo: true,
            alTocar: (it) => { if (Math.random() < 0.15) emitir(humo, { x: it.x, y: it.y + 0.5, z: it.z, vy: 4, vida: 0.9, s0: 0.08, s1: 0.25, a0: 0.5, tint: 0xeaf6fb }); } });
        }
        anilloDeAgua(x, z, 0.55);
      }
      if (u >= 1) { avion.destroy(); sombra.destroy(); return false; }
      return true;
    },
  });
}
function anilloDeAgua(x, z, demora) {
  const g = new Graphics();
  capas.efectos.addChild(g);
  efectos.push({
    t: -demora,
    paso(dt) {
      this.t += dt;
      g.clear();
      if (this.t < 0) return true;
      const u = this.t / 0.7;
      if (u >= 1) { g.destroy(); return false; }
      const r = RADIO_AVION * (0.6 + u * 0.55);
      const pts = [];
      for (let s = 0; s <= 40; s++) { const an = (s / 40) * Math.PI * 2, px = x + Math.cos(an) * r, pz = z + Math.sin(an) * r; proy(cam, px, altura(clamp(px, 0, A), clamp(pz, 0, H)) + 0.5, pz, P); pts.push(P.x, P.y); }
      g.poly(pts).fill({ color: 0x7cbcd6, alpha: 0.18 * (1 - u) }).stroke({ width: 3, color: 0xdff3fb, alpha: 1 - u });
      return true;
    },
  });
}
function chorroDeAgua(x, z) {
  const h = altura(x, z);
  for (let n = 0; n < 22; n++) emitir(agua, { x: x + (Math.random() - 0.5) * 4, y: h + 22 + Math.random() * 8, z: z + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 6, vy: -45, vz: (Math.random() - 0.5) * 6, g: -50, vida: 1.2, s0: 0.28, s1: 0.22, estirar: 2, tint: 0xa8dcf3, suelo: true });
  for (let n = 0; n < 4; n++) emitir(humo, { x, y: h + 2, z, vx: (Math.random() - 0.5) * 6, vy: 8, vz: (Math.random() - 0.5) * 6, vida: 1.1, s0: 0.1, s1: 0.32, a0: 0.6, tint: 0xf3f5f7 });
}
/**
 * Aviso que salta del mapa. Es HTML y no texto de Pixi: así nunca sale cortado ni fuera de la pantalla.
 * `fuerza` (0 a 4) lo agranda y lo hace temblar más: es para los combos.
 */
const COLOR_AVISO = { 0xf2f0e8: "var(--blanco)", 0x868d80: "var(--tenue)" };
function flotar(x, z, texto, color, fuerza = 0) {
  const capa = document.querySelector("#flotantes");
  // El mismo aviso repetido (tocar diez veces sin agua) no se apila: reemplaza al anterior.
  for (const viejo of [...capa.children]) if (viejo.textContent === texto) viejo.remove();
  const el = document.createElement("span");
  el.className = "flotante";
  el.textContent = texto;
  el.style.color = COLOR_AVISO[color] ?? `#${color.toString(16).padStart(6, "0")}`;
  el.style.setProperty("--f", fuerza);
  capa.appendChild(el);
  proy(cam, x, altura(clamp(x, 0, A), clamp(z, 0, H)) + 14, z, P);
  // Se mide y se acomoda entero adentro de la escena, con lugar para el salto y el temblor.
  const w = el.offsetWidth, h = el.offsetHeight, borde = 14 + w * 0.12;
  el.style.left = `${clamp(P.x - w / 2, borde, Math.max(borde, app.screen.width - w - borde))}px`;
  el.style.top = `${clamp(P.y - h, margenArriba + 8, Math.max(margenArriba + 8, app.screen.height - margenAbajo - h - 8))}px`;
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

// ---------- Interacción ----------
const herramientaBotones = new Map([...document.querySelectorAll("[data-herramienta]")].map((b) => [b.dataset.herramienta, b]));
const nombreAvion = herramientaBotones.get("piloto").querySelector(".nombre");
let mantener = null;

function focoEn(sx, sy) {
  let mejor = null, dist = Infinity;
  for (const f of partida.activos) {
    const d = dibujos.get(f.id);
    if (!d || d.muere) continue;
    proy(cam, f.x, altura(f.x, f.y), f.y, P);
    const radio = Math.max(24, ladoDe(f.golpes) * P.k * 1.6);
    const dd = Math.hypot(P.x - sx, P.y - sy + ladoDe(f.golpes) * P.k * 0.5);
    if (dd < radio && dd < dist) [mejor, dist] = [f.id, dd];
  }
  return mejor;
}
function lagoEnPantalla(sx, sy) {
  for (const l of lagosActivos()) { proy(cam, l.x, altura(l.x, l.y), l.y, P); if (Math.hypot(P.x - sx, P.y - sy) < Math.max(22, RADIO_LAGO * P.k)) return l; }
  return null;
}

function elegir(h) {
  partida = elegirHerramienta(partida, h);
  for (const [n, b] of herramientaBotones) b.setAttribute("aria-pressed", String(n === h));
  document.querySelector("#ayuda").textContent = AYUDAS[h];
}
function alLago() {
  if (partida.agua === TANQUE) return;
  partida = recargar(partida);
  SONIDO.tocar("recarga");
  flotar(...ultimoLago(), "Tanque lleno", 0x7cbcd6, 1);
  reaccionar("festeja", "¡Tanque lleno!");
  if (reglas.gastaAgua) agotarFuente(lagoUsado);
}
let lagoUsado = LAGOS_P[0];
const ultimoLago = () => [lagoUsado.x, lagoUsado.y];

/** Un toque en el mapa (o en un foco con el avión o la guía), en coordenadas del mapa. */
function tocarMapa(x, y) {
  const lago = lagoTocado(lagosActivos(), x, y, RADIO_LAGO);
  if (lago) { lagoUsado = lago; return alLago(); }
  if (x < 0 || y < 0 || x > A || y > H) return;
  if (partida.herramienta === "piloto") {
    if (reloj < partida.avionListoMs) { flotar(x, y, `Avión en ${Math.ceil((partida.avionListoMs - reloj) / 1000)} s`, 0x868d80); return; }
    if (!pagar("piloto", x, y)) return;
    const antes = partida.marcador;
    partida = lanzarAvion(partida, x, y, reloj);
    lanzarVueloDelAvion(x, y);
    reaccionar("explica", "¡Avión en camino!");
    SONIDO.tocar("recarga");
    sincronizar("avion", 0.55);
    festejar(antes, x, y);
  } else if (partida.herramienta === "guia") {
    const celda = aCelda(GRILLA, x, y);
    if (partida.cortafuegos.some((c) => c.col === celda.col && c.fila === celda.fila)) return;
    if (!pagar("guia", x, y)) return;
    partida = ponerCortafuegos(partida, celda);
    dibujarCortafuegos();
    for (let n = 0; n < 8; n++) emitir(humo, { x: x + (Math.random() - 0.5) * 10, y: altura(x, y) + 1, z: y + (Math.random() - 0.5) * 10, vy: 3, vida: 0.8, s0: 0.1, s1: 0.25, a0: 0.5, tint: 0xb99b67 });
  } else if (partida.herramienta === "brigada") desplegarBrigada(x, y);
  else if (partida.herramienta === "aguatero") desplegarAguatero(x, y);
}
function alTocarFoco(id) {
  const actual = partida.activos.find((f) => f.id === id);
  if (!actual) return;
  const h = partida.herramienta;
  if (h === "guia" || h === "piloto" || h === "brigada" || h === "aguatero") return tocarMapa(actual.x, actual.y);
  tocar(id);
}
function soltar() {
  if (!mantener) return;
  mantener.evento.vivo = false;
  const id = mantener.id;
  mantener = null;
  tocar(id);
}
/**
 * Verifica un foco con "?". La mayoría resulta falsa alarma: desaparece sin gastar agua y suma puntos.
 * Si es real queda confirmado, y apagarlo ya no gasta agua de más.
 */
function verificarEnMapa(id) {
  const f = buscar(partida, id);
  if (!f) return;
  if (f.confianza !== "low" || f.verificado) { flotar(f.x, f.y, "Es fuego de verdad", 0x868d80); return; }
  if (reglas.gastaAgua && azar() < PROB_FALSA_ALARMA) {
    partida = descartarFalsaAlarma(partida, id);
    flotar(f.x, f.y, `Falsa alarma +${PREMIO_FALSA_ALARMA}`, 0x9bbf6a, 1);
    reaccionar("festeja", "Era una falsa alarma");
    SONIDO.tocar("combo");
    sincronizar("falsa");
    return;
  }
  partida = verificarFoco(partida, id);
  flotar(f.x, f.y, "Es real: apagalo", 0xe89d5b, 1);
  reaccionar("alerta", "Ese es real");
  SONIDO.tocar("recarga");
  sincronizar();
}
/** Un toque a un foco con el agua o la científica. */
function tocar(id) {
  const foco = partida.activos.find((f) => f.id === id);
  if (!foco) return;
  const ordenAntes = ordenDeRecorrido(partida.activos);
  if (partida.herramienta === "bombero" && partida.agua < 1) { flotar(foco.x, foco.y, "Sin agua: buscá una fuente", 0xf0866a, 1); reaccionar("explica", "Te quedaste sin agua"); return; }
  const antes = partida.marcador;
  if (partida.herramienta === "cientifica") verificarEnMapa(id);
  else partida = tocarFoco(partida, id, reloj);
  if (!reglas.gastaAgua) partida = recargar(partida);
  const { marcador } = partida;
  if (partida.herramienta === "bombero") chorroDeAgua(foco.x, foco.y);
  if (partida.herramienta === "cientifica") for (let n = 0; n < 12; n++) emitir(chispas, { x: foco.x, y: altura(foco.x, foco.y) + 3, z: foco.y, vx: Math.cos(n) * 12, vy: 4, vz: Math.sin(n) * 12, vida: 0.5, s0: 0.25, s1: 0.05, tint: 0x9bbf6a });
  if (marcador.puntos < antes.puntos) flotar(foco.x, foco.y, `-${antes.puntos - marcador.puntos}`, 0xf0866a);
  if (marcador.apagados > antes.apagados) festejar(antes, foco.x, foco.y);
  else if (partida.herramienta === "bombero") SONIDO.tocar(foco.fuenteFija ? "escape" : "apagar");
  sincronizar("apagado");
  if (modo === "explorador") trasTocar(id, ordenAntes);
}

// Puntero. Arrastrar con el botón izquierdo (o con un dedo) desplaza el mapa; con el derecho lo gira 360° y lo inclina.
// Un clic sin arrastrar, con cualquiera de los dos botones, acciona la herramienta. Con dos dedos: pellizco y giro.
const punteros = new Map();
let gesto = null;
const UMBRAL_ARRASTRE = 6;
const enLienzo = (e) => { const r = app.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function moverMapa(dxPx, dyPx) {
  const kk = cam.dist / cam.focal;
  const dx = dxPx * kk, dy = (dyPx * kk) / Math.max(0.35, Math.sin(cam.pitch));
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  cam.panX -= dx * cy - dy * sy;
  cam.panZ -= dx * sy + dy * cy;
  cam.sucia = true;
}
function girarMapa(dYaw, dPitch) {
  objetivo.yaw += dYaw; cam.yaw = objetivo.yaw;
  objetivo.pitch = clamp(objetivo.pitch + dPitch, PITCH.min, PITCH.max); cam.pitch = objetivo.pitch;
  cam.sucia = true; cam.ajustar = true;
}
function tocarSuelo(x, y) {
  const lago = lagoEnPantalla(x, y);
  if (lago) { lagoUsado = lago; return alLago(); }
  const s = sueloEn(x, y);
  if (s) tocarMapa(s.x, s.z);
}
const cancelarMantener = () => { if (mantener) { mantener.evento.vivo = false; mantener = null; } };
/** Mantener apretado un foco con "?" lo verifica sin cambiar de herramienta (solo con el agua). */
function empezarEspera(id) {
  const f = buscar(partida, id);
  if (!f || partida.herramienta !== "bombero" || f.confianza !== "low" || f.verificado) return false;
  mantener = { id, evento: programar(VERIFICAR_MS, () => { mantener = null; verificarEnMapa(id); if (gesto) gesto.hecho = true; }) };
  return true;
}
function alBajar(e) {
  const { x, y } = enLienzo(e);
  punteros.set(e.pointerId, { x, y });
  app.canvas.setPointerCapture?.(e.pointerId);
  if (punteros.size === 2) {
    cancelarMantener();
    const [a, b] = [...punteros.values()];
    gesto = { tipo: "pellizco", d0: Math.hypot(a.x - b.x, a.y - b.y), zoom0: objetivo.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    return;
  }
  const derecho = e.pointerType === "mouse" && e.button !== 0;
  const id = estado === "jugando" ? focoEn(x, y) : null;
  gesto = { tipo: "pendiente", derecho, x0: x, y0: y, x, y, id, espera: false, hecho: false };
  if (id !== null && !derecho) gesto.espera = empezarEspera(id);
}
function alMover(e) {
  const { x, y } = enLienzo(e);
  if (punteros.has(e.pointerId)) punteros.set(e.pointerId, { x, y });
  if (!gesto) {
    if (e.pointerType === "mouse") app.canvas.style.cursor = estado === "jugando" && (focoEn(x, y) !== null || lagoEnPantalla(x, y)) ? "pointer" : "grab";
    return;
  }
  if (gesto.tipo === "pellizco") {
    if (punteros.size !== 2) return;
    const [a, b] = [...punteros.values()];
    objetivo.zoom = clamp((gesto.zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, gesto.d0), ZOOM.min, ZOOM.max);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
    moverMapa(mx - gesto.mx, my - gesto.my);
    let giro = ang - gesto.ang;
    if (giro > Math.PI) giro -= Math.PI * 2; else if (giro < -Math.PI) giro += Math.PI * 2;
    girarMapa(giro, 0);
    Object.assign(gesto, { mx, my, ang });
    return;
  }
  if (gesto.tipo === "pendiente" && Math.hypot(x - gesto.x0, y - gesto.y0) > UMBRAL_ARRASTRE) {
    cancelarMantener();
    gesto.tipo = gesto.derecho ? "girar" : "mover";
    app.canvas.style.cursor = "grabbing";
  }
  if (gesto.tipo === "mover") moverMapa(x - gesto.x, y - gesto.y);
  else if (gesto.tipo === "girar") girarMapa((x - gesto.x) * 0.006, (y - gesto.y) * 0.004);
  gesto.x = x; gesto.y = y;
}
function alSubir(e) {
  punteros.delete(e.pointerId);
  if (!gesto) return;
  if (gesto.tipo === "pendiente" && estado === "jugando" && !gesto.hecho && !guiaAbierta) {
    if (gesto.id !== null) { if (gesto.espera) soltar(); else alTocarFoco(gesto.id); }
    else tocarSuelo(gesto.x0, gesto.y0);
  }
  if (gesto.tipo !== "pellizco" || punteros.size === 0) { gesto = null; app.canvas.style.cursor = "grab"; }
}

// ---------- Teclado ----------
const VISTA_INICIAL = { get yaw() { return giroInicial(); }, pitch: VISTAS[0], zoom: 1 };
let vistaN = 0;
function teclaCamara(k) {
  const tecla = k.length === 1 ? k.toLowerCase() : k;
  // Las flechas recorren los focos en el modo explorador; en la partida normal desplazan el mapa, igual que WASD.
  const flechas = modo !== "explorador" || estado !== "jugando";
  if (tecla === "q") objetivo.yaw -= 0.3;
  else if (tecla === "e") objetivo.yaw += 0.3;
  else if (tecla === "r") { vistaN = (vistaN + 1) % VISTAS.length; objetivo.pitch = VISTAS[vistaN]; }
  else if (tecla === "+" || tecla === "=") objetivo.zoom = clamp(objetivo.zoom * 1.25, ZOOM.min, ZOOM.max);
  else if (tecla === "-" || tecla === "_") objetivo.zoom = clamp(objetivo.zoom / 1.25, ZOOM.min, ZOOM.max);
  else if (tecla === "a" || (flechas && tecla === "ArrowLeft")) moverMapa(70, 0);
  else if (tecla === "d" || (flechas && tecla === "ArrowRight")) moverMapa(-70, 0);
  else if (tecla === "w" || (flechas && tecla === "ArrowUp")) moverMapa(0, 70);
  else if (tecla === "s" || (flechas && tecla === "ArrowDown")) moverMapa(0, -70);
  else if (tecla === "0") {
    // Vuelve por el camino corto, aunque el mapa haya dado varias vueltas.
    const vuelta = Math.PI * 2, meta = VISTA_INICIAL.yaw;
    cam.yaw = meta + ((((cam.yaw - meta + Math.PI) % vuelta) + vuelta) % vuelta) - Math.PI;
    Object.assign(objetivo, VISTA_INICIAL); vistaN = 0; cam.panX = 0; cam.panZ = 0; cam.sucia = true;
  }
  else return false;
  return true;
}
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLElement && e.target.closest("button, a") && (e.key === "Enter" || e.key === " ")) return;
  if (teclaCamara(e.key)) return;
  if (estado !== "jugando") return;
  const n = ["1", "2", "3", "4", "5", "6"].indexOf(e.key);
  if (n >= 0) return elegir(HERRAMIENTAS[n]);
  if (modo !== "explorador") return;
  const mover = (paso) => enfocar(siguiente(ordenDeRecorrido(partida.activos), elegido, paso));
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); mover(1); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
  else if (e.key === "Tab") { e.preventDefault(); mover(e.shiftKey ? -1 : 1); }
  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (elegido !== null) tocar(elegido); }
  else if (e.key === "v" || e.key === "V") { if (elegido === null) return; verificarEnMapa(elegido); enfocar(elegido); }
  else if (e.key === "Escape") terminar();
});
function enfocar(id) {
  elegido = id;
  const foco = partida.activos.find((f) => f.id === id);
  if (!foco) return;
  const orden = ordenDeRecorrido(partida.activos);
  anunciar(textoDeFoco(foco, orden.indexOf(foco.id) + 1, orden.length, regiones.get(foco.id) ?? null));
}
function trasTocar(id, ordenAntes) {
  if (partida.activos.some((f) => f.id === id)) return enfocar(id);
  const quedan = partida.activos.length;
  if (quedan === 0) return terminar();
  const proximo = siguiente(ordenAntes, id, 1);
  elegido = null;
  anunciar(`Apagado. Quedan ${focosTxt(quedan)}.`);
  programar(1200, () => enfocar(proximo));
}
function dibujarElegido() {
  const g = capas.elegido.clear();
  if (modo !== "explorador" || elegido === null) return;
  const f = partida.activos.find((x) => x.id === elegido);
  if (!f) return;
  proy(cam, f.x, altura(f.x, f.y), f.y, P);
  const r = ladoDe(f.golpes) * Math.max(P.k, 0.55) * 1.9 + 3 * Math.sin(tiempoReal * 5);
  g.ellipse(P.x, P.y, r, r * (0.35 + Math.sin(cam.pitch) * 0.65)).stroke({ width: 3, color: 0xffffff }).stroke({ width: 1, color: T.trazo });
}

// ---------- Tiempo, costos y festejo ----------
// El reloj no es fijo: cada foco apagado suma segundos y cada foco prendido lo hace correr más rápido.
let tiempoMs = TIEMPO_INICIAL_MS, ritmoReloj = 1;
const sueltos = () => partida.activos.reduce((n, f) => n + (f.fuenteFija ? 0 : 1), 0);
const reanimar = (el, clase) => { el.classList.remove(clase); void el.offsetWidth; el.classList.add(clase); };
function tiempoExtra(ms) {
  const el = $("#tiempoExtra");
  el.textContent = `${ms > 0 ? "+" : "−"}${(Math.abs(ms) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} s`;
  el.dataset.signo = ms > 0 ? "mas" : "menos";
  reanimar(el, "sube");
}
/** Sacude la pantalla un instante. `fuerza` va de 0 a 1. */
function sismo(fuerza) {
  if (MOVIMIENTO_REDUCIDO) return;
  const el = $("#lienzo");
  el.style.setProperty("--sismo", `${(3 + fuerza * 7).toFixed(1)}px`);
  reanimar(el, "sismo");
}
function estallido(combo) {
  const el = $("#estallido");
  el.textContent = `¡Combo x${combo}!`;
  el.dataset.nivel = combo >= 6 ? "3" : combo >= 4 ? "2" : "1";
  reanimar(el, "pum");
}
/** Cobra una herramienta. En el modo explorador todo es gratis. */
function pagar(herramienta, x, y) {
  if (!reglas.gastaAgua) return true;
  const cobrada = cobrar(partida, herramienta);
  if (!cobrada) { flotar(x, y, `Faltan ${COSTOS[herramienta] - partida.marcador.puntos} puntos`, 0xf0866a, 1); SONIDO.tocar("escape"); reaccionar("pensando", "Faltan puntos"); return false; }
  partida = cobrada;
  return true;
}
/** Después de una jugada que apaga focos: suma tiempo, muestra los puntos y hace temblar todo según el combo. */
function festejar(antes, x, y) {
  const m = partida.marcador, n = m.apagados - antes.apagados;
  if (n <= 0) return;
  if (reglas.reloj) {
    const extra = premioDeTiempo(n, m.combo);
    tiempoMs = sumarTiempo(tiempoMs, extra);
    tiempoExtra(extra);
  }
  SONIDO.tocar(m.combo > 1 ? "combo" : "apagar");
  flotar(x, y, `+${m.puntos - antes.puntos}`, m.combo > 1 ? 0xe89d5b : 0xf2f0e8, Math.min(4, m.combo - 1));
  reaccionar("festeja", m.combo >= 2 ? `¡Combo x${m.combo}!` : "¡Bien!", 1300);
  if (m.combo >= 2) estallido(m.combo);
  if (m.combo >= 3) sismo(Math.min(1, m.combo / 8));
}

// ---------- Barridas del satélite: de dónde salen los focos ----------
// Los focos son simulados. Salen al azar, pero no en cualquier lado: en zonas donde suele haber fuego,
// y en cada barrida hay dos o tres zonas "activas" que concentran la mayoría.
const ZONAS = [
  { n: "Rondônia", lat: -10.5, lon: -63, r: 3, p: 3 },
  { n: "Mato Grosso", lat: -12.5, lon: -55, r: 3.5, p: 3 },
  { n: "el sur de Pará", lat: -7, lon: -52, r: 3, p: 2.5 },
  { n: "la Chiquitanía", lat: -17, lon: -61, r: 2.5, p: 2.5 },
  { n: "el Chaco", lat: -22.5, lon: -60.5, r: 3, p: 2.5 },
  { n: "el Cerrado", lat: -13, lon: -46.5, r: 3.5, p: 2 },
  { n: "el Pantanal", lat: -18.5, lon: -56.5, r: 1.8, p: 1.5 },
  { n: "los Llanos del Orinoco", lat: 6.5, lon: -69, r: 3, p: 1.5 },
  { n: "la Caatinga", lat: -8, lon: -41, r: 2.5, p: 1 },
  { n: "el norte argentino", lat: -25, lon: -64, r: 2, p: 1.5 },
  { n: "el delta del Paraná", lat: -33.3, lon: -59.5, r: 1.2, p: 1.2 },
  { n: "las sierras de Córdoba", lat: -31.5, lon: -64.7, r: 1, p: 1.2 },
  { n: "Corrientes", lat: -28.5, lon: -57.5, r: 1.3, p: 1 },
  { n: "el centro de Chile", lat: -36.5, lon: -72.3, r: 1.6, p: 1.5 },
  { n: "la Patagonia andina", lat: -42, lon: -71.3, r: 1.8, p: 1.5 },
  { n: "La Pampa", lat: -37, lon: -65.5, r: 2, p: 1 },
  { n: "la Amazonia peruana", lat: -8.5, lon: -74.5, r: 2, p: 1 },
  { n: "el este de Paraguay", lat: -24.5, lon: -56, r: 1.5, p: 1 },
];
const BARRIDA_MS = 8000, PAUSA_BARRIDA_MS = 2600, BARRIDAS_PARA_GANAR = 4, FOCOS_EXPLORADOR = 26;
let barridaN = 0, pendientes = 0, barridasCompletas = 0, zonasActivas = [];
const gauss = () => Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar());
function elegirZona() {
  let tiro = azar() * ZONAS.reduce((t, z) => t + z.p, 0);
  return ZONAS.find((z) => (tiro -= z.p) < 0) ?? ZONAS.at(-1);
}
function focoAlAzar() {
  for (let intento = 0; intento < 24; intento++) {
    const z = azar() < 0.7 && zonasActivas.length ? zonasActivas[Math.floor(azar() * zonasActivas.length)] : elegirZona();
    const lon = z.lon + gauss() * z.r * 0.55, lat = z.lat + gauss() * z.r * 0.55;
    if (lon < OESTE + 0.5 || lon > ESTE - 0.5 || lat < SUR + 0.5 || lat > NORTE - 0.5) continue;
    const { x, y } = proyectar([lon, lat], BBOX, AREA);
    if (muestra(MAR, x, y) > 0.2 || muestra(LAGO, x, y) > 0.05) continue;
    if (partida.activos.some((f) => Math.hypot(f.x - x, f.y - y) < 5)) continue;
    const frp = Math.min(120, Math.round((1 + Math.exp(gauss() * 1.1 + 1.6)) * 10) / 10);
    return { lon, lat, x, y, frp, confidence: azar() < 0.15 ? "low" : "nominal", fuente_fija: azar() < 0.05 };
  }
  return null;
}
const activarZonas = (cuantas) => { zonasActivas = Array.from({ length: cuantas }, elegirZona); };
/** El rayo del satélite al detectar un foco. */
function destello(x, z) {
  const g = new Graphics();
  capas.efectos.addChild(g);
  efectos.push({ t: 0, paso(dt) {
    this.t += dt; const u = this.t / 0.4;
    g.clear();
    if (u >= 1 || !capas.satelite.visible) { g.destroy(); return false; }
    proy(cam, x, altura(x, z), z, P);
    g.moveTo(capas.satelite.x, capas.satelite.y).lineTo(P.x, P.y).stroke({ width: 3 * (1 - u) + 1, color: num(PALETA.llamaNucleo), alpha: 0.9 * (1 - u) });
    g.circle(P.x, P.y, 6 + u * 22).stroke({ width: 2, color: num(PALETA.llamaNucleo), alpha: 0.8 * (1 - u) });
    return true;
  } });
}
function barrida() {
  barridaN++;
  const n = barridaN, haciaElSur = n % 2 === 1;
  activarZonas(n % 2 ? 2 : 3);
  const v = { n, sat: n % 2 ? "NOAA-20" : "NOAA-21", haciaElSur, hora: haciaElSur ? 2 : 14, desdeMs: reloj, hastaMs: reloj + BARRIDA_MS };
  ventanas = [...ventanas.slice(-1), v];
  const cantidad = Math.min(14, 4 + Math.floor(n * 1.3));
  for (let i = 0; i < cantidad; i++) {
    const f = focoAlAzar();
    if (!f) continue;
    const id = proximoId++;
    regiones.set(id, regionEn(FONDO, [f.lon, f.lat]));
    pendientes++;
    programar((haciaElSur ? f.y / H : 1 - f.y / H) * BARRIDA_MS, () => { pendientes--; destello(f.x, f.y); encender(focoActivo(id, f)); });
  }
  programar(BARRIDA_MS, () => { barridasCompletas++; });
  programar(BARRIDA_MS + PAUSA_BARRIDA_MS, barrida);
  const donde = [...new Set(zonasActivas.map((z) => z.n))].join(" y ");
  anunciar(`Barrida ${n} de ${v.sat}, ${haciaElSur ? "de norte a sur" : "de sur a norte"}. Hay más fuego en ${donde}.`);
  reaccionar(n === 1 ? "saluda" : "explica", n === 1 ? "¡A apagar!" : `Barrida ${n}: mirá ${zonasActivas[0].n}`, 2200);
}

// ---------- Viento: cambia de dirección, inclina las llamas y empuja el fuego ----------
const VIENTO_CAMBIO_MS = 13_000, VIENTO_SALTA_DESDE_MS = 7;
const RUMBOS = ["norte", "noreste", "este", "sudeste", "sur", "sudoeste", "oeste", "noroeste"];
let viento = { desdeGrados: 225, velocidadMs: 6 }, vientoMeta = { ...viento };
let rafagas;
const rumbo = (grados) => RUMBOS[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
/** Hacia dónde sopla, en coordenadas del mapa (x al este, z al sur). */
const haciaViento = () => { const a = ((viento.desdeGrados + 180) * Math.PI) / 180; return { x: Math.sin(a), z: -Math.cos(a) }; };
function vientoEnPantalla() {
  const v = haciaViento();
  const a = proy(cam, A / 2, 0, H / 2, {}), b = proy(cam, A / 2 + v.x * 10, 0, H / 2 + v.z * 10, {});
  const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / largo, y: (b.y - a.y) / largo };
}
function cambiarViento() {
  vientoMeta = { desdeGrados: Math.floor(azar() * 8) * 45 + (azar() - 0.5) * 20, velocidadMs: 3 + azar() * 11 };
  programar(VIENTO_CAMBIO_MS, cambiarViento);
  programar(2600, saltoPorViento);
  SONIDO.tocar("viento");
  reanimar($("#vientoDato"), "cambia");
  reaccionar("alerta", `Ahora el viento viene del ${rumbo(vientoMeta.desdeGrados)}`, 2200);
  anunciar(`Cambió el viento: ahora sopla del ${rumbo(vientoMeta.desdeGrados)} a ${Math.round(vientoMeta.velocidadMs * 3.6)} kilómetros por hora.`);
}
/** Con viento fuerte, uno o dos focos tiran brasas a la celda de al lado, a favor del viento. */
function saltoPorViento() {
  if (!reglas.escapes || viento.velocidadMs < VIENTO_SALTA_DESDE_MS) return;
  const viejos = partida.activos.filter((f) => !f.fuenteFija && reloj - (dibujos.get(f.id)?.nacio ?? reloj) > 3000);
  for (let n = viento.velocidadMs > 11 ? 2 : 1; n > 0 && viejos.length; n--) {
    const [foco] = viejos.splice(Math.floor(azar() * viejos.length), 1);
    const antes = partida.activos.length;
    propagarFuego(foco, 1);
    if (partida.activos.length > antes) flotar(foco.x, foco.y, "¡Viento!", 0xf0866a, 1);
  }
}
function avanzarViento(dt) {
  const k = 1 - Math.exp(-dt * 0.9);
  const giro = ((vientoMeta.desdeGrados - viento.desdeGrados + 540) % 360) - 180;
  viento = { desdeGrados: viento.desdeGrados + giro * k, velocidadMs: lerp(viento.velocidadMs, vientoMeta.velocidadMs, k) };
}
/** Ráfagas: rayitas que cruzan el mapa para que se vea de dónde viene el viento. */
function moverRafagas(dt) {
  const v = haciaViento(), vel = viento.velocidadMs * 3.2, visible = estado === "jugando" ? 1 : 0;
  const q = {};
  for (const it of rafagas.lista) {
    it.edad += dt;
    if (it.edad > it.vida || it.x < -30 || it.x > A + 30 || it.z < -30 || it.z > H + 30) {
      Object.assign(it, { x: Math.random() * A, z: Math.random() * H, edad: 0, vida: 1.4 + Math.random() * 1.6, alto: 5 + Math.random() * 10 });
    }
    it.x += v.x * vel * dt; it.z += v.z * vel * dt;
    const h = altura(clamp(it.x, 0, A), clamp(it.z, 0, H)) + it.alto;
    proy(cam, it.x, h, it.z, P); proy(cam, it.x + v.x * 9, h, it.z + v.z * 9, q);
    it.p.x = P.x; it.p.y = P.y;
    it.p.rotation = Math.atan2(q.y - P.y, q.x - P.x);
    it.p.scaleX = (Math.hypot(q.x - P.x, q.y - P.y) / 64) * (0.6 + viento.velocidadMs / 10); it.p.scaleY = 0.5;
    it.p.tint = T.rafaga;
    it.p.alpha = visible * Math.sin(Math.PI * Math.min(1, it.edad / it.vida)) * clamp(viento.velocidadMs / 16, 0.12, 0.6);
  }
}

// ---------- Fuentes de agua: cada una sirve una vez y después el agua aparece en otro lado ----------
const FUENTES_ACTIVAS = 6;
let fuentes = new Set();
const lagosActivos = () => LAGOS_P.filter((l) => fuentes.has(l.i));
function repartirFuentes() {
  fuentes = new Set();
  while (fuentes.size < FUENTES_ACTIVAS) fuentes.add(Math.floor(azar() * LAGOS_P.length));
  cam.sucia = true;
}
function agotarFuente(l) {
  const libres = LAGOS_P.filter((o) => !fuentes.has(o.i));
  const nueva = libres[Math.floor(azar() * libres.length)];
  fuentes.delete(l.i); fuentes.add(nueva.i);
  cam.sucia = true;
  flotar(nueva.x, nueva.y, "Nueva fuente", 0x7cbcd6, 1);
  for (let n = 0; n < 14; n++) emitir(agua, { x: nueva.x + (Math.random() - 0.5) * 8, y: altura(nueva.x, nueva.y) + 1, z: nueva.y + (Math.random() - 0.5) * 8, vy: 30 + Math.random() * 20, g: -70, vida: 1, s0: 0.3, s1: 0.2, estirar: 2, tint: 0xa8dcf3 });
  anunciar(`Se agotó ${l.nombre}. Ahora hay agua en ${nueva.nombre}.`);
  reaccionar("explica", `Ahora hay agua en ${nueva.nombre}`, 2800);
}

// ---------- Charmy aguatero: va a la fuente más cercana y vuelve con agua para el tanque ----------
// Trae 8 de agua en total (dos viajes de 4) y se va: recién ahí se puede llamar a otro.
const AGUATERO = { viajes: 2, velocidad: 42, carga: 4, esperaMs: 700 };
let aguatero = null;
function desplegarAguatero(x, z) {
  if (muestra(MAR, x, z) > 0.5) { flotar(x, z, "Ahí hay mar", 0x868d80); return; }
  if (aguatero) { flotar(x, z, "Ya hay un aguatero", 0x868d80, 1); return; }
  if (!pagar("aguatero", x, z)) return;
  const sprite = new Sprite(texCharmy["bombero-explica"]);
  sprite.anchor.set(0.5, 0.92);
  capas.focos.addChild(sprite);
  aguatero = { x, z, casa: { x, z }, fase: "ida", destino: null, espera: 0, viajes: 0, sprite, mira: 1, sale: 0 };
  reaccionar("explica", "¡Voy por agua!");
  SONIDO.tocar("recarga");
}
function moverAguatero(dt) {
  const a = aguatero;
  if (!a || a.sale) return;
  if (a.fase === "carga") {
    a.espera -= dt * 1000;
    if (a.espera <= 0) { a.fase = "vuelta"; a.sprite.texture = texCharmy["bombero-festeja"]; }
    return;
  }
  if (a.fase === "ida" && (!a.destino || !fuentes.has(a.destino.i))) {
    // La fuente activa más cercana; si se agota en el camino, cambia de rumbo.
    a.destino = lagosActivos().reduce((m, l) => (!m || Math.hypot(l.x - a.x, l.y - a.z) < Math.hypot(m.x - a.x, m.y - a.z) ? l : m), null);
    if (!a.destino) return;
  }
  const meta = a.fase === "ida" ? { x: a.destino.x, z: a.destino.y } : a.casa;
  const dx = meta.x - a.x, dz = meta.z - a.z, d = Math.hypot(dx, dz);
  if (d > 2) {
    const paso = Math.min(d, AGUATERO.velocidad * dt);
    a.x += (dx / d) * paso; a.z += (dz / d) * paso; a.dx = dx / d; a.dz = dz / d;
    return;
  }
  if (a.fase === "ida") {
    a.fase = "carga"; a.espera = AGUATERO.esperaMs;
    for (let n = 0; n < 10; n++) emitir(agua, { x: a.x + (Math.random() - 0.5) * 4, y: altura(a.x, a.z) + 1, z: a.z + (Math.random() - 0.5) * 4, vy: 25 + Math.random() * 15, g: -70, vida: 0.8, s0: 0.25, s1: 0.2, estirar: 2, tint: 0xa8dcf3 });
    return;
  }
  // Volvió: descarga en el tanque.
  const antes = partida.agua;
  partida = { ...partida, agua: Math.min(TANQUE, partida.agua + AGUATERO.carga) };
  flotar(a.x, a.z, `+${partida.agua - antes} de agua`, 0x7cbcd6, 1);
  SONIDO.tocar("recarga");
  a.viajes++; a.sprite.texture = texCharmy["bombero-explica"];
  if (a.viajes >= AGUATERO.viajes) { a.sale = tiempoReal; flotar(a.x, a.z, "¡Listo, me voy!", 0x868d80); } else { a.fase = "ida"; a.destino = null; }
}
function dibujarAguatero() {
  const a = aguatero;
  if (!a) return;
  const h = altura(clamp(a.x, 0, A), clamp(a.z, 0, H)) + 0.6;
  proy(cam, a.x, h, a.z, P);
  const px = P.x, py = P.y, k = clamp(P.k, 0.5, 2.2);
  let alfa = 1;
  if (a.sale) { alfa = 1 - (tiempoReal - a.sale) / 0.6; if (alfa <= 0) { a.sprite.destroy(); aguatero = null; return; } }
  if (a.dx !== undefined) { const q = proy(cam, a.x + a.dx * 4, h, a.z + a.dz * 4, {}); if (Math.abs(q.x - px) > 0.5) a.mira = q.x > px ? 1 : -1; }
  const salto = a.fase === "carga" ? 0 : Math.abs(Math.sin(tiempoReal * 9)) * 3 * k;
  a.sprite.position.set(px, py - salto);
  a.sprite.scale.set(a.mira * k * 0.13, k * 0.13);
  a.sprite.alpha = alfa; a.sprite.zIndex = P.k * 1000 + 2;
  const g = capas.rutas;
  // Los viajes que le quedan, y una gota cuando vuelve cargado.
  for (let n = 0; n < AGUATERO.viajes - a.viajes; n++) g.circle(px + (n - (AGUATERO.viajes - a.viajes - 1) / 2) * 5, py - k * 30, 1.6).fill({ color: 0x7cbcd6, alpha: alfa }).stroke({ width: 1, color: 0x131611, alpha: alfa });
  if (a.fase === "vuelta") g.circle(px + a.mira * k * 9, py - k * 12 - salto, 3.2 * k).fill({ color: 0x7cbcd6, alpha: 0.95 }).stroke({ width: 1, color: 0xdff3fb });
}

// ---------- Charmy en vivo: cambia de ánimo y dice algo corto según lo que pasa ----------
const TRAJE = { bombero: "bombero", piloto: "piloto", cientifica: "cientifica", guia: "guia", brigada: "bombero", aguatero: "bombero" };
let reaccion = null, charmyVista = "";
function reaccionar(mood, frase = "", ms = 1600) { reaccion = { mood, frase, hasta: tiempoReal + ms / 1000 }; }
function pintarCharmy() {
  const caja = $("#charmyVivo"), visible = estado === "jugando" && !guiaAbierta;
  if (caja.hidden === visible) caja.hidden = !visible;
  if (!visible) { charmyVista = ""; return; }
  if (reaccion && tiempoReal > reaccion.hasta) reaccion = null;
  const mood = reaccion ? reaccion.mood : estadoDeCharmy(partida), outfit = TRAJE[partida.herramienta], frase = reaccion?.frase ?? "";
  const vista = `${mood}|${outfit}|${frase}`;
  if (vista === charmyVista) return;
  charmyVista = vista;
  $("#charmyFigura").innerHTML = dibujarCharmyGuia(mood, outfit);
  const dice = $("#charmyDice");
  dice.textContent = frase; dice.hidden = !frase;
  reanimar($("#charmyFigura"), "brinca");
  if (frase) reanimar(dice, "aparece");
}

// ---------- Brigadas: camiones que van solos de foco en foco ----------
const BRIGADA = { max: 3, velocidad: 30, focos: 3, vidaMs: 32_000, golpeMs: 600, alcance: 3 };
let unidades = [];
function desplegarBrigada(x, z) {
  if (muestra(MAR, x, z) > 0.5) { flotar(x, z, "Ahí hay mar", 0x868d80); return; }
  if (unidades.length >= BRIGADA.max) { flotar(x, z, `Máximo ${BRIGADA.max} brigadas`, 0x868d80, 1); return; }
  if (!pagar("brigada", x, z)) return;
  const sprite = new Sprite(TEX.camion);
  sprite.anchor.set(0.5, 0.85);
  capas.focos.addChild(sprite);
  unidades.push({ x, z, objetivo: null, apagados: 0, nacio: reloj, trabajo: 0, sprite, mira: 1, sale: 0 });
  reaccionar("explica", "¡Allá va la brigada!");
  SONIDO.tocar("recarga");
  for (let n = 0; n < 10; n++) emitir(humo, { x: x + (Math.random() - 0.5) * 6, y: altura(x, z) + 1, z: z + (Math.random() - 0.5) * 6, vy: 4, vida: 0.8, s0: 0.1, s1: 0.3, a0: 0.5, tint: 0xb99b67 });
}
/** El foco más cercano; los que ya tiene otra brigada quedan para el final. */
function objetivoDe(u) {
  const tomados = new Set(unidades.filter((o) => o !== u && o.objetivo !== null).map((o) => o.objetivo));
  let mejor = null, dist = Infinity;
  for (const f of partida.activos) {
    if (f.fuenteFija) continue;
    const d = Math.hypot(f.x - u.x, f.y - u.z) * (tomados.has(f.id) ? 3 : 1);
    if (d < dist) [mejor, dist] = [f.id, d];
  }
  return mejor;
}
function moverBrigadas(dt) {
  for (const u of unidades) {
    if (u.sale) continue;
    if (u.apagados >= BRIGADA.focos || reloj - u.nacio > BRIGADA.vidaMs) { u.sale = tiempoReal; u.objetivo = null; continue; }
    let f = u.objetivo === null ? undefined : buscar(partida, u.objetivo);
    if (!f) { u.objetivo = objetivoDe(u); u.trabajo = 0; f = u.objetivo === null ? undefined : buscar(partida, u.objetivo); }
    if (!f) continue;
    const dx = f.x - u.x, dz = f.y - u.z, d = Math.hypot(dx, dz);
    if (d > BRIGADA.alcance) {
      const paso = Math.min(d - BRIGADA.alcance * 0.8, BRIGADA.velocidad * dt);
      u.x += (dx / d) * paso; u.z += (dz / d) * paso; u.dx = dx / d; u.dz = dz / d;
      if (Math.random() < 6 * dt) emitir(humo, { x: u.x, y: altura(clamp(u.x, 0, A), clamp(u.z, 0, H)) + 0.5, z: u.z, vy: 2, vida: 0.7, s0: 0.06, s1: 0.2, a0: 0.35, tint: 0xb99b67 });
      continue;
    }
    u.trabajo += dt * 1000;
    if (u.trabajo < BRIGADA.golpeMs) continue;
    u.trabajo = 0;
    chorroDeAgua(f.x, f.y);
    const antes = partida.marcador;
    if (f.golpes > 1) partida = { ...partida, activos: partida.activos.map((o) => (o.id === f.id ? { ...o, golpes: o.golpes - 1 } : o)) };
    else {
      partida = { ...partida, marcador: apagar(antes, reloj, f.toques), activos: sin(partida, f.id) };
      u.apagados++; u.objetivo = null;
      festejar(antes, f.x, f.y);
    }
    sincronizar("apagado");
    if (modo === "explorador" && partida.activos.length === 0) terminar();
  }
}
function dibujarBrigadas() {
  const g = capas.rutas.clear();
  const q = {};
  for (let i = unidades.length - 1; i >= 0; i--) {
    const u = unidades[i];
    const h = altura(clamp(u.x, 0, A), clamp(u.z, 0, H)) + 0.6;
    proy(cam, u.x, h, u.z, P);
    const px = P.x, py = P.y, k = clamp(P.k, 0.5, 2.2);
    let alfa = 1;
    if (u.sale) { alfa = 1 - (tiempoReal - u.sale) / 0.6; if (alfa <= 0) { u.sprite.destroy(); unidades.splice(i, 1); continue; } }
    if (u.dx !== undefined) { proy(cam, u.x + u.dx * 4, h, u.z + u.dz * 4, q); if (Math.abs(q.x - px) > 0.5) u.mira = q.x > px ? 1 : -1; }
    u.sprite.position.set(px, py + Math.sin(tiempoReal * 18 + i) * 0.6);
    u.sprite.scale.set(u.mira * k * 0.36, k * 0.36);
    u.sprite.alpha = alfa; u.sprite.zIndex = P.k * 1000 + 1;
    const f = u.objetivo === null || u.sale ? undefined : buscar(partida, u.objetivo);
    if (f) {
      // El recorrido hasta el próximo foco, en guiones que avanzan.
      const tramos = 14, corre = (tiempoReal * 2) % 1;
      for (let t = 0; t < tramos; t++) {
        const a = (t + corre * 0.999) / tramos, b = Math.min(1, a + 0.5 / tramos);
        const ax = lerp(u.x, f.x, a), az = lerp(u.z, f.y, a), bx = lerp(u.x, f.x, b), bz = lerp(u.z, f.y, b);
        proy(cam, ax, altura(clamp(ax, 0, A), clamp(az, 0, H)) + 0.5, az, P); proy(cam, bx, altura(clamp(bx, 0, A), clamp(bz, 0, H)) + 0.5, bz, q);
        g.moveTo(P.x, P.y).lineTo(q.x, q.y).stroke({ width: 2, color: 0xe89d5b, alpha: 0.8 });
      }
    }
    // Cuántos focos le quedan antes de volver al cuartel.
    for (let n = 0; n < BRIGADA.focos - u.apagados; n++) g.circle(px + (n - (BRIGADA.focos - u.apagados - 1) / 2) * 5, py - k * 16, 1.6).fill({ color: 0xf2f0e8, alpha: alfa }).stroke({ width: 1, color: 0x131611, alpha: alfa });
  }
}

// ---------- Partida ----------
const $ = (s) => document.querySelector(s);
function mostrar(id) {
  for (const s of ["#inicio", "#fin", "#pausa"]) $(s).hidden = s !== id;
  enPausa = id === "#pausa";
  $("#pausaBtn").hidden = estado !== "jugando" || modo === "explorador";
}
function limpiarMundo() {
  for (const d of dibujos.values()) d.cont.destroy({ children: true });
  dibujos.clear(); eventos = []; mantener = null; elegido = null;
  for (const u of unidades) u.sprite.destroy();
  if (aguatero) { aguatero.sprite.destroy(); aguatero = null; }
  reaccion = null;
  unidades = []; ventanas = []; regiones = new Map();
  for (const pl of [humo, chispas, agua]) for (const it of pl.lista) { it.vivo = false; it.p.alpha = 0; }
  limpiarQuemados();
}
function empezar(m = "normal") {
  limpiarMundo();
  modo = m; reglas = REGLAS[m];
  partida = nuevaPartida(); reloj = 0; azar = crearAzar(`${Date.now()}-${Math.random()}`);
  proximoId = 0; barridaN = 0; pendientes = 0; barridasCompletas = 0;
  for (const h of Object.keys(ultimoAviso)) delete ultimoAviso[h];
  $("#flotantes").replaceChildren();
  tiempoMs = TIEMPO_INICIAL_MS; ritmoReloj = 1;
  viento = { desdeGrados: Math.floor(azar() * 8) * 45, velocidadMs: 4 + azar() * 5 }; vientoMeta = { ...viento };
  repartirFuentes();
  estado = "jugando";
  if (reglas.reloj) { barrida(); programar(VIENTO_CAMBIO_MS, cambiarViento); }
  else {
    // Modo explorador: todos los focos de una, sin reloj y sin que se escapen.
    activarZonas(4);
    for (let i = 0; i < FOCOS_EXPLORADOR; i++) {
      const f = focoAlAzar();
      if (!f) continue;
      const id = proximoId++;
      regiones.set(id, regionEn(FONDO, [f.lon, f.lat]));
      encender(focoActivo(id, f));
    }
  }
  mostrar(null);
  $("#hud").hidden = false; $("#abajo").hidden = false; $("#leyenda").hidden = false;
  elegir("bombero");
  dibujarCortafuegos();
  medirMargenes();
  Object.assign(objetivo, { pitch: VISTAS[0], yaw: VISTA_INICIAL.yaw });
  if (!MOVIMIENTO_REDUCIDO) { cam.pitch = 1.1; }
  cam.panX = 0; cam.panZ = 0; objetivo.zoom = 1;
  cam.sucia = true;
  if (modo === "explorador") anunciar(`Modo explorador, sin reloj: ${partida.activos.length} focos simulados. Usá las flechas o Tab para recorrerlos, Enter o Espacio para apagar, V para verificar y Escape para terminar.`);
  else anunciar(`Empieza la partida con ${TIEMPO_INICIAL_MS / 1000} segundos. Cada foco apagado suma tiempo. ${AYUDAS.bombero}`);
}
/** `causa`: "tiempo" (se acabó el reloj), "victoria" (no quedó ningún foco) o nada (modo explorador o Escape). */
function terminar(causa = "") {
  if (estado !== "jugando") return;
  estado = "fin";
  const victoria = causa === "victoria";
  const antes = partida.marcador.puntos;
  // Ganar apagando todo multiplica los puntos y suma los segundos que sobraron.
  if (victoria) partida = { ...partida, marcador: { ...partida.marcador, puntos: puntosDeVictoria(antes, tiempoMs) } };
  const m = partida.marcador;
  const record = leerRecord(almacen());
  const esRecord = reglas.sumaRecord && m.puntos > record;
  if (esRecord) guardarRecord(almacen(), m.puntos);
  SONIDO.tocar(victoria ? "victoria" : "fin");
  if (victoria) sismo(1);
  const { consejo } = cierreDePartida(Math.floor(Math.random() * CONSEJOS.length), m.fijasTocadas);
  const ahora = Date.now();
  let mejores = leerMejores(almacen(), record);
  if (reglas.sumaRecord && m.puntos > 0) { mejores = sumarMejor(mejores, m.puntos, ahora); guardarMejores(almacen(), mejores); }
  const frase = fraseDelFinal({ puntos: m.puntos, antes, record, apagados: m.apagados, barridas: barridaN, victoria, sumaRecord: reglas.sumaRecord });
  const chip = victoria ? (esRecord ? "¡Apagaste todo! Récord nuevo" : "¡Apagaste todo!") : esRecord ? "Récord nuevo" : causa === "tiempo" ? "Se acabó el tiempo" : "Fin de la partida";
  const plano = frase.replace(/<[^>]+>/g, "");
  anunciar(`${chip}. ${miles(m.puntos)} puntos. ${plano} ${consejo} ${AVISO_SIMULADOS} Enter para jugar otra vez.`);
  $("#charmyFin").innerHTML = dibujarCharmyGuia(victoria ? "festeja" : estadoDelCierre(m, esRecord), "bombero");
  $("#chipFin").textContent = chip;
  $("#tituloFin").innerHTML = `${miles(m.puntos)}<small>puntos</small>`;
  $("#resumenFin").innerHTML = frase;
  $("#mejoresCaja").hidden = mejores.length === 0;
  $("#mejoresFin").innerHTML = mejores.map((x, i) => `<li${x.t === ahora ? ' class="esta"' : ""}><i>${i + 1}</i><span>${x.t === ahora ? "Esta partida" : cuando(x.t, ahora)}</span><b>${miles(x.p)}</b></li>`).join("");
  $("#consejoFin").textContent = consejo;
  $("#avisoFin").textContent = AVISO_SIMULADOS;
  for (const d of dibujos.values()) if (!d.muere) d.muere = { causa: "apagado", desde: tiempoReal + Math.random() * 0.6 };
  for (const u of unidades) if (!u.sale) u.sale = tiempoReal;
  if (aguatero && !aguatero.sale) aguatero.sale = tiempoReal;
  eventos = [];
  $("#hud").hidden = true; $("#abajo").hidden = true; $("#leyenda").hidden = true;
  mostrar("#fin");
  $("#otraVez").focus();
}
function irAlInicio() {
  estado = "inicio";
  limpiarMundo();
  partida = nuevaPartida();
  dibujarCortafuegos();
  $("#hud").hidden = true; $("#abajo").hidden = true; $("#leyenda").hidden = true;
  const record = leerRecord(almacen());
  $("#recordInicio").hidden = record <= 0;
  $("#recordInicio").textContent = `Tu récord · ${miles(record)} puntos`;
  mostrar("#inicio");
  medirMargenes();
  $("#jugar").focus();
}

// ---------- Marcador (HTML, para el lector de pantalla) ----------
const tanque = $("#tanque");
for (let i = 0; i < TANQUE; i++) tanque.appendChild(document.createElement("i"));
const previo = {};
const costoBotones = [...herramientaBotones].filter(([h]) => COSTOS[h]);
const NOMBRE_UNIDAD = { piloto: "Avión", brigada: "Brigada", aguatero: "Aguatero" };
const ultimoAviso = {};
/** Una unidad quedó lista: cartel grande que tiembla arriba de la barra y el botón salta. Como mucho una vez cada 9 s por unidad. */
function avisarListo(h, boton) {
  if (ultimoAviso[h] !== undefined && reloj - ultimoAviso[h] < 9000) return;
  ultimoAviso[h] = reloj;
  const el = $("#listoAviso");
  el.textContent = `¡${NOMBRE_UNIDAD[h]} ${h === "brigada" ? "lista" : "listo"}! Tecla ${HERRAMIENTAS.indexOf(h) + 1}`;
  reanimar(el, "pum");
  reanimar(boton, "salta");
  boton.addEventListener("animationend", () => boton.classList.remove("salta"), { once: true });
  SONIDO.tocar("combo");
  reaccionar("explica", `¡Podés usar ${h === "brigada" ? "la brigada" : h === "piloto" ? "el avión" : "el aguatero"}!`, 2000);
}
function actualizarMarcador() {
  const m = partida.marcador;
  const set = (k, v, fn) => { if (previo[k] !== v) { const antes = previo[k]; previo[k] = v; fn(v, antes); } };
  set("puntos", m.puntos, (v, antes) => { $("#puntos").textContent = v; if (v > (antes ?? 0)) reanimar($("#puntos"), "tiembla"); });
  set("combo", m.combo, (v) => {
    const el = $("#combo");
    el.textContent = `x${v}`; el.classList.toggle("vivo", v > 1);
    el.parentElement.dataset.nivel = v >= 6 ? "3" : v >= 4 ? "2" : v >= 2 ? "1" : "0";
    if (v > 1) reanimar(el, "tiembla");
  });
  // La barra del combo: cuánto falta para que se corte la racha.
  const racha = m.combo > 0 && m.ultimoApagadoMs !== null ? clamp(1 - (reloj - m.ultimoApagadoMs) / VENTANA_COMBO_MS, 0, 1) : 0;
  $("#comboBarra").style.transform = `scaleX(${racha.toFixed(3)})`;
  set("agua", partida.agua, (v) => { [...tanque.children].forEach((c, i) => c.classList.toggle("lleno", i < v)); tanque.classList.toggle("bajo", v <= 3); tanque.setAttribute("aria-label", `Agua ${v} de ${TANQUE}`); $("#aguaNum").textContent = `${v}/${TANQUE}`; });
  set("tiempo", reglas.reloj ? Math.max(0, Math.ceil(tiempoMs / 1000)) : -1, (v) => { $("#tiempo").textContent = v < 0 ? "Sin reloj" : `${v} s`; $("#tiempoDato").classList.toggle("poco", v >= 0 && v <= 10); });
  set("ritmo", reglas.reloj ? Math.round(ritmoReloj * 10) : 10, (v) => {
    $("#ritmo").textContent = v > 10 ? `corre x${(v / 10).toLocaleString("es-AR")}` : "";
    $("#tiempoDato").dataset.ritmo = v >= 20 ? "3" : v >= 15 ? "2" : v > 10 ? "1" : "0";
  });
  const v = ventanas.find((w) => reloj >= w.desdeMs && reloj < w.hastaMs);
  set("pasada", v ? v.n : modo === "explorador" ? -2 : -1, (n) => {
    $("#pasada").textContent = n === -2 ? "Focos de práctica" : n < 0 ? "Esperando al satélite…" : `Barrida ${n} · ${v.sat}`;
  });
  const avion = Math.max(0, Math.ceil((partida.avionListoMs - reloj) / 1000));
  set("avion", avion, (s) => { nombreAvion.textContent = s > 0 ? `Avión (${s} s)` : "Avión"; });
  // Lo que no se puede pagar queda apagado.
  for (const [h, b] of costoBotones) {
    const alcanza = !reglas.gastaAgua || m.puntos >= COSTOS[h];
    const libre = h === "piloto" ? reloj >= partida.avionListoMs : h === "brigada" ? unidades.length < BRIGADA.max : h === "aguatero" ? !aguatero && partida.agua < TANQUE : false;
    b.classList.toggle("caro", !alcanza);
    // Cuando ya se puede usar, el botón late para que no pase de largo.
    const listo = reglas.gastaAgua && alcanza && libre;
    if (listo && !b.classList.contains("listo")) avisarListo(h, b);
    b.classList.toggle("listo", listo);
  }
  set("brigadas", unidades.length, (n) => { $("#brigadasN").textContent = n > 0 ? `${n}/${BRIGADA.max}` : ""; });
  const vp = vientoEnPantalla();
  $("#vientoFlecha").style.transform = `rotate(${Math.atan2(vp.y, vp.x).toFixed(2)}rad)`;
  set("viento", `${rumbo(viento.desdeGrados)}-${Math.round(viento.velocidadMs * 3.6)}`, () => {
    $("#vientoTxt").textContent = `del ${rumbo(viento.desdeGrados)} · ${Math.round(viento.velocidadMs * 3.6)} km/h`;
    $("#vientoDato").classList.toggle("fuerte", viento.velocidadMs >= VIENTO_SALTA_DESDE_MS);
  });
}

// ---------- Charmy (componente @charmy/charmy, generado con charmySvg) ----------
const TRAJES = ["bombero", "piloto", "cientifica", "guia"], ANIMOS = ["idle", "alerta", "pensando", "festeja", "explica"];
const texCharmy = {};
async function cargarCharmy() {
  const claves = TRAJES.flatMap((o) => ANIMOS.map((m) => `${o}-${m}`));
  await Promise.all(claves.map(async (clave) => {
    const [outfit, mood] = clave.split("-");
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(charmySvg({ mood, outfit, size: 256 }));
    await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 256;
    c.getContext("2d").drawImage(img, 0, 0, 256, 256);
    texCharmy[clave] = Texture.from(c);
  }));
}
let charmy, charmyClave = "", charmySalto = 0;

function medirMargenes() {
  const hud = $("#hud"), abajo = $("#abajo");
  margenArriba = hud.hidden ? 30 : hud.getBoundingClientRect().height + 20;
  margenAbajo = abajo.hidden ? 40 : abajo.getBoundingClientRect().height + 24;
  if (app) { ajustarCamara(); cam.sucia = true; }
}

// ---------- Arranque ----------
async function iniciar() {
  generarRelieve();
  crearTexturas();
  hornearTerreno();
  guardarTerreno();
  app = new Application();
  await app.init({ resizeTo: $("#lienzo"), antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), background: T.app, preference: "webgl" });
  $("#lienzo").appendChild(app.canvas);
  await Promise.all([cargarCharmy(), document.fonts?.ready]);
  for (const n of ["fondo", "mundo", "cortafuegos", "lagos", "rutas", "efectos", "pasada", "focos", "particulas", "cielo", "elegido", "ui"]) { capas[n] = n === "cortafuegos" || n === "lagos" || n === "rutas" || n === "pasada" || n === "elegido" ? new Graphics() : new Container(); app.stage.addChild(capas[n]); }
  const fondo = new Sprite(TEX.fondo); capas.fondo.addChild(fondo);
    capas.focos.sortableChildren = true;
  crearMalla();
  humo = pool(TEX.humo, 520); chispas = pool(TEX.chispa, 420, "add"); agua = pool(TEX.gota, 520);
  brillos = pool(TEX.chispa, 90, "add");
  rafagas = pool(TEX.estela, 70);
  for (const it of rafagas.lista) Object.assign(it, { x: Math.random() * A, z: Math.random() * H, edad: Math.random() * 2, vida: 2, alto: 8 });
  capas.particulas.addChild(rafagas.pc, humo.pc, agua.pc, chispas.pc);
  capas.mundo.addChild(brillos.pc);
  // Destellos sobre el mar.
  const puntosMar = [];
  while (puntosMar.length < 90) { const x = X0 + Math.random() * MW, z = Z0 + Math.random() * MH; if (muestra(MAR, x, z) > 0.9 && fundido(x, z) > 0.6) puntosMar.push([x, z]); }
  brillos.lista.forEach((it, i) => Object.assign(it, { x: puntosMar[i][0], z: puntosMar[i][1], fase: Math.random() * 10 }));
  // Paralelos y lagos con nombre.
  const estilo = (tam, color) => ({ fontFamily: "IBM Plex Mono, monospace", fontSize: tam, fill: color, stroke: { color: T.trazo, width: 3 } });
  for (let lat = 10; lat >= -50; lat -= 10) {
    const t = new Text({ text: lat === 0 ? "0°" : `${Math.abs(lat)}° ${lat > 0 ? "N" : "S"}`, style: estilo(11, T.rotulo) }); t.anchor.set(1.1, 0.5);
    capas.ui.addChild(t); rotulos.push({ texto: t, x: -0.06 * A, y: 0, z: ((NORTE - lat) / (NORTE - SUR)) * H });
  }
  for (const l of LAGOS_P) {
    const t = new Text({ text: l.nombre.split(" / ")[0], style: { ...estilo(10, T.lagoTxt), fontFamily: "IBM Plex Sans, sans-serif", fontStyle: "italic" } });
    t.anchor.set(0.5, -0.6); capas.ui.addChild(t); rotulos.push({ texto: t, x: l.x, y: altura(l.x, l.y), z: l.y, lago: l.i });
  }
  {
    // Las Malvinas, con su nombre en el mapa.
    const p = proyectar([-59.2, -51.75], BBOX, AREA);
    const t = new Text({ text: "Islas Malvinas", style: { ...estilo(10, T.rotulo), fontFamily: "IBM Plex Sans, sans-serif", fontWeight: "600" } });
    t.anchor.set(-0.12, 0.5); capas.ui.addChild(t); rotulos.push({ texto: t, x: p.x + 4, y: 0, z: p.y });
  }
  const sat = new Sprite(TEX.satelite); sat.anchor.set(0.5); capas.satelite = new Container(); capas.satelite.addChild(sat); capas.cielo.addChild(capas.satelite);
  rotuloPasada = new Text({ text: "", style: { fontFamily: "IBM Plex Sans, sans-serif", fontWeight: "600", fontSize: 12, fill: 0xe89d5b, stroke: { color: T.trazo, width: 3 } } });
  rotuloPasada.anchor.set(1, 0.5); capas.ui.addChild(rotuloPasada);
  charmy = new Sprite(texCharmy["bombero-idle"]); charmy.anchor.set(0.5, 1); capas.ui.addChild(charmy);

  app.canvas.addEventListener("pointerdown", alBajar);
  window.addEventListener("pointermove", alMover);
  window.addEventListener("pointerup", alSubir);
  window.addEventListener("pointercancel", alSubir);
  app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  app.canvas.addEventListener("wheel", (e) => { e.preventDefault(); objetivo.zoom = clamp(objetivo.zoom * Math.exp(-e.deltaY * 0.0015), ZOOM.min, ZOOM.max); }, { passive: false });
  app.canvas.style.cursor = "grab";
  const redimensionar = () => { app.resize(); fondo.width = app.screen.width; fondo.height = app.screen.height; medirMargenes(); };
  redimensionar();
  new ResizeObserver(redimensionar).observe($("#lienzo"));
  new ResizeObserver(() => medirMargenes()).observe($("#hud"));

  // Controles de HTML.
  for (const [h, b] of herramientaBotones) { b.addEventListener("click", () => elegir(h)); b.addEventListener("keydown", (e) => e.stopPropagation()); }
  $("#jugar").addEventListener("click", () => empezar("normal"));
  $("#otraVez").addEventListener("click", () => empezar(modo));
  $("#volver").addEventListener("click", irAlInicio);
  const silencio = $("#silencio");
  const pintarSilencio = () => { silencio.setAttribute("aria-pressed", String(SONIDO.silenciado())); silencio.setAttribute("aria-label", SONIDO.silenciado() ? "Prender el sonido" : "Apagar el sonido"); };
  silencio.addEventListener("click", () => { SONIDO.silenciar(!SONIDO.silenciado()); guardarSilencio(almacen(), SONIDO.silenciado()); pintarSilencio(); });
  pintarSilencio();
  const camBoton = (sel, k) => $(sel).addEventListener("click", () => teclaCamara(k));
  camBoton("#camVista", "r"); camBoton("#camIzq", "q"); camBoton("#camDer", "e"); camBoton("#camMas", "+"); camBoton("#camMenos", "-"); camBoton("#camCentro", "0");
  $("#rampa").innerHTML = RAMPA.map((c) => `<span style="background:${c}"></span>`).join("");
  armarPausa();
  $("#cargando").remove();
  irAlInicio();
  app.ticker.add(cuadro);
}

let rotuloPasada;
function cuadro(ticker) {
  const dt = Math.min(0.1, ticker.deltaMS / 1000);
  tiempoReal += dt;
  if (estado === "jugando" && !guiaAbierta && !enPausa) {
    reloj += dt * 1000; correrEventos();
    avanzarViento(dt);
    moverBrigadas(dt);
    moverAguatero(dt);
    if (reglas.reloj && estado === "jugando") {
      // Mientras más focos prendidos, más rápido corre el reloj.
      const prendidos = sueltos();
      ritmoReloj = ritmoDelReloj(prendidos);
      tiempoMs -= dt * 1000 * ritmoReloj;
      if (tiempoMs <= 0) { tiempoMs = 0; terminar("tiempo"); }
      else if (barridasCompletas >= BARRIDAS_PARA_GANAR && pendientes === 0 && prendidos === 0) terminar("victoria");
    }
  }
  // En el inicio la maqueta gira despacio.
  if (estado === "inicio" && !MOVIMIENTO_REDUCIDO && !gesto) objetivo.yaw = giroInicial() + Math.sin(tiempoReal * 0.12) * 0.12;
  const s = 1 - Math.exp(-dt * 7);
  for (const k of ["yaw", "pitch", "zoom"]) {
    if (Math.abs(cam[k] - objetivo[k]) > 1e-4) { cam[k] = lerp(cam[k], objetivo[k], s); cam.sucia = true; if (k !== "zoom") cam.ajustar = true; }
  }
  if (cam.ajustar) { ajustarCamara(); cam.ajustar = false; }
  if (cam.sucia) { actualizarCamara(); proyectarMundo(); cam.sucia = false; }
  // Madrugada o tarde según la pasada del satélite: de noche la maqueta se apaga y el fuego brilla más.
  const v = ventanas.find((w) => reloj >= w.desdeMs && reloj < w.hastaMs);
  const metaNoche = estado === "jugando" && v ? (v.hora < 12 ? 1 : 0) : 0;
  noche = lerp(noche, metaNoche, 1 - Math.exp(-dt * 2));
  const tinte = tintaMezcla(0xffffff, 0x9aa3b8, noche);
  terreno.tint = tinte;
  capas.fondo.children[0].tint = tintaMezcla(0xffffff, 0x8f97ab, noche);
  for (const it of brillos.lista) {
    proy(cam, it.x, 0.2, it.z, P);
    it.p.x = P.x; it.p.y = P.y; const sc = P.k * 0.12; it.p.scaleX = sc * 1.8; it.p.scaleY = sc * 0.6;
    it.p.alpha = Math.max(0, Math.sin(tiempoReal * 1.4 + it.fase * 3)) ** 6 * (0.7 - noche * 0.4) * fundido(it.x, it.z);
  }
  dibujarFocos(dt);
  moverParticulas(humo, dt); moverParticulas(chispas, dt); moverParticulas(agua, dt);
  for (let i = efectos.length - 1; i >= 0; i--) if (!efectos[i].paso(dt)) efectos.splice(i, 1);
  moverRafagas(dt);
  dibujarBrigadas();
  dibujarAguatero();
  pintarCharmy();
  dibujarLagos();
  dibujarPasada();
  dibujarElegido();
  // Charmy acompaña: vestuario de la herramienta y estado de la partida.
  const clave = `${partida.herramienta === "brigada" ? "bombero" : partida.herramienta}-${estado === "jugando" ? estadoDeCharmy(partida) : "idle"}`;
  if (clave !== charmyClave) { charmyClave = clave; charmy.texture = texCharmy[clave]; charmySalto = 1; }
  charmySalto = Math.max(0, charmySalto - dt * 3);
  const tam = Math.min(120, app.screen.width * 0.16);
  charmy.visible = false; // ahora Charmy vive en el HTML, animado (pintarCharmy)
  charmy.position.set(app.screen.width - tam * 0.5 - 60, app.screen.height - margenAbajo + 6 - Math.sin(charmySalto * Math.PI) * 14);
  const resp = 1 + Math.sin(tiempoReal * 2.2) * 0.015;
  charmy.scale.set((tam / 256) * resp, (tam / 256) / resp);
  if (estado === "jugando") actualizarMarcador();
}


// ===== Tema oscuro y claro, como en la landing (botón del pie o tecla T) =====
const C_OSCURO = { ...C };
const C_CLARO = {
  mar: rgb("#c3cdcb"), marClaro: rgb("#dfe3dc"), lago: rgb("#8fb3c2"), lagoBorde: rgb("#c4d8de"),
  estepa: rgb("#ebe6d2"), estepaSeca: rgb("#ddd5bb"), bosque: rgb("#93a07a"), valle: rgb("#b8c29f"),
  roca: rgb("#a5ae96"), rocaOscura: rgb("#86917a"), nieve: rgb("#fbfaf6"),
};
const TEMAS_MAPA = {
  oscuro: { C: C_OSCURO, fondo: ["#1a1e17", "#12160f", "#0b0d0a"], app: 0x0b0d0a, trazo: 0x0b0d0a, rotulo: 0x868d80, lagoTxt: 0xdff3fb, limites: "rgba(255, 248, 235, 0.34)", grilla: "rgba(255, 255, 255, 0.16)", rafaga: 0xf2f0e8 },
  claro: { C: C_CLARO, fondo: ["#f8f7f2", "#ecebe4", "#dddcd3"], app: 0xecebe4, trazo: 0xf8f7f2, rotulo: 0x62675b, lagoTxt: 0x245a70, limites: "rgba(18, 20, 15, 0.42)", grilla: "rgba(18, 20, 15, 0.14)", rafaga: 0x3b4036 },
};
let temaActual = "oscuro";
try { temaActual = localStorage.getItem("charmy-tema") === "claro" ? "claro" : "oscuro"; } catch (e) {}
let T = TEMAS_MAPA[temaActual];
Object.assign(C, T.C);
document.documentElement.dataset.tema = temaActual;

// Las manchas de quemado se guardan para volver a pintarlas sobre el relieve del otro tema.
const quemados = [];
const quemarOriginal = quemar;
quemar = function (x, z, radio, fuerza) { quemados.push([x, z, radio, fuerza]); quemarOriginal(x, z, radio, fuerza); };
const limpiarOriginal = limpiarQuemados;
limpiarQuemados = () => { quemados.length = 0; limpiarOriginal(); };

function pintarFondo(x, w, h) {
  const g = x.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.55, w * 0.75);
  g.addColorStop(0, T.fondo[0]); g.addColorStop(0.5, T.fondo[1]); g.addColorStop(1, T.fondo[2]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}

function aplicarTema(id) {
  temaActual = id === "claro" ? "claro" : "oscuro";
  T = TEMAS_MAPA[temaActual];
  document.documentElement.dataset.tema = temaActual;
  try { localStorage.setItem("charmy-tema", temaActual); } catch (e) {}
  const boton = $("#tema");
  boton.setAttribute("aria-label", temaActual === "claro" ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
  if (!app || !terreno) return;
  Object.assign(C, T.C);
  const viejo = texTerreno;
  hornearTerreno();
  guardarTerreno();
  for (const q of quemados) quemarOriginal(...q);
  terreno.texture = texTerreno;
  viejo.destroy(true);
  const fondo = capas.fondo.children[0], fondoViejo = fondo.texture;
  fondo.texture = lienzo(512, 512, pintarFondo);
  fondoViejo.destroy(true);
  app.renderer.background.color = T.app;
  for (const r of rotulos) { r.texto.style.stroke = { color: T.trazo, width: 3 }; r.texto.style.fill = r.lago !== undefined ? T.lagoTxt : T.rotulo; }
  if (rotuloPasada) rotuloPasada.style.stroke = { color: T.trazo, width: 3 };
}
const alternarTema = () => aplicarTema(temaActual === "claro" ? "oscuro" : "claro");

// ===== Guía de Charmy =====
// Cada paso ilumina una parte del juego, Charmy cambia de traje y una demo chica muestra qué hace.
// En el texto, *palabra* se resalta.
const RAMPA_DEMO = ["#fed976", "#fd8d3c", "#e31a1c"];
const LLAMA_D = "M0 -22 C8 -12 12 -6 12 2 A12 12 0 0 1 -12 2 C-12 -6 -8 -12 0 -22Z";
// La posición va en un <g> de afuera: la animación CSS del de adentro no la pisa.
const llama = (x, y, s = 1, extra = "") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="d-llama" ${extra}>` +
  `<path d="${LLAMA_D}" fill="#fd8d3c"/><path transform="translate(0 2) scale(.55)" d="${LLAMA_D}" fill="#fed976"/></g></g>`;
const svgDemo = (clase, cuerpo) => `<svg class="${clase}" viewBox="0 0 180 74" preserveAspectRatio="xMidYMid meet">${cuerpo}</svg>`;
const DEMOS = {
  focos: () => svgDemo("demo-focos", [[40, 40, 7, 0], [90, 34, 11, 1], [140, 42, 15, 2]]
    .map(([x, y, r, i]) => `<circle style="--i:${i}" cx="${x}" cy="${y}" r="${r}" fill="${RAMPA_DEMO[i]}"/>`).join("")),
  agua: () => svgDemo("demo-agua",
    `<ellipse class="d-suelo" cx="90" cy="62" rx="40" ry="6"/>${llama(90, 54, 1.1)}` +
    `<ellipse class="anillo" cx="90" cy="58" rx="16" ry="5" fill="none" stroke="#4fa3c7" stroke-width="2"/>` +
    `<path class="gota d-agua" d="M90 22 C95 30 98 34 98 38 A8 8 0 0 1 82 38 C82 34 85 30 90 22Z"/>`),
  tanque: () => svgDemo("demo-tanque",
    `<rect x="18" y="26" width="104" height="22" rx="11" class="d-traz" stroke-width="2" opacity=".5"/>` +
    `<rect class="nivel d-agua" x="22" y="30" width="96" height="14" rx="7"/>` +
    `<ellipse class="lago" cx="152" cy="40" rx="18" ry="9" fill="#4fa3c7" opacity=".55"/>` +
    `<text x="152" y="66" text-anchor="middle" class="d-tinta" font-size="10" font-family="IBM Plex Mono, monospace">lago</text>`),
  avion: () => svgDemo("demo-avion",
    `<ellipse class="d-suelo" cx="90" cy="62" rx="70" ry="6"/>` +
    [50, 90, 130].map((x, i) => llama(x, 56, 0.8, `style="--i:${i}"`)).join("") +
    `<rect class="estela" x="0" y="26" width="180" height="5" rx="2.5" fill="#4fa3c7"/>` +
    `<g class="avion"><path class="d-tinta" d="M0 22 l22 4 l8 -8 l4 0 l-4 10 l14 2 l0 4 l-14 2 l4 10 l-4 0 l-8 -8 l-22 4z" transform="translate(0 4) scale(.9)"/></g>`),
  verificar: () => svgDemo("demo-verificar",
    `<g class="duda"><circle cx="90" cy="38" r="15" fill="#131611" stroke="#e89d5b" stroke-width="2"/><text x="90" y="44" text-anchor="middle" font-size="17" font-weight="600" fill="#e89d5b" font-family="IBM Plex Mono, monospace">?</text></g>` +
    `<g class="tilde"><circle cx="90" cy="38" r="15" fill="#131611" stroke="#9bbf6a" stroke-width="2"/><path d="M83 38 l5 5 l9 -10" fill="none" stroke="#9bbf6a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>` +
    `<g class="lupa"><circle cx="90" cy="38" r="20" class="d-traz" stroke-width="3"/><path d="M104 52 l14 14" class="d-traz" stroke-width="5" stroke-linecap="round"/></g>`),
  cortafuegos: () => svgDemo("demo-corta",
    [0, 1, 2, 3].map((i) => `<rect x="${22 + i * 36}" y="18" width="32" height="44" rx="6" class="d-suelo"/>`).join("") +
    llama(38, 52, 0.9) +
    `<g class="salta">${llama(74, 52, 0.75)}</g>` +
    `<g class="frenada" style="transform-box:fill-box;transform-origin:50% 100%">${llama(110, 52, 0.5)}</g>` +
    `<g class="barrera">${[0, 1, 2, 3, 4].map((i) => `<rect style="--i:${i}" x="${93 + i * 0}" y="${20 + i * 8}" width="5" height="8" rx="1.5" fill="#e89d5b"/>`).join("")}</g>`),
  pasada: () => svgDemo("demo-pasada",
    `<path d="M -10 60 Q 90 -20 190 60" class="d-traz" stroke-width="1.5" stroke-dasharray="3 5" opacity=".45"/>` +
    [[50, 62], [90, 58], [130, 63]].map(([x, y], i) => `<circle class="f" style="--i:${i}" cx="${x}" cy="${y}" r="5" fill="${RAMPA_DEMO[i]}"/>`).join("") +
    `<g class="sat"><rect x="-14" y="-4" width="9" height="8" fill="#5a86b0"/><rect x="5" y="-4" width="9" height="8" fill="#5a86b0"/><rect x="-5" y="-5" width="10" height="10" rx="2" class="d-tinta"/></g>`),
  combo: () => svgDemo("demo-combo",
    ["+10", "x2", "x3"].map((t, i) => `<text style="--i:${i}" x="${45 + i * 45}" y="46" text-anchor="middle" fill="${i ? "#e89d5b" : "currentColor"}">${t}</text>`).join("")),
  camara: () => svgDemo("demo-camara",
    `<g class="maqueta"><path d="M90 12 L150 37 L90 62 L30 37Z" class="d-suelo"/><path d="M90 12 L150 37 L90 62 L30 37Z" class="d-traz" stroke-width="1.5" opacity=".5"/>` +
    `<path d="M70 40 l10 -12 l8 8 l10 -14 l12 18" class="d-traz" stroke-width="2" stroke-linejoin="round"/><circle cx="105" cy="44" r="4" fill="#fd8d3c"/></g>`),
  viento: () => svgDemo("demo-viento",
    [14, 30, 46].map((y, i) => `<path class="rafaga" style="--i:${i}" d="M10 ${y} h${50 + i * 12}" stroke="#4fa3c7" stroke-width="3" stroke-linecap="round" fill="none"/>`).join("") +
    `<ellipse class="d-suelo" cx="110" cy="64" rx="50" ry="5"/>` +
    `<g class="inclina">${llama(95, 58, 1)}</g><g class="salta">${llama(140, 58, 0.7)}</g>`),
  brigada: () => svgDemo("demo-brigada",
    `<ellipse class="d-suelo" cx="90" cy="64" rx="76" ry="5"/><path d="M20 60 H160" class="d-traz" stroke-width="1.5" stroke-dasharray="4 5" opacity=".5"/>` +
    [70, 115, 160].map((x, i) => llama(x, 58, 0.7, `style="--i:${i}"`)).join("") +
    `<g class="camion"><rect x="0" y="44" width="26" height="13" rx="2" fill="#c2410c"/><rect x="26" y="48" width="11" height="9" rx="2" fill="#c2410c"/><rect x="29" y="50" width="6" height="4" fill="#9fd2e8"/><path d="M2 42 L24 38" stroke="#e9e2d0" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="59" r="4" class="d-tinta"/><circle cx="30" cy="59" r="4" class="d-tinta"/></g>`),
  tiempo: () => svgDemo("demo-tiempo",
    `<circle cx="52" cy="38" r="22" class="d-traz" stroke-width="3"/><path class="aguja d-traz" d="M52 38 V22" stroke-width="3" stroke-linecap="round"/><path d="M46 12 h12" class="d-traz" stroke-width="3" stroke-linecap="round"/>` +
    `<text class="mas" x="118" y="46" text-anchor="middle" fill="#4f7a2a">+2 s</text>`),
  llamar: () => `<div class="demo-llamar"><span>100<small>Argentina</small></span><span>132<small>Chile</small></span></div>`,
};

const PASOS = [
  { titulo: "¡Hola! Soy <em>Charmy.</em>", texto: "Te muestro cómo se juega. Los focos de esta versión son *simulados*: no son datos reales.", mood: "saluda", outfit: "bombero", demo: "focos" },
  { objetivo: ".dato.pasada", titulo: "La <em>barrida</em>", texto: "Cada vez que el satélite *barre* el mapa aparecen focos nuevos, en zonas distintas.", mood: "explica", outfit: "cientifica", demo: "pasada" },
  { objetivo: "#leyenda", titulo: "Los <em>focos</em>", texto: "Cuanto más *roja* es la luz, más fuerte es el foco, más agua pide y más puntos da.", mood: "explica", outfit: "guia", demo: "focos" },
  { objetivo: '[data-herramienta="bombero"]', herramienta: "bombero", titulo: "1 · <em>Agua</em>", texto: "Tocá un foco para *apagarlo*. Los fuertes piden más de un toque.", mood: "explica", outfit: "bombero", demo: "agua" },
  { objetivo: ".dato.agua", herramienta: "bombero", titulo: "El <em>tanque</em>", texto: "Cada toque gasta agua. Recargá en una *fuente*: sirve una vez y después el agua aparece *en otro lado*.", mood: "pensando", outfit: "bombero", demo: "tanque" },
  { objetivo: '[data-herramienta="piloto"]', herramienta: "piloto", titulo: "2 · <em>Avión</em>", texto: "Apaga una *zona entera*. Cuesta *80 puntos* y tarda 20 s en volver.", mood: "festeja", outfit: "piloto", demo: "avion" },
  { objetivo: '[data-herramienta="cientifica"]', herramienta: "cientifica", titulo: "3 · <em>Verificar</em>", texto: "De los focos con *?*, seis de cada diez son *falsa alarma*. Verificalos: desaparecen sin gastar agua.", mood: "explica", outfit: "cientifica", demo: "verificar" },
  { objetivo: "#vientoDato", titulo: "El <em>viento</em>", texto: "Cambia de dirección y *empuja el fuego* a las celdas vecinas. Mirá la flecha.", mood: "alerta", outfit: "guia", demo: "viento" },
  { objetivo: '[data-herramienta="guia"]', herramienta: "guia", titulo: "4 · <em>Cortafuegos</em>", texto: "Ponelo hacia donde sopla el viento. Cuesta *10 puntos* y cada vez que frena al fuego *suma 25*.", mood: "explica", outfit: "guia", demo: "cortafuegos" },
  { objetivo: '[data-herramienta="brigada"]', herramienta: "brigada", titulo: "5 · <em>Brigada</em>", texto: "Tocá el mapa y un camión va *solo* de foco en foco. Cuesta *50 puntos* y apaga hasta *tres*.", mood: "festeja", outfit: "bombero", demo: "brigada" },
  { objetivo: '[data-herramienta="aguatero"]', herramienta: "aguatero", titulo: "6 · <em>Aguatero</em>", texto: "Un Charmy bombero te trae *8 de agua* en dos viajes y se va. Cuesta *30 puntos*.", mood: "saluda", outfit: "bombero", demo: "tanque" },
  { objetivo: "#tiempoDato", titulo: "El <em>tiempo</em>", texto: "Cada foco apagado *suma segundos*. Mientras más fuego hay, más rápido corre el reloj.", mood: "alerta", outfit: "bombero", demo: "tiempo" },
  { objetivo: "#hud .dato.combo", titulo: "El <em>combo</em>", texto: "Apagá varios seguidos y los puntos se *multiplican*. Si no queda ni un foco, *ganás* y valen doble.", mood: "festeja", outfit: "bombero", demo: "combo" },
  { objetivo: "#camara", titulo: "La <em>cámara</em>", texto: "*Arrastrá* para moverte, botón *derecho* para girar y la *rueda* para acercar. Acá están también el sonido y el tema.", mood: "explica", outfit: "guia", demo: "camara" },
  { titulo: "¡Listo para <em>salir!</em>", texto: "Esto es un juego. Si ves fuego de verdad, *llamá* a emergencias.", mood: "saluda", outfit: "bombero", demo: "llamar", final: true },
];

var guiaAbierta = false;

// ---------- Pausa: frena el reloj, los focos, el viento y las unidades ----------
var enPausa = false;
function pintarPausa() {
  $("#pausaSonido").textContent = `Sonido: ${SONIDO.silenciado() ? "no" : "sí"}`;
  $("#pausaSonido").setAttribute("aria-pressed", String(!SONIDO.silenciado()));
  $("#pausaTema").textContent = temaActual === "claro" ? "Tema claro" : "Tema oscuro";
}
function pausar() {
  if (estado !== "jugando" || modo === "explorador" || guiaAbierta || enPausa) return;
  cancelarMantener();
  pintarPausa();
  mostrar("#pausa");
  anunciar("Pausa. El reloj está frenado.");
  $("#pausaSeguir").focus();
}
function seguir() {
  if (!enPausa) return;
  mostrar(null);
  anunciar("Seguimos.");
}
function armarPausa() {
  $("#charmyInicio").innerHTML = dibujarCharmyGuia("saluda", "bombero");
  $("#charmyPausa").innerHTML = dibujarCharmyGuia("idle", "bombero");
  $("#pausaBtn").addEventListener("click", pausar);
  $("#pausaSeguir").addEventListener("click", seguir);
  $("#pausaReiniciar").addEventListener("click", () => empezar(modo));
  $("#pausaGuia").addEventListener("click", () => { seguir(); abrirGuia(false); });
  $("#pausaSonido").addEventListener("click", () => { $("#silencio").click(); pintarPausa(); });
  $("#pausaTema").addEventListener("click", () => { alternarTema(); pintarPausa(); });
  // Si la pestaña queda oculta, la partida se pausa sola.
  document.addEventListener("visibilitychange", () => { if (document.hidden) pausar(); });
}
let guiaPaso = 0, guiaDesdeInicio = false;
const VISTA_GUIA = "charmy-brigada-guia-vista";

function dibujarCharmyGuia(mood, outfit) {
  return charmySvg({ mood, outfit, size: 128, label: `Charmy con traje de ${outfit}` });
}

function textoAnimado(texto) {
  let i = 0;
  // Los tramos entre *asteriscos* se resaltan; cada palabra entra con su propio retraso.
  return texto.split(/(\*[^*]+\*)/).filter(Boolean).map((tramo) => {
    const resaltado = tramo.startsWith("*");
    return tramo.replace(/\*/g, "").split(/(\s+)/).map((p) => {
      if (!p.trim()) return p;
      const html = resaltado ? `<b>${p}</b>` : p;
      return `<span class="pal" style="--i:${i++}">${html}</span>`;
    }).join("");
  }).join("");
}

function colocarGuia() {
  const paso = PASOS[guiaPaso];
  const escena = $("#escena").getBoundingClientRect();
  const foco = $("#guiaFoco"), caja = $("#guiaCaja");
  const el = paso.objetivo ? document.querySelector(paso.objetivo) : null;
  const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
  const margen = 8;
  if (r) {
    Object.assign(foco.style, { left: `${r.left - escena.left - margen}px`, top: `${r.top - escena.top - margen}px`, width: `${r.width + margen * 2}px`, height: `${r.height + margen * 2}px` });
    foco.classList.remove("vacio");
  } else {
    Object.assign(foco.style, { left: `${escena.width / 2}px`, top: `${escena.height / 2}px`, width: "0px", height: "0px" });
    foco.classList.add("vacio");
  }
  const cw = caja.offsetWidth, ch = caja.offsetHeight;
  let x, y;
  if (!r) { x = (escena.width - cw) / 2; y = (escena.height - ch) / 2; }
  else {
    const cx = r.left - escena.left + r.width / 2, abajo = r.top - escena.top + r.height / 2 > escena.height / 2;
    x = cx - cw / 2;
    y = abajo ? r.top - escena.top - ch - 22 : r.bottom - escena.top + 22;
    // La cámara está a la derecha: la caja va a su izquierda.
    if (r.left - escena.left > escena.width * 0.8) { x = r.left - escena.left - cw - 22; y = r.top - escena.top + r.height / 2 - ch / 2; }
  }
  caja.style.left = `${clamp(x, 8, escena.width - cw - 8)}px`;
  caja.style.top = `${clamp(y, 8, escena.height - ch - 8)}px`;
}

function mostrarPaso(n) {
  guiaPaso = clamp(n, 0, PASOS.length - 1);
  const paso = PASOS[guiaPaso];
  if (paso.herramienta) elegir(paso.herramienta);
  $("#camara").classList.toggle("guiada", paso.objetivo === "#camara");
  const figura = $("#guiaFigura"), globo = $("#guiaGlobo");
  figura.innerHTML = dibujarCharmyGuia(paso.mood, paso.outfit);
  for (const el of [figura, globo]) { el.classList.remove("salta", "entra"); void el.offsetWidth; }
  figura.classList.add("salta"); globo.classList.add("entra");
  $("#guiaPaso").textContent = `${guiaPaso + 1} de ${PASOS.length}`;
  $("#guiaTitulo").innerHTML = paso.titulo;
  $("#guiaTexto").innerHTML = textoAnimado(paso.texto);
  $("#guiaDemo").innerHTML = DEMOS[paso.demo] ? DEMOS[paso.demo]() : "";
  $("#guiaPuntos").innerHTML = PASOS.map((_, i) => `<i class="${i === guiaPaso ? "on" : ""}"></i>`).join("");
  $("#guiaAtras").hidden = guiaPaso === 0;
  $("#guiaExplorar").hidden = !(paso.final && guiaDesdeInicio);
  $("#guiaSig").textContent = paso.final ? (guiaDesdeInicio ? "Jugar" : "¡A jugar!") : "Siguiente";
  anunciar(`${$("#guiaTitulo").textContent}. ${paso.texto.replace(/\*/g, "")}`);
  requestAnimationFrame(colocarGuia);
  $("#guiaSig").focus({ preventScroll: true });
}

function abrirGuia(desdeInicio = false) {
  if (estado !== "jugando") return;
  guiaDesdeInicio = desdeInicio;
  guiaAbierta = true;
  try { localStorage.setItem(VISTA_GUIA, "1"); } catch (e) {}
  $("#guia").hidden = false;
  mostrarPaso(0);
}
function cerrarGuia(despues) {
  guiaAbierta = false;
  $("#guia").hidden = true;
  $("#camara").classList.remove("guiada");
  elegir("bombero");
  if (despues === "jugar") empezar("normal");
}
const guiaVista = () => { try { return localStorage.getItem(VISTA_GUIA) === "1"; } catch (e) { return true; } };

function armarGuiaYTema() {
  $("#guiaSig").addEventListener("click", () => {
    if (!PASOS[guiaPaso].final) return mostrarPaso(guiaPaso + 1);
    cerrarGuia(guiaDesdeInicio ? "jugar" : null);
  });
  $("#guiaAtras").addEventListener("click", () => mostrarPaso(guiaPaso - 1));
  $("#guiaSaltar").addEventListener("click", () => cerrarGuia(null));
  $("#guiaExplorar").addEventListener("click", () => cerrarGuia(null));
  $("#camAyuda").addEventListener("click", () => {
    if (estado !== "jugando") empezar("normal");
    abrirGuia(false);
  });
  $("#tema").addEventListener("click", alternarTema);
  // En pantallas táctiles no hay hover: el asa abre y cierra la columna.
  $("#camAsa").addEventListener("click", () => {
    const abierta = $("#camara").classList.toggle("abierta");
    $("#camAsa").setAttribute("aria-expanded", String(abierta));
  });
  // La primera vez que se juega, Charmy explica antes de que corra el reloj.
  // El listener del juego se registra después: se espera a que la partida arranque.
  $("#jugar").addEventListener("click", () => setTimeout(() => { if (!guiaVista()) abrirGuia(false); }, 0));
  window.addEventListener("resize", () => { if (guiaAbierta) colocarGuia(); });
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (guiaAbierta) {
      if (e.key === "Tab") return;
      e.stopImmediatePropagation();
      if (e.key === "ArrowRight") { if (!PASOS[guiaPaso].final) mostrarPaso(guiaPaso + 1); }
      else if (e.key === "ArrowLeft") mostrarPaso(guiaPaso - 1);
      else if (e.key === "Escape") cerrarGuia(null);
      return;
    }
    if (enPausa) {
      if (e.key === "Tab" || e.key === "Enter" || e.key === " ") return;
      e.stopImmediatePropagation();
      if (e.key === "Escape" || e.key === "p" || e.key === "P") seguir();
      return;
    }
    if ((e.key === "p" || e.key === "P" || e.key === "Escape") && estado === "jugando" && modo !== "explorador") { e.stopImmediatePropagation(); pausar(); return; }
    if (e.key === "t" || e.key === "T") { e.stopImmediatePropagation(); alternarTema(); }
  }, true);
  aplicarTema(temaActual);
}

armarGuiaYTema();

iniciar().catch((e) => {
  console.error(e);
  const c = document.querySelector("#cargando");
  if (c) c.textContent = "No se pudo iniciar el juego: este navegador no tiene WebGL disponible.";
});
