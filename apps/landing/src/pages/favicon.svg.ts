// Favicon generado al compilar desde el componente: la cabeza de Charmy sin fondo (nunca un SVG copiado).
import { charmySvg } from "@charmy/charmy/core";

export const GET = () =>
  new Response(charmySvg({ mood: "idle", size: 64, variant: "cabeza", animate: false, decorative: true }), {
    headers: { "content-type": "image/svg+xml" },
  });
