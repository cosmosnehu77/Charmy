import { charmySvg } from "@charmy/charmy/core";

/** La cabeza de Charmy como ícono de la pestaña (F4-D15). Sale del componente: no se copia el SVG. */
export function iconoCharmy(): string {
  const svg = charmySvg({ variant: "cabeza", size: 32, animate: false, decorative: true });
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Pone a Charmy en el ícono de la página; el de `index.html` queda solo hasta que carga la app. */
export function ponerIcono(doc: Document): void {
  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = doc.createElement("link");
    link.rel = "icon";
    doc.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = iconoCharmy();
}
