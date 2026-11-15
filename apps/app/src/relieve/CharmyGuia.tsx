import { Charmy, type Mood, type Outfit } from "@charmy/charmy";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRelieve } from "./estado";
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
    titulo: "¡Hola! Soy Charmy",
    texto: "Te muestro en un minuto cómo mirar el fuego en Argentina y Chile. Podés salir cuando quieras.",
  },
  {
    guia: "indicadores",
    mood: "explica",
    titulo: "Elegí qué mirar",
    texto: "Focos, intensidad o anomalía: cada provincia sube según ese dato. En vivo muestra los focos de las últimas horas.",
  },
  {
    guia: "zona",
    mood: "explica",
    titulo: "Marcá tu zona",
    texto:
      "En Experto marcás un área en el mapa: un rectángulo, un polígono, un punto con radio o una localidad. Te muestro cuánto fuego hubo ahí mes a mes y qué hay cerca.",
  },
  { guia: "lupa", mood: "explica", titulo: "Buscá tu lugar", texto: "Tocá la lupa y escribí el nombre de una provincia o región." },
  {
    guia: "ranking",
    mood: "explica",
    titulo: "Las que más arden",
    texto: "El ranking ordena las regiones con más fuego según el indicador. Tocá una para ver su ficha.",
  },
  {
    guia: "controles",
    mood: "explica",
    titulo: "Mové el mapa",
    texto: "Acercá, alejá, mirá al norte, pasá a 2D si tu conexión es lenta y frená el giro. También podés arrastrar el mapa.",
  },
  {
    guia: "leyenda",
    mood: "pensando",
    titulo: "¿Qué significan los colores?",
    texto: "Cuanto más alta y más oscura la región, más fuego. Si dudás, mirá acá.",
  },
  {
    guia: "ficha",
    abrirRegion: true,
    mood: "explica",
    titulo: "La ficha de una provincia",
    texto: "Al tocar una provincia se abre su ficha y las demás se apagan para que la veas sola. Para volver, tocala de nuevo.",
  },
  {
    guia: "linea",
    mood: "explica",
    titulo: "Día por día",
    texto: "Con el play ves cómo suben y bajan los focos de esa provincia. También podés tocar un día.",
  },
  {
    cerrarRegion: true,
    mood: "festeja",
    titulo: "¡Listo!",
    texto: "Si necesitás ayuda de nuevo, tocame: estoy abajo a la izquierda.",
    emergencia: true,
  },
];

const reducido = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function CharmyGuia({
  regionMasFuego = null,
  pasos: PASOS = PASOS_MAPA,
  outfit = "guia",
  boton = "figura",
  etiqueta = "Charmy: ¿necesitás ayuda? Tocá para ver cómo se usa el mapa",
}: {
  regionMasFuego?: string | null;
  pasos?: Paso[];
  outfit?: Outfit;
  /** «figura»: Charmy entero con la pregunta (vista común); «cabeza»: un botón chico para un encabezado. */
  boton?: "figura" | "cabeza";
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viaja, setViaja] = useState(false);
  const elegidaPorGuia = useRef(false);
  const siguienteRef = useRef<HTMLButtonElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const globo = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState({ x: 0, y: 0, izquierda: false });

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
        <button ref={botonRef} type="button" className="guia-boton" hidden={abierto} onClick={abrir} aria-label={etiqueta}>
          <span className="guia-figura">
            <Charmy size={84} mood="saluda" outfit={outfit} decorative />
          </span>
          <span className="guia-pregunta" aria-hidden="true">
            <b>¿Necesitás ayuda?</b>Tocame y te muestro cómo usar el mapa.
          </span>
        </button>
      ) : (
        <button
          ref={botonRef}
          type="button"
          onClick={abrir}
          aria-label={etiqueta}
          title={etiqueta}
          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/20 py-0.5 pl-0.5 pr-2.5 text-[12.5px] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Charmy size={28} variant="cabeza" outfit={outfit} animate={false} decorative />
          Guía
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
                  Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al <b>100</b> en Argentina o al{" "}
                  <b>132</b> en Chile.
                </p>
              )}
              <div className="guia-puntos" aria-hidden="true">
                {PASOS.map((_, i) => (
                  <i key={i} className={i === paso ? "on" : ""} />
                ))}
              </div>
              <div className="guia-acciones">
                <button type="button" className="guia-salir" onClick={terminar}>
                  Salir
                </button>
                {paso > 0 && (
                  <button type="button" className="guia-atras" onClick={() => ir(paso - 1, -1)}>
                    Atrás
                  </button>
                )}
                <button ref={siguienteRef} type="button" className="guia-sig" onClick={() => ir(paso + 1, 1)}>
                  {paso === PASOS.length - 1 ? "Terminar" : "Siguiente"}
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
