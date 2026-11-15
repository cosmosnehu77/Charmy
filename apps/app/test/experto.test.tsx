import { rampaAnomalia } from "@charmy/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { armarGrilla, type CeldaCalendario } from "@/calendario/grilla";
import { useApp } from "@/estado/app";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";
import { atributosFoco } from "@/experto/atributos";
import { calendarioCsv, calendarioSvg } from "@/experto/archivos";
import { filtrarPorMes, mesesDelPeriodo } from "@/experto/meses";

vi.mock("@/relieve/MapaRelieve", () => ({ default: () => <div data-testid="mapa" /> }));
// Tu zona no necesita las regiones ni los focos en vivo de Relieve.
vi.mock("@/relieve/datos", () => ({ useDatosRelieve: () => ({ resumen: {}, vivo: {}, regiones: [], focos: [] }) }));

// Muestras con la forma de los contratos (valores inventados).
const metricas = {
  method: "log-linear por región y mes, validación dejando un año afuera",
  overlap: "modis_snpp 2012-01/2026-07; noaa20_snpp 2018-04/2026-07",
  regions: [
    { region: "AR-U", pair: "modis_snpp", r2: 0.82, bias: -0.05, mae: 1.3, n_months: 160, provisional: true },
    { region: "AR-V", pair: "noaa20_snpp", r2: null, bias: null, mae: 0, n_months: 96, provisional: true },
  ],
};
const calendario = {
  unit: "dias_celda_con_fuego_equivalente_viirs",
  baseline: "mediana del mismo mes en los años anteriores al último",
  region: "AR-U",
  provisional: true,
  cells: [
    { year: 2025, month: 1, value: 22, median: 4, anomaly: 18, percentile: 99, origin: "viirs_medido" },
    { year: 2025, month: 2, value: 0, median: 3, anomaly: -3, percentile: 20, origin: "viirs_medido" },
  ],
};
const foco = (id: string, fecha: string) => ({
  type: "Feature" as const,
  id,
  geometry: { type: "Point" as const, coordinates: [-71.3, -42.9] },
  properties: {
    acq_datetime: fecha,
    satellite: "N20" as const,
    instrument: "VIIRS" as const,
    confidence: "nominal" as const,
    frp: 12.4,
    daynight: "D" as const,
    cell_id: "-429_-713",
  },
});
const focos = { type: "FeatureCollection" as const, features: [foco("a", "2025-01-10T18:00:00Z"), foco("b", "2025-02-03T05:00:00Z")] };
const area = {
  type: "Polygon" as const,
  coordinates: [[[-71.6, -42.2], [-71.0, -42.2], [-71.0, -42.8], [-71.6, -42.8], [-71.6, -42.2]]],
};

const fetchSimulado = vi.fn<typeof fetch>();
function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.prueba/api/v1");
  fetchSimulado.mockReset();
  fetchSimulado.mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes("/harmonization/metrics")) return new Response(JSON.stringify(metricas));
    if (u.includes("/calendar")) return new Response(JSON.stringify(calendario));
    if (u.includes("/health")) return new Response(JSON.stringify({ status: "ok" }));
    return new Response(JSON.stringify(focos));
  });
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState({ ...estadoInicialConsulta("2026-11-14"), desde: "2025-01-01", hasta: "2025-03-31", area });
  useApp.setState({ modo: "experto" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("panel de validación (RF-ARM-04)", () => {
  it("muestra las métricas del mock por región y tramo", async () => {
    montar();
    const panel = await screen.findByRole("region", { name: "Validación de la armonización" });
    const tabla = await within(panel).findByRole("table");
    const filas = within(tabla).getAllByRole("row");
    expect(filas[1]).toHaveTextContent(/AR-U.*MODIS → S-NPP.*0,82.*−0,05.*1,3.*160/);
    expect(filas[2]).toHaveTextContent(/AR-V.*NOAA-20 → S-NPP.*sin fuego en el solape/);
    expect(within(panel).getByText("Dato de ejemplo")).toBeInTheDocument();
    expect(within(panel).getByText(/dejando un año afuera/)).toBeInTheDocument();
  });

  it("no aparece en el modo novato", async () => {
    useApp.setState({ modo: "novato" });
    montar();
    await screen.findByTestId("mapa");
    expect(screen.queryByRole("region", { name: "Validación de la armonización" })).not.toBeInTheDocument();
  });
});

describe("descargas extra (RF-EXP-02)", () => {
  it("el GeoJSON usa los mismos parámetros que el mapa", async () => {
    useConsulta.setState({ fuente: "modis", confianzaMin: "high" });
    montar();
    const enlace = await screen.findByRole("link", { name: /focos \(GeoJSON\)/i });
    const url = new URL(enlace.getAttribute("href") ?? "");
    expect(url.pathname).toBe("/api/v1/hotspots");
    expect(url.searchParams.get("source")).toBe("modis");
    expect(url.searchParams.get("min_confidence")).toBe("high");
    expect(url.searchParams.get("from")).toBe("2025-01-01");
    expect(url.searchParams.has("format")).toBe(false);
    expect(await screen.findByRole("button", { name: /calendario \(CSV\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /calendario \(imagen\)/i })).toBeInTheDocument();
  });

  it("el CSV del calendario trae una fila por celda con sus columnas", () => {
    const csv = calendarioCsv(calendario as never);
    const [encabezado, primera] = csv.trim().split("\n");
    expect(encabezado).toBe("anio,mes,valor,mediana,anomalia,percentil,origen,region,provisional");
    expect(primera).toBe("2025,1,22,4,18,99,viirs_medido,AR-U,true");
  });

  it("la imagen del calendario es un SVG con un rectángulo por mes coloreado con la rampa", () => {
    const svg = calendarioSvg(armarGrilla(calendario.cells as CeldaCalendario[], 2025, 2025), "anomalia", "Calendario de quema");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.match(/<rect /g)).toHaveLength(12);
    expect(svg).toContain(`fill="${rampaAnomalia[6]}"`);
    expect(svg).toContain("Calendario de quema");
  });
});

describe("reproducción temporal (RF-MAP-07)", () => {
  it("arma los meses del período y filtra los focos de cada mes", () => {
    expect(mesesDelPeriodo("2025-01-15", "2025-03-02")).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(filtrarPorMes(focos as never, "2025-02").features.map((f) => f.id)).toEqual(["b"]);
    expect(filtrarPorMes(focos as never, null).features).toHaveLength(2);
  });

  it("avanza mes a mes y se pausa", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    montar();
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const control = await screen.findByRole("group", { name: "Reproducir por mes" });
    await u.click(within(control).getByRole("button", { name: "Reproducir" }));
    expect(within(control).getByText("enero de 2025")).toBeInTheDocument();
    expect(useConsulta.getState().mesReproduccion).toBe("2025-01");
    expect(await screen.findByText(/1 foco en el área en enero de 2025/)).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1600));
    expect(within(control).getByText("febrero de 2025")).toBeInTheDocument();
    await u.click(within(control).getByRole("button", { name: "Pausar" }));
    await act(async () => vi.advanceTimersByTime(5000));
    expect(within(control).getByText("febrero de 2025")).toBeInTheDocument();
    await u.click(within(control).getByRole("button", { name: "Ver todo el período" }));
    expect(useConsulta.getState().mesReproduccion).toBeNull();
  });
});

describe("atributos originales del foco (RF-MOD-02)", () => {
  it("lista los campos del foco con nombres claros", () => {
    const filas = Object.fromEntries(atributosFoco(foco("a", "2025-01-10T18:00:00Z").properties));
    expect(filas["Satélite"]).toBe("NOAA-20 (VIIRS)");
    expect(filas["Fecha y hora (UTC)"]).toBe("2025-01-10 18:00");
    expect(filas["Confianza"]).toBe("nominal");
    expect(filas["Potencia radiativa (FRP)"]).toBe("12,4 MW");
    expect(filas["Momento"]).toBe("día");
    expect(filas["Celda de 0,1°"]).toBe("-429_-713");
  });
});

describe("atributos de un foco sin FRP", () => {
  it("dice «sin dato» en la potencia", () => {
    const p = { ...foco("a", "2025-01-10T18:00:00Z").properties, frp: null as unknown as number };
    expect(Object.fromEntries(atributosFoco(p))["Potencia radiativa (FRP)"]).toBe("sin dato");
  });
});
