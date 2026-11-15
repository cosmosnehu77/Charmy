import { Charmy } from "@charmy/charmy";
import { Activity, CalendarClock, Flame, Gauge, type LucideIcon, Microscope, Radio, Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import { URL_LANDING } from "@/lib/enlaces";
import { useRelieve } from "./estado";
import { t, useIdioma } from "./idioma";
import type { Pestana } from "./estado";
import { INDICADORES, type RegionResumen } from "./logica";

/** Ícono de cada pestaña: las inactivas muestran solo el ícono y la elegida abre su nombre (#406). */
const ICONOS: Record<Pestana, LucideIcon> = {
  focos: Flame,
  frp: Gauge,
  anomalia: Activity,
  prediccion: CalendarClock,
  zona: Microscope,
  vivo: Radio,
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Píldora central: Charmy, los indicadores, Experto (ex Tu zona, #262), En vivo y la lupa (F4-R1). */
export function Pildora({ regiones }: { regiones: RegionResumen[] }) {
  useIdioma((s) => s.idioma);
  const { pestana, elegirPestana } = useRelieve();
  const pestanas = [
    ...INDICADORES.map((i) => ({ id: i.id, nombre: i.nombre })),
    { id: "zona" as const, nombre: t("Experto", "Expert") },
    { id: "vivo" as const, nombre: t("En vivo", "Live") },
  ];
  const lista = useRef<HTMLDivElement>(null);

  const moverConFlechas = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = pestanas.findIndex((p) => p.id === pestana);
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
    const siguiente = pestanas[j];
    if (!siguiente) return;
    elegirPestana(siguiente.id);
    lista.current?.querySelector<HTMLButtonElement>(`[data-pestana="${siguiente.id}"]`)?.focus();
  };

  return (
    <div className="pildora-relieve pointer-events-auto absolute left-1/2 top-3 z-30 flex w-max -translate-x-1/2 items-center">
      <a
        href={URL_LANDING}
        className="pildora-charmy vidrio-relieve"
        aria-label={t("Charmy: ir a la página de inicio", "Charmy: go to home page")}
      >
        <Charmy size={36} variant="cabeza" animate={false} decorative />
        <span className="pildora-titulo" aria-hidden="true">
          <span className="font-titulos text-[17px] font-semibold tracking-tight">Charmy</span>
        </span>
      </a>
      <div
        ref={lista}
        role="tablist"
        aria-label={t("Indicador", "Indicator")}
        onKeyDown={moverConFlechas}
        data-guia="indicadores"
        className="pildora-pestanas vidrio-relieve no-scrollbar"
      >
        {pestanas.map((p) => {
          const activa = pestana === p.id;
          const Icono = ICONOS[p.id];
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              title={p.nombre}
              data-pestana={p.id}
              data-guia={p.id === "zona" ? "zona" : undefined}
              aria-selected={activa}
              tabIndex={activa ? 0 : -1}
              onClick={() => elegirPestana(p.id)}
              className={`pildora-pestana ${activa ? "font-semibold text-white" : "text-white/65 hover:text-white"}`}
            >
              <span className={`pildora-icono ${activa ? "bg-charmy-llama text-tinta" : ""}`}>
                <Icono aria-hidden="true" />
              </span>
              {p.id === "vivo" && <i aria-hidden="true" className="punto-vivo" />}
              <span className="pildora-etiqueta" data-abierta={activa}>
                <span>{p.nombre}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Lupa regiones={regiones} />
    </div>
  );
}

function Lupa({ regiones }: { regiones: RegionResumen[] }) {
  const alternarRegion = useRelieve((s) => s.alternarRegion);
  const [texto, setTexto] = useState("");
  const [activa, setActiva] = useState(0);
  const id = useId();
  const q = sinTildes(texto.trim());
  const resultados = q ? regiones.filter((r) => sinTildes(r.properties.name).includes(q)).slice(0, 6) : [];
  const elegir = (r: RegionResumen | undefined) => {
    if (!r) return;
    alternarRegion(r.id);
    setTexto("");
    (document.activeElement as HTMLElement | null)?.blur();
  };
  return (
    <div className="buscador-relieve vidrio-relieve" data-guia="lupa">
      <label htmlFor={id} className="buscador-lupa" title={t("Buscar una provincia o región", "Search for a province or region")}>
        <Search aria-hidden="true" className="size-[18px]" />
        <span className="sr-only">{t("Buscá tu provincia o región", "Search your province or region")}</span>
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={resultados.length > 0}
        aria-controls={`${id}-lista`}
        aria-activedescendant={resultados.length ? `${id}-op-${activa}` : undefined}
        autoComplete="off"
        value={texto}
        placeholder={t("Buscá tu provincia o región", "Search your province or region")}
        className="buscador-campo"
        onChange={(e) => {
          setTexto(e.target.value);
          setActiva(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActiva((a) => Math.min(a + 1, resultados.length - 1));
          else if (e.key === "ArrowUp") setActiva((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter") elegir(resultados[activa]);
          else if (e.key === "Escape") {
            setTexto("");
            e.currentTarget.blur();
          }
        }}
      />
      <span className="buscador-pista" aria-hidden="true">
        {t(
          "Escribí el nombre de una provincia o región, por ejemplo Neuquén, y elegila de la lista.",
          "Type the name of a province or region, for example Neuquén, and pick it from the list.",
        )}
      </span>
      {resultados.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" className="buscador-lista">
          {resultados.map((r, i) => (
            <li key={r.id} id={`${id}-op-${i}`} role="option" aria-selected={i === activa}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(r)}
                className={`flex w-full justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 ${
                  i === activa ? "bg-white/10" : ""
                }`}
              >
                {r.properties.name}
                <span className="text-xs text-white/50">{r.properties.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
