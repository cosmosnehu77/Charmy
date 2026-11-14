import { useId } from "react";
import { AvisoEmergencias } from "@/components/AvisoEmergencias";
import { Button } from "@/components/ui/button";
import { useFocosVivo, useEvidencia } from "./consultas";
import { useVivo } from "./estado";
import { ETIQUETAS_EVIDENCIA, TIPOS_EVIDENCIA, veredicto } from "./veredictos";

const hora = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function Detalle({ id }: { id: string }) {
  const evidencia = useEvidencia(id);
  const cambiar = useVivo((s) => s.cambiar);
  return (
    <section aria-label="Foco reciente" className="flex flex-col gap-2 rounded-tarjeta border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Por qué este veredicto</h3>
        <Button variant="ghost" size="sm" onClick={() => cambiar({ seleccionado: null })}>
          Cerrar
        </Button>
      </div>
      {evidencia.isPending && <p className="text-sm text-tinta-suave">Buscando la evidencia…</p>}
      {evidencia.isError && (
        <p className="text-sm">La evidencia de este foco no está disponible ahora.</p>
      )}
      {evidencia.isSuccess && (
        <>
          <p className="text-sm">
            <strong>{veredicto(evidencia.data.verdict).texto}</strong>. El veredicto combina varias señales: satélite,
            fuentes fijas, noticias y reportes. La inteligencia artificial solo ayuda a leer noticias; que no haya
            noticias no vuelve falso un foco.
          </p>
          {evidencia.data.evidence.length === 0 ? (
            <p className="text-sm text-tinta-suave">Todavía no hay evidencia además del satélite.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {evidencia.data.evidence.map((e) => (
                <li key={`${e.kind}-${e.title}`} className="flex flex-col">
                  <span className="text-xs text-tinta-suave">
                    {TIPOS_EVIDENCIA[e.kind] ?? e.kind} · {ETIQUETAS_EVIDENCIA[e.label] ?? e.label}
                  </span>
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {e.title}
                    </a>
                  ) : (
                    <span>{e.title}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <AvisoEmergencias />
    </section>
  );
}

/** Focos de las últimas 48 horas con su veredicto (RF-VIV-01, RF-VIV-02). */
export function PanelVivo() {
  const id = useId();
  const { visible, seleccionado, cambiar } = useVivo();
  const vivo = useFocosVivo();
  const focos = [...(vivo.data?.features ?? [])].sort((a, b) =>
    b.properties.acq_datetime.localeCompare(a.properties.acq_datetime),
  );

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3">
      <h2 id={`${id}-titulo`} className="text-lg font-semibold">
        En vivo
      </h2>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-acento)]"
          checked={visible}
          onChange={(e) => cambiar({ visible: e.target.checked, seleccionado: null })}
        />
        Mostrar los focos de las últimas 48 horas
      </label>
      {visible && vivo.isPending && <p className="text-sm text-tinta-suave">Buscando focos recientes…</p>}
      {visible && vivo.isError && (
        <p className="rounded-control bg-superficie-2 p-2 text-sm">
          Los focos recientes no están disponibles ahora. El resto de la app sigue funcionando.
        </p>
      )}
      {visible && vivo.data?.stale && vivo.data.message && (
        <p className="rounded-control border border-aviso-borde p-2 text-sm text-aviso-texto">{vivo.data.message}</p>
      )}
      {visible && vivo.isSuccess && (
        <>
          <p className="text-xs text-tinta-suave">
            {focos.length === 1 ? "1 foco" : `${focos.length} focos`} de VIIRS (NOAA-20 y NOAA-21). Tocá uno para ver
            por qué tiene ese veredicto.
          </p>
          <ul aria-label="Focos recientes" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {focos.map((f) => {
              const v = veredicto(f.properties.verdict);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={seleccionado === f.id}
                    onClick={() => cambiar({ seleccionado: f.id })}
                    className="flex w-full items-center gap-2 rounded-control px-2 py-1 text-left text-sm hover:bg-accent aria-pressed:bg-superficie-2"
                  >
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: v.color }} />
                    <span className="font-medium">{v.texto}</span>
                    <span className="ml-auto font-mono text-xs text-tinta-suave">
                      {hora.format(new Date(f.properties.acq_datetime))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {visible && seleccionado && <Detalle id={seleccionado} />}
    </section>
  );
}
