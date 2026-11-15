// Genera las imágenes de Charmy que muestra el README, con el componente (charmySvg): no se dibujan a mano.
// GitHub no puede montar el componente, así que el README necesita archivos. Si cambia el dibujo, se regeneran:
//   pnpm --filter @charmy/charmy build && node docs/charmy/generar.mjs
import { writeFileSync } from "node:fs";
import { charmySvg } from "../../packages/charmy/dist/core.js";

// Cada vestuario con el estado con que aparece en el producto (ver .claude/skills/charmy), y los seis estados.
const vestuarios = [
  ["base", "saluda"],
  ["guia", "explica"],
  ["cientifica", "explica"],
  ["bombero", "alerta"],
  ["piloto", "festeja"],
];
const estados = ["idle", "saluda", "explica", "alerta", "festeja", "pensando"].map((m) => ["base", m]);

const aviso = "<!-- Generado por docs/charmy/generar.mjs con charmySvg de @charmy/charmy. No se edita a mano. -->\n";
const hechos = new Set();
for (const [outfit, mood] of [...vestuarios, ...estados]) {
  const nombre = `${outfit}-${mood}.svg`;
  if (hechos.has(nombre)) continue;
  hechos.add(nombre);
  // Sin animación: en un <img> de GitHub no corre, y así el archivo no depende de CSS de afuera.
  writeFileSync(new URL(nombre, import.meta.url), aviso + charmySvg({ outfit, mood, size: 160, animate: false }) + "\n");
}
console.log([...hechos].join("\n"));
