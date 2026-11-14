import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { bboxDeArea } from "@/consulta/consulta";
import { useApp } from "@/estado/app";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";
import { conclusionDelArea } from "@/novato/conclusion";

vi.mock("@/mapa/Mapa", () => ({ default: () => <div data-testid="mapa" /> }));

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
  useApp.setState({ modo: "novato", perfilMapa: "2d", recorridoVisto: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("recorrido de Charmy (RF-CHA-05)", () => {
  it("aparece la primera vez en modo novato, avanza, retrocede y se puede saltar", async () => {
    useApp.setState({ recorridoVisto: false });
    montar();
    const u = userEvent.setup();
    const recorrido = await screen.findByRole("region", { name: "Recorrido de Charmy" });
    expect(within(recorrido).getByText(/Paso 1 de/)).toBeInTheDocument();
    expect(within(recorrido).getByRole("button", { name: "Atrás" })).toBeDisabled();
    await u.click(within(recorrido).getByRole("button", { name: "Siguiente" }));
    expect(within(recorrido).getByText(/Paso 2 de/)).toBeInTheDocument();
    await u.click(within(recorrido).getByRole("button", { name: "Atrás" }));
    expect(within(recorrido).getByText(/Paso 1 de/)).toBeInTheDocument();
    await u.click(within(recorrido).getByRole("button", { name: "Saltar" }));
    expect(screen.queryByRole("region", { name: "Recorrido de Charmy" })).not.toBeInTheDocument();
    expect(useApp.getState().recorridoVisto).toBe(true);
  });

  it("al llegar al último paso, «Terminar» lo cierra", async () => {
    useApp.setState({ recorridoVisto: false });
    montar();
    const u = userEvent.setup();
    const recorrido = await screen.findByRole("region", { name: "Recorrido de Charmy" });
    while (within(recorrido).queryByRole("button", { name: "Siguiente" })) {
      await u.click(within(recorrido).getByRole("button", { name: "Siguiente" }));
    }
    await u.click(within(recorrido).getByRole("button", { name: "Terminar" }));
    expect(screen.queryByRole("region", { name: "Recorrido de Charmy" })).not.toBeInTheDocument();
  });

  it("no aparece en modo experto y se puede volver a ver desde el encabezado", async () => {
    useApp.setState({ modo: "experto", recorridoVisto: false });
    montar();
    expect(screen.queryByRole("region", { name: "Recorrido de Charmy" })).not.toBeInTheDocument();
    useApp.setState({ modo: "novato", recorridoVisto: true });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Ver el recorrido" }));
    expect(await screen.findByRole("region", { name: "Recorrido de Charmy" })).toBeInTheDocument();
  });
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

describe("conclusión del área en lenguaje simple (RF-MOD-01)", () => {
  it("dice si el último mes estuvo por encima, dentro o por debajo de lo normal, y cuál fue el pico", () => {
    const texto = conclusionDelArea(calendario as never);
    expect(texto).toMatch(/enero de 2026 hubo menos fuego que lo normal/);
    expect(texto).toMatch(/más fuego.*enero de 2025/);
    expect(texto).toMatch(/datos de ejemplo/);
    expect(texto).not.toMatch(/percentil|anomalía|VIIRS|MODIS/);
  });

  it("si no hay celdas, usa el motivo de la API", () => {
    expect(conclusionDelArea({ ...calendario, provisional: false, message: "Fuera de cobertura.", cells: [] } as never)).toBe(
      "Fuera de cobertura.",
    );
  });

  it("la muestra en el modo novato, junto al calendario", async () => {
    useConsulta.setState({ area });
    montar();
    expect(await screen.findByText(/hubo menos fuego que lo normal/)).toBeInTheDocument();
  });
});

describe("modos (RF-MOD-01, RF-MOD-03)", () => {
  it("el modo novato oculta los filtros técnicos y el experto los muestra", async () => {
    montar();
    expect(screen.queryByLabelText("Serie")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("radio", { name: "Experto" }));
    expect(screen.getByLabelText("Serie")).toBeInTheDocument();
  });

  it("cambiar de modo no pierde el área ni las fechas", async () => {
    useConsulta.setState({ area, desde: "2024-03-01", hasta: "2026-10-31" });
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("radio", { name: "Experto" }));
    await u.click(screen.getByRole("radio", { name: "Novato" }));
    await waitFor(() => expect(useConsulta.getState().area).toEqual(area));
    expect(useConsulta.getState().desde).toBe("2024-03-01");
    expect(useConsulta.getState().hasta).toBe("2026-10-31");
  });
});

describe("calendario sin jerga en el modo novato (RF-MOD-01)", () => {
  it("en novato explica el calendario sin siglas ni términos técnicos", async () => {
    useConsulta.setState({ area });
    montar();
    const seccion = (await screen.findByRole("heading", { name: "Calendario de quema" })).closest("section") as HTMLElement;
    await within(seccion).findByRole("table");
    expect(seccion.textContent).not.toMatch(/VIIRS|MODIS|días-celda|mediana|percentil|anomalía/i);
    expect(within(seccion).getByRole("radio", { name: "Comparado con lo normal" })).toBeInTheDocument();
  });

  it("en experto mantiene la explicación técnica", async () => {
    useApp.setState({ modo: "experto" });
    useConsulta.setState({ area });
    montar();
    expect(await screen.findByText(/equivalente VIIRS/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Anomalía" })).toBeInTheDocument();
  });
});
