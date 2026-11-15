import type * as maplibregl from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Poligono } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";

/**
 * Rectángulo y polígono con Terra Draw: al cerrar la figura queda como área de la consulta.
 * Terra Draw dibuja sus propias capas: se crea de nuevo después de cada cambio de estilo.
 */
export function crearDibujo(m: maplibregl.Map) {
  const dibujo = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
    modes: [new TerraDrawRectangleMode(), new TerraDrawPolygonMode()],
  });
  dibujo.start();
  dibujo.on("finish", (id, contexto) => {
    if (contexto.action !== "draw") return;
    const figura = dibujo.getSnapshot().find((f) => f.id === id);
    dibujo.clear();
    if (figura?.geometry.type === "Polygon") {
      useConsulta.getState().cambiar({ area: figura.geometry as Poligono, dibujando: null });
    }
  });
  return dibujo;
}
