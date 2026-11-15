import { Charmy } from "@charmy/charmy";
import { Search, SquareDashed } from "lucide-react";
import { useId, useRef, useState } from "react";
import { URL_LANDING } from "@/lib/enlaces";
import { useRelieve } from "./estado";
import { INDICADORES, type RegionResumen } from "./logica";

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Píldora central: Charmy, los indicadores, En vivo, Tu zona (#262) y la lupa (F4-R1). */
export function Pildora({ regiones }: { regiones: RegionResumen[] }) {
  const { pestana, elegirPestana } = useRelieve();
  const pestanas = [
    ...INDICADORES.map((i) => ({ id: i.id, nombre: i.nombre })),
    { id: "vivo" as const, nombre: "En vivo" },
    { id: "zona" as const, nombre: "Tu zona" },
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
    <div className="pildora-relieve vidrio-relieve pointer-events-auto absolute left-1/2 top-3 z-30 flex w-max max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1.5 rounded-full p-1.5">
      <a
        href={URL_LANDING}
        className="flex shrink-0 items-center gap-2 rounded-full py-0.5 pl-1 pr-2.5 hover:bg-white/5"
        aria-label="Charmy: ir a la página de inicio"
      >
        <Charmy size={36} variant="cabeza" animate={false} decorative />
        <span className="hidden font-titulos text-[17px] font-semibold tracking-tight sm:inline">Charmy</span>
      </a>
      <div
        ref={lista}
        role="tablist"
        aria-label="Indicador"
        onKeyDown={moverConFlechas}
        data-guia="indicadores"
        className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto"
      >
        {pestanas.map((p) => {
          const activa = pestana === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              data-pestana={p.id}
              aria-selected={activa}
              tabIndex={activa ? 0 : -1}
              onClick={() => elegirPestana(p.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-[18px] py-2.5 text-[14.5px] transition ${
                activa ? "bg-white font-semibold text-tinta" : "text-white/65 hover:text-white"
              }`}
            >
              {p.id === "vivo" && <i aria-hidden="true" className="punto-vivo" />}
              {p.id === "zona" && <SquareDashed aria-hidden="true" className="size-4" />}
              {p.nombre}
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
    <div className="buscador-relieve" data-guia="lupa">
      <label htmlFor={id} className="buscador-lupa" title="Buscar una provincia o región">
        <Search aria-hidden="true" className="size-[18px]" />
        <span className="sr-only">Buscá tu provincia o región</span>
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
        placeholder="Buscá tu provincia o región"
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
        Escribí el nombre de una provincia o región, por ejemplo Neuquén, y elegila de la lista.
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
