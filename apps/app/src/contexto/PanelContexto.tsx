import type { components, paths } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Seguro } from "@/components/Seguro";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bboxDeArea } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";
import { pedir, urlApi } from "@/lib/api";
import { useFocosVivo } from "@/vivo/consultas";
import { useVivo } from "@/vivo/estado";
import { direccionViento, textoRiesgo, urlImagen } from "./contexto";
import { type EstiloImagen, useContexto } from "./estado";

/** `stale` y `message` (copia de respaldo, D-26) vienen de services/contexto (#141) y entran al contrato. */
type Tiempo = paths["/weather"]["get"]["responses"]["200"]["content"]["application/json"] & {
  stale?: boolean;
  message?: string;
};
type PuntoTiempo = components["schemas"]["WeatherPoint"];
type Imagen = components["schemas"]["ImageryResult"];

const zona = "America/Argentina/Buenos_Aires";
const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: zona });
const fechaLarga = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: zona });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

const viento = (p: PuntoTiempo) =>
  `${entero.format(p.wind_speed_ms * 3.6)} km/h del ${direccionViento(p.wind_dir_deg)}`;

/** El lugar del contexto: el foco reciente elegido o, si no hay, el centro del área (RF-CTX-01). */
function usePunto(): { lat: number; lon: number; cual: string } | null {
  const area = useConsulta((s) => s.area);
  const seleccionado = useVivo((s) => s.seleccionado);
  const vivo = useFocosVivo();
  const foco = seleccionado ? vivo.data?.features.find((f) => f.id === seleccionado) : undefined;
  if (foco) {
    const [lon, lat] = foco.geometry.coordinates;
    if (lat !== undefined && lon !== undefined) return { lat, lon, cual: "Foco reciente elegido" };
  }
  if (!area) return null;
  const [o, s, e, n] = bboxDeArea(area);
  return { lat: (s + n) / 2, lon: (o + e) / 2, cual: "Centro del área" };
}

const redondear = (n: number) => Math.round(n * 1e4) / 1e4;

function Tiempo({ lat, lon }: { lat: number; lon: number }) {
  const consulta = useQuery({
    queryKey: ["tiempo", lat, lon],
    queryFn: ({ signal }) => pedir<Tiempo>(`/weather?lat=${lat}&lon=${lon}&hours=12`, { signal }),
  });
  if (consulta.isPending) return <p className="text-sm text-tinta-suave">Buscando el tiempo…</p>;
  if (consulta.isError)
    return <p className="rounded-control bg-superficie-2 p-2 text-sm">El tiempo no está disponible ahora.</p>;
  const { now, forecast, source, fetched_at, stale, message } = consulta.data;
  const riesgo = textoRiesgo(now.fire_risk_index, now.fire_risk_label);
  return (
    <div className="flex flex-col gap-1 text-sm">
      {stale && (
        <p className="rounded-control border border-aviso-borde p-2 text-aviso-texto">
          Copia guardada: {message ?? "la fuente no responde y mostramos los últimos datos que tenemos."}
        </p>
      )}
      <p>
        Viento: <strong>{viento(now)}</strong>. Temperatura: {decimal.format(now.temperature_c)} °C. Humedad:{" "}
        {entero.format(now.relative_humidity_pct)} %.
      </p>
      {riesgo && (
        <p>
          Riesgo de incendio: <strong>{riesgo}</strong>
        </p>
      )}
      {forecast.length > 0 && (
        <ul aria-label="Pronóstico" className="flex flex-wrap gap-x-3 font-mono text-xs text-tinta-suave">
          {forecast.slice(0, 4).map((p) => (
            <li key={p.time}>
              {hora.format(new Date(p.time))}: {viento(p)}, {decimal.format(p.temperature_c)} °C
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">
        Fuente: {source}. Datos de las {hora.format(new Date(fetched_at))}
      </p>
    </div>
  );
}

function ImagenSatelital({ lat, lon }: { lat: number; lon: number }) {
  const { estilo, capa, cambiar } = useContexto();
  const consulta = useQuery({
    queryKey: ["imagen", lat, lon, estilo],
    queryFn: ({ signal }) => pedir<Imagen>(`/imagery/latest?lat=${lat}&lon=${lon}&style=${estilo}`, { signal }),
  });
  const url = consulta.data ? urlImagen(urlApi(), consulta.data.image_url) : null;
  // La URL que no se pudo cargar (el PNG puede faltar aunque el pedido de datos haya andado).
  const [rota, setRota] = useState<string | null>(null);
  const enMapa = capa !== null && capa.url === url;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <ToggleGroup
        type="single"
        aria-label="Estilo de la imagen"
        value={estilo}
        onValueChange={(v) => v && cambiar({ estilo: v as EstiloImagen, capa: null })}
      >
        <ToggleGroupItem value="color_real">Color real</ToggleGroupItem>
        <ToggleGroupItem value="falso_color">Falso color</ToggleGroupItem>
      </ToggleGroup>
      {consulta.isPending && <p className="text-tinta-suave">Buscando la imagen más reciente…</p>}
      {consulta.isError && (
        <p className="rounded-control bg-superficie-2 p-2">
          La imagen satelital no está disponible ahora. El resto sigue funcionando.
        </p>
      )}
      {consulta.isSuccess && url && rota === url && (
        <p className="rounded-control bg-superficie-2 p-2">La imagen no se pudo cargar. Probá de nuevo en un rato.</p>
      )}
      {consulta.isSuccess && url && rota !== url && (
        <>
          <img
            onError={() => {
              setRota(url);
              if (capa?.url === url) cambiar({ capa: null });
            }}
            src={url}
            alt={`Imagen satelital ${estilo === "falso_color" ? "en falso color" : "en color real"} del ${fechaLarga.format(new Date(consulta.data.acquired_at))}`}
            className="w-full rounded-control border"
          />
          <p className="text-xs">
            {fechaLarga.format(new Date(consulta.data.acquired_at))} · Nubes: {entero.format(consulta.data.cloud_cover_pct)} % ·{" "}
            {consulta.data.source}
          </p>
          <p className="text-xs text-tinta-suave">{consulta.data.attribution}</p>
          {estilo === "falso_color" && (
            <p className="text-xs text-tinta-suave">En falso color, lo quemado se ve oscuro y el fuego activo, brillante.</p>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={enMapa}
              onChange={(e) =>
                cambiar({
                  capa: e.target.checked ? { url, bbox: consulta.data.bbox as [number, number, number, number] } : null,
                })
              }
            />
            Mostrar la imagen en el mapa
          </label>
        </>
      )}
    </div>
  );
}

/** Tiempo e imagen satelital del lugar (RF-CTX-01, RF-CTX-03). Cada parte falla por separado (RNF-14). */
export function PanelContexto() {
  const id = useId();
  const punto = usePunto();
  if (!punto) return null;
  const lat = redondear(punto.lat);
  const lon = redondear(punto.lon);
  return (
    <section aria-label="Contexto del lugar" className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          Contexto del lugar
        </h2>
        <p className="text-xs text-tinta-suave">{punto.cual}</p>
      </div>
      <Seguro nombre="El tiempo">
        <Tiempo lat={lat} lon={lon} />
      </Seguro>
      <Seguro nombre="La imagen satelital">
        <ImagenSatelital lat={lat} lon={lon} />
      </Seguro>
    </section>
  );
}
