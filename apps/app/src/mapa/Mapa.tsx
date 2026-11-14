import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
// MapLibre v6 pide la URL de su worker cuando se usa con un empaquetador (guía de instalación, Vite).
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/estado/app";
import { LIMITES_MVP, perfiles, transformarEstilo } from "./perfiles";

maplibregl.setWorkerUrl(urlWorker);

/** Textos de los controles de MapLibre en español. */
const locale = {
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar al norte",
  "AttributionControl.ToggleAttribution": "Ver créditos del mapa",
  "ScaleControl.Kilometers": "km",
  "ScaleControl.Meters": "m",
  "FullscreenControl.Enter": "Pantalla completa",
  "FullscreenControl.Exit": "Salir de pantalla completa",
};

export default function Mapa() {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const perfil = useApp((s) => s.perfilMapa);
  const [falla, setFalla] = useState(false);

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current) return;
    const inicial = perfiles[useApp.getState().perfilMapa];
    const m = new maplibregl.Map({
      container: contenedor.current,
      bounds: LIMITES_MVP,
      fitBoundsOptions: { padding: 24 },
      pitch: inicial.inclinacion,
      maxPitch: inicial.inclinacionMax,
      attributionControl: { compact: true },
      locale,
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    m.on("error", (e: maplibregl.ErrorEvent) => {
      // Si el estilo base no carga, se avisa; los errores de una tesela suelta no tapan el mapa.
      if (!m.isStyleLoaded() && !("tile" in e)) setFalla(true);
    });
    m.on("style.load", () => setFalla(false));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Aplicar el perfil: estilo, relieve e inclinación.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const config = perfiles[perfil];
    m.setStyle(config.estilo, { diff: false, transformStyle: transformarEstilo(perfil) });
    m.setMaxPitch(config.inclinacionMax);
    m.easeTo({ pitch: config.inclinacion, bearing: config.relieve ? m.getBearing() : 0, duration: 600 });
    if (config.relieve) {
      m.dragRotate.enable();
      m.touchZoomRotate.enableRotation();
    } else {
      m.dragRotate.disable();
      m.touchZoomRotate.disableRotation();
    }
  }, [perfil]);

  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="h-full w-full" />
      {falla && (
        <div role="alert" className="absolute inset-x-4 top-4 rounded-tarjeta border bg-card p-3 text-sm shadow-tarjeta">
          El mapa base no está disponible ahora. El resto de la app sigue funcionando.
        </div>
      )}
    </div>
  );
}
