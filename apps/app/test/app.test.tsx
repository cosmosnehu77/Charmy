import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";

// jsdom no tiene WebGL: el mapa se revisa en el navegador.
vi.mock("@/relieve/MapaRelieve", () => ({ default: () => <div data-testid="mapa" /> }));
// Tu zona no necesita las regiones ni los focos en vivo de Relieve.
vi.mock("@/relieve/datos", () => ({ useDatosRelieve: () => ({ resumen: {}, vivo: {}, regiones: [], focos: [] }) }));

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe("esqueleto de la app", () => {
  it("es una sola vista: Relieve con la píldora y el aviso de emergencias (#276)", () => {
    montar();
    expect(screen.getByRole("tablist", { name: "Indicador" })).toBeInTheDocument();
    expect(screen.getByText(/no reemplaza a los servicios de emergencia/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Charmy: ir a la página de inicio" })).toHaveAttribute(
      "href",
      "https://charmy.earth",
    );
  });

  it("la pestaña Experto no tiene modo novato: los filtros técnicos se ven siempre", () => {
    montar();
    expect(screen.queryByRole("radio", { name: "Novato" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Serie")).toBeInTheDocument();
  });
});
