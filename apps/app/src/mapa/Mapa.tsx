import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
// MapLibre v6 pide la URL de su worker cuando se usa con un empaquetador (guía de instalación, Vite).
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { useEffect, useRef, useState } from "react";
import { bboxDeArea, type Poligono } from "@/consulta/consulta";
import { useFocos } from "@/consulta/useFocos";
import { useApp } from "@/estado/app";
import { useConsulta } from "@/estado/consulta";
import { atributosFoco } from "@/experto/atributos";
import { useFocosVivo } from "@/vivo/consultas";
import { useVivo } from "@/vivo/estado";
import { useContexto } from "@/contexto/estado";
import { agregarCapas, datosArea, ponerImagen } from "./capas";
import { esFallaDelEstilo, LIMITES_MVP, perfiles, transformarEstilo } from "./perfiles";

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

/** Terra Draw dibuja sus propias capas: se crea de nuevo después de cada cambio de estilo. */
function crearDibujo(m: maplibregl.Map) {
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

export default function Mapa() {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const dibujo = useRef<TerraDraw | null>(null);
  const perfil = useApp((s) => s.perfilMapa);
  const area = useConsulta((s) => s.area);
  const dibujando = useConsulta((s) => s.dibujando);
  const { focos } = useFocos();
  const vivoVisible = useVivo((s) => s.visible);
  const { data: vivoDatos } = useFocosVivo();
  const vivo = vivoVisible ? (vivoDatos ?? null) : null;
  const capaImagen = useContexto((s) => s.capa);
  const [falla, setFalla] = useState(false);

  // Lo último que hay que dibujar, para volver a agregarlo después de un cambio de estilo.
  const datos = useRef({ area, focos, vivo, capaImagen });
  datos.current = { area, focos, vivo, capaImagen };

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
      if (esFallaDelEstilo(e.error, perfiles[useApp.getState().perfilMapa].estilo)) setFalla(true);
    });
    m.on("style.load", () => {
      setFalla(false);
      agregarCapas(m, datos.current.area, datos.current.focos, datos.current.vivo);
      ponerImagen(m, datos.current.capaImagen);
      // Terra Draw ya se detuvo antes de setStyle (ver el efecto del perfil): acá se crea uno nuevo.
      dibujo.current = crearDibujo(m);
      const modo = useConsulta.getState().dibujando;
      if (modo) dibujo.current.setMode(modo);
    });
    // Modo experto: tocar un foco muestra sus atributos originales (RF-MOD-02).
    m.on("click", "focos", (e) => {
      const foco = e.features?.[0];
      if (!foco || useApp.getState().modo !== "experto") return;
      const lista = document.createElement("dl");
      lista.className = "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs";
      for (const [nombre, valor] of atributosFoco(foco.properties as Parameters<typeof atributosFoco>[0])) {
        const dt = document.createElement("dt");
        dt.className = "text-tinta-suave";
        dt.textContent = nombre;
        const dd = document.createElement("dd");
        dd.textContent = valor;
        lista.append(dt, dd);
      }
      new maplibregl.Popup({ maxWidth: "320px" }).setLngLat(e.lngLat).setDOMContent(lista).addTo(m);
    });
    // Tocar un foco reciente lo elige en el panel «En vivo» para ver su evidencia.
    m.on("click", "vivo", (e) => {
      const id = e.features?.[0]?.properties?.id ?? e.features?.[0]?.id;
      if (id !== undefined) useVivo.getState().cambiar({ seleccionado: String(id) });
    });
    m.on("mouseenter", "vivo", () => {
      m.getCanvas().style.cursor = "pointer";
    });
    m.on("mouseleave", "vivo", () => {
      m.getCanvas().style.cursor = "";
    });
    m.on("mouseenter", "focos", () => {
      if (useApp.getState().modo === "experto") m.getCanvas().style.cursor = "pointer";
    });
    m.on("mouseleave", "focos", () => {
      m.getCanvas().style.cursor = "";
    });
    mapa.current = m;
    return () => {
      dibujo.current?.stop();
      dibujo.current = null;
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Aplicar el perfil: estilo, relieve e inclinación.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const config = perfiles[perfil];
    // Terra Draw se detiene antes de cambiar el estilo, mientras sus fuentes existen. Si se detiene después,
    // su limpieza falla (las fuentes ya no están), corta el style.load y el dibujo queda inactivo.
    dibujo.current?.stop();
    dibujo.current = null;
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

  // Área: dibujarla y encuadrarla.
  useEffect(() => {
    const m = mapa.current;
    const fuente = m?.getSource<maplibregl.GeoJSONSource>("area");
    fuente?.setData(datosArea(area));
    if (m && area) {
      const [o, s, e, n] = bboxDeArea(area);
      m.fitBounds([o, s, e, n], { padding: 48, duration: 800, maxZoom: 11 });
    }
  }, [area]);

  // Focos filtrados.
  useEffect(() => {
    mapa.current
      ?.getSource<maplibregl.GeoJSONSource>("focos")
      ?.setData(focos ?? { type: "FeatureCollection", features: [] });
  }, [focos]);

  // Focos en vivo.
  useEffect(() => {
    mapa.current
      ?.getSource<maplibregl.GeoJSONSource>("vivo")
      ?.setData(vivo ?? { type: "FeatureCollection", features: [] });
  }, [vivo]);

  // Imagen satelital como capa.
  useEffect(() => {
    const m = mapa.current;
    if (!m?.getSource("area")) return; // si el estilo está cargando, la pone el style.load
    ponerImagen(m, capaImagen);
    if (capaImagen) {
      const [o, s, e, n] = capaImagen.bbox;
      m.fitBounds([o, s, e, n], { padding: 48, duration: 800 });
    }
  }, [capaImagen]);

  // Herramienta de dibujo.
  useEffect(() => {
    const d = dibujo.current;
    if (!d?.enabled) return;
    d.setMode(dibujando ?? "static");
  }, [dibujando]);

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
