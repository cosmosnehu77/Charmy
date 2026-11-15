import { colorSinDato, rampaAnomalia, rampaConteo } from "@charmy/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { armarGrilla, colorCelda, describirCelda, type CeldaCalendario } from "@/calendario/grilla";
import { Calendario } from "@/calendario/Calendario";
import { rutaCsv } from "@/consulta/consulta";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";

vi.mock("@/relieve/MapaRelieve", () => ({ default: () => <div data-testid="mapa" /> }));
// Tu zona no necesita las regiones ni los focos en vivo de Relieve.
vi.mock("@/relieve/datos", () => ({ useDatosRelieve: () => ({ resumen: {}, vivo: {}, regiones: [], focos: [] }) }));

// Muestra provisoria con la forma del contrato (valores inventados).
const calendario = {
  unit: "dias_celda_con_fuego_equivalente_viirs",
  baseline: "mediana del mismo mes en los años anteriores al último",
  region: "AR-U",
  provisional: true,
  cells: [
    { year: 2025, month: 1, value: 22.0, median: 4.0, anomaly: 18.0, percentile: 99, origin: "viirs_medido" },
    { year: 2025, month: 2, value: 0, median: 3.0, anomaly: -3.0, percentile: 20, origin: "viirs_medido" },
    { year: 2026, month: 1, value: 3.1, median: 4.0, anomaly: -0.9, percentile: 38, origin: "viirs_medido" },
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
    const [, cuerpo] = within(tabla).getAllByRole("rowgroup");
    const filas = within(cuerpo!).getAllByRole("rowheader");
    expect(filas.map((f) => f.textContent)).toEqual(["2025", "2026"]);
    expect(within(cuerpo!).getAllByRole("cell")).toHaveLength(24);
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
    const enlace = await screen.findByRole("link", { name: "Focos (CSV)" });
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

describe("estadísticas del calendario (F4-R2)", () => {
  const verEstadisticas = async () => {
    montar(<Calendario />);
    await userEvent.setup().click(await screen.findByRole("radio", { name: "Estadísticas" }));
    return screen.getByRole("region", { name: "Estadísticas del calendario" });
  };

  it("son una tercera opción después de Cantidad, y la grilla queda sola", async () => {
    montar(<Calendario />);
    const opciones = within(await screen.findByRole("radiogroup", { name: /qué mostrar/i })).getAllByRole("radio");
    expect(opciones.map((o) => o.textContent)).toEqual(["Anomalía", "Cantidad", "Estadísticas"]);
    expect(screen.queryByRole("region", { name: "Estadísticas del calendario" })).not.toBeInTheDocument();
  });

  it("en Estadísticas no hay grilla; vuelve con Anomalía", async () => {
    await verEstadisticas();
    expect(screen.queryByRole("table", { name: /calendario de quema/i })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("radio", { name: "Anomalía" }));
    expect(screen.getByRole("table", { name: /calendario de quema/i })).toBeInTheDocument();
  });

  it("resume el período: total, mes pico, año con más fuego y meses fuera de lo normal", async () => {
    const resumen = await verEstadisticas();
    expect(within(resumen).getByText("Total del período").nextSibling).toHaveTextContent("25,1");
    expect(within(resumen).getByText("Mes pico").nextSibling).toHaveTextContent("enero de 2025");
    expect(within(resumen).getByText("Año con más fuego").nextSibling).toHaveTextContent("2025");
    expect(within(resumen).getByText("Meses sobre lo normal").nextSibling).toHaveTextContent("1 de 3");
  });

  it("compara el último año con los anteriores hasta el mismo mes", async () => {
    const resumen = await verEstadisticas();
    expect(within(resumen).getByText("Año 2026").nextSibling).toHaveTextContent("−86 %");
  });

  it("muestra el total de cada año con sus meses fuera de lo normal", async () => {
    const resumen = await verEstadisticas();
    const anios = within(resumen).getByRole("list", { name: /cada año/i });
    const filas = within(anios).getAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent(/2025.*22.*1 sobre lo normal/);
    expect(filas[1]).toHaveTextContent(/2026.*3,1/);
  });

  it("la temporada muestra el promedio de cada mes, con su texto para lectores de pantalla", async () => {
    const resumen = await verEstadisticas();
    const temporada = within(resumen).getByRole("list", { name: /temporada/i });
    expect(within(temporada).getAllByRole("listitem")).toHaveLength(12);
    expect(within(temporada).getByRole("listitem", { name: /enero: 12,6 en promedio/i })).toBeInTheDocument();
    expect(within(temporada).getByRole("listitem", { name: /marzo: sin dato/i })).toBeInTheDocument();
  });

  it("dice de qué origen sale cada mes", async () => {
    const resumen = await verEstadisticas();
    expect(within(resumen).getByText(/VIIRS medido/)).toHaveTextContent(/3 meses/);
  });

  it("sin «Minimizar» no se puede plegar; con él, el botón avisa", async () => {
    const minimizar = vi.fn();
    const { unmount } = montar(<Calendario />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /minimizar el calendario/i })).not.toBeInTheDocument();
    unmount();
    montar(<Calendario onMinimizar={minimizar} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /minimizar el calendario/i }));
    expect(minimizar).toHaveBeenCalledOnce();
  });
});

describe("describirCelda: origen de cada valor", () => {
  const celda = (origin: string) =>
    ({ year: 2020, month: 3, value: 1, median: 1, anomaly: 0, percentile: 50, origin }) as unknown as CeldaCalendario;
  it.each([
    ["modis_convertido", "MODIS convertido"],
    ["viirs_medido", "VIIRS medido"],
    ["viirs_convertido", "VIIRS NOAA-20 convertido"],
    ["modis_medido", "MODIS medido"],
  ])("%s se describe como «%s»", (origen, texto) => {
    expect(describirCelda(celda(origen), 2020, 2)).toContain(texto);
  });
  it("un origen desconocido se muestra tal cual, sin inventar", () => {
    expect(describirCelda(celda("goes_medido"), 2020, 2)).toContain("goes_medido");
  });
});

describe("calendario sin celdas o con área inválida", () => {
  it("si no hay celdas muestra el motivo que manda la API, sin grilla", async () => {
    fetchSimulado.mockImplementation(async (url) =>
      String(url).includes("/calendar")
        ? new Response(
            JSON.stringify({
              unit: "x",
              baseline: "mediana del mismo mes en los años anteriores al último",
              provisional: false,
              message: "El área está fuera de la cobertura del MVP (Argentina y Chile).",
              cells: [],
            }),
          )
        : new Response(JSON.stringify(focos)),
    );
    montar(<Calendario />);
    expect(await screen.findByText("El área está fuera de la cobertura del MVP (Argentina y Chile).")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("si la API rechaza el área (400) muestra su mensaje", async () => {
    fetchSimulado.mockImplementation(async (url) =>
      String(url).includes("/calendar")
        ? new Response(JSON.stringify({ code: "poligono_invalido", message: "El polígono se cruza consigo mismo." }), { status: 400 })
        : new Response(JSON.stringify(focos)),
    );
    montar(<Calendario />);
    expect(await screen.findByText(/El polígono se cruza consigo mismo\./)).toBeInTheDocument();
    expect(screen.queryByText(/no está disponible/)).not.toBeInTheDocument();
  });
});

describe("contrato de /calendar v0.2 (#118)", () => {
  it("con provisional muestra «Dato de ejemplo»", async () => {
    montar(<Calendario />);
    expect(await screen.findByText("Dato de ejemplo")).toBeInTheDocument();
  });

  it("sin provisional no muestra la etiqueta", async () => {
    fetchSimulado.mockImplementation(async (url) =>
      String(url).includes("/calendar")
        ? new Response(JSON.stringify({ ...calendario, provisional: false }))
        : new Response(JSON.stringify(focos)),
    );
    montar(<Calendario />);
    await screen.findByRole("table");
    expect(screen.queryByText("Dato de ejemplo")).not.toBeInTheDocument();
  });

  it("nombra la región de calibración", async () => {
    montar(<Calendario />);
    expect(await screen.findByText(/región AR-U/)).toBeInTheDocument();
  });

  it("la descripción de la celda incluye la anomalía con su signo", () => {
    const [enero, febrero] = calendario.cells as CeldaCalendario[];
    expect(describirCelda(enero ?? null, 2025, 0)).toMatch(/anomalía \+18/);
    expect(describirCelda(febrero ?? null, 2025, 1)).toMatch(/anomalía −3/);
  });
});
