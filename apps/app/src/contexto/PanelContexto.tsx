import type { components, paths } from "@charmy/contracts-api";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Seguro } from "@/components/Seguro";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bboxDeArea } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";
import { pedir, urlApi } from "@/lib/api";
import { localeActual, t, useIdioma } from "@/relieve/idioma";
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

/** El lugar del contexto: el centro del área de Tu zona (RF-CTX-01). */
function usePunto(): { lat: number; lon: number; cual: string } | null {
  const area = useConsulta((s) => s.area);
  if (!area) return null;
  const [o, s, e, n] = bboxDeArea(area);
  return { lat: (s + n) / 2, lon: (o + e) / 2, cual: t("Centro del área", "Area center") };
}

const redondear = (n: number) => Math.round(n * 1e4) / 1e4;

function Tiempo({ lat, lon }: { lat: number; lon: number }) {
  useIdioma((s) => s.idioma);
  const loc = localeActual();
  const hora = new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit", timeZone: zona });
  const decimal = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
  const entero = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const viento = (p: PuntoTiempo) =>
    t(
      `${entero.format(p.wind_speed_ms * 3.6)} km/h del ${direccionViento(p.wind_dir_deg)}`,
      `${entero.format(p.wind_speed_ms * 3.6)} km/h from the ${direccionViento(p.wind_dir_deg)}`,
    );

  const consulta = useQuery({
    queryKey: ["tiempo", lat, lon],
    queryFn: ({ signal }) => pedir<Tiempo>(`/weather?lat=${lat}&lon=${lon}&hours=12`, { signal }),
  });
  if (consulta.isPending) return <p className="text-sm text-tinta-suave">{t("Buscando el tiempo…", "Loading weather…")}</p>;
  if (consulta.isError)
    return <p className="rounded-control bg-superficie-2 p-2 text-sm">{t("El tiempo no está disponible ahora.", "Weather is not available right now.")}</p>;
  const { now, forecast, source, fetched_at, stale, message } = consulta.data;
  const riesgo = textoRiesgo(now.fire_risk_index, now.fire_risk_label);
  return (
    <div className="flex flex-col gap-1 text-sm">
      {stale && (
        <p className="rounded-control border border-aviso-borde p-2 text-aviso-texto">
          {t("Copia guardada", "Cached copy")}:{" "}
          {message ?? t("la fuente no responde y mostramos los últimos datos que tenemos.", "the source is not responding; showing the latest cached data.")}
        </p>
      )}
      <p>
        {t("Viento", "Wind")}: <strong>{viento(now)}</strong>. {t("Temperatura", "Temperature")}: {decimal.format(now.temperature_c)} °C.{" "}
        {t("Humedad", "Humidity")}: {entero.format(now.relative_humidity_pct)} %.
      </p>
      {riesgo && (
        <p>
          {t("Riesgo de incendio", "Fire risk")}: <strong>{riesgo}</strong>
        </p>
      )}
      {forecast.length > 0 && (
        <ul aria-label={t("Pronóstico", "Forecast")} className="flex flex-wrap gap-x-3 font-mono text-xs text-tinta-suave">
          {forecast.slice(0, 4).map((p) => (
            <li key={p.time}>
              {hora.format(new Date(p.time))}: {viento(p)}, {decimal.format(p.temperature_c)} °C
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">
        {t(
          `Fuente: ${source}. Datos de las ${hora.format(new Date(fetched_at))}`,
          `Source: ${source}. Data from ${hora.format(new Date(fetched_at))}`,
        )}
      </p>
    </div>
  );
}

function ImagenSatelital({ lat, lon }: { lat: number; lon: number }) {
  useIdioma((s) => s.idioma);
  const loc = localeActual();
  const fechaLarga = new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: zona });
  const entero = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
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
        aria-label={t("Estilo de la imagen", "Image style")}
        value={estilo}
        onValueChange={(v) => v && cambiar({ estilo: v as EstiloImagen, capa: null })}
      >
        <ToggleGroupItem value="color_real">{t("Color real", "True color")}</ToggleGroupItem>
        <ToggleGroupItem value="falso_color">{t("Falso color", "False color")}</ToggleGroupItem>
      </ToggleGroup>
      {consulta.isPending && <p className="text-tinta-suave">{t("Buscando la imagen más reciente…", "Looking for the latest image…")}</p>}
      {consulta.isError && (
        <p className="rounded-control bg-superficie-2 p-2">
          {t("La imagen satelital no está disponible ahora. El resto sigue funcionando.", "Satellite imagery is not available right now. Everything else keeps working.")}
        </p>
      )}
      {consulta.isSuccess && url && rota === url && (
        <p className="rounded-control bg-superficie-2 p-2">
          {t("La imagen no se pudo cargar. Probá de nuevo en un rato.", "The image could not be loaded. Try again shortly.")}
        </p>
      )}
      {consulta.isSuccess && url && rota !== url && (
        <>
          <img
            onError={() => {
              setRota(url);
              if (capa?.url === url) cambiar({ capa: null });
            }}
            src={url}
            alt={t(
              `Imagen satelital ${estilo === "falso_color" ? "en falso color" : "en color real"} del ${fechaLarga.format(new Date(consulta.data.acquired_at))}`,
              `${estilo === "falso_color" ? "False-color" : "True-color"} satellite image from ${fechaLarga.format(new Date(consulta.data.acquired_at))}`,
            )}
            className="w-full rounded-control border"
          />
          <p className="text-xs">
            {fechaLarga.format(new Date(consulta.data.acquired_at))} · {t("Nubes", "Clouds")}: {entero.format(consulta.data.cloud_cover_pct)} % ·{" "}
            {consulta.data.source}
          </p>
          <p className="text-xs text-tinta-suave">{consulta.data.attribution}</p>
          {estilo === "falso_color" && (
            <p className="text-xs text-tinta-suave">
              {t("En falso color, lo quemado se ve oscuro y el fuego activo, brillante.", "In false color, burned areas appear dark and active fire appears bright.")}
            </p>
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
            {t("Mostrar la imagen en el mapa", "Show image on map")}
          </label>
        </>
      )}
    </div>
  );
}

/** Tiempo e imagen satelital del lugar (RF-CTX-01, RF-CTX-03). Cada parte falla por separado (RNF-14). */
export function PanelContexto() {
  useIdioma((s) => s.idioma);
  const id = useId();
  const punto = usePunto();
  if (!punto) return null;
  const lat = redondear(punto.lat);
  const lon = redondear(punto.lon);
  return (
    <section aria-label={t("Contexto del lugar", "Place context")} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {t("Contexto del lugar", "Place context")}
        </h2>
        <p className="text-xs text-tinta-suave">{punto.cual}</p>
      </div>
      <Seguro nombre={t("El tiempo", "Weather")}>
        <Tiempo lat={lat} lon={lon} />
      </Seguro>
      <Seguro nombre={t("La imagen satelital", "Satellite imagery")}>
        <ImagenSatelital lat={lat} lon={lon} />
      </Seguro>
    </section>
  );
}
