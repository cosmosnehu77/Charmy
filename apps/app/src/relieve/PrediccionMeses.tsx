import { type MesPrediccion, nombreMes, plazoPrediccion } from "./logica";

/**
 * Los seis meses que vienen según el modelo (F4-D12, D-40): primero los dos de pronóstico, el resto plegado.
 * `texto` dice cada mes en celdas (una provincia) o en probabilidad (un área chica).
 */
export function PrediccionMeses({ meses, texto }: { meses: MesPrediccion[]; texto: (m: MesPrediccion) => string }) {
  const fila = (m: MesPrediccion) => {
    const nombre = nombreMes(Number(m.month.slice(5, 7)));
    return (
      <li key={m.month} className="flex flex-col gap-0.5 py-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <b className="text-sm font-semibold">
            {nombre.charAt(0).toUpperCase() + nombre.slice(1)} {m.month.slice(0, 4)}
          </b>
          <span className="text-[11px] text-white/50">{plazoPrediccion(m)}</span>
        </span>
        <small className="text-[12.5px] leading-snug text-white/65">{texto(m)}</small>
      </li>
    );
  };
  const pronostico = meses.filter((m) => m.kind === "forecast");
  const resto = meses.filter((m) => m.kind !== "forecast");
  return (
    <div>
      <h3 className="mb-1 text-[11.5px] font-normal uppercase tracking-wider text-white/50">Los próximos meses</h3>
      <ul className="m-0 list-none p-0">{pronostico.map(fila)}</ul>
      {resto.length > 0 && (
        <details className="calendario-relieve">
          <summary>Más adelante</summary>
          <ul className="m-0 list-none p-0">{resto.map(fila)}</ul>
        </details>
      )}
      <p className="mt-1 text-[11.5px] leading-snug text-white/45">
        Es una estimación del modelo con los datos hasta el mes pasado: cuenta celdas de 0,1° (unos 11 km) con fuego.
      </p>
    </div>
  );
}
