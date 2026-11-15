import { Pentagon, Square, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ModoDibujo, useConsulta } from "@/estado/consulta";
import { areaDesdePunto, type Confianza, type Fuente, INICIO_DATOS, leerPunto, type Momento, validarPunto } from "./consulta";
import { useApp } from "@/estado/app";
import { nombreMes, Reproduccion } from "@/experto/Reproduccion";
import { BuscarLocalidad } from "@/novato/BuscarLocalidad";
import { useFocos } from "./useFocos";

/** Tope de focos por respuesta de /hotspots en GeoJSON (decisión del 14/11, #127). */
const LIMITE_FOCOS = 20_000;

const control =
  "min-h-9 w-full rounded-control border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const etiqueta = "flex flex-col gap-1 text-sm font-medium";

function Campo({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={etiqueta}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export function Area() {
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

  const dibujar = (modo: ModoDibujo) => cambiar({ dibujando: dibujando === modo ? null : modo });

  return (
    <section aria-labelledby="titulo-area" className="flex flex-col gap-3">
      <h2 id="titulo-area" className="text-lg font-semibold">
        Área
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" aria-pressed={dibujando === "rectangle"} onClick={() => dibujar("rectangle")}>
          <Square aria-hidden="true" />
          Dibujar rectángulo
        </Button>
        <Button variant="outline" size="sm" aria-pressed={dibujando === "polygon"} onClick={() => dibujar("polygon")}>
          <Pentagon aria-hidden="true" />
          Dibujar polígono
        </Button>
        {area && (
          <Button variant="ghost" size="sm" onClick={() => cambiar({ area: null, dibujando: null })}>
            <Trash2 aria-hidden="true" />
            Borrar área
          </Button>
        )}
      </div>
      {dibujando && (
        <p className="text-xs text-tinta-suave">
          {dibujando === "rectangle"
            ? "Hacé clic en dos esquinas opuestas del mapa."
            : "Hacé clic en cada vértice y doble clic en el último para cerrar."}
        </p>
      )}
      <BuscarLocalidad />
      <form onSubmit={usarPunto} className="flex flex-col gap-2" noValidate>
        <p className="text-sm text-tinta-suave">O escribí un punto y un radio:</p>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Latitud">
            {(id) => (
              <input id={id} className={control} inputMode="decimal" placeholder="-42,90" value={lat} onChange={(e) => setLat(e.target.value)} />
            )}
          </Campo>
          <Campo label="Longitud">
            {(id) => (
              <input id={id} className={control} inputMode="decimal" placeholder="-71,30" value={lon} onChange={(e) => setLon(e.target.value)} />
            )}
          </Campo>
        </div>
        <Campo label="Radio">
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
          Usar este punto
        </Button>
      </form>
    </section>
  );
}

export function Fechas({ error }: { error: string | null }) {
  const { desde, hasta, hoy, cambiar } = useConsulta();
  return (
    <section aria-labelledby="titulo-fechas" className="flex flex-col gap-3">
      <h2 id="titulo-fechas" className="text-lg font-semibold">
        Período
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Desde">
          {(id) => (
            <input id={id} type="date" className={control} min={INICIO_DATOS} max={hoy} value={desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          )}
        </Campo>
        <Campo label="Hasta">
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

export function Filtros() {
  const { fuente, confianzaMin, frpMin, momento, cambiar } = useConsulta();
  return (
    <section aria-labelledby="titulo-filtros" className="flex flex-col gap-3">
      <h2 id="titulo-filtros" className="text-lg font-semibold">
        Filtros
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Serie">
          {(id) => (
            <select id={id} className={control} value={fuente} onChange={(e) => cambiar({ fuente: e.target.value as Fuente })}>
              <option value="harmonized">Armonizada</option>
              <option value="modis">MODIS</option>
              <option value="viirs">VIIRS</option>
            </select>
          )}
        </Campo>
        <Campo label="Confianza mínima">
          {(id) => (
            <select id={id} className={control} value={confianzaMin} onChange={(e) => cambiar({ confianzaMin: e.target.value as Confianza })}>
              <option value="low">Baja</option>
              <option value="nominal">Nominal</option>
              <option value="high">Alta</option>
            </select>
          )}
        </Campo>
        <Campo label="Potencia mínima (MW)">
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
        <Campo label="Momento del día">
          {(id) => (
            <select id={id} className={control} value={momento} onChange={(e) => cambiar({ momento: e.target.value as Momento })}>
              <option value="todos">Día y noche</option>
              <option value="D">Día</option>
              <option value="N">Noche</option>
            </select>
          )}
        </Campo>
      </div>
    </section>
  );
}

const enteros = new Intl.NumberFormat("es-AR");

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
  let texto = "Elegí un área para ver sus focos.";
  if (hayArea && cargando)
    texto = demora
      ? "Buscando focos… La primera búsqueda puede tardar: el servidor se está despertando."
      : "Buscando focos…";
  else if (fallo) texto = "Los focos no están disponibles ahora. Probá de nuevo en un rato.";
  else if (focos !== null) {
    const donde = mes ? `en el área en ${nombreMes(mes)}` : "en el área y el período";
    texto = focos === 1 ? `1 foco ${donde}.` : `${focos} focos ${donde}.`;
  }
  return (
    <div role="status" className="flex flex-col gap-1 rounded-control bg-superficie-2 p-2 text-sm">
      <p>{texto}</p>
      {total !== null && !cargando && !fallo && (
        <p className="text-aviso-texto">
          Hay muchos focos: mostramos los primeros {enteros.format(LIMITE_FOCOS)} de {enteros.format(total)} focos.
          Para verlos todos, achicá el área o el período. El CSV los trae completos.
        </p>
      )}
    </div>
  );
}

export function PanelConsulta() {
  const { focos, errorFechas, consulta, hayArea } = useFocos();
  const modo = useApp((s) => s.modo);
  const mesReproduccion = useConsulta((s) => s.mesReproduccion);
  return (
    <div className="flex flex-col gap-5">
      <Area />
      <Fechas error={errorFechas} />
      {/* Serie, confianza y potencia son términos técnicos: solo en el modo experto (RF-MOD-01). */}
      {modo === "experto" && <Filtros />}
      {modo === "experto" && hayArea && !errorFechas && <Reproduccion />}
      <Resultado
        focos={focos?.features.length ?? null}
        cargando={consulta.isFetching}
        fallo={consulta.isError}
        hayArea={hayArea && !errorFechas}
        total={consulta.data?.truncated ? (consulta.data.total ?? null) : null}
        mes={mesReproduccion}
      />
    </div>
  );
}
