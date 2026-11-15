import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Area, Fechas, Filtros, Resultado } from "@/consulta/PanelConsulta";
import { useFocos } from "@/consulta/useFocos";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";

const respuesta = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "muestra-1",
      geometry: { type: "Point", coordinates: [-71.3, -42.9] },
      properties: {
        acq_datetime: "2026-11-12T18:00:00Z",
        satellite: "N20",
        instrument: "VIIRS",
        confidence: "nominal",
        frp: 12,
        daynight: "D",
      },
    },
  ],
};

const fetchSimulado = vi.fn<typeof fetch>();

/** Las piezas de la consulta, como las arma Tu zona en Relieve (#276), sin el calendario ni el contexto. */
function PanelDePrueba() {
  const { focos, errorFechas, consulta, hayArea } = useFocos();
  return (
    <>
      <Area />
      <Fechas error={errorFechas} />
      <Filtros />
      <Resultado
        focos={focos?.features.length ?? null}
        cargando={consulta.isFetching}
        fallo={consulta.isError}
        hayArea={hayArea && !errorFechas}
        total={consulta.data?.truncated ? (consulta.data.total ?? null) : null}
        mes={null}
      />
    </>
  );
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PanelDePrueba />
    </QueryClientProvider>,
  );
}

const urlsPedidas = () => fetchSimulado.mock.calls.map(([u]) => new URL(String(u)));

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.prueba/api/v1");
  fetchSimulado.mockReset();
  fetchSimulado.mockResolvedValue(new Response(JSON.stringify(respuesta), { status: 200 }));
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState({ ...estadoInicialConsulta("2026-11-14") });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function elegirPunto(lat: string, lon: string) {
  const u = userEvent.setup();
  await u.clear(screen.getByLabelText("Latitud"));
  await u.type(screen.getByLabelText("Latitud"), lat);
  await u.clear(screen.getByLabelText("Longitud"));
  await u.type(screen.getByLabelText("Longitud"), lon);
  await u.click(screen.getByRole("button", { name: "Usar este punto" }));
  return u;
}

describe("panel de consulta (F2-D1)", () => {
  it("con latitud y longitud válidas actualiza el área y consulta los focos", async () => {
    montar();
    await elegirPunto("-42.9", "-71.3");
    expect(useConsulta.getState().area?.type).toBe("Polygon");
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const url = urlsPedidas()[0];
    expect(url?.pathname).toBe("/api/v1/hotspots");
    const [oeste, sur, este, norte] = (url?.searchParams.get("bbox") ?? "").split(",").map(Number);
    expect(oeste).toBeLessThan(-71.3);
    expect(este).toBeGreaterThan(-71.3);
    expect(sur).toBeLessThan(-42.9);
    expect(norte).toBeGreaterThan(-42.9);
    expect(await screen.findByText(/1 foco/)).toBeInTheDocument();
  });

  it("pide los focos como GeoJSON, el tipo que declara el contrato", async () => {
    montar();
    await elegirPunto("-42.9", "-71.3");
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const cabeceras = new Headers(fetchSimulado.mock.calls[0]?.[1]?.headers);
    expect(cabeceras.get("Accept")).toBe("application/geo+json");
  });

  it("con latitud fuera de rango muestra el error y no consulta", async () => {
    montar();
    await elegirPunto("-95", "-71.3");
    expect(screen.getByRole("alert")).toHaveTextContent(/latitud/i);
    expect(useConsulta.getState().area).toBeNull();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("con «desde» posterior a «hasta» bloquea la consulta con un mensaje", async () => {
    montar();
    const u = await elegirPunto("-42.9", "-71.3");
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));
    fetchSimulado.mockClear();
    // «desde» queda en 2022-01-01 (valor inicial) y «hasta» pasa a ser anterior.
    await u.clear(screen.getByLabelText("Hasta"));
    await u.type(screen.getByLabelText("Hasta"), "2021-06-01");
    expect(await screen.findByRole("alert")).toHaveTextContent(/desde.*hasta/i);
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("la consulta lleva las fechas y los filtros elegidos", async () => {
    montar();
    const u = await elegirPunto("-42.9", "-71.3");
    await u.selectOptions(screen.getByLabelText("Serie"), "viirs");
    await u.selectOptions(screen.getByLabelText("Confianza mínima"), "high");
    await waitFor(() =>
      expect(urlsPedidas().some((x) => x.searchParams.get("source") === "viirs" && x.searchParams.get("min_confidence") === "high")).toBe(true),
    );
    const ultima = urlsPedidas().at(-1);
    expect(ultima?.searchParams.get("from")).toBe("2022-01-01"); // por defecto, los últimos 5 años calendario
    expect(ultima?.searchParams.get("to")).toBe("2026-11-14");
  });

  it("los filtros de intensidad y momento no hacen otra consulta y cambian el conteo", async () => {
    montar();
    const u = await elegirPunto("-42.9", "-71.3");
    expect(await screen.findByText(/1 foco/)).toBeInTheDocument();
    const pedidos = fetchSimulado.mock.calls.length;
    await u.selectOptions(screen.getByLabelText("Momento del día"), "N");
    expect(await screen.findByText(/0 focos/)).toBeInTheDocument();
    expect(fetchSimulado.mock.calls.length).toBe(pedidos);
  });

  it("si la API falla, avisa que los focos no están disponibles", async () => {
    fetchSimulado.mockResolvedValue(new Response("{}", { status: 500 }));
    montar();
    await elegirPunto("-42.9", "-71.3");
    expect(await screen.findByText(/no están disponibles/i)).toBeInTheDocument();
  });
});

describe("tope de /hotspots (#127)", () => {
  it("si la respuesta viene cortada, avisa cuántos hay y pide achicar la búsqueda", async () => {
    fetchSimulado.mockResolvedValue(
      new Response(JSON.stringify({ ...respuesta, truncated: true, total: 31234 }), { status: 200 }),
    );
    montar();
    await elegirPunto("-42.9", "-71.3");
    expect(await screen.findByText(/mostramos los primeros 20\.000 de 31\.234 focos/i)).toBeInTheDocument();
    expect(screen.getByText(/achicá el área o el período/i)).toBeInTheDocument();
  });

  it("sin truncated no muestra el aviso", async () => {
    montar();
    await elegirPunto("-42.9", "-71.3");
    await screen.findByText(/1 foco/);
    expect(screen.queryByText(/mostramos los primeros/i)).not.toBeInTheDocument();
  });
});

describe("espera larga de /hotspots", () => {
  it("si tarda más de 8 s, avisa que el servidor se puede estar despertando", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchSimulado.mockImplementation(() => new Promise(() => {}));
    montar();
    await elegirPunto("-42.9", "-71.3");
    expect(screen.queryByText(/se está despertando/i)).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(9000));
    expect(screen.getByText(/se está despertando/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
