import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { direccionViento, urlImagen } from "@/contexto/contexto";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";
import { useVivo } from "@/vivo/estado";

vi.mock("@/relieve/MapaRelieve", () => ({ default: () => <div data-testid="mapa" /> }));
// Tu zona no necesita las regiones ni los focos en vivo de Relieve.
vi.mock("@/relieve/datos", () => ({ useDatosRelieve: () => ({ resumen: {}, vivo: {}, regiones: [], focos: [] }) }));

// Muestras con la forma del contrato (valores inventados).
const tiempo = {
  source: "Meteomatics",
  fetched_at: "2026-11-14T12:00:00Z",
  now: {
    time: "2026-11-14T12:00:00Z",
    wind_speed_ms: 8.2,
    wind_dir_deg: 270,
    temperature_c: 24.5,
    relative_humidity_pct: 22,
    fire_risk_index: 3,
    fire_risk_label: "alto",
  },
  forecast: [
    { time: "2026-11-14T15:00:00Z", wind_speed_ms: 9, wind_dir_deg: 265, temperature_c: 25.1, relative_humidity_pct: 20, fire_risk_label: "alto" },
  ],
};
const imagen = {
  image_id: "muestra-img-0001",
  image_url: "/api/v1/imagery/muestra-img-0001.png",
  bbox: [-71.35, -42.15, -71.22, -42.08],
  acquired_at: "2026-11-10T14:22:00Z",
  cloud_cover_pct: 4.1,
  style: "color_real",
  source: "Copernicus Sentinel-2 L2A",
  attribution: "Contiene datos modificados de Copernicus Sentinel 2026",
};
const area = {
  type: "Polygon" as const,
  coordinates: [[[-71.6, -42.2], [-71.0, -42.2], [-71.0, -42.8], [-71.6, -42.8], [-71.6, -42.2]]],
};

const fetchSimulado = vi.fn<typeof fetch>();
let falla: "tiempo" | "imagen" | "prediccion" | null = null;
// Muestra de /forecast/zone (valores inventados): dos meses de pronóstico y uno más adelante.
const mesZona = (month: string, horizon: number, probability: number) => ({
  month,
  horizon,
  kind: horizon <= 2 ? "forecast" : "usual_adjusted",
  probability,
  usual_probability: 0.2,
  expected_cells: 0.5,
  usual_cells: 0.4,
  level: "baja",
  skill_vs_climatology: 0.12,
});
const prediccionZona = {
  model: "charmy-eventos-v1",
  emission: "2026-10",
  zone: { cells: 30, no_history: false },
  months: [mesZona("2026-11", 1, 0.31), mesZona("2026-12", 2, 0.21), mesZona("2027-01", 3, 0.1)],
};

/** Monta la app y abre la pestaña Lugar del panel de Experto, donde va el contexto (F4-D8). */
function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const vista = render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Lugar" }));
  return vista;
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.prueba/api/v1");
  falla = null;
  fetchSimulado.mockReset();
  fetchSimulado.mockImplementation(async (url) => {
    const u = String(url);
    const error = new Response(JSON.stringify({ code: "fuente_no_disponible", message: "x" }), { status: 503 });
    if (u.includes("/weather")) return falla === "tiempo" ? error : new Response(JSON.stringify(tiempo));
    if (u.includes("/imagery/latest")) return falla === "imagen" ? error : new Response(JSON.stringify(imagen));
    if (u.includes("/forecast/zone"))
      return falla === "prediccion" ? error : new Response(JSON.stringify(prediccionZona));
    if (u.includes("/health")) return new Response(JSON.stringify({ status: "ok" }));
    if (u.includes("/calendar")) return new Response(JSON.stringify({ unit: "x", baseline: "x", provisional: false, cells: [] }));
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }));
  });
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState({ ...estadoInicialConsulta("2026-11-14"), area });
  useVivo.setState({ reportando: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("panel de contexto del lugar (RF-CTX-01, RF-CTX-03)", () => {
  it("muestra viento, riesgo e imagen con fecha, nubosidad y atribución", async () => {
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    expect(within(panel).getByText(/centro del área/i)).toBeInTheDocument();
    expect(await within(panel).findByText(/30 km\/h/)).toBeInTheDocument();
    expect(within(panel).getAllByText(/del oeste/).length).toBeGreaterThan(0);
    expect(within(panel).getByText(/24,5 °C/)).toBeInTheDocument();
    expect(within(panel).getByText(/22 %/)).toBeInTheDocument();
    expect(
      within(panel).getByText((_, el) => el?.tagName === "P" && /riesgo de incendio: alto/i.test(el.textContent ?? "")),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/Meteomatics/)).toBeInTheDocument();
    const img = await within(panel).findByRole("img", { name: /imagen satelital/i });
    expect(img).toHaveAttribute("src", "http://api.prueba/api/v1/imagery/muestra-img-0001.png");
    expect(within(panel).getByText(/10 de noviembre de 2026/)).toBeInTheDocument();
    expect(within(panel).getByText(/nubes: 4 %/i)).toBeInTheDocument();
    expect(within(panel).getByText("Contiene datos modificados de Copernicus Sentinel 2026")).toBeInTheDocument();
    // Pide el tiempo y la imagen del centro del área.
    const urls = fetchSimulado.mock.calls.map(([x]) => new URL(String(x)));
    const pedidoTiempo = urls.find((x) => x.pathname.endsWith("/weather"));
    expect(Number(pedidoTiempo?.searchParams.get("lat"))).toBeCloseTo(-42.5, 1);
    expect(Number(pedidoTiempo?.searchParams.get("lon"))).toBeCloseTo(-71.3, 1);
  });

  it("si /weather falla, el tiempo dice «no disponible» y la imagen se ve", async () => {
    falla = "tiempo";
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    expect(await within(panel).findByText(/el tiempo no está disponible/i)).toBeInTheDocument();
    expect(await within(panel).findByRole("img", { name: /imagen satelital/i })).toBeInTheDocument();
  });

  it("si /imagery falla, la imagen dice «no disponible» y el tiempo se ve", async () => {
    falla = "imagen";
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    expect(await within(panel).findByText(/la imagen satelital no está disponible/i)).toBeInTheDocument();
    expect(await within(panel).findByText(/30 km\/h/)).toBeInTheDocument();
  });

  it("el estilo «falso color» pide esa imagen", async () => {
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    await within(panel).findByRole("img", { name: /imagen satelital/i });
    await userEvent.setup().click(within(panel).getByRole("radio", { name: /falso color/i }));
    const estilos = fetchSimulado.mock.calls
      .map(([x]) => new URL(String(x)))
      .filter((x) => x.pathname.endsWith("/imagery/latest"))
      .map((x) => x.searchParams.get("style"));
    expect(estilos).toContain("falso_color");
  });
});

describe("predicción del área (F4-D12)", () => {
  it("pide la predicción del área dibujada y la dice en probabilidad", async () => {
    montar();
    const seccion = await screen.findByRole("region", { name: "Predicción del área" });
    expect(await within(seccion).findByText("Probabilidad de fuego: 31 %, más que el 20 % habitual.")).toBeInTheDocument();
    expect(within(seccion).getAllByText("Pronóstico")).toHaveLength(2);
    const pedido = fetchSimulado.mock.calls.find(([u]) => String(u).includes("/forecast/zone"));
    expect(JSON.parse(String(pedido?.[1]?.body))).toEqual({ geometry: area });
  });

  it("si la predicción no responde, lo dice y el resto del lugar sigue", async () => {
    falla = "prediccion";
    montar();
    const seccion = await screen.findByRole("region", { name: "Predicción del área" });
    expect(await within(seccion).findByText(/La predicción no está disponible ahora/)).toBeInTheDocument();
  });
});

describe("funciones del contexto", () => {
  it("nombra la dirección de donde viene el viento", () => {
    expect(direccionViento(270)).toBe("oeste");
    expect(direccionViento(0)).toBe("norte");
    expect(direccionViento(225)).toBe("sudoeste");
    expect(direccionViento(359)).toBe("norte");
  });
  it("arma la URL de la imagen con el origen de la API", () => {
    expect(urlImagen("http://api.prueba/api/v1", "/api/v1/imagery/a.png")).toBe("http://api.prueba/api/v1/imagery/a.png");
    expect(urlImagen("http://api.prueba/api/v1", "https://otro/a.png")).toBe("https://otro/a.png");
  });
});

describe("una parte complementaria que falla no rompe la app (RNF-14)", () => {
  it("si /weather responde con otra forma, el panel dice «no disponible» y el mapa y el resto siguen", async () => {
    fetchSimulado.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/weather")) return new Response(JSON.stringify({ inesperado: true }));
      if (u.includes("/imagery/latest")) return new Response(JSON.stringify(imagen));
      if (u.includes("/health")) return new Response(JSON.stringify({ status: "ok" }));
      return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }));
    });
    montar();
    expect(await screen.findByText(/el tiempo no está disponible/i)).toBeInTheDocument();
    expect(await screen.findByTestId("mapa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 · Dónde" })).toBeInTheDocument();
  });
});

describe("imagen que no carga", () => {
  it("si el PNG no llega, lo dice en lugar de mostrar una imagen rota", async () => {
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    fireEvent.error(await within(panel).findByRole("img", { name: /imagen satelital/i }));
    expect(await within(panel).findByText(/la imagen no se pudo cargar/i)).toBeInTheDocument();
    expect(within(panel).queryByRole("img", { name: /imagen satelital/i })).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText(/mostrar la imagen en el mapa/i)).not.toBeInTheDocument();
  });
});

describe("/weather real de services/contexto (#141)", () => {
  const conTiempo = (t: unknown) =>
    fetchSimulado.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/weather")) return new Response(JSON.stringify(t));
      if (u.includes("/imagery/latest")) return new Response(JSON.stringify(imagen));
      if (u.includes("/health")) return new Response(JSON.stringify({ status: "ok" }));
      return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }));
    });
  const sinEtiqueta = (indice: number) => ({
    ...tiempo,
    now: { ...tiempo.now, fire_risk_index: indice, fire_risk_label: undefined },
  });

  it("sin etiqueta, explica el índice de 0 a 1: desde 0,5 el riesgo sube", async () => {
    conTiempo(sinEtiqueta(0.72));
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    expect(
      await within(panel).findByText(
        (_, el) => el?.tagName === "P" && /riesgo de incendio: por encima de lo habitual \(índice 0,72 de 1\)/i.test(el.textContent ?? ""),
      ),
    ).toBeInTheDocument();
  });

  it("con índice bajo dice que está por debajo", async () => {
    conTiempo(sinEtiqueta(0.2));
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    expect(
      await within(panel).findByText(
        (_, el) => el?.tagName === "P" && /riesgo de incendio: bajo \(índice 0,2 de 1\)/i.test(el.textContent ?? ""),
      ),
    ).toBeInTheDocument();
  });

  it("si es la copia de respaldo (D-26), lo avisa con su fecha", async () => {
    conTiempo({ ...tiempo, stale: true, message: "Meteomatics no responde: son los datos guardados del 14/11 a las 09:00." });
    montar();
    const panel = await screen.findByRole("region", { name: "Contexto del lugar" });
    expect(await within(panel).findByText(/son los datos guardados del 14\/11 a las 09:00/)).toBeInTheDocument();
    expect(within(panel).getByText(/copia/i)).toBeInTheDocument();
  });
});
