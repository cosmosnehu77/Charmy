import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { perfilInicial, useApp } from "@/estado/app";

// jsdom no tiene WebGL: el mapa se prueba aparte (perfiles.test.ts) y en el navegador.
vi.mock("@/mapa/Mapa", () => ({ default: () => <div data-testid="mapa" /> }));

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe("esqueleto de la app", () => {
  beforeEach(() => useApp.setState({ modo: "novato", perfilMapa: "3d" }));

  it("muestra el encabezado, el aviso de emergencias y el estado de los datos", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Charmy" })).toBeInTheDocument();
    expect(screen.getByText(/no reemplaza a los servicios de emergencia/)).toBeInTheDocument();
    expect(screen.getByText("Sin servidor configurado")).toBeInTheDocument();
  });

  it("cambia de modo y de vista del mapa", async () => {
    montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("radio", { name: "Experto" }));
    expect(useApp.getState().modo).toBe("experto");
    await usuario.click(screen.getByRole("radio", { name: /Mapa 2D/ }));
    expect(useApp.getState().perfilMapa).toBe("2d");
    expect(screen.getByRole("main")).toHaveAccessibleName("Mapa 2D");
  });
});

describe("perfilInicial", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "connection");
  const conConexion = (connection: unknown) =>
    Object.defineProperty(globalThis.navigator, "connection", { value: connection, configurable: true });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, "connection", original);
    else delete (globalThis.navigator as { connection?: unknown }).connection;
  });

  it("arranca en 3D si no sabe nada de la red", () => {
    conConexion(undefined);
    expect(perfilInicial()).toBe("3d");
  });
  it("arranca en 2D con ahorro de datos o red lenta", () => {
    conConexion({ saveData: true });
    expect(perfilInicial()).toBe("2d");
    conConexion({ effectiveType: "3g" });
    expect(perfilInicial()).toBe("2d");
    conConexion({ effectiveType: "slow-2g" });
    expect(perfilInicial()).toBe("2d");
  });
});

describe("enlaces entre las tres piezas (F4-E1)", () => {
  it("el encabezado enlaza a la landing y al juego en producción", () => {
    montar();
    expect(screen.getByRole("link", { name: "Qué es Charmy" })).toHaveAttribute("href", "https://charmy-landing.pages.dev");
    expect(screen.getByRole("link", { name: "Charmy Brigada" })).toHaveAttribute("href", "https://charmy-juego.pages.dev");
  });
});
