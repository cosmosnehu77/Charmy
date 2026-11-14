import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { useApp } from "@/estado/app";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";
import { useVivo } from "@/vivo/estado";

vi.mock("@/mapa/Mapa", () => ({ default: () => <div data-testid="mapa" /> }));

// Muestras con la forma del contrato (valores inventados).
const vivo = {
  type: "FeatureCollection",
  fetched_at: "2026-11-14T05:30:00Z",
  stale: false,
  features: [
    {
      type: "Feature",
      id: "N21-2026-11-14T05:12:00Z--45.86100--67.51200",
      geometry: { type: "Point", coordinates: [-67.512, -45.861] },
      properties: {
        acq_datetime: "2026-11-14T05:12:00Z",
        satellite: "N21",
        instrument: "VIIRS",
        confidence: "nominal",
        frp: 9.8,
        daynight: "N",
        fixed_source: true,
        verdict: "fuente_fija",
      },
    },
    {
      type: "Feature",
      id: "N20-2026-11-14T04:40:00Z--42.11800--71.28700",
      geometry: { type: "Point", coordinates: [-71.287, -42.118] },
      properties: {
        acq_datetime: "2026-11-14T04:40:00Z",
        satellite: "N20",
        instrument: "VIIRS",
        confidence: "high",
        frp: 27.3,
        daynight: "N",
        fixed_source: false,
        verdict: "probable",
      },
    },
  ],
};
const evidencia = {
  verdict: "probable",
  score: 0.64,
  signals: { satellite: 0.8, fixed_source: 0, news: 0.5, reports: 0 },
  evidence: [
    { kind: "satelite", title: "Dos pasadas de VIIRS con el foco en la misma celda", label: "apoya" },
    { kind: "noticia", title: "Titular de ejemplo sobre un incendio en la zona", url: "https://example.org/n", label: "apoya" },
  ],
};

const fetchSimulado = vi.fn<typeof fetch>();
let reportesFallan = false;
let vivoViejo = false;

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
  reportesFallan = false;
  vivoViejo = false;
  fetchSimulado.mockReset();
  fetchSimulado.mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.includes("/evidence")) return new Response(JSON.stringify(evidencia));
    if (u.includes("/live"))
      return new Response(
        JSON.stringify(vivoViejo ? { ...vivo, stale: true, message: "Los focos son de la consulta de las 05:30." } : vivo),
      );
    if (u.includes("/reports") && init?.method === "POST")
      return reportesFallan
        ? new Response(JSON.stringify({ code: "demasiados_reportes", message: "Hiciste muchos reportes seguidos. Probá en unos minutos." }), { status: 429 })
        : new Response(JSON.stringify({ id: "r-1", status: "sin_verificar" }), { status: 201 });
    if (u.includes("/health")) return new Response(JSON.stringify({ status: "ok" }));
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }));
  });
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState({ ...estadoInicialConsulta("2026-11-14") });
  useApp.setState({ modo: "novato", perfilMapa: "2d", recorridoVisto: true });
  useVivo.setState({ visible: false, seleccionado: null, reportando: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("focos en vivo (RF-VIV-01, RF-VIV-02)", () => {
  it("cada foco reciente muestra su veredicto y, al elegirlo, su evidencia", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("checkbox", { name: /focos de las últimas 48 horas/i }));
    const lista = await screen.findByRole("list", { name: "Focos recientes" });
    const items = within(lista).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Ordenados del más nuevo al más viejo, con el veredicto en texto.
    expect(items[0]).toHaveTextContent(/Probable fuente fija/);
    expect(items[1]).toHaveTextContent(/Probable/);
    await u.click(within(items[1] as HTMLElement).getByRole("button"));
    const detalle = await screen.findByRole("region", { name: "Foco reciente" });
    expect(await within(detalle).findByText("Dos pasadas de VIIRS con el foco en la misma celda")).toBeInTheDocument();
    expect(within(detalle).getByRole("link", { name: /Titular de ejemplo/ })).toHaveAttribute("href", "https://example.org/n");
    expect(within(detalle).getByText(/no reemplaza a los servicios de emergencia/i)).toBeInTheDocument();
    const pedido = fetchSimulado.mock.calls.map(([x]) => String(x)).find((x) => x.includes("/evidence"));
    expect(pedido).toContain(encodeURIComponent("N20-2026-11-14T04:40:00Z--42.11800--71.28700"));
  });

  it("si los datos están viejos, lo avisa", async () => {
    vivoViejo = true;
    montar();
    await userEvent.setup().click(screen.getByRole("checkbox", { name: /focos de las últimas 48 horas/i }));
    expect(await screen.findByText("Los focos son de la consulta de las 05:30.")).toBeInTheDocument();
  });
});

describe("reporte ciudadano (RF-ALE-01, RF-ALE-06)", () => {
  async function abrirFormulario() {
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Reportar un foco" }));
    const form = await screen.findByRole("form", { name: "Reportar un foco" });
    return { u, form };
  }

  it("valida las coordenadas y muestra el aviso de emergencias", async () => {
    montar();
    const { u, form } = await abrirFormulario();
    expect(within(form).getByText(/no reemplaza a los servicios de emergencia/i)).toBeInTheDocument();
    await u.type(within(form).getByLabelText("Latitud del foco"), "-95");
    await u.type(within(form).getByLabelText("Longitud del foco"), "-71,3");
    await u.click(within(form).getByRole("button", { name: "Enviar reporte" }));
    expect(within(form).getByRole("alert")).toHaveTextContent(/latitud/i);
    expect(fetchSimulado.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("confirma el envío con el estado «sin verificar» y no manda datos personales", async () => {
    montar();
    const { u, form } = await abrirFormulario();
    await u.type(within(form).getByLabelText("Latitud del foco"), "-42,12");
    await u.type(within(form).getByLabelText("Longitud del foco"), "-71,29");
    await u.type(within(form).getByLabelText(/Qué ves/), "Columna de humo detrás del cerro");
    await u.click(within(form).getByRole("button", { name: "Enviar reporte" }));
    expect(await screen.findByText(/recibimos tu reporte/i)).toBeInTheDocument();
    const [, init] = fetchSimulado.mock.calls.find(([, i]) => i?.method === "POST") ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ lat: -42.12, lon: -71.29, description: "Columna de humo detrás del cerro" });
  });

  it("si la API falla, muestra el error y no pierde lo escrito", async () => {
    reportesFallan = true;
    montar();
    const { u, form } = await abrirFormulario();
    await u.type(within(form).getByLabelText("Latitud del foco"), "-42,12");
    await u.type(within(form).getByLabelText("Longitud del foco"), "-71,29");
    await u.type(within(form).getByLabelText(/Qué ves/), "Humo");
    await u.click(within(form).getByRole("button", { name: "Enviar reporte" }));
    expect(await within(form).findByText(/Hiciste muchos reportes seguidos/)).toBeInTheDocument();
    expect(within(form).getByLabelText("Latitud del foco")).toHaveValue("-42,12");
    expect(within(form).getByLabelText(/Qué ves/)).toHaveValue("Humo");
  });
});
