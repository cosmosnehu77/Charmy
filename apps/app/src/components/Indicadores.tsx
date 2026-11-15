import { cn } from "@/lib/utils";

export interface Indicador {
  nombre: string;
  valor: string;
  detalle?: string;
}

/** Fila de indicadores (nombre y valor) para los resúmenes de Tu zona. */
export function Indicadores({
  items,
  className,
}: {
  items: Indicador[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2 [&>div:last-child:nth-child(odd)]:col-span-2", className)}>
      {items.map(({ nombre, valor, detalle }) => (
        <div key={nombre} className="flex flex-col rounded-control bg-superficie-2 px-2.5 py-2">
          <dt className="text-[11px] leading-tight text-tinta-suave">{nombre}</dt>
          <dd className="m-0 text-base font-semibold tabular-nums leading-snug">{valor}</dd>
          {detalle && <dd className="m-0 text-[11px] leading-tight text-tinta-suave">{detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}
