import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { bboxDeArea } from "@/consulta/consulta";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";

vi.mock("@/relieve/MapaRelieve", () => ({ default: () => <div data-testid="mapa" /> }));
// Tu zona no necesita las regiones ni los focos en vivo de Relieve.
vi.mock("@/relieve/datos", () => ({ useDatosRelieve: () => ({ resumen: {}, vivo: {}, regiones: [], focos: [] }) }));

// Muestras con la forma de los contratos (valores inventados).
const calendario = {
  unit: "dias_celda_con_fuego_equivalente_viirs",
  baseline: "mediana del mismo mes en los años anteriores al último",
  region: "AR-U",
  provisional: true,
  cells: [
    { year: 2025, month: 1, value: 22, median: 4, anomaly: 18, percentile: 99, origin: "viirs_medido" },
    { year: 2025, month: 2, value: 3, median: 3, anomaly: 0, percentile: 50, origin: "viirs_medido" },
    { year: 2026, month: 1, value: 1, median: 4, anomaly: -3, percentile: 10, origin: "viirs_medido" },
  ],
};
const georef = {
  cantidad: 1,
  localidades: [{ id: "26035030", nombre: "Esquel", provincia: { nombre: "Chubut" }, centroide: { lat: -42.9173, lon: -71.3216 } }],
};
const area = {
  type: "Polygon" as const,
  coordinates: [[[-71.6, -42.2], [-71.0, -42.2], [-71.0, -42.8], [-71.6, -42.8], [-71.6, -42.2]]],
};

const fetchSimulado = vi.fn<typeof fetch>();
let georefFalla = false;

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
  georefFalla = false;
  fetchSimulado.mockReset();
  fetchSimulado.mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes("georef")) return georefFalla ? new Response("{}", { status: 500 }) : new Response(JSON.stringify(georef));
    if (u.includes("/calendar")) return new Response(JSON.stringify(calendario));
    if (u.includes("/health")) return new Response(JSON.stringify({ status: "ok" }));
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }));
  });
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState({ ...estadoInicialConsulta("2026-11-14") });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("búsqueda por localidad (RF-MAP-03)", () => {
  it("busca en Georef y al elegir un resultado arma el área alrededor de la localidad", async () => {
    montar();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Buscar una localidad"), "esquel");
    await u.click(screen.getByRole("button", { name: "Buscar" }));
    const pedido = fetchSimulado.mock.calls.map(([x]) => new URL(String(x))).find((x) => x.pathname.includes("georef"));
    expect(pedido?.searchParams.get("nombre")).toBe("esquel");
    await u.click(await screen.findByRole("button", { name: "Esquel, Chubut" }));
    const [oeste, sur, este, norte] = bboxDeArea(useConsulta.getState().area ?? area);
    expect(oeste).toBeLessThan(-71.32);
    expect(este).toBeGreaterThan(-71.32);
    expect(sur).toBeLessThan(-42.92);
    expect(norte).toBeGreaterThan(-42.92);
  });

  it("si Georef falla, avisa y el resto sigue", async () => {
    georefFalla = true;
    montar();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Buscar una localidad"), "esquel");
    await u.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText(/la búsqueda de localidades no está disponible/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitud")).toBeInTheDocument();
    expect(await screen.findByTestId("mapa")).toBeInTheDocument();
  });
});
