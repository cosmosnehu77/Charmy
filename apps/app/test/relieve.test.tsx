import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { estadoInicialConsulta, useConsulta } from "@/estado/consulta";
import { urlGoogleMaps, urlGoogleMapsEmbed } from "@/lib/enlaces";
import { useRelieve } from "@/relieve/estado";
import { useVivo } from "@/vivo/estado";

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
      properties: { acq_datetime: "2026-11-14T05:12:00Z", satellite: "N20", instrument: "VIIRS", confidence: "high", frp: 42.5, daynight: "N", verdict: "probable" },
    },
  ],
};
const evidencia = {
  verdict: "probable",
  score: 0.64,
  signals: { satellite: 0.8, fixed_source: 0, news: 0.5, reports: 0 },
  evidence: [{ kind: "noticia", title: "Titular de ejemplo sobre un incendio", url: "https://example.org/n", label: "apoya" }],
};
const focosZona = {
  type: "FeatureCollection",
  truncated: false,
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-71.3, -42.9] },
      properties: { acq_datetime: "2025-01-10T15:00:00Z", source: "viirs", confidence: "high", frp: 12, daynight: "D" },
    },
  ],
};

const fetchSimulado = vi.fn<typeof fetch>();
let resumenFalla = false;
let calendarioFalla = false;

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
  calendarioFalla = false;
  fetchSimulado.mockReset();
  fetchSimulado.mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes("/regions/summary"))
      return resumenFalla
        ? new Response(JSON.stringify({ code: "datos_no_disponibles", message: "No disponible" }), { status: 503 })
        : new Response(JSON.stringify(resumen));
    if (u.includes("/evidence")) return new Response(JSON.stringify(evidencia));
    if (u.includes("/hotspots")) return new Response(JSON.stringify(focosZona));
    if (u.includes("/weather") || u.includes("/imagery")) return new Response("{}", { status: 503 });
    if (u.includes("/live")) return new Response(JSON.stringify(vivo));
    if (u.includes("/calendar"))
      return calendarioFalla
        ? new Response("{}", { status: 500 })
        : new Response(JSON.stringify({ unit: "u", baseline: "b", region: "AR-Q", provisional: false, cells: [{ year: 2024, month: 1, value: 1, median: 1, anomaly: 0, percentile: 50 }, { year: 2025, month: 1, value: 3, median: 2, anomaly: 1, percentile: 60 }] }));
    return new Response(JSON.stringify({ status: "ok" }));
  });
  vi.stubGlobal("fetch", fetchSimulado);
  useConsulta.setState(estadoInicialConsulta("2026-11-14"));
  useVivo.setState({ satelites: ["N20", "N21"], reportando: false });
  useRelieve.setState({
    pestana: "focos",
    seleccion: null,
    linea: { activa: false, dia: 0, play: false },
    plano: false,
    focoVivo: null,
    nivelesVivo: [],
    ranking: true,
    guia: false,
  });
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
      "Experto",
      "En vivo",
    ]);
    // Experto va sin ícono (F4-D8).
    expect(within(pestanas).getByRole("tab", { name: "Experto" }).querySelector("svg")).toBeNull();
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

  it("el ranking muestra la tendencia de los últimos días, sin contar hoy, y no en Anomalía (F4-D6)", async () => {
    // Hoy es el 14/11: queda afuera. Neuquén: 10 → 15 focos, en alza.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    try {
      montar();
      const u = userEvent.setup();
      const ranking = await screen.findByRole("region", { name: "Ranking" });
      expect(await within(ranking).findByRole("button", { name: /Neuquén.*en alza/ })).toBeInTheDocument();
      await u.click(screen.getByRole("tab", { name: "Anomalía" }));
      expect(within(ranking).queryByText(/en alza|en baja|estable/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("la ficha suma sus números: puesto, este año contra los anteriores y la temporada (F4-D5)", async () => {
    montar();
    const u = userEvent.setup();
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    await u.click(await within(ranking).findByRole("button", { name: /Neuquén/ }));
    const ficha = screen.getByRole("region", { name: "Ficha de Neuquén" });
    const numeros = within(ficha).getByRole("region", { name: "En números" });
    expect(within(numeros).getByText("Puesto por focos").nextSibling).toHaveTextContent(/^1\.º de \d+$/);
    // 2025 hasta enero: 3 días-celda; 2024 hasta enero: 1.
    const anio = await within(numeros).findByText("Año 2025");
    expect(anio.nextSibling).toHaveTextContent("+200 %");
    expect(anio.nextSibling?.nextSibling).toHaveTextContent("hasta enero, contra 2024");
    expect(within(numeros).getByRole("list", { name: /temporada/i })).toBeInTheDocument();
  });

  it("si el calendario de la región falla, la ficha sigue y esa parte dice que no está disponible (F4-D5)", async () => {
    calendarioFalla = true;
    montar();
    const u = userEvent.setup();
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    await u.click(await within(ranking).findByRole("button", { name: /Neuquén/ }));
    const ficha = screen.getByRole("region", { name: "Ficha de Neuquén" });
    expect(await within(ficha).findByText(/La comparación con otros años no está disponible ahora/)).toBeInTheDocument();
    expect(within(ficha).getByText("30")).toBeInTheDocument();
    expect(within(ficha).getByText("Puesto por focos")).toBeInTheDocument();
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

  it("el recorrido de Charmy guía se dibuja fuera de la vista, así ningún panel le queda encima (#226)", async () => {
    montar();
    const u = userEvent.setup();
    await screen.findByRole("region", { name: "Ranking" });
    await u.click(screen.getByRole("button", { name: /Charmy: ¿necesitás ayuda\?/ }));
    const recorrido = await screen.findByRole("dialog", { name: "¡Hola! Soy Charmy" });
    expect(recorrido.parentElement).toBe(document.body);
  });

  it("el recorrido de Charmy explica Experto señalando su pestaña (#281)", async () => {
    // jsdom no mide: con un tamaño falso ningún paso se saltea por no estar en pantalla.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 40));
    montar();
    const u = userEvent.setup();
    await screen.findByRole("region", { name: "Ranking" });
    expect(screen.getByRole("tab", { name: "Experto" })).toHaveAttribute("data-guia", "zona");
    await u.click(screen.getByRole("button", { name: /Charmy: ¿necesitás ayuda\?/ }));
    await screen.findByRole("dialog", { name: "¡Hola! Soy Charmy" });
    await u.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("dialog", { name: "Elegí qué mirar" });
    await u.click(screen.getByRole("button", { name: "Siguiente" }));
    const paso = await screen.findByRole("dialog", { name: "Marcá tu zona" });
    expect(paso).toHaveTextContent(/rectángulo, un polígono, un punto con radio o una localidad/);
    vi.restoreAllMocks();
  });

  it("en la píldora, la pestaña elegida va en naranja y el hover pasa las letras a naranja (#281)", async () => {
    montar();
    const elegida = screen.getByRole("tab", { selected: true });
    expect(elegida).toHaveClass("bg-charmy-llama");
    expect(elegida).not.toHaveClass("bg-white");
    const otra = screen.getByRole("tab", { name: "Experto" });
    expect(otra).toHaveClass("hover:text-charmy-llama");
    expect(otra).not.toHaveClass("hover:text-white");
  });

  it("con una provincia abierta, el foco se ve en la misma ficha y la flecha vuelve a la provincia (#236)", async () => {
    montar();
    const u = userEvent.setup();
    const ranking = await screen.findByRole("region", { name: "Ranking" });
    await u.click(await within(ranking).findByRole("button", { name: /Neuquén/ }));
    // El foco de la muestra cae en Neuquén; en el mapa se elige tocando su aguja.
    await screen.findByText("Entre las de más fuego");
    act(() => useRelieve.getState().cambiar({ focoVivo: 0 }));
    const ficha = screen.getByRole("region", { name: "Ficha de Neuquén" });
    expect(screen.queryByRole("region", { name: "Ficha del foco" })).not.toBeInTheDocument();
    expect(within(ficha).getByText("42,5")).toBeInTheDocument();
    expect(within(ficha).queryByText("Entre las de más fuego")).not.toBeInTheDocument();
    await u.click(within(ficha).getByRole("button", { name: "Volver a Neuquén" }));
    expect(useRelieve.getState().focoVivo).toBeNull();
    expect(within(ficha).getByText("Entre las de más fuego")).toBeInTheDocument();
  });

  it("cerrar la provincia también cierra el foco elegido (#236)", () => {
    useRelieve.setState({ seleccion: "AR-Q", focoVivo: 0 });
    useRelieve.getState().alternarRegion(null);
    expect(useRelieve.getState()).toMatchObject({ seleccion: null, focoVivo: null });
  });

  it("el ranking se esconde a los segundos y vuelve al acercar el cursor (#251)", async () => {
    // Tiempo simulado desde el arranque (el temporizador se arma al montar); avanza solo para que las esperas anden.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      const ranking = await screen.findByRole("region", { name: "Ranking" });
      expect(await within(ranking).findByText("Neuquén")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(7000));
      expect(useRelieve.getState().ranking).toBe(false);
      expect(screen.queryByRole("region", { name: "Ranking" })).not.toBeInTheDocument();
      // Sigue montado y oculto para los lectores, así la salida se anima en vez de cortarse (#281).
      const escondido = document.querySelector('[data-guia="ranking"]');
      expect(escondido).toHaveAttribute("data-abierto", "false");
      expect(escondido).toHaveAttribute("aria-hidden", "true");
      fireEvent.mouseEnter(screen.getByRole("button", { name: "Mostrar el ranking" }));
      expect(useRelieve.getState().ranking).toBe(true);
      // Con el cursor encima no se esconde.
      fireEvent.mouseEnter(screen.getByRole("region", { name: "Ranking" }));
      act(() => vi.advanceTimersByTime(10000));
      expect(useRelieve.getState().ranking).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("en En vivo, tocar un nivel de intensidad deja solo esos focos (#251)", async () => {
    vivo.features.push({
      type: "Feature",
      id: "N21-chico",
      geometry: { type: "Point", coordinates: [-70.2, -39.1] },
      properties: { acq_datetime: "2026-11-14T06:00:00Z", satellite: "N21", instrument: "VIIRS", confidence: "nominal", frp: 3.5, daynight: "N", verdict: "sin_confirmar" },
    });
    try {
      montar();
      const u = userEvent.setup();
      await u.click(screen.getByRole("tab", { name: "En vivo" }));
      const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
      expect(await within(panel).findByText("2")).toBeInTheDocument();
      const muyFuerte = within(panel).getByRole("button", { name: /Muy fuerte/ });
      await u.click(muyFuerte);
      expect(muyFuerte).toHaveAttribute("aria-pressed", "true");
      expect(within(panel).getByText("1")).toBeInTheDocument();
      expect(within(panel).queryByRole("button", { name: /3,5 MW/ })).not.toBeInTheDocument();
      await u.click(muyFuerte);
      expect(within(panel).getByText("2")).toBeInTheDocument();
    } finally {
      vivo.features.pop();
    }
  });

  it("en En vivo, las estadísticas comparan con la ventana anterior, nombran las regiones y cuentan los veredictos (F4-D4)", async () => {
    vivo.features.push({
      type: "Feature",
      id: "N21-sin-veredicto",
      geometry: { type: "Point", coordinates: [-70.2, -39.1] },
      properties: { acq_datetime: "2026-11-14T01:00:00Z", satellite: "N21", instrument: "VIIRS", confidence: "nominal", frp: 3.5, daynight: "N", verdict: "sin_confirmar" },
    });
    try {
      montar();
      const u = userEvent.setup();
      await u.click(screen.getByRole("tab", { name: "En vivo" }));
      const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
      const estadisticas = await within(panel).findByRole("region", { name: "Estadísticas en vivo" });
      // Con 48 h no hay ventana anterior en /live: no se compara.
      expect(within(panel).queryByText(/anteriores/)).not.toBeInTheDocument();
      await u.click(within(panel).getByRole("button", { name: "24 h" }));
      expect(within(panel).getByText("2 más que las 24 h anteriores")).toBeInTheDocument();
      const regiones = within(estadisticas).getByRole("list", { name: "Regiones con más focos" });
      expect(within(regiones).getByText("Neuquén")).toBeInTheDocument();
      expect(within(regiones).getByText("2 focos")).toBeInTheDocument();
      const veredictos = within(estadisticas).getByRole("list", { name: "Focos por veredicto" });
      expect(within(veredictos).getByText("Probable: 1")).toBeInTheDocument();
      expect(within(veredictos).getByText("Sin confirmar: 1")).toBeInTheDocument();
      // Respeta el filtro de intensidad: con «Muy fuerte» queda solo el foco probable.
      await u.click(within(panel).getByRole("button", { name: /Muy fuerte/ }));
      expect(within(veredictos).queryByText("Sin confirmar: 1")).not.toBeInTheDocument();
      expect(within(panel).getByText("1 más que las 24 h anteriores")).toBeInTheDocument();
    } finally {
      vivo.features.pop();
    }
  });

  it("en En vivo, destildar un satélite deja solo los focos del otro y cierra la ficha de un foco suyo (#271)", async () => {
    vivo.features.push({
      type: "Feature",
      id: "N21-sat",
      geometry: { type: "Point", coordinates: [-70.2, -39.1] },
      properties: { acq_datetime: "2026-11-14T06:00:00Z", satellite: "N21", instrument: "VIIRS", confidence: "nominal", frp: 3.5, daynight: "N", verdict: "sin_confirmar" },
    });
    try {
      montar();
      const u = userEvent.setup();
      await u.click(screen.getByRole("tab", { name: "En vivo" }));
      const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
      expect(await within(panel).findByText("2")).toBeInTheDocument();
      await u.click(within(panel).getByRole("button", { name: /3,5 MW/ }));
      expect(screen.getByRole("region", { name: "Ficha del foco" })).toBeInTheDocument();
      expect(within(panel).getByRole("checkbox", { name: "NOAA-20" })).toBeChecked();
      await u.click(within(panel).getByRole("checkbox", { name: "NOAA-21" }));
      expect(useVivo.getState().satelites).toEqual(["N20"]);
      expect(within(panel).getByText("1")).toBeInTheDocument();
      expect(within(panel).queryByRole("button", { name: /3,5 MW/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Ficha del foco" })).not.toBeInTheDocument();
      await u.click(within(panel).getByRole("checkbox", { name: "NOAA-20" }));
      expect(within(panel).getByText(/Elegí al menos un satélite/)).toBeInTheDocument();
    } finally {
      vivo.features.pop();
    }
  });

  it("En vivo tiene la lista de todos sus focos, del más nuevo al más viejo, con el veredicto en texto (RNF-04)", async () => {
    vivo.features.push({
      type: "Feature",
      id: "N21-lista",
      geometry: { type: "Point", coordinates: [-70.2, -39.1] },
      properties: { acq_datetime: "2026-11-14T06:00:00Z", satellite: "N21", instrument: "VIIRS", confidence: "nominal", frp: 3.5, daynight: "N", verdict: "sin_confirmar" },
    });
    try {
      montar();
      const u = userEvent.setup();
      await u.click(screen.getByRole("tab", { name: "En vivo" }));
      const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
      // Con teclado: la lista se abre con Enter sobre su título.
      within(panel).getByText(/Lista de focos \(2\)/).focus();
      await u.keyboard("{Enter}");
      const lista = within(panel).getByRole("list", { name: "Focos en vivo" });
      const items = within(lista).getAllByRole("button");
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent(/Sin confirmar/);
      expect(items[1]).toHaveTextContent(/Probable/);
      await u.click(items[0] as HTMLElement);
      expect(screen.getByRole("region", { name: "Ficha del foco" })).toBeInTheDocument();
      const pedido = fetchSimulado.mock.calls.map(([x]) => String(x)).find((x) => x.includes("/evidence"));
      expect(pedido).toContain("N21-lista");
      // La lista sigue los mismos filtros que el resto del panel.
      await u.click(within(panel).getByRole("button", { name: /Muy fuerte/ }));
      expect(within(lista).getAllByRole("button")).toHaveLength(1);
      expect(within(lista).getByRole("button")).toHaveTextContent(/Probable/);
    } finally {
      vivo.features.pop();
    }
  });

  it("con más de 50 focos, la lista muestra los 50 más nuevos y dice cuántos hay", async () => {
    const extra = Array.from({ length: 55 }, (_, i) => ({
      type: "Feature",
      id: `N20-extra-${i}`,
      geometry: { type: "Point", coordinates: [-70.5, -39.5] },
      properties: { acq_datetime: `2026-11-14T04:${String(i).padStart(2, "0")}:00Z`, satellite: "N20", instrument: "VIIRS", confidence: "nominal", frp: 5, daynight: "N", verdict: "probable" },
    }));
    vivo.features.push(...extra);
    try {
      montar();
      const u = userEvent.setup();
      await u.click(screen.getByRole("tab", { name: "En vivo" }));
      const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
      await u.click(within(panel).getByText(/Lista de focos \(56\)/));
      const lista = within(panel).getByRole("list", { name: "Focos en vivo" });
      expect(within(lista).getAllByRole("button")).toHaveLength(50);
      expect(within(panel).getByText(/Los 50 más nuevos de 56/)).toBeInTheDocument();
    } finally {
      vivo.features.splice(-extra.length);
    }
  });

  it("la lupa busca provincias sin importar los acentos", async () => {
    montar();
    const u = userEvent.setup();
    await screen.findByRole("region", { name: "Ranking" });
    await u.type(screen.getByRole("combobox", { name: "Buscá tu provincia o región" }), "araucania");
    await u.keyboard("{Enter}");
    expect(useRelieve.getState().seleccion).toBe("CL-AR");
  });

  it("En vivo muestra los focos recientes y la ficha de cada uno con su ubicación y previsualización en Google Maps (#219)", async () => {
    expect(urlGoogleMaps(-39, -70)).toBe("https://www.google.com/maps?q=-39,-70");
    expect(urlGoogleMapsEmbed(-39, -70)).toBe("https://maps.google.com/maps?q=-39,-70&z=13&output=embed");
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "En vivo" }));
    const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
    expect(await within(panel).findByText("1")).toBeInTheDocument();
    await u.click(within(panel).getByRole("button", { name: /Neuquén.*42,5 MW/ }));
    const ficha = screen.getByRole("region", { name: "Ficha del foco" });
    expect(within(ficha).getByText("NOAA-20")).toBeInTheDocument();
    expect(within(ficha).getByText("VIIRS")).toBeInTheDocument();
    expect(within(ficha).getByText("alta")).toBeInTheDocument();
    expect(within(ficha).getByText("De noche")).toBeInTheDocument();
    expect(within(ficha).getByText("Muy fuerte", { exact: false })).toBeInTheDocument();
    expect(within(ficha).getByText(/-39,000, -70,000/)).toBeInTheDocument();
    const enlaceMapa = within(ficha).getByRole("link", { name: /ver ubicación en google maps/i });
    expect(enlaceMapa).toHaveAttribute("href", "https://www.google.com/maps?q=-39,-70");
    expect(enlaceMapa.querySelector("svg")).toBeInTheDocument();
    const preview = within(ficha).getByTitle("Previsualización de la ubicación en Google Maps");
    expect(preview).toHaveAttribute("src", "https://maps.google.com/maps?q=-39,-70&z=13&output=embed");
  });

  it("si la API falla, lo dice y el resto de la vista sigue", async () => {
    resumenFalla = true;
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("no están disponibles ahora");
    expect(screen.getByRole("tablist", { name: "Indicador" })).toBeInTheDocument();
  });

  it("abajo a la izquierda quedan solo Charmy y el aviso: no hay enlaces a otras vistas (#276)", async () => {
    montar();
    await screen.findByRole("region", { name: "Ranking" });
    expect(screen.getByRole("button", { name: /Charmy: ¿necesitás ayuda\?/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Consulta por área y fechas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Charmy Brigada" })).not.toBeInTheDocument();
    expect(screen.queryByText(/regiones$/)).not.toBeInTheDocument();
  });

  it("si los datos en vivo están atrasados, En vivo lo dice (RF-VIV-01)", async () => {
    resumen.live = { ...resumen.live, stale: true, message: "Los focos en vivo están atrasados: el último dato es de hace 3 horas." } as never;
    try {
      montar();
      await userEvent.setup().click(screen.getByRole("tab", { name: "En vivo" }));
      const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
      expect(await within(panel).findByText(/están atrasados/)).toBeInTheDocument();
    } finally {
      resumen.live = { available: true, fetched_at: "2026-11-14T11:30:00Z", stale: false };
    }
  });

  it("la ficha del foco en vivo dice su veredicto y por qué (RF-VIV-02)", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "En vivo" }));
    const panel = await screen.findByRole("complementary", { name: "Resumen en vivo" });
    await u.click(await within(panel).findByRole("button", { name: /Neuquén.*42,5 MW/ }));
    const ficha = screen.getByRole("region", { name: "Ficha del foco" });
    expect(within(ficha).getByText("Probable")).toBeInTheDocument();
    expect(await within(ficha).findByRole("link", { name: "Titular de ejemplo sobre un incendio" })).toHaveAttribute(
      "href",
      "https://example.org/n",
    );
    const pedido = fetchSimulado.mock.calls.map(([x]) => String(x)).find((x) => x.includes("/evidence"));
    expect(pedido).toContain(encodeURIComponent("N20-2026-11-14T05:12:00Z--39.00000--70.00000"));
  });
});

describe("tu zona en Relieve (#262)", () => {
  it("elegir Experto abre su panel con las herramientas de dibujo y esconde el ranking", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "Experto" }));
    const panel = screen.getByRole("complementary", { name: "Experto" });
    expect(screen.queryByRole("region", { name: "Ranking" })).not.toBeInTheDocument();
    const rectangulo = within(panel).getByRole("button", { name: "Dibujar rectángulo" });
    expect(rectangulo).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Dibujando en el mapa")).not.toBeInTheDocument();
    await u.click(rectangulo);
    expect(useConsulta.getState().dibujando).toBe("rectangle");
    // Toggle: el botón queda encendido y un indicador avisa que el mapa está listo para dibujar.
    expect(rectangulo).toHaveAttribute("aria-pressed", "true");
    expect(rectangulo).toHaveAttribute("data-state", "on");
    expect(within(panel).getByRole("button", { name: "Dibujar polígono" })).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByText(/dos esquinas opuestas/)).toBeInTheDocument();
    expect(screen.getByText("Dibujando en el mapa")).toBeInTheDocument();
    // Tocarlo de nuevo lo apaga.
    await u.click(rectangulo);
    expect(useConsulta.getState().dibujando).toBeNull();
    expect(rectangulo).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Dibujando en el mapa")).not.toBeInTheDocument();
    expect(within(panel).getByLabelText("Desde")).toHaveValue("2022-01-01");
    // Ya no hay modo novato: los filtros técnicos están siempre, plegados con un resumen de lo elegido (F4-D8).
    expect(within(panel).getByLabelText("Serie")).toBeInTheDocument();
    expect(within(panel).getByText("3 · Filtros").closest("summary")).toHaveTextContent("Armonizada · confianza nominal o más");
    expect(within(panel).queryByRole("radio", { name: "Novato" })).not.toBeInTheDocument();
    expect(screen.getByText(/no reemplaza a los servicios de emergencia/)).toBeInTheDocument();
  });

  it("con un punto y un radio: focos, calendario con CSV, contexto y reporte; borrar el área los saca", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "Experto" }));
    const panel = screen.getByRole("complementary", { name: "Experto" });
    await u.click(within(panel).getByRole("button", { name: "Punto" }));
    await u.type(within(panel).getByLabelText("Latitud"), "-42,9");
    await u.type(within(panel).getByLabelText("Longitud"), "-71,3");
    await u.click(within(panel).getByRole("button", { name: "Usar este punto" }));
    expect(useConsulta.getState().area?.type).toBe("Polygon");
    expect(await within(panel).findByText("1 foco en el área y el período.")).toBeInTheDocument();
    const resumen = within(panel).getByRole("region", { name: "Resumen de los focos" });
    expect(within(resumen).getByText("Día con más focos").nextSibling).toHaveTextContent(/^\d{1,2} [a-z]{3} \d{4}$/);
    expect(resumen).toHaveTextContent(/potencia/i);
    const calendario = await screen.findByRole("region", { name: "Calendario de quema" });
    await u.click(within(calendario).getByText("Descargas"));
    expect(within(calendario).getByRole("link", { name: "Focos (CSV)" })).toHaveAttribute(
      "href",
      expect.stringContaining("http://api.prueba/api/v1/"),
    );
    await u.click(within(panel).getByRole("tab", { name: "Lugar" }));
    expect(within(panel).getByRole("region", { name: "Contexto del lugar" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Reportar un foco" })).toBeInTheDocument();
    await u.click(within(panel).getByRole("button", { name: "Borrar área" }));
    expect(useConsulta.getState().area).toBeNull();
    expect(screen.queryByRole("region", { name: "Calendario de quema" })).not.toBeInTheDocument();
  });

  it("salir de Experto apaga la herramienta de dibujo", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "Experto" }));
    await u.click(screen.getByRole("button", { name: "Dibujar polígono" }));
    await u.click(screen.getByRole("tab", { name: "Focos" }));
    expect(useConsulta.getState().dibujando).toBeNull();
  });

  it("Experto suma filtros, reproducción y validación, y un foco tocado muestra sus atributos (RF-MOD-02, #276)", async () => {
    useConsulta.setState({ area: { type: "Polygon", coordinates: [[[-72, -43], [-71, -43], [-71, -42], [-72, -42], [-72, -43]]] } });
    useRelieve.setState({
      pestana: "zona",
      focoZona: {
        lon: -71.3,
        lat: -42.9,
        propiedades: { acq_datetime: "2025-01-10T15:00:00Z", satellite: "N20", instrument: "VIIRS", confidence: "high", frp: 12, daynight: "D" },
      },
    });
    montar();
    const panel = screen.getByRole("complementary", { name: "Experto" });
    expect(within(panel).getByLabelText("Serie")).toBeInTheDocument();
    expect(await within(panel).findByRole("group", { name: "Reproducir por mes" })).toBeInTheDocument();
    await userEvent.setup().click(within(panel).getByRole("tab", { name: "Validación" }));
    expect(within(panel).getByRole("region", { name: "Validación de la armonización" })).toBeInTheDocument();
    const ficha = screen.getByRole("region", { name: "Atributos del foco" });
    expect(within(ficha).getByText("NOAA-20 (VIIRS)")).toBeInTheDocument();
    expect(within(ficha).getByText("12 MW")).toBeInTheDocument();
  });
});

describe("organización de Experto (F4-D8)", () => {
  it("el panel va por pasos: Dónde, Cuándo y Filtros, y el área se marca con un solo selector", async () => {
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "Experto" }));
    const panel = screen.getByRole("complementary", { name: "Experto" });
    expect(within(panel).getByRole("heading", { name: "1 · Dónde" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "2 · Cuándo" })).toBeInTheDocument();
    const formas = within(panel).getByRole("group", { name: "Cómo marcar el área" });
    expect(within(formas).getAllByRole("button").map((b) => b.textContent)).toEqual(["Rectángulo", "Polígono", "Localidad", "Punto"]);
    // Localidad y Punto muestran su formulario; elegir uno apaga el dibujo.
    expect(within(panel).queryByLabelText("Latitud")).not.toBeInTheDocument();
    await u.click(within(formas).getByRole("button", { name: "Dibujar polígono" }));
    await u.click(within(formas).getByRole("button", { name: "Localidad" }));
    expect(useConsulta.getState().dibujando).toBeNull();
    expect(within(formas).getByRole("button", { name: "Localidad" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByLabelText("Buscar una localidad")).toBeInTheDocument();
    await u.click(within(formas).getByRole("button", { name: "Punto" }));
    expect(within(panel).queryByLabelText("Buscar una localidad")).not.toBeInTheDocument();
    expect(within(panel).getByLabelText("Latitud")).toBeInTheDocument();
  });

  it("Resumen, Lugar y Validación son pestañas del panel; las flechas pasan de una a otra", async () => {
    useConsulta.setState({ area: { type: "Polygon", coordinates: [[[-72, -43], [-71, -43], [-71, -42], [-72, -42], [-72, -43]]] } });
    useRelieve.setState({ pestana: "zona" });
    montar();
    const u = userEvent.setup();
    const panel = screen.getByRole("complementary", { name: "Experto" });
    const pestanas = within(panel).getByRole("tablist", { name: "Qué ver del área" });
    expect(within(pestanas).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Lugar", "Validación"]);
    expect(within(pestanas).getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(within(panel).queryByRole("region", { name: "Contexto del lugar" })).not.toBeInTheDocument();
    within(pestanas).getByRole("tab", { name: "Resumen" }).focus();
    await u.keyboard("{ArrowRight}");
    expect(within(pestanas).getByRole("tab", { name: "Lugar" })).toHaveAttribute("aria-selected", "true");
    expect(within(panel).getByRole("tabpanel", { name: "Lugar" })).toContainElement(
      within(panel).getByRole("region", { name: "Contexto del lugar" }),
    );
  });

  it("Reportar un foco va en el encabezado y abre el formulario en el panel", async () => {
    useRelieve.setState({ pestana: "zona" });
    montar();
    const u = userEvent.setup();
    const panel = screen.getByRole("complementary", { name: "Experto" });
    await u.click(within(within(panel).getByRole("banner")).getByRole("button", { name: "Reportar un foco" }));
    expect(within(panel).getByRole("form", { name: "Reportar un foco" })).toBeInTheDocument();
  });
});

describe("Charmy guía Experto (F4-D9)", () => {
  const AREA = { type: "Polygon" as const, coordinates: [[[-72, -43], [-71, -43], [-71, -42], [-72, -42], [-72, -43]]] };

  /** Avanza con Siguiente y devuelve los títulos de los pasos por los que pasó, hasta el último. */
  async function recorrer(u: ReturnType<typeof userEvent.setup>) {
    const titulos: string[] = [];
    for (let i = 0; i < 20; i++) {
      const dialogo = await screen.findByRole("dialog");
      titulos.push(dialogo.getAttribute("aria-labelledby") ? within(dialogo).getByRole("heading").textContent ?? "" : "");
      const boton = within(dialogo).getByRole("button", { name: /Siguiente|Terminar/ });
      if (boton.textContent === "Terminar") break;
      await u.click(boton);
    }
    return titulos;
  }

  it("el botón del encabezado abre el recorrido de Experto, que señala cada parte del panel", async () => {
    // jsdom no mide: con un tamaño falso ningún paso se saltea por no estar en pantalla.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 40));
    useConsulta.setState({ area: AREA });
    useRelieve.setState({ pestana: "zona" });
    montar();
    const u = userEvent.setup();
    const panel = screen.getByRole("complementary", { name: "Experto" });
    await screen.findByRole("region", { name: "Calendario de quema" });
    // Cada parte que explica lleva su marca.
    for (const marca of ["zona-donde", "zona-cuando", "zona-filtros", "zona-resultado", "zona-secciones", "zona-reportar"]) {
      expect(panel.querySelector(`[data-guia="${marca}"]`)).not.toBeNull();
    }
    expect(document.querySelector('[data-guia="calendario"]')).not.toBeNull();
    await u.click(within(within(panel).getByRole("banner")).getByRole("button", { name: /Guía: Charmy te explica cómo se usa Experto/ }));
    expect(await recorrer(u)).toEqual([
      "Experto, paso a paso",
      "1 · Dónde",
      "2 · Cuándo",
      "Serie y confianza",
      "Potencia y momento",
      "Cuántos focos",
      "Resumen, Lugar y Validación",
      "Calendario de quema",
      "Tocá un foco",
      "¿Ves fuego?",
      "¡Listo!",
    ]);
    // El último paso recuerda los números de emergencia; Escape cierra el recorrido.
    expect(screen.getByRole("dialog")).toHaveTextContent(/llamá al 100 en Argentina o al 132 en Chile/);
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("explica los parámetros: las cuatro formas del área y los filtros", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 40));
    useRelieve.setState({ pestana: "zona" });
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: /Guía: Charmy te explica cómo se usa Experto/ }));
    await u.click(await screen.findByRole("button", { name: "Siguiente" }));
    expect(await screen.findByRole("dialog", { name: "1 · Dónde" })).toHaveTextContent(/Rectángulo.*Polígono.*Localidad.*Punto/);
    await u.click(screen.getByRole("button", { name: "Siguiente" }));
    await u.click(await screen.findByRole("button", { name: "Siguiente" }));
    expect(await screen.findByRole("dialog", { name: "Serie y confianza" })).toHaveTextContent(/MODIS y VIIRS/);
    vi.restoreAllMocks();
  });

  it("sin área no hay calendario: ese paso se saltea", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 40));
    useRelieve.setState({ pestana: "zona" });
    montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: /Guía: Charmy te explica cómo se usa Experto/ }));
    const titulos = await recorrer(u);
    expect(titulos).not.toContain("Calendario de quema");
    expect(titulos.at(-1)).toBe("¡Listo!");
    vi.restoreAllMocks();
  });
});

describe("Charmy invita a la guía (F4-D10)", () => {
  it("el globo «¿Necesitás ayuda?» se ve 5 s, se oculta 15 s, tres veces, y después no vuelve", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      const boton = screen.getByRole("button", { name: /Charmy: ¿necesitás ayuda\?/ });
      const visible = () => boton.getAttribute("data-invita");
      const avanzar = (ms: number) => act(() => vi.advanceTimersByTime(ms));
      for (let vez = 1; vez <= 3; vez++) {
        expect(visible()).toBe("true");
        avanzar(5000);
        expect(visible()).toBe("false");
        if (vez < 3) avanzar(15000);
      }
      avanzar(60000);
      expect(visible()).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });
});
