import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { AvisoEmergencias } from "@/components/AvisoEmergencias";
import { Button } from "@/components/ui/button";
import { leerPunto, validarPunto } from "@/consulta/consulta";
import { ErrorApi, pedir } from "@/lib/api";
import { t, useIdioma } from "@/relieve/idioma";
import { useVivo } from "./estado";

const control =
  "min-h-9 w-full rounded-control border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Reporte {
  lat: number;
  lon: number;
  description?: string;
}

/** Reporte ciudadano sin cuenta (RF-ALE-01). No pide ni manda datos personales (RNF-05). Se abre con `reportando`. */
export function FormReporte() {
  useIdioma((s) => s.idioma);
  const id = useId();
  const { reportando, cambiar } = useVivo();
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const envio = useMutation({
    mutationFn: (r: Reporte) =>
      pedir<{ id: string; status: string }>("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      }),
  });

  // El botón que lo abre va en el encabezado del panel de Experto (F4-D8).
  if (!reportando) return null;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const problema = validarPunto(lat, lon);
    setError(problema);
    if (problema) return;
    const [la, lo] = leerPunto(lat, lon);
    const texto = descripcion.trim();
    envio.mutate({ lat: la, lon: lo, ...(texto ? { description: texto } : {}) });
  };

  const mensajeError =
    envio.error instanceof ErrorApi && envio.error.mensaje
      ? envio.error.mensaje
      : t(
          "No pudimos enviar el reporte. Probá de nuevo en un rato; lo que escribiste sigue acá.",
          "Could not send the report. Try again shortly; what you wrote is still here.",
        );

  return (
    <form aria-label={t("Reportar un foco", "Report a hotspot")} onSubmit={enviar} noValidate className="flex flex-col gap-2 rounded-tarjeta border p-3">
      <h3 className="text-sm font-semibold">{t("Reportar un foco", "Report a hotspot")}</h3>
      <AvisoEmergencias />
      {envio.isSuccess ? (
        <>
          <p role="status" className="text-sm">
            {t(
              "Recibimos tu reporte. Queda «sin verificar» hasta que alguien lo revise. Gracias.",
              "We received your report. It remains “unverified” until reviewed. Thank you.",
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              envio.reset();
              setLat("");
              setLon("");
              setDescripcion("");
              cambiar({ reportando: false });
            }}
          >
            {t("Listo", "Done")}
          </Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 text-sm font-medium">
              <label htmlFor={`${id}-lat`}>{t("Latitud del foco", "Hotspot latitude")}</label>
              <input id={`${id}-lat`} className={control} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 text-sm font-medium">
              <label htmlFor={`${id}-lon`}>{t("Longitud del foco", "Hotspot longitude")}</label>
              <input id={`${id}-lon`} className={control} inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm font-medium">
            <label htmlFor={`${id}-desc`}>{t("Qué ves (opcional)", "What do you see? (optional)")}</label>
            <textarea
              id={`${id}-desc`}
              className={`${control} min-h-16 py-1`}
              maxLength={500}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <p className="text-xs text-tinta-suave">{t("No pedimos ni guardamos datos personales.", "We do not ask for or store personal data.")}</p>
          {(error || envio.isError) && (
            <p role="alert" className="text-sm text-peligro">
              {error ?? mensajeError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={envio.isPending}>
              {t("Enviar reporte", "Submit report")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => cambiar({ reportando: false })}>
              {t("Cancelar", "Cancel")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
