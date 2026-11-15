import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { useApp } from "@/estado/app";
import { useRelieve } from "@/relieve/estado";

// jsdom no tiene WebGL: el mapa de Relieve se revisa en el navegador.
vi.mock("@/relieve/MapaRelieve", () => ({ default: () => <div data-testid="mapa-relieve" /> }));

const cuadrado = (x: number) => ({
  type: "Polygon",
  coordinates: [[[x, -40], [x + 2, -40], [x + 2, -38], [x, -38], [x, -40]]],
});
// Muestra con la forma del contrato (valores inventados).
const resumen = {
  type: "FeatureCollection",
  hours: 120,
  days: ["2026-11-12", "2026-11-13", "2026-11-14"],
  live: { available: true, fetched_at: "2026-11-14T11:30:00Z", stale: false },
  features: [
    {
      type: "Feature",
      id: "AR-Q",
      geometry: cuadrado(-71),
      properties: {
        region: "AR-Q",
        name: "Neuquén",
        country: "Argentina",
        hotspots: 30,
        frp_mw: 120.5,
        by_day: [10, 15, 5],
        frp_by_day: [40, 60, 20.5],
        last_month: { year: 2026, month: 10, value: 41.4, median: 34.3, percentile: 75 },
      },
    },
    {
      type: "Feature",
      id: "CL-AR",
      geometry: cuadrado(-74),
      properties: {
        region: "CL-AR",
        name: "La Araucanía",
        country: "Chile",
        hotspots: 4,
        frp_mw: 9,
        by_day: [1, 2, 1],
        frp_by_day: [2, 5, 2],
        last_month: null,
      },
    },
  ],
};
const vivo = {
  type: "FeatureCollection",
  fetched_at: "2026-11-14T11:30:00Z",
  stale: false,
  features: [
    {
      type: "Feature",
      id: "N20-2026-11-14T05:12:00Z--39.00000--70.00000",
      geometry: { type: "Point", coordinates: [-70, -39] },
      properties: { acq_datetime: "2026-11-14T05:12:00Z", satellite: "N20", instrument: "VIIRS", confidence: "high", frp: 42.5, daynight: "N" },
    },
  ],
};

const fetchSimulado = vi.fn<typeof fetch>();
let resumenFalla = false;

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
  resumenFalla = false;
  fetchSimulado.mockReset();
  fetchSimulado.mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes("/regions/summary"))
      return resumenFalla
        ? new Response(JSON.stringify({ code: "datos_no_disponibles", message: "No disponible" }), { status: 503 })
        : new Response(JSON.stringify(resumen));
    if (u.includes("/live")) return new Response(JSON.stringify(vivo));
    if (u.includes("/calendar"))
      return new Response(JSON.stringify({ unit: "u", baseline: "b", region: "AR-Q", provisional: false, cells: [{ year: 2025, month: 1, value: 3, median: 2, anomaly: 1, percentile: 60 }] }));
    return new Response(JSON.stringify({ status: "ok" }));
  });
  vi.stubGlobal("fetch", fetchSimulado);
  useApp.setState({ vista: "relieve" });
  useRelieve.setState({ pestana: "focos", seleccion: null, linea: { activa: false, dia: 0, play: false }, plano: false, focoVivo: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("vista Relieve (F4-R1)", () => {
  it("arranca en Relieve con la píldora, el ranking y el aviso de emergencias", async () => {
    montar();
    const pestanas = screen.getByRole("tablist", { name: "Indicador" });
    expect(within(pestanas).getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Focos",
      "Intensidad",
      "Anomalía",
      "Riesgo",
      "Predicción",
      "En vivo",
    ]);
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    expect(await within(ranking).findByText("Neuquén")).toBeInTheDocument();
    expect(screen.getByText(/no reemplaza a los servicios de emergencia/)).toBeInTheDocument();
  });

  it("el ranking va sobre vidrio, así se lee aunque el mapa acercado ponga regiones de color debajo (#214)", async () => {
    montar();
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    expect(await within(ranking).findByText("Neuquén")).toBeInTheDocument();
    expect(ranking).toHaveClass("vidrio-relieve");
  });

  it("Charmy en la píldora lleva a la landing", () => {
    montar();
    expect(screen.getByRole("link", { name: "Charmy: ir a la página de inicio" })).toHaveAttribute(
      "href",
      "https://charmy-landing.pages.dev",
    );
  });

  it("elegir una provincia abre su ficha y la línea de tiempo; elegirla de nuevo las cierra", async () => {
    montar();
    const u = userEvent.setup();
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    await u.click(await within(ranking).findByRole("button", { name: /Neuquén/ }));
    const ficha = screen.getByRole("region", { name: "Ficha de Neuquén" });
    expect(within(ficha).getByText("Entre las de más fuego")).toBeInTheDocument();
    expect(within(ficha).getByText("30")).toBeInTheDocument();
    expect(within(ficha).getByText(/Octubre 2026: bastante por encima de lo normal/)).toBeInTheDocument();
    const linea = screen.getByRole("group", { name: "Focos por día en Neuquén" });
    await u.click(within(linea).getByRole("button", { name: "13/11: 15 focos" }));
    expect(useRelieve.getState().linea).toMatchObject({ activa: true, dia: 1 });
    expect(within(linea).getByText("13/11 · 15 focos")).toBeInTheDocument();
    await u.click(within(ranking).getByRole("button", { name: /Neuquén/ }));
    expect(screen.queryByRole("region", { name: "Ficha de Neuquén" })).not.toBeInTheDocument();
  });

  it("en celular, con la ficha abierta, el aviso de emergencias queda encima y Charmy guía se guarda (#218)", async () => {
    montar();
    const u = userEvent.setup();
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    await u.click(await within(ranking).findByRole("button", { name: /Neuquén/ }));
    // jsdom no aplica las media queries: se revisan las clases de celular (max-md:).
    const ficha = screen.getByRole("region", { name: "Ficha de Neuquén" });
    const aviso = screen.getAllByText(/no reemplaza a los servicios de emergencia/).find((p) => !ficha.contains(p));
    expect(aviso?.parentElement).toHaveClass("max-md:z-40");
    expect(screen.getByRole("button", { name: /Charmy: ¿necesitás ayuda\?/ }).parentElement).toHaveClass("max-md:hidden");
  });

  it("la lupa busca provincias sin importar los acentos", async () => {
    montar();
    const u = userEvent.setup();
    await screen.findByRole("region", { name: "Ranking" });
    await u.type(screen.getByRole("combobox", { name: "Buscá tu provincia o región" }), "araucania");
    await u.keyboard("{Enter}");
    expect(useRelieve.getState().seleccion).toBe("CL-AR");
  });

  it("En vivo muestra los focos recientes y la ficha de cada uno", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "En vivo" }));
    const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
    expect(await within(panel).findByText("1")).toBeInTheDocument();
    await u.click(within(panel).getByRole("button", { name: /Neuquén.*42,5 MW/ }));
    const ficha = screen.getByRole("region", { name: "Ficha del foco" });
    expect(within(ficha).getByText("NOAA-20")).toBeInTheDocument();
    expect(within(ficha).getByText("Muy fuerte", { exact: false })).toBeInTheDocument();
  });

  it("si la API falla, lo dice y el resto de la vista sigue", async () => {
    resumenFalla = true;
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("no están disponibles ahora");
    expect(screen.getByRole("tablist", { name: "Indicador" })).toBeInTheDocument();
  });

  it("se puede ir a la consulta por área y volver", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Consulta por área y fechas" }));
    expect(useApp.getState().vista).toBe("consulta");
    await u.click(screen.getByRole("button", { name: "Mapa por provincia" }));
    expect(useApp.getState().vista).toBe("relieve");
  });
});
