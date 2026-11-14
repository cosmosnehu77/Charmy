import { type EstadoApi as Estado, useEstadoApi } from "@/lib/consultas";
import { cn } from "@/lib/utils";

const textos: Record<Estado, { texto: string; punto: string }> = {
  "sin-configurar": { texto: "Datos de muestra", punto: "bg-charmy-llama-nucleo" },
  conectando: { texto: "Conectando…", punto: "bg-borde-control" },
  conectada: { texto: "Datos en línea", punto: "bg-exito" },
  "no-disponible": { texto: "Servidor no disponible", punto: "bg-peligro" },
};

/** Indicador del estado de la API. El color nunca va solo: siempre lo acompaña el texto (RNF-04). */
export function EstadoApi() {
  const estado = useEstadoApi();
  const { texto, punto } = textos[estado];
  return (
    <span role="status" className="inline-flex items-center gap-1.5 font-mono text-xs text-tinta-suave">
      <span aria-hidden="true" className={cn("size-2 rounded-full", punto)} />
      {texto}
    </span>
  );
}
