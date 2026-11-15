import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { VEREDICTOS } from "@/vivo/veredictos";
import type { FocoReciente } from "./datos";
import { compararVentanas, porVeredicto, regionesConMasFocos } from "./estadisticasVivo";
import { localeActual, t, useIdioma } from "./idioma";
import type { NivelFoco } from "./logica";

const num = (v: number) => v.toLocaleString(localeActual());
const TOPE_REGIONES = 3;

/** Debajo del total: cuántos más o menos que la ventana anterior. Flecha y texto, sin color de alarma. */
export function ComparacionVivo({
  focos,
  ultimo,
  horas,
  niveles,
}: {
  focos: FocoReciente[];
  ultimo: number;
  horas: number;
  niveles: NivelFoco[];
}) {
  useIdioma((s) => s.idioma);
  const c = compararVentanas(focos, ultimo, horas, niveles);
  if (!c) return null;
  const diferencia = c.actual - c.anterior;
  const Icono = diferencia > 0 ? ArrowUp : diferencia < 0 ? ArrowDown : Equal;
  const texto =
    diferencia === 0
      ? t(`Igual que las ${horas} h anteriores`, `Same as the previous ${horas} h`)
      : t(
          `${num(Math.abs(diferencia))} ${diferencia > 0 ? "más" : "menos"} que las ${horas} h anteriores`,
          `${num(Math.abs(diferencia))} ${diferencia > 0 ? "more" : "fewer"} than the previous ${horas} h`,
        );
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/70">
      <Icono aria-hidden="true" className="size-3.5 shrink-0 text-white/60" />
      <span>{texto}</span>
      <span className="text-white/45">({num(c.anterior)})</span>
    </p>
  );
}

/** Dónde están los focos visibles y cómo van sus veredictos (D-09). Usa los mismos filtros que el mapa. */
export function EstadisticasVivo({ visibles, nombre }: { visibles: FocoReciente[]; nombre: (id: string | null) => string }) {
  useIdioma((s) => s.idioma);
  if (visibles.length === 0) return null;
  const regiones = regionesConMasFocos(visibles, TOPE_REGIONES);
  const maximo = regiones[0]?.cantidad ?? 1;
  const veredictos = porVeredicto(visibles);

  return (
    <section aria-labelledby="titulo-estadisticas-vivo" className="mt-3.5 border-t border-white/10 pt-3">
      <h3 id="titulo-estadisticas-vivo" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {t("Estadísticas en vivo", "Live statistics")}
      </h3>
      {regiones.length > 0 && (
        <ol aria-label={t("Regiones con más focos", "Regions with the most hotspots")} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {regiones.map((r) => (
            <li key={r.region} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-[12.5px]">
              <span className="truncate">{nombre(r.region)}</span>
              <span className="tabular-nums text-white/70">
                {r.cantidad === 1 ? t("1 foco", "1 hotspot") : t(`${num(r.cantidad)} focos`, `${num(r.cantidad)} hotspots`)}
              </span>
              <span aria-hidden="true" className="col-span-2 h-1 rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-relieve-brillo" style={{ width: `${(r.cantidad / maximo) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3">
        {/* Barra apilada: proporción de cada veredicto, con 2 px de separación. El texto va en la lista. */}
        <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {Object.entries(veredictos).map(([v, n]) =>
            n > 0 ? <span key={v} style={{ flexGrow: n, background: VEREDICTOS[v]?.color }} /> : null,
          )}
        </div>
        <ul aria-label={t("Focos por veredicto", "Hotspots by verdict")} className="m-0 mt-2 grid list-none grid-cols-2 gap-x-2 gap-y-1 p-0 text-[11.5px] text-white/75">
          {Object.entries(veredictos).map(([v, n]) => (
            <li key={v} className={`flex items-start gap-1.5 ${n === 0 ? "opacity-50" : ""}`}>
              <span aria-hidden="true" className="mt-[3px] size-2 shrink-0 rounded-full ring-1 ring-white/40" style={{ background: VEREDICTOS[v]?.color }} />
              <span className="leading-tight">{`${VEREDICTOS[v]?.texto}: ${num(n)}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
