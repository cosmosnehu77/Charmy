import { colorSinDato, rampaAnomalia, rampaConteo } from "@charmy/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { armarGrilla, colorCelda, type CeldaCalendario } from "@/calendario/calendario";
import { Calendario } from "@/calendario/Calendario";
import { rutaCsv } from "@/consulta/consulta";
import { useApp } from "@/estado/app";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";

vi.mock("@/mapa/Mapa", () => ({ default: () => <div data-testid="mapa" /> }));

// Muestra provisoria con la forma del contrato (valores inventados).
const calendario = {
  unit: "dias_celda_con_fuego_equivalente_viirs",
  baseline: "mediana 2001-2025 por mes",
  cells: [
    { year: 2025, month: 1, value: 22.0, median: 4.0, percentile: 99, origin: "viirs_medido" },
    { year: 2025, month: 2, value: 0, median: 3.0, percentile: 20, origin: "viirs_medido" },
    { year: 2026, month: 1, value: 3.1, median: 4.0, percentile: 38, origin: "viirs_medido" },
  ],
};
const focos = { type: "FeatureCollection", features: [] };

const area = {
  type: "Polygon" as const,
  coordinates: [
    [
      [-71.6, -42.2],
      [-71.0, -42.2],
      [-71.0, -42.8],
      [-71.6, -42.8],
      [-71.6, -42.2],
    ],
  ],
};

const fetchSimulado = vi.fn<typeof fetch>();
const responder = (calendarioOk = true) =>
  fetchSimulado.mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes("/calendar"))
      return calendarioOk ? new Response(JSON.stringify(calendario)) : new Response("{}", { status: 500 });
    return new Response(JSON.stringify(focos));
  });

const hexARgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

function montar(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.prueba/api/v1");
  fetchSimulado.mockReset();
  responder();
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState({ ...estadoInicialConsulta("2026-11-14"), desde: "2025-01-01", area });
  useApp.setState({ modo: "novato", perfilMapa: "2d" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lógica del calendario", () => {
  const celdas = calendario.cells as CeldaCalendario[];
  it("arma una fila por año del período y 12 meses por fila", () => {
    const grilla = armarGrilla(celdas, 2024, 2026);
    expect(grilla.map((f) => f.year)).toEqual([2024, 2025, 2026]);
    expect(grilla.every((f) => f.meses.length === 12)).toBe(true);
    expect(grilla[1]?.meses[0]?.value).toBe(22);
    expect(grilla[0]?.meses[0]).toBeNull();
  });
  it("los colores salen de las rampas de @charmy/ui", () => {
    const [enero, febrero] = celdas;
    expect(colorCelda(enero ?? null, "anomalia")).toBe(rampaAnomalia[6]);
    expect(colorCelda(enero ?? null, "cantidad")).toBe(rampaConteo[5]); // 22 está entre 20 y 50
    expect(colorCelda(febrero ?? null, "cantidad")).toBe(rampaConteo[0]);
    expect(colorCelda(null, "cantidad")).toBe(colorSinDato);
  });
});

describe("rutaCsv", () => {
  it("usa los mismos parámetros que la consulta de focos y pide CSV", () => {
    const url = new URL(
      rutaCsv({ bbox: [-71.6, -42.8, -71, -42.2], desde: "2025-01-01", hasta: "2026-11-14", fuente: "modis", confianzaMin: "high" }),
      "http://x",
    );
    expect(url.pathname).toBe("/hotspots");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      bbox: "-71.6,-42.8,-71,-42.2",
      from: "2025-01-01",
      to: "2026-11-14",
      source: "modis",
      min_confidence: "high",
      format: "csv",
    });
  });
});

describe("calendario (F2-D2)", () => {
  it("con la respuesta del mock dibuja una celda por año y mes, con encabezados accesibles", async () => {
    montar(<Calendario />);
    const tabla = await screen.findByRole("table", { name: /calendario de quema/i });
    expect(within(tabla).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Año", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ]);
    const filas = within(tabla).getAllByRole("rowheader");
    expect(filas.map((f) => f.textContent)).toEqual(["2025", "2026"]);
    expect(within(tabla).getAllByRole("cell")).toHaveLength(24);
  });

  it("pide el calendario del área y los años del período", async () => {
    montar(<Calendario />);
    await screen.findByRole("table");
    const pedido = fetchSimulado.mock.calls.find(([u]) => String(u).includes("/calendar"));
    expect(pedido?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(pedido?.[1]?.body))).toEqual({ area, from_year: 2025, to_year: 2026, resolution: "month" });
  });

  it("«sin dato» y «cero» se ven distintos", async () => {
    montar(<Calendario />);
    await userEvent.setup().click(await screen.findByRole("radio", { name: "Cantidad" }));
    const cero = screen.getByRole("cell", { name: /febrero de 2025: 0 /i });
    const sinDato = screen.getByRole("cell", { name: /marzo de 2025: sin dato/i });
    expect(cero).toHaveTextContent("0");
    expect(sinDato).toHaveTextContent("—");
    expect(cero.style.backgroundColor).toBe(hexARgb(rampaConteo[0]));
    expect(sinDato.style.backgroundColor).toBe(hexARgb(colorSinDato));
  });

  it("colorea la anomalía con la rampa PuOr y la explica en texto", async () => {
    montar(<Calendario />);
    const enero = await screen.findByRole("cell", { name: /enero de 2025: 22.*percentil 99/i });
    expect(enero.style.backgroundColor).toBe(hexARgb(rampaAnomalia[6]));
  });

  it("el botón de CSV arma la URL con los mismos filtros", async () => {
    useConsulta.setState({ fuente: "viirs", confianzaMin: "high" });
    montar(<Calendario />);
    const enlace = await screen.findByRole("link", { name: /descargar csv/i });
    const url = new URL(enlace.getAttribute("href") ?? "");
    expect(url.pathname).toBe("/api/v1/hotspots");
    expect(url.searchParams.get("format")).toBe("csv");
    expect(url.searchParams.get("source")).toBe("viirs");
    expect(url.searchParams.get("min_confidence")).toBe("high");
    expect(url.searchParams.get("from")).toBe("2025-01-01");
    expect(url.searchParams.get("to")).toBe("2026-11-14");
  });

  it("si la API falla, el calendario dice «no disponible» y el mapa sigue", async () => {
    responder(false);
    montar(<App />);
    expect(await screen.findByText(/el calendario no está disponible/i)).toBeInTheDocument();
    expect(await screen.findByTestId("mapa")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/0 focos en el área/)).toBeInTheDocument());
  });
});
