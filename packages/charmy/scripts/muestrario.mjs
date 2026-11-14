// Arma dist/muestrario.html con todos los estados y vestuarios, para revisar el dibujo a ojo.
// Uso: pnpm --filter @charmy/charmy build && pnpm --filter @charmy/charmy muestrario
import { writeFileSync } from "node:fs";
import { CHARMY_CSS, MOODS, OUTFITS, charmyHtml, charmySvg } from "../dist/core.js";

const celdas = OUTFITS.map(
  (o) =>
    `<tr><th>${o}</th>${MOODS.map((m) => `<td>${charmySvg({ mood: m, outfit: o, size: 140 })}</td>`).join("")}</tr>`,
).join("\n");
const chicos = [96, 64, 48, 32, 24].map((s) => charmySvg({ mood: "saluda", outfit: "bombero", size: s })).join(" ");
writeFileSync(
  new URL("../dist/muestrario.html", import.meta.url),
  `<!doctype html><meta charset="utf-8"><title>Muestrario de Charmy</title>
<style>body{font-family:system-ui;background:#EEF2F4;color:#1B2430;margin:16px}td,th{padding:4px;text-align:center}
.fila{display:flex;flex-wrap:wrap;gap:24px;align-items:center}${CHARMY_CSS}</style>
<h1>Animados y con globo</h1>
<div class="fila">
${charmyHtml({ mood: "saluda", outfit: "base", size: 160, say: "¡Hola! Soy Charmy." })}
${charmyHtml({ mood: "explica", outfit: "guia", size: 160, say: "Elegí un área en el mapa para empezar.", sayPosition: "arriba" })}
${charmyHtml({ mood: "alerta", outfit: "bombero", size: 160, say: "Este mes hay más focos que lo normal en tu zona. Si ves fuego, llamá al 100." })}
${charmyHtml({ mood: "explica", outfit: "cientifica", size: 120 })}
</div>
<h1>Charmy: estados × vestuarios</h1>
<table><tr><th></th>${MOODS.map((m) => `<th>${m}</th>`).join("")}</tr>${celdas}</table>
<h2>Tamaños (por debajo de 40 px, solo la cabeza)</h2><p>${chicos}</p>`,
);
console.log("dist/muestrario.html");
