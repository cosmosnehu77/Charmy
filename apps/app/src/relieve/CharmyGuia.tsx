import { Charmy, type Mood, type Outfit } from "@charmy/charmy";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRelieve } from "./estado";
import { t, useIdioma } from "./idioma";
import { ubicarGlobo } from "./logica";

/**
 * Charmy guía (RF-CHA-05): al tocarlo recorre la pantalla con un foco que va de un elemento a otro (marcados con
 * `data-guia`). Si un elemento no está en pantalla, ese paso se saltea. En la vista común espera abajo a la izquierda;
 * en Experto va en el encabezado del panel con sus propios pasos (F4-D9).
 */
export interface Paso {
  guia?: string;
  mood: Mood;
  titulo: string;
  texto: string;
  /** Abre la región con más fuego para mostrar la ficha y la línea de tiempo. */
  abrirRegion?: boolean;
  cerrarRegion?: boolean;
  emergencia?: boolean;
}

const PASOS_MAPA: Paso[] = [
  {
    mood: "saluda",
    get titulo() {
      return t("¡Hola! Soy Charmy", "Hi! I’m Charmy");
    },
    get texto() {
      return t(
        "Te muestro en un minuto cómo mirar el fuego en Argentina y Chile. Podés salir cuando quieras.",
        "I’ll show you in a minute how to explore fire activity in Argentina and Chile. You can exit anytime.",
      );
    },
  },
  {
    guia: "indicadores",
    mood: "explica",
    get titulo() {
      return t("Elegí qué mirar", "Choose what to view");
    },
    get texto() {
      return t(
        "Focos, intensidad o anomalía: cada provincia sube según ese dato. En vivo muestra los focos de las últimas horas.",
        "Hotspots, intensity, or anomaly: each province rises according to that metric. Live shows hotspots from recent hours.",
      );
    },
  },
  {
    guia: "zona",
    mood: "explica",
    get titulo() {
      return t("Marcá tu zona", "Mark your area");
    },
    get texto() {
      return t(
        "En Experto marcás un área en el mapa: un rectángulo, un polígono, un punto con radio o una localidad. Te muestro cuánto fuego hubo ahí mes a mes y qué hay cerca.",
        "In Expert you mark an area on the map: a rectangle, a polygon, a point with radius, or a locality. I’ll show you how much fire occurred there month by month and what is nearby.",
      );
    },
  },
  {
    guia: "lupa",
    mood: "explica",
    get titulo() {
      return t("Buscá tu lugar", "Find your place");
    },
    get texto() {
      return t(
        "Tocá la lupa y escribí el nombre de una provincia o región.",
        "Tap the search icon and type the name of a province or region.",
      );
    },
  },
  {
    guia: "ranking",
    mood: "explica",
    get titulo() {
      return t("Las que más arden", "Top burning regions");
    },
    get texto() {
      return t(
        "El ranking ordena las regiones con más fuego según el indicador. Tocá una para ver su ficha.",
        "The ranking orders the regions with the most fire by the selected indicator. Tap one to open its card.",
      );
    },
  },
  {
    guia: "controles",
    mood: "explica",
    get titulo() {
      return t("Mové el mapa", "Move the map");
    },
    get texto() {
      return t(
        "Acercá, alejá, mirá al norte, pasá a 2D si tu conexión es lenta y frená el giro. También podés arrastrar el mapa.",
        "Zoom in, zoom out, reset north, switch to 2D on slower connections, and pause rotation. You can also drag the map.",
      );
    },
  },
  {
    guia: "leyenda",
    mood: "pensando",
    get titulo() {
      return t("¿Qué significan los colores?", "What do the colors mean?");
    },
    get texto() {
      return t(
        "Cuanto más alta y más oscura la región, más fuego. Si dudás, mirá acá.",
        "The taller and darker the region, the more fire. Whenever in doubt, check here.",
      );
    },
  },
  {
    guia: "ficha",
    abrirRegion: true,
    mood: "explica",
    get titulo() {
      return t("La ficha de una provincia", "A province’s card");
    },
    get texto() {
      return t(
        "Al tocar una provincia se abre su ficha y las demás se apagan para que la veas sola. Para volver, tocala de nuevo.",
        "Tapping a province opens its card and dims the others so you can focus on it. Tap it again to go back.",
      );
    },
  },
  {
    guia: "linea",
    mood: "explica",
    get titulo() {
      return t("Día por día", "Day by day");
    },
    get texto() {
      return t(
        "Con el play ves cómo suben y bajan los focos de esa provincia. También podés tocar un día.",
        "Press play to watch hotspots rise and fall across days in that province, or tap any day directly.",
      );
    },
  },
  {
    cerrarRegion: true,
    mood: "festeja",
    get titulo() {
      return t("¡Listo!", "All set!");
    },
    get texto() {
      return t(
        "Si necesitás ayuda de nuevo, tocame: estoy abajo a la izquierda.",
        "If you need help again, tap me—I’m in the bottom-left corner.",
      );
    },
    emergencia: true,
  },
];

/** El globo «¿Necesitás ayuda?» se muestra solo unas veces al entrar, para que se note la guía (F4-D10). */
const INVITACION = { visibleMs: 5000, pausaMs: 15000, veces: 3 };

const reducido = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function CharmyGuia({
  regionMasFuego = null,
  pasos: PASOS = PASOS_MAPA,
  outfit = "guia",
  boton = "figura",
  etiqueta,
}: {
  regionMasFuego?: string | null;
  pasos?: Paso[];
  outfit?: Outfit;
  /** «figura»: Charmy entero con la pregunta (vista común); «cabeza»: un botón chico para un encabezado. */
  boton?: "figura" | "cabeza";
  etiqueta?: string;
}) {
  useIdioma((s) => s.idioma);
  const etiquetaFinal = etiqueta ?? t("Charmy: ¿necesitás ayuda? Tocá para ver cómo se usa el mapa", "Charmy: need help? Tap to see how to use the map");
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viaja, setViaja] = useState(false);
  const elegidaPorGuia = useRef(false);
  const siguienteRef = useRef<HTMLButtonElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const globo = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState({ x: 0, y: 0, izquierda: false });
  const [invita, setInvita] = useState(boton === "figura");

  // Visible unos segundos, oculto un rato, unas pocas veces; después solo con el mouse o el foco (F4-D10).
  useEffect(() => {
    if (boton !== "figura") return;
    let vez = 0;
    let reloj: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setInvita(true);
      reloj = setTimeout(() => {
        setInvita(false);
        vez += 1;
        if (vez < INVITACION.veces) reloj = setTimeout(mostrar, INVITACION.pausaMs);
      }, INVITACION.visibleMs);
    };
    mostrar();
    return () => clearTimeout(reloj);
  }, [boton]);

  const cerrarRegionDeGuia = useCallback(() => {
    if (elegidaPorGuia.current) {
      useRelieve.getState().alternarRegion(null);
      elegidaPorGuia.current = false;
    }
  }, []);

  const terminar = useCallback(() => {
    cerrarRegionDeGuia();
    setAbierto(false);
    useRelieve.getState().cambiar({ guia: false });
    botonRef.current?.focus();
  }, [cerrarRegionDeGuia]);

  // Al llegar a un paso: abrir o cerrar la región si hace falta y medir el elemento a iluminar.
  const ir = useCallback(
    (destino: number, direccion: 1 | -1) => {
      const p = PASOS[destino];
      if (!p) return terminar();
      const pasoFicha = PASOS.findIndex((x) => x.abrirRegion);
      if (p.abrirRegion && !useRelieve.getState().seleccion && regionMasFuego) {
        useRelieve.getState().alternarRegion(regionMasFuego);
        elegidaPorGuia.current = true;
      }
      if ((p.cerrarRegion || (direccion < 0 && destino < pasoFicha)) && elegidaPorGuia.current) cerrarRegionDeGuia();
      // Los cambios de la página tardan un instante en dibujarse.
      setTimeout(() => {
        const el = p.guia ? document.querySelector<HTMLElement>(`[data-guia="${p.guia}"]`) : null;
        const r = el?.getBoundingClientRect();
        if (p.guia && (!r || r.width < 4 || r.height < 4)) {
          const otro = destino + direccion;
          if (otro >= 0 && otro < PASOS.length) return ir(otro, direccion);
        }
        setPaso(destino);
        setRect(r && r.width >= 4 ? r : null);
        if (!reducido()) {
          setViaja(false);
          requestAnimationFrame(() => setViaja(true));
        }
      }, p.abrirRegion || p.cerrarRegion || direccion < 0 ? 280 : 0);
    },
    [PASOS, cerrarRegionDeGuia, regionMasFuego, terminar],
  );

  const abrir = () => {
    elegidaPorGuia.current = false;
    // Durante el recorrido el ranking queda abierto: uno de los pasos lo señala (#251).
    useRelieve.getState().cambiar({ guia: true, ranking: true });
    setAbierto(true);
    ir(0, 1);
  };

  // Charmy y su globo se ubican al costado del elemento, o debajo si es uno de arriba de la pantalla.
  useLayoutEffect(() => {
    if (!abierto) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    setPosicion(ubicarGlobo(rect, { W, H, ancho: Math.min(430, W - 24), alto: globo.current?.offsetHeight ?? 190 }));
    siguienteRef.current?.focus();
  }, [abierto, rect, paso]);

  useEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const p = PASOS[paso];
      const el = p?.guia ? document.querySelector<HTMLElement>(`[data-guia="${p.guia}"]`) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [PASOS, abierto, paso]);

  const actual = PASOS[paso] ?? PASOS[0];
  const pad = 10;

  return (
    <>
      {boton === "figura" ? (
        <button
          ref={botonRef}
          type="button"
          className="guia-boton"
          data-invita={invita}
          hidden={abierto}
          onClick={abrir}
          aria-label={etiquetaFinal}
        >
          <span className="guia-figura">
            <Charmy size={84} mood="saluda" outfit={outfit} decorative />
          </span>
          <span className="guia-pregunta" aria-hidden="true">
            <b>{t("¿Necesitás ayuda?", "Need help?")}</b>
            {t("Tocame y te muestro cómo usar el mapa.", "Tap me and I’ll show you how to use the map.")}
          </span>
        </button>
      ) : (
        <button
          ref={botonRef}
          type="button"
          onClick={abrir}
          aria-label={etiquetaFinal}
          title={etiquetaFinal}
          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/20 py-0.5 pl-0.5 pr-2.5 text-[12.5px] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Charmy size={28} variant="cabeza" outfit={outfit} animate={false} decorative />
          {t("Guía", "Guide")}
        </button>
      )}
      {/* En `body`: dentro de la vista quedaba atrapado en la capa del bloque de abajo, debajo de la píldora y la ficha (#226). */}
      {abierto && actual && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guia-titulo"
          className="guia-recorrido"
          onKeyDown={(e) => {
            if (e.key === "Escape") terminar();
            else if (e.key === "ArrowRight") ir(paso + 1, 1);
            else if (e.key === "ArrowLeft" && paso > 0) ir(paso - 1, -1);
          }}
        >
          <div className="guia-bloqueo" />
          <div
            className={`guia-foco ${rect ? "" : "sin"}`}
            style={
              rect
                ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
                : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }
            }
          />
          <div
            ref={globo}
            className={`guia-grupo ${posicion.izquierda ? "izquierda" : ""} ${viaja ? "viaja" : ""}`}
            style={{ left: posicion.x, top: posicion.y }}
          >
            <span className="guia-figura-grande">
              <Charmy size={96} mood={actual.mood} outfit={outfit} decorative />
            </span>
            <div className="guia-globo" aria-live="polite" key={paso}>
              <h3 id="guia-titulo">{actual.titulo}</h3>
              <p>{actual.texto}</p>
              {actual.emergencia && (
                <p className="guia-emergencia">
                  {t(
                    <>
                      Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al <b>100</b> en Argentina o al{" "}
                      <b>132</b> en Chile.
                    </>,
                    <>
                      Charmy does not replace emergency services. If you see fire, call <b>100</b> in Argentina or{" "}
                      <b>132</b> in Chile.
                    </>,
                  )}
                </p>
              )}
              <div className="guia-puntos" aria-hidden="true">
                {PASOS.map((_, i) => (
                  <i key={i} className={i === paso ? "on" : ""} />
                ))}
              </div>
              <div className="guia-acciones">
                <button type="button" className="guia-salir" onClick={terminar}>
                  {t("Salir", "Exit")}
                </button>
                {paso > 0 && (
                  <button type="button" className="guia-atras" onClick={() => ir(paso - 1, -1)}>
                    {t("Atrás", "Back")}
                  </button>
                )}
                <button ref={siguienteRef} type="button" className="guia-sig" onClick={() => ir(paso + 1, 1)}>
                  {paso === PASOS.length - 1 ? t("Terminar", "Finish") : t("Siguiente", "Next")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
