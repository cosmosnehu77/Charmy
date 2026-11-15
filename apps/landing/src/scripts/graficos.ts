// Gráficos de las cards de la landing, armados al compilar como SVG. Son ilustrativos: ninguno usa datos reales.
// Los colores salen de las clases de landing.css (tokens de @charmy/ui).

type Punto = [number, number];
const suave = (pts: Punto[]) =>
  pts.reduce((d, [px, py], i, a) => {
    if (!i) return `M${px.toFixed(1)},${py.toFixed(1)}`;
    const [qx, qy] = a[i - 1]!, m = (px - qx) / 2;
    return `${d} C${(qx + m).toFixed(1)},${qy.toFixed(1)} ${(px - m).toFixed(1)},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
  }, "");
const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const NOMBRES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Paso 1: la serie armonizada sigue de largo y la sin armonizar salta en 2012, cuando llega VIIRS. */
export function graficoEmpalme(): string {
  const W = 600, x0 = 84, x1 = 508, yt = 64, yb = 270, A0 = 2001, A1 = 2025, CAMBIO = 2012;
  const x = (a: number) => x0 + ((a - A0) / (A1 - A0)) * (x1 - x0), y = (v: number) => yb - v * (yb - yt);
  const arm: number[] = [], cru: number[] = [];
  for (let a = A0; a <= A1; a++) {
    const v = 0.62 + 0.16 * Math.sin(a * 1.1) + 0.06 * Math.sin(a * 2.7);
    arm.push(v);
    cru.push(a < CAMBIO ? v * 0.3 + 0.02 : v);
  }
  const pts = (serie: number[], hasta = A1): Punto[] => serie.slice(0, hasta - A0 + 1).map((v, i) => [x(A0 + i), y(v)]);
  const medio = (yt + yb) / 2 - 30, cx = x(CAMBIO), cy = y(arm[CAMBIO - A0]!);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line class="eje" x1="${x0 - 5}" x2="${x0}" y1="${y(v)}" y2="${y(v)}"/>`).join("");
  let anios = "";
  for (let a = A0; a <= A1; a += 4) anios += `<line class="eje" x1="${x(a)}" x2="${x(a)}" y1="${yb}" y2="${yb + 5}"/><text x="${x(a)}" y="${yb + 20}" text-anchor="middle">${a}</text>`;
  const hitos = ([[CAMBIO, "LLEGA VIIRS"], [2018, "NOAA-20"], [2023, "NOAA-21"]] as const)
    .map(([a, t]) => `<g class="pin"><line x1="${x(a)}" x2="${x(a)}" y1="40" y2="${yb}"/><circle cx="${x(a)}" cy="36" r="3.5"/><text x="${x(a)}" y="24">${t}</text></g>`).join("");
  const nodo = (nx: number, ny: number, t: string, hx: number) =>
    `<g class="nodo"><line class="eje" x1="${nx}" x2="${hx}" y1="${ny}" y2="${ny}"/><circle cx="${nx}" cy="${ny}" r="26"/><text x="${nx}" y="${ny + 4}">${t}</text></g>`;
  return `<svg viewBox="0 0 ${W} 322" role="img" aria-label="Serie armonizada continua y serie sin armonizar, que salta en 2012 cuando llega VIIRS. Ilustrativo.">
<defs><pattern id="rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="raya" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>
<line class="eje d" x1="${x0}" x2="${x0}" y1="${yt - 8}" y2="${yb}"/><line class="eje" x1="${x0}" x2="${x1}" y1="${yb}" y2="${yb}"/>${marcas}${anios}
<text x="${x0 - 12}" y="${medio}" text-anchor="middle" transform="rotate(-90 ${x0 - 12} ${medio})">DÍAS CON FUEGO</text>${hitos}
<path class="dif" d="${suave(pts(arm, CAMBIO))}${suave(pts(cru, CAMBIO).reverse()).replace("M", "L")}Z"/>
<path class="cru" d="${suave(pts(cru))}"/><path class="arm" d="${suave(pts(arm))}"/>
${nodo(34, y(cru[0]!), "MODIS", x0)}${nodo(W - 34, y(arm.at(-1)!), "VIIRS", x1)}
<line class="cur" x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}"/><line class="cur" x1="${cx}" x2="${cx}" y1="${yt - 8}" y2="${yb}"/>
<rect class="rombo" width="10" height="10" x="${cx - 5}" y="${cy - 5}" transform="rotate(45 ${cx} ${cy})"/>
<text class="ilus" x="${(x0 + x1) / 2}" y="${yb + 44}" text-anchor="middle">ILUSTRATIVO</text></svg>`;
}

/** Card «Tu provincia»: lo normal de los doce meses y este año hasta marzo. */
export function curvaNovato(): string {
  const normal = [7, 8, 6, 3, 1, 0, 0, 0, 1, 2, 4, 6], anio = [9, 12, 14], W = 440, top = 8, base = 86, max = 16;
  const x = (i: number) => 8 + (i * (W - 16)) / 11, y = (v: number) => base - (v / max) * (base - top);
  const pn: Punto[] = normal.map((v, i) => [x(i), y(v)]);
  const meses = MESES.map((m, i) => `<text x="${x(i).toFixed(1)}" y="104" text-anchor="middle"${i === 2 ? ' class="hoy"' : ""}>${m}</text>`).join("");
  return `<svg class="curva" viewBox="0 0 ${W} 110" aria-hidden="true">
<path class="banda" d="${suave(pn)} L${x(11)},${base} L${x(0)},${base} Z"/><path class="normal" d="${suave(pn)}"/>
<line class="guia-mes" x1="${x(2)}" x2="${x(2)}" y1="0" y2="${base}"/><path class="anio" pathLength="1" d="${suave(anio.map((v, i) => [x(i), y(v)]))}"/>
<circle class="p-normal" cx="${x(2)}" cy="${y(normal[2]!)}" r="4"/><circle class="punto" cx="${x(2)}" cy="${y(anio[2]!)}" r="5"/>${meses}</svg>`;
}

/** Modo experto: días con fuego por mes de una celda, con la rampa de conteo (apta para daltonismo). */
export function barrasExperto(): string {
  const dias = [4, 6, 3, 2, 0, 0, 0, 0, 1, 3, 5, 6], W = 520, top = 6, base = 144, max = 8, ancho = (W - 26) / 12;
  const rampa = (v: number) => (v === 0 ? "var(--l-linea)" : `var(--rampa-conteo-${Math.min(7, 2 + Math.ceil(v / 1.5))})`);
  const grilla = [0, 2, 4, 6, 8].map((v) => { const yy = base - (v / max) * (base - top); return `<line class="grilla" x1="26" x2="${W}" y1="${yy}" y2="${yy}"/><text x="0" y="${yy + 3.5}">${v}</text>`; }).join("");
  const barras = dias.map((v, i) => {
    const h = Math.max(2, (v / max) * (base - top)), bx = 26 + i * ancho + ancho * 0.18;
    return `<rect class="b" style="--i:${i}" x="${bx.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(ancho * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${rampa(v)}"><title>${NOMBRES[i]} 2019 · ${v} ${v === 1 ? "día" : "días"}</title></rect><text x="${(bx + ancho * 0.32).toFixed(1)}" y="162" text-anchor="middle">${MESES[i]}</text>`;
  }).join("");
  return `<svg id="barras" viewBox="0 0 ${W} 170" role="img" aria-label="Días con fuego por mes en 2019, muestra">${grilla}${barras}</svg>`;
}
