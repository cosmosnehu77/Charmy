import { Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ModoDibujo, useConsulta } from "@/estado/consulta";
import {
  areaDesdePunto,
  type Confianza,
  type Fuente,
  INICIO_DATOS,
  leerPunto,
  type Momento,
  resumenFiltros,
  validarPunto,
} from "./consulta";
import { nombreMes } from "@/experto/Reproduccion";
import { BuscarLocalidad } from "@/novato/BuscarLocalidad";
import { cn } from "@/lib/utils";
import { localeActual, t, useIdioma } from "@/relieve/idioma";
import { useFocos } from "./useFocos";

/** Tope de focos por respuesta de /hotspots en GeoJSON (decisión del 14/11, #127). */
const LIMITE_FOCOS = 20_000;

const control =
  "min-h-9 w-full rounded-control border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const etiqueta = "flex flex-col gap-1 text-sm font-medium";
/** Título de cada paso del panel de Experto (F4-D8): chico, en mayúsculas, numerado. */
const paso = "text-[11.5px] font-semibold uppercase tracking-[0.06em] text-tinta-suave";

function Campo({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={etiqueta}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

/** Cómo se marca el área: dibujando en el mapa, buscando una localidad o con un punto y un radio. */
type Forma = ModoDibujo | "localidad" | "punto";

function BotonForma({
  encendido,
  etiqueta: nombre,
  onClick,
  children,
}: {
  encendido: boolean;
  /** Nombre accesible cuando el texto visible no alcanza («Dibujar rectángulo»). */
  etiqueta?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={encendido}
      aria-label={nombre}
      data-state={encendido ? "on" : "off"}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center justify-center rounded-[calc(var(--radius-control)-2px)] px-1 text-xs font-medium text-muted-foreground transition-colors",
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[state=on]:bg-charmy-llama data-[state=on]:font-semibold data-[state=on]:text-tinta data-[state=on]:shadow-[0_0_14px_var(--charmy-llama)]",
      )}
    >
      {children}
    </button>
  );
}

export function Area() {
  useIdioma((s) => s.idioma);
  const { area, dibujando, cambiar } = useConsulta();
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("25");
  const [error, setError] = useState<string | null>(null);

  const usarPunto = (e: FormEvent) => {
    e.preventDefault();
    const problema = validarPunto(lat, lon);
    setError(problema);
    if (problema) return;
    const [la, lo] = leerPunto(lat, lon);
    cambiar({ area: areaDesdePunto(la, lo, Number(radio)), dibujando: null });
  };

  // Rectángulo y polígono salen del estado del dibujo; localidad y punto, de lo que se eligió acá.
  const [formulario, setFormulario] = useState<"localidad" | "punto" | null>(null);
  const forma: Forma | null = dibujando ?? formulario;
  // Elegir la forma encendida la apaga; elegir otra apaga el dibujo o el formulario que hubiera.
  const elegir = (f: Forma) => {
    const apagar = forma === f;
    if (f === "rectangle" || f === "polygon") {
      setFormulario(null);
      cambiar({ dibujando: apagar ? null : f });
    } else {
      setFormulario(apagar ? null : f);
      cambiar({ dibujando: null });
    }
  };

  return (
    <section aria-labelledby="titulo-area" className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 id="titulo-area" className={paso}>
          {t("1 · Dónde", "1 · Where")}
        </h3>
        {area && (
          <Button variant="ghost" size="sm" onClick={() => cambiar({ area: null, dibujando: null })}>
            <Trash2 aria-hidden="true" />
            {t("Borrar área", "Clear area")}
          </Button>
        )}
      </div>
      {/* Un solo selector: la forma encendida va en el naranja primario de Relieve (como las pestañas). */}
      <div role="group" aria-label={t("Cómo marcar el área", "How to mark the area")} className="grid grid-cols-4 gap-0.5 rounded-control border border-input bg-card p-0.5">
        <BotonForma encendido={forma === "rectangle"} etiqueta={t("Dibujar rectángulo", "Draw rectangle")} onClick={() => elegir("rectangle")}>
          {t("Rectángulo", "Rectangle")}
        </BotonForma>
        <BotonForma encendido={forma === "polygon"} etiqueta={t("Dibujar polígono", "Draw polygon")} onClick={() => elegir("polygon")}>
          {t("Polígono", "Polygon")}
        </BotonForma>
        <BotonForma encendido={forma === "localidad"} onClick={() => elegir("localidad")}>
          {t("Localidad", "Locality")}
        </BotonForma>
        <BotonForma encendido={forma === "punto"} onClick={() => elegir("punto")}>
          {t("Punto", "Point")}
        </BotonForma>
      </div>
      {!forma && <p className="text-xs text-tinta-suave">{t("Elegí cómo marcar el área.", "Choose how to mark the area.")}</p>}
      {dibujando && (
        <div role="status" className="flex items-start gap-2 rounded-control border border-charmy-llama/60 bg-charmy-llama/10 p-2 text-xs">
          <span aria-hidden="true" className="relative mt-1 flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-charmy-llama opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-charmy-llama" />
          </span>
          <p>
            <strong className="block font-semibold">{t("Dibujando en el mapa", "Drawing on the map")}</strong>
            <span className="text-tinta-suave">
              {dibujando === "rectangle"
                ? t("Hacé clic en dos esquinas opuestas del mapa.", "Click two opposite corners on the map.")
                : t(
                    "Hacé clic en cada vértice y doble clic en el último para cerrar.",
                    "Click each vertex and double-click the last one to close.",
                  )}
            </span>
          </p>
        </div>
      )}
      {forma === "localidad" && <BuscarLocalidad />}
      {forma === "punto" && (
      <form onSubmit={usarPunto} className="flex flex-col gap-2" noValidate>
        <div className="grid grid-cols-2 gap-2">
          <Campo label={t("Latitud", "Latitude")}>
            {(id) => (
              <input id={id} className={control} inputMode="decimal" placeholder="-42,90" value={lat} onChange={(e) => setLat(e.target.value)} />
            )}
          </Campo>
          <Campo label={t("Longitud", "Longitude")}>
            {(id) => (
              <input id={id} className={control} inputMode="decimal" placeholder="-71,30" value={lon} onChange={(e) => setLon(e.target.value)} />
            )}
          </Campo>
        </div>
        <Campo label={t("Radio", "Radius")}>
          {(id) => (
            <select id={id} className={control} value={radio} onChange={(e) => setRadio(e.target.value)}>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
            </select>
          )}
        </Campo>
        {error && (
          <p role="alert" className="text-sm text-peligro">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" size="sm" className="self-start">
          {t("Usar este punto", "Use this point")}
        </Button>
      </form>
      )}
    </section>
  );
}

export function Fechas({ error }: { error: string | null }) {
  useIdioma((s) => s.idioma);
  const { desde, hasta, hoy, cambiar } = useConsulta();
  return (
    <section aria-labelledby="titulo-fechas" className="flex flex-col gap-2">
      <h3 id="titulo-fechas" className={paso}>
        {t("2 · Cuándo", "2 · When")}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Campo label={t("Desde", "From")}>
          {(id) => (
            <input id={id} type="date" className={control} min={INICIO_DATOS} max={hoy} value={desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          )}
        </Campo>
        <Campo label={t("Hasta", "To")}>
          {(id) => (
            <input id={id} type="date" className={control} min={INICIO_DATOS} max={hoy} value={hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
          )}
        </Campo>
      </div>
      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
    </section>
  );
}

/** Paso 3, plegado: el resumen dice qué está elegido sin abrirlo (F4-D8). */
export function Filtros() {
  useIdioma((s) => s.idioma);
  const { fuente, confianzaMin, frpMin, momento, cambiar } = useConsulta();
  return (
    <details className="group rounded-control bg-superficie-2 px-3 py-2">
      <summary className="flex min-h-8 cursor-pointer list-none flex-wrap items-center justify-between gap-x-2 gap-y-0.5 [&::-webkit-details-marker]:hidden">
        <span className={paso}>{t("3 · Filtros", "3 · Filters")}</span>
        <span className="text-xs text-tinta-suave">{resumenFiltros({ fuente, confianzaMin, frpMin, momento })}</span>
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Campo label={t("Serie", "Series")}>
          {(id) => (
            <select id={id} className={control} value={fuente} onChange={(e) => cambiar({ fuente: e.target.value as Fuente })}>
              <option value="harmonized">{t("Armonizada", "Harmonized")}</option>
              <option value="modis">MODIS</option>
              <option value="viirs">VIIRS</option>
            </select>
          )}
        </Campo>
        <Campo label={t("Confianza mínima", "Minimum confidence")}>
          {(id) => (
            <select id={id} className={control} value={confianzaMin} onChange={(e) => cambiar({ confianzaMin: e.target.value as Confianza })}>
              <option value="low">{t("Baja", "Low")}</option>
              <option value="nominal">{t("Nominal", "Nominal")}</option>
              <option value="high">{t("Alta", "High")}</option>
            </select>
          )}
        </Campo>
        <Campo label={t("Potencia mínima (MW)", "Minimum power (MW)")}>
          {(id) => (
            <input
              id={id}
              type="number"
              min={0}
              step={1}
              className={control}
              value={frpMin}
              onChange={(e) => cambiar({ frpMin: Math.max(0, Number(e.target.value) || 0) })}
            />
          )}
        </Campo>
        <Campo label={t("Momento del día", "Time of day")}>
          {(id) => (
            <select id={id} className={control} value={momento} onChange={(e) => cambiar({ momento: e.target.value as Momento })}>
              <option value="todos">{t("Día y noche", "Day and night")}</option>
              <option value="D">{t("Día", "Day")}</option>
              <option value="N">{t("Noche", "Night")}</option>
            </select>
          )}
        </Campo>
      </div>
    </details>
  );
}

export function Resultado({
  focos,
  cargando,
  fallo,
  hayArea,
  total,
  mes,
}: {
  focos: number | null;
  cargando: boolean;
  fallo: boolean;
  hayArea: boolean;
  /** Cantidad sin cortar cuando /hotspots llegó al tope (truncated). */
  total: number | null;
  /** Mes de la reproducción temporal (AAAA-MM), si está activa. */
  mes: string | null;
}) {
  useIdioma((s) => s.idioma);
  const enteros = new Intl.NumberFormat(localeActual());
  // El servidor gratuito se duerme: si la búsqueda tarda, se explica por qué (RNF-02).
  const [demora, setDemora] = useState(false);
  useEffect(() => {
    if (!cargando) {
      setDemora(false);
      return;
    }
    const id = setTimeout(() => setDemora(true), 8000);
    return () => clearTimeout(id);
  }, [cargando]);
  let texto = t("Elegí un área para ver sus focos.", "Select an area to view its hotspots.");
  if (hayArea && cargando)
    texto = demora
      ? t(
          "Buscando focos… La primera búsqueda puede tardar: el servidor se está despertando.",
          "Searching for hotspots… The first search may take a moment while the server wakes up.",
        )
      : t("Buscando focos…", "Searching for hotspots…");
  else if (fallo)
    texto = t("Los focos no están disponibles ahora. Probá de nuevo en un rato.", "Hotspots are not available right now. Try again shortly.");
  else if (focos !== null) {
    const donde = mes
      ? t(`en el área en ${nombreMes(mes)}`, `in the area in ${nombreMes(mes)}`)
      : t("en el área y el período", "in the area and period");
    texto =
      focos === 1
        ? t(`1 foco ${donde}.`, `1 hotspot ${donde}.`)
        : t(`${focos} focos ${donde}.`, `${focos} hotspots ${donde}.`);
  }
  return (
    // La franja que lo enmarca (con la reproducción al lado) la pone el panel de Experto (F4-D8).
    <div role="status" className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
      <p>{texto}</p>
      {total !== null && !cargando && !fallo && (
        <p className="text-aviso-texto">
          {t(
            `Hay muchos focos: mostramos los primeros ${enteros.format(LIMITE_FOCOS)} de ${enteros.format(total)} focos. Para verlos todos, achicá el área o el período. El CSV los trae completos.`,
            `There are many hotspots: showing the first ${enteros.format(LIMITE_FOCOS)} of ${enteros.format(total)} hotspots. To view all of them, narrow the area or period. The CSV export includes the full set.`,
          )}
        </p>
      )}
    </div>
  );
}
