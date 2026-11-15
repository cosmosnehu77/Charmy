import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import bbox from "@turf/bbox";
import { interfaz, paleta, rampaConteo, relieve } from "@charmy/ui";
import { useEffect, useRef } from "react";
import type { TerraDraw } from "terra-draw";
import { bboxDeArea } from "@/consulta/consulta";
import { useFocos } from "@/consulta/useFocos";
import { useContexto } from "@/contexto/estado";
import { useConsulta } from "@/estado/consulta";
import { datosArea, ponerImagen } from "@/mapa/capas";
import { crearDibujo } from "@/mapa/dibujo";
import { LIMITES_MVP, nombresEnEspanol } from "@/mapa/perfiles";
import { controlMapa } from "./controlMapa";
import type { FocoReciente } from "./datos";
import { indicadorDe, useRelieve } from "./estado";
import { t, useIdioma } from "./idioma";
import {
  AGRUPAR_VIVO,
  AGRUPAR_ZONA,
  alturaDelDia,
  capaRegiones,
  capasRegionesVisibles,
  CORTES_FOCO,
  escalaRegion,
  estiloGrupo,
  focosVivoVisibles,
  maximo,
  nombresPorZoom,
  type RegionResumen,
  valorIndicador,
} from "./logica";

maplibregl.setWorkerUrl(urlWorker);

/** Mapa base oscuro y claro de OpenFreeMap (sin clave): ciudades, rutas y calles debajo de las regiones. */
export const ESTILO_OSCURO = "https://tiles.openfreemap.org/styles/dark";
export const ESTILO_CLARO = "https://tiles.openfreemap.org/styles/positron";
const VACIO = { type: "FeatureCollection" as const, features: [] };
/** Metros de alto de una región con altura 1 (la de más fuego). */
const ALTO_MAX = 380_000;
const reducido = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const RADIO_FOCO: maplibregl.ExpressionSpecification = ["+", 3, ["*", 1.6, ["sqrt", ["max", 0, ["get", "frp"]]]]];
const COLOR_FOCO: maplibregl.ExpressionSpecification = [
  "step",
  ["get", "frp"],
  rampaConteo[1],
  CORTES_FOCO[0],
  rampaConteo[2],
  CORTES_FOCO[1],
  rampaConteo[3],
  CORTES_FOCO[2],
  rampaConteo[4],
  CORTES_FOCO[3],
  rampaConteo[5],
  CORTES_FOCO[4],
  rampaConteo[6],
];
/** Los grupos de En vivo (#333) y de Experto (#343) llevan `point_count`; los focos sueltos, no. */
const SUELTO: maplibregl.ExpressionSpecification = ["!", ["has", "point_count"]];
/** Cada grupo guarda el `frp` de su foco más intenso, así toma el mismo color que tendría ese foco. */
const FRP_DEL_GRUPO = { frp: ["max", ["coalesce", ["get", "frp"], 0]] } as const;

/** Acerca hasta que el grupo se abre: al menos un nivel, porque los grupos se arman por zoom entero. */
function abrirGrupo(m: maplibregl.Map, fuente: string, id: number, centro: [number, number]) {
  void m
    .getSource<maplibregl.GeoJSONSource>(fuente)
    ?.getClusterExpansionZoom(id)
    .then((zoom) => m.easeTo({ center: centro, zoom: Math.max(zoom, m.getZoom() + 1), duration: reducido() ? 0 : 600 }));
}

/**
 * Grupos de focos como marcadores HTML (#343): así llevan la tipografía de la marca, un halo translúcido y laten con
 * CSS. No se despliegan en telaraña: tocarlos solo acerca. Devuelve la función que los pone al día.
 */
function marcadoresDeGrupo(m: maplibregl.Map, fuente: string) {
  const puestos = new Map<number, maplibregl.Marker>();
  return () => {
    const vistos = new Set<number>();
    if (m.getSource(fuente) && m.isSourceLoaded(fuente)) {
      for (const f of m.querySourceFeatures(fuente, { filter: ["has", "point_count"] })) {
        const id = Number(f.properties?.cluster_id);
        if (vistos.has(id)) continue;
        vistos.add(id);
        if (puestos.has(id)) continue;
        const centro = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const cantidad = Number(f.properties?.point_count);
        const { diametro, color, late, texto } = estiloGrupo(cantidad, Number(f.properties?.frp));
        const el = document.createElement("button");
        el.type = "button";
        el.className = late ? "grupo-focos grupo-focos-late" : "grupo-focos";
        el.style.setProperty("--grupo-color", color);
        el.style.setProperty("--grupo-d", `${diametro}px`);
        el.textContent = texto;
        el.setAttribute("aria-label", t(`${texto} focos juntos. Tocá para acercar.`, `${texto} hotspots together. Tap to zoom in.`));
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          abrirGrupo(m, fuente, id, centro);
        });
        puestos.set(id, new maplibregl.Marker({ element: el }).setLngLat(centro).addTo(m));
      }
    }
    for (const [id, marcador] of puestos) {
      if (!vistos.has(id)) {
        marcador.remove();
        puestos.delete(id);
      }
    }
  };
}

function mezcla(a: string, b: string, t: number): string {
  const x = Number.parseInt(a.slice(1), 16);
  const y = Number.parseInt(b.slice(1), 16);
  const canal = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `#${((canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).padStart(6, "0")}`;
}

/** Una aguja por foco: un cuadradito que se extruye sobre la tapa de su región. */
function agujas(focos: FocoReciente[], base: (region: string | null) => number) {
  const lado = 0.05;
  return {
    type: "FeatureCollection" as const,
    features: focos.map((f) => {
      const dx = lado / Math.cos((f.lat * Math.PI) / 180);
      const b = base(f.region) + 400;
      return {
        type: "Feature" as const,
        properties: { k: f.k, region: f.region, dia: f.dia, b, t: b + (0.25 + 0.22 * Math.log1p(f.frp)) * 90_000 },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [f.lon - dx, f.lat - lado],
              [f.lon + dx, f.lat - lado],
              [f.lon + dx, f.lat + lado],
              [f.lon - dx, f.lat + lado],
              [f.lon - dx, f.lat - lado],
            ],
          ],
        },
      };
    }),
  };
}

function puntos(focos: FocoReciente[]) {
  return {
    type: "FeatureCollection" as const,
    features: focos.map((f) => ({
      type: "Feature" as const,
      properties: { k: f.k, frp: f.frp, t: f.t, dia: f.dia, region: f.region, orden: -f.frp },
      geometry: { type: "Point" as const, coordinates: [f.lon, f.lat] },
    })),
  };
}

interface Props {
  regiones: RegionResumen[];
  dias: string[];
  focos: FocoReciente[];
  onHover: (h: { id: string | null; foco: number | null; x: number; y: number }) => void;
}

export default function MapaRelieve({ regiones, dias, focos, onHover }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const tema = useIdioma((s) => s.tema);
  const temaActual = useRef(tema);
  const estado = useRelieve();
  // Tu zona (#262): el área, sus focos, la herramienta de dibujo y la imagen satelital del contexto.
  const area = useConsulta((s) => s.area);
  const dibujando = useConsulta((s) => s.dibujando);
  const { focos: focosZona } = useFocos();
  const capaImagen = useContexto((s) => s.capa);
  const dibujo = useRef<TerraDraw | null>(null);
  const props = useRef({ regiones, dias, focos, onHover, estado, area, focosZona });
  props.current = { regiones, dias, focos, onHover, estado, area, focosZona };
  // Altura actual (animada) y destino de cada región, en metros.
  const alturas = useRef(new Map<string, { actual: number; meta: number }>());
  const pausaGiro = useRef(0);
  const regionesPuestas = useRef<RegionResumen[] | null>(null);
  const vivoPuesto = useRef<unknown[]>([]);
  const zonaPuesta = useRef<unknown>(null);

  const sincronizar = useRef(() => {});
  sincronizar.current = () => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    const { regiones: rs, focos: fs, estado: e, area: a, focosZona: fz } = props.current;
    const vivo = e.pestana === "vivo";
    const zona = e.pestana === "zona";
    // En En vivo y en Tu zona las regiones quedan grises y planas: lo que importa son los puntos.
    const apagado = vivo || zona;
    const indicador = indicadorDe(e.pestana);
    const max = maximo(rs, indicador);
    if (regionesPuestas.current !== rs) {
      m.getSource<maplibregl.GeoJSONSource>("regiones")?.setData({ type: "FeatureCollection", features: rs as never });
      regionesPuestas.current = rs;
    }
    for (const r of rs) {
      const { color, altura } = escalaRegion(valorIndicador(r.properties, indicador), max, indicador, r.properties);
      let meta = altura;
      let tono = color;
      if (e.seleccion && r.id !== e.seleccion) {
        meta = 0;
        tono = relieve.apagada;
      } else if (e.seleccion === r.id) {
        tono = mezcla(color, paleta.hocico, 0.3);
        if (e.linea.activa && r.properties.by_day) meta = alturaDelDia(altura, r.properties.by_day, e.linea.dia);
      }
      const metros = e.plano ? 1500 : 3000 + meta * ALTO_MAX;
      const a = alturas.current.get(r.id) ?? { actual: 3000, meta: 3000 };
      a.meta = metros;
      if (reducido()) a.actual = metros;
      alturas.current.set(r.id, a);
      m.setFeatureState({ source: "regiones", id: r.id }, { c: tono, h: a.actual });
    }
    // Con una provincia elegida, las regiones van opacas: las rutas y límites del mapa base no se mezclan (#251).
    const opacidadReg = e.seleccion ? 1 : 0.92;
    m.setPaintProperty("reg-2d", "fill-opacity", opacidadReg);
    m.setPaintProperty("reg-3d", "fill-extrusion-opacity", opacidadReg);
    // Focos: en el relieve, con el indicador Focos o con una región elegida; con la línea, solo ese día.
    const dia = props.current.dias[e.linea.dia];
    const visibles = fs.filter((f) => {
      if (e.seleccion && f.region !== e.seleccion) return false;
      if (e.linea.activa && f.dia !== dia) return false;
      return true;
    });
    const verFocos = !apagado && (indicador === "focos" || e.seleccion !== null);
    m.getSource<maplibregl.GeoJSONSource>("agujas")?.setData(
      verFocos ? agujas(visibles, (region) => (region ? (alturas.current.get(region)?.meta ?? 0) : 0)) : VACIO,
    );
    m.getSource<maplibregl.GeoJSONSource>("puntos")?.setData(verFocos ? puntos(visibles) : VACIO);
    // La ventana de horas y los niveles van en los datos y no en las capas: así los grupos cuentan solo lo que se ve.
    // Se mandan solo si cambian: el puntero vuelve a pintar en cada movimiento y rearmar los grupos cada vez es caro.
    const claveVivo = vivo ? [fs, e.horasVivo, e.nivelesVivo] : [];
    if (claveVivo.length !== vivoPuesto.current.length || claveVivo.some((x, i) => x !== vivoPuesto.current[i])) {
      const enVivo = vivo ? puntos(focosVivoVisibles(fs, e.horasVivo, e.nivelesVivo)) : VACIO;
      m.getSource<maplibregl.GeoJSONSource>("vivo")?.setData(enVivo);
      vivoPuesto.current = claveVivo;
    }
    m.getSource<maplibregl.GeoJSONSource>("zona-area")?.setData(zona ? datosArea(a) : VACIO);
    // Como En vivo: los focos del área se mandan solo si cambian, para no rearmar los grupos en cada movimiento.
    const datosZona = zona && fz ? fz : VACIO;
    if (zonaPuesta.current !== datosZona) {
      m.getSource<maplibregl.GeoJSONSource>("zona-focos")?.setData(datosZona);
      zonaPuesta.current = datosZona;
    }
    const capasReg = capasRegionesVisibles(e.plano, apagado);
    const visible = (id: string, si: boolean) => m.setLayoutProperty(id, "visibility", si ? "visible" : "none");
    visible("reg-2d", capasReg.reg2d);
    visible("reg-3d", capasReg.reg3d);
    visible("reg-borde-halo", capasReg.regBorde);
    visible("reg-borde", capasReg.regBorde);
    visible("reg-agujas", !apagado && !e.plano);
    visible("reg-puntos", !apagado && e.plano);
    visible("vivo-gris", capasReg.vivoGris);
    visible("vivo-pulso", vivo);
    visible("vivo-focos", vivo);
    visible("vivo-sel", vivo);
    visible("zona-focos", zona);
    // Laten los focos sueltos de las últimas 6 h, contadas desde el último foco.
    const ultimo = fs.reduce((max, f) => Math.max(max, f.t), 0) || Date.now();
    m.setFilter("vivo-pulso", ["all", SUELTO, [">=", ["get", "t"], ultimo - 6 * 3_600_000]]);
    m.setFilter("vivo-sel", ["==", ["get", "k"], e.focoVivo ?? -1]);
  };

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      bounds: LIMITES_MVP,
      fitBoundsOptions: { padding: 40 },
      pitch: 55,
      bearing: -12,
      maxPitch: 70,
      attributionControl: { compact: true },
    });
    mapa.current = m;
    // El estilo se pone después del constructor porque solo `setStyle` acepta `transformStyle`: nombres en español,
    // y que aparezcan de a poco al acercar.
    m.setStyle(temaActual.current === "claro" ? ESTILO_CLARO : ESTILO_OSCURO, {
      transformStyle: (_anterior, siguiente) => nombresPorZoom(nombresEnEspanol(siguiente)),
    });
    m.on("style.load", () => {
      // Las regiones van encima de todas las líneas y rellenos del mapa base (rutas, vías, límites) y debajo solo de
      // los nombres de lugares. Antes iban antes del primer nombre (`water_name`), que está antes que las rutas:
      // las rutas y los límites se dibujaban sobre la provincia elegida (#251).
      const capas = m.getStyle().layers;
      const ultimaBase = capas.length - 1 - [...capas].reverse().findIndex((l) => l.type !== "symbol");
      const antes = capas[ultimaBase + 1]?.id;
      m.addSource("regiones", { type: "geojson", data: VACIO, promoteId: "region" });
      m.addSource("agujas", { type: "geojson", data: VACIO });
      m.addSource("puntos", { type: "geojson", data: VACIO });
      // En vivo (#333) y Experto (#343) agrupan los focos cercanos y los separan al acercar.
      m.addSource("vivo", { type: "geojson", data: VACIO, cluster: true, ...AGRUPAR_VIVO, clusterProperties: FRP_DEL_GRUPO });
      m.addSource("zona-area", { type: "geojson", data: VACIO });
      m.addSource("zona-focos", {
        type: "geojson",
        data: VACIO,
        cluster: true,
        ...AGRUPAR_ZONA,
        clusterProperties: FRP_DEL_GRUPO,
      });
      m.addLayer(
        { id: "vivo-gris", type: "fill", source: "regiones", paint: { "fill-color": relieve.gris, "fill-opacity": 0.55 } },
        antes,
      );
      m.addLayer(
        {
          id: "reg-2d",
          type: "fill",
          source: "regiones",
          paint: {
            "fill-color": ["coalesce", ["feature-state", "c"], relieve.sinDato],
            "fill-opacity": 0.92,
          },
        },
        antes,
      );
      // En 2D las divisiones van encima de `vivo-gris` y `reg-2d` (antes iban debajo de `reg-3d` y se tapaban).
      // Halo oscuro + trazo claro para que se lean sobre fondos oscuros (sin dato, apagada, En vivo) y rampas claras.
      m.addLayer(
        {
          id: "reg-borde-halo",
          type: "line",
          source: "regiones",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": relieve.vidrio,
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.8, 7, 2.8],
            "line-opacity": 0.55,
          },
        },
        antes,
      );
      m.addLayer(
        {
          id: "reg-borde",
          type: "line",
          source: "regiones",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#dce3ec",
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.85, 7, 1.3],
            "line-opacity": 0.72,
          },
        },
        antes,
      );
      m.addLayer(
        {
          id: "reg-3d",
          type: "fill-extrusion",
          source: "regiones",
          paint: {
            "fill-extrusion-color": ["coalesce", ["feature-state", "c"], relieve.sinDato],
            "fill-extrusion-height": ["coalesce", ["feature-state", "h"], 3000],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.92,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        antes,
      );
      m.addLayer({
        id: "reg-agujas",
        type: "fill-extrusion",
        source: "agujas",
        paint: {
          "fill-extrusion-color": relieve.brillo,
          "fill-extrusion-base": ["get", "b"],
          "fill-extrusion-height": ["get", "t"],
          "fill-extrusion-opacity": 0.95,
        },
      });
      m.addLayer({
        id: "reg-puntos",
        type: "circle",
        source: "puntos",
        paint: {
          "circle-radius": RADIO_FOCO,
          "circle-color": COLOR_FOCO,
          "circle-opacity": 0.9,
          "circle-stroke-color": relieve.vidrio,
          "circle-stroke-width": 1,
        },
      });
      m.addLayer({
        id: "vivo-pulso",
        type: "circle",
        source: "vivo",
        paint: {
          "circle-radius": RADIO_FOCO,
          "circle-opacity": 0,
          "circle-stroke-color": COLOR_FOCO,
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0,
        },
      });
      m.addLayer({
        id: "vivo-focos",
        type: "circle",
        source: "vivo",
        filter: SUELTO,
        layout: { "circle-sort-key": ["get", "orden"] },
        paint: {
          "circle-radius": RADIO_FOCO,
          "circle-color": COLOR_FOCO,
          "circle-opacity": 0.88,
          "circle-stroke-color": relieve.vidrio,
          "circle-stroke-width": 1,
        },
      });
      m.addLayer({
        id: "vivo-sel",
        type: "circle",
        source: "vivo",
        filter: ["==", ["get", "k"], -1],
        paint: {
          "circle-radius": ["+", RADIO_FOCO, 2],
          "circle-opacity": 0,
          "circle-stroke-color": interfaz.superficie,
          "circle-stroke-width": 2,
        },
      });
      m.addLayer({
        id: "zona-relleno",
        type: "fill",
        source: "zona-area",
        paint: { "fill-color": relieve.brillo, "fill-opacity": 0.1 },
      });
      m.addLayer({
        id: "zona-borde",
        type: "line",
        source: "zona-area",
        paint: { "line-color": relieve.brillo, "line-width": 2 },
      });
      m.addLayer({
        id: "zona-focos",
        type: "circle",
        source: "zona-focos",
        filter: SUELTO,
        paint: {
          "circle-radius": RADIO_FOCO,
          "circle-color": COLOR_FOCO,
          "circle-opacity": 0.88,
          "circle-stroke-color": relieve.vidrio,
          "circle-stroke-width": 1,
        },
      });
      dibujo.current = crearDibujo(m);
      // En celular la atribución arranca plegada (ⓘ), como queda después de arrastrar el mapa: desplegada tapa los avisos.
      if ((contenedor.current?.clientWidth ?? 1000) < 768) {
        contenedor.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
      }
      listo.current = true;
      regionesPuestas.current = null;
      vivoPuesto.current = [];
      zonaPuesta.current = null;
      sincronizar.current();
      herramienta.current();
      imagen.current();
    });

    // Región bajo el puntero y toque para elegirla (tocar la elegida la deselecciona).
    m.on("mousemove", (e) => {
      if (props.current.estado.pestana === "zona") {
        // Mientras se dibuja el área, la cruz: la mano de arrastrar confundía al marcar las esquinas.
        if (useConsulta.getState().dibujando) {
          m.getCanvas().style.cursor = "crosshair";
          return;
        }
        const f = m.getLayer("zona-focos") ? m.queryRenderedFeatures(e.point, { layers: ["zona-focos"] })[0] : undefined;
        m.getCanvas().style.cursor = f ? "pointer" : "";
        return;
      }
      const vivo = props.current.estado.pestana === "vivo";
      const capa = vivo ? "vivo-focos" : capaRegiones(props.current.estado.plano);
      const f = m.getLayer(capa) ? m.queryRenderedFeatures(e.point, { layers: [capa] })[0] : undefined;
      m.getCanvas().style.cursor = f ? "pointer" : "";
      props.current.onHover({
        id: vivo ? null : ((f?.properties?.region as string | undefined) ?? null),
        foco: vivo && f ? Number(f.properties?.k) : null,
        x: e.point.x,
        y: e.point.y,
      });
    });
    m.on("mouseout", () => props.current.onHover({ id: null, foco: null, x: 0, y: 0 }));
    m.on("click", (e) => {
      // Tocar un grupo lo atiende su marcador.
      if ((e.originalEvent.target as Element | null)?.closest?.(".grupo-focos")) return;
      const { estado: est } = props.current;
      if (est.pestana === "zona") {
        // En Experto el mapa es para dibujar; si no se dibuja, tocar un foco muestra sus atributos (RF-MOD-02).
        if (useConsulta.getState().dibujando) return;
        const f = m.getLayer("zona-focos") ? m.queryRenderedFeatures(e.point, { layers: ["zona-focos"] })[0] : undefined;
        est.cambiar({
          focoZona: f ? { lon: e.lngLat.lng, lat: e.lngLat.lat, propiedades: f.properties as Record<string, unknown> } : null,
        });
        return;
      }
      if (est.pestana === "vivo") {
        const f = m.getLayer("vivo-focos") ? m.queryRenderedFeatures(e.point, { layers: ["vivo-focos"] }) : [];
        // Entre focos encimados gana el más chico, que es el que queda arriba.
        const elegido = [...f].sort((a, b) => Number(a.properties?.frp) - Number(b.properties?.frp))[0];
        est.cambiar({ focoVivo: elegido ? Number(elegido.properties?.k) : null });
        return;
      }
      const capaFoco = est.plano ? "reg-puntos" : "reg-agujas";
      const fFoco = m.getLayer(capaFoco) ? m.queryRenderedFeatures(e.point, { layers: [capaFoco] })[0] : undefined;
      if (fFoco?.properties?.k !== undefined) {
        est.cambiar({ focoVivo: Number(fFoco.properties.k) });
        return;
      }
      const capaReg = capaRegiones(est.plano);
      const f = m.getLayer(capaReg) ? m.queryRenderedFeatures(e.point, { layers: [capaReg] })[0] : undefined;
      const id = (f?.properties?.region as string | undefined) ?? null;
      if (id || est.seleccion) est.alternarRegion(id ?? est.seleccion);
    });
    // Los grupos cambian al cruzar un zoom entero o cuando llegan datos nuevos; no hace falta rehacerlos en cada cuadro.
    const grupos = [marcadoresDeGrupo(m, "vivo"), marcadoresDeGrupo(m, "zona-focos")];
    const ponerGrupos = () => {
      for (const poner of grupos) poner();
    };
    let zoomEntero = Math.floor(m.getZoom());
    m.on("zoom", () => {
      if (Math.floor(m.getZoom()) === zoomEntero) return;
      zoomEntero = Math.floor(m.getZoom());
      ponerGrupos();
    });
    m.on("moveend", ponerGrupos);
    m.on("sourcedata", (e) => {
      if ((e.sourceId === "vivo" || e.sourceId === "zona-focos") && e.isSourceLoaded) ponerGrupos();
    });
    for (const ev of ["dragstart", "zoomstart", "rotatestart", "pitchstart"] as const) {
      m.on(ev, (e: { originalEvent?: unknown }) => {
        if (e.originalEvent) pausaGiro.current = Date.now() + 6000;
      });
    }

    controlMapa.zoom = (factor) => {
      pausaGiro.current = Date.now() + 4000;
      m.easeTo({ zoom: m.getZoom() - Math.log2(factor), duration: reducido() ? 0 : 400 });
    };
    controlMapa.norte = () => {
      pausaGiro.current = Date.now() + 4000;
      m.easeTo({ bearing: 0, duration: reducido() ? 0 : 600 });
    };

    // Cada cuadro: las alturas se acercan a su destino y, si toca, el mapa gira despacio.
    let raf = 0;
    let fase = 0;
    const cuadro = (t: number) => {
      raf = requestAnimationFrame(cuadro);
      if (!listo.current) return;
      for (const [id, a] of alturas.current) {
        const d = a.meta - a.actual;
        if (Math.abs(d) > 50) {
          a.actual += d * 0.12;
          m.setFeatureState({ source: "regiones", id }, { h: a.actual });
        }
      }
      const e = props.current.estado;
      if (e.giro && !e.plano && e.pestana !== "vivo" && e.pestana !== "zona" && !e.seleccion && !reducido() && Date.now() > pausaGiro.current && !m.isMoving()) {
        m.setBearing(m.getBearing() + 0.04);
      }
      // Los focos de En vivo de las últimas 6 h laten: un anillo que crece y se apaga.
      if (e.pestana === "vivo" && !reducido()) {
        fase = (t % 1800) / 1800;
        m.setPaintProperty("vivo-pulso", "circle-radius", ["*", RADIO_FOCO, 1 + fase * 1.6]);
        m.setPaintProperty("vivo-pulso", "circle-stroke-opacity", 0.9 * (1 - fase));
      }
    };
    raf = requestAnimationFrame(cuadro);
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(contenedor.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controlMapa.zoom = () => {};
      controlMapa.norte = () => {};
      listo.current = false;
      dibujo.current?.stop();
      dibujo.current = null;
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Cualquier cambio de datos o de estado vuelve a pintar.
  useEffect(() => {
    sincronizar.current();
  });

  useEffect(() => {
    if (temaActual.current === tema) return;
    temaActual.current = tema;
    const m = mapa.current;
    if (!m) return;
    listo.current = false;
    dibujo.current?.stop();
    dibujo.current = null;
    m.setStyle(tema === "claro" ? ESTILO_CLARO : ESTILO_OSCURO, {
      transformStyle: (_anterior, siguiente) => nombresPorZoom(nombresEnEspanol(siguiente)),
    });
  }, [tema]);

  // Plano o relieve; En vivo siempre plano.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const plano = estado.plano || estado.pestana === "vivo" || estado.pestana === "zona";
    m.easeTo({ pitch: plano ? 0 : 55, bearing: plano ? 0 : m.getBearing(), duration: reducido() ? 0 : 800 });
    if (plano) {
      m.dragRotate.disable();
      m.touchZoomRotate.disableRotation();
    } else {
      m.dragRotate.enable();
      m.touchZoomRotate.enableRotation();
    }
  }, [estado.plano, estado.pestana]);

  // Volar a la región elegida o al área de Tu zona, o volver al país entero.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const ancho = (contenedor.current?.clientWidth ?? 1000) >= 768;
    const alto = contenedor.current?.clientHeight ?? 800;
    const zona = estado.pestana === "zona";
    const region = props.current.regiones.find((r) => r.id === estado.seleccion);
    const caja = region
      ? (bbox(region as never) as [number, number, number, number])
      : zona && area
        ? bboxDeArea(area)
        : LIMITES_MVP;
    // En Tu zona el panel ocupa la izquierda y, con un área, el calendario la parte de abajo (en celular, la hoja).
    const padding = zona
      ? ancho
        ? { top: 90, bottom: area ? Math.round(alto * 0.46) + 30 : 60, left: 380, right: 90 }
        : { top: 80, bottom: Math.round(alto * 0.62) + 20, left: 20, right: 20 }
      : ancho
        ? { top: 90, bottom: 80, left: region ? 60 : 300, right: region ? 460 : 80 }
        : { top: 80, bottom: region ? 300 : 40, left: 20, right: 20 };
    m.fitBounds(caja, {
      padding,
      maxZoom: zona && area ? 11 : 6.5,
      pitch: estado.plano || estado.pestana === "vivo" || zona ? 0 : region ? 58 : 55,
      bearing: zona ? 0 : m.getBearing(),
      duration: reducido() ? 0 : 1200,
    });
  }, [estado.seleccion, estado.plano, estado.pestana, area]);

  // Herramienta de dibujo: solo en Tu zona.
  const herramienta = useRef(() => {});
  herramienta.current = () => {
    const m = mapa.current;
    const d = dibujo.current;
    if (!m || !d?.enabled) return;
    const zona = estado.pestana === "zona";
    d.setMode(zona && dibujando ? dibujando : "static");
    // La cruz aparece apenas se elige la herramienta, sin esperar a que se mueva el puntero.
    m.getCanvas().style.cursor = zona && dibujando ? "crosshair" : "";
    // El doble clic que cierra el polígono también acercaba el mapa y lo sacaba del encuadre del área.
    if (zona) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  };
  useEffect(() => herramienta.current(), [dibujando, estado.pestana]);

  // Imagen satelital del contexto como capa, solo en Tu zona.
  const imagen = useRef(() => {});
  imagen.current = () => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    ponerImagen(m, estado.pestana === "zona" ? capaImagen : null);
  };
  useEffect(() => imagen.current(), [capaImagen, estado.pestana]);

  // MapLibre le pone `position: relative` a su contenedor: si fuera el mismo div absoluto, se queda sin alto.
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div ref={contenedor} className="h-full w-full" />
    </div>
  );
}
