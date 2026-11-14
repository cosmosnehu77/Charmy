import { render, screen } from "@testing-library/react";
import { Seguro } from "@/components/Seguro";

function Rompe(): never {
  throw new Error("forma inesperada");
}

describe("Seguro (RNF-14)", () => {
  it("si una parte tira un error, muestra «no disponible» y lo de al lado sigue", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <Seguro nombre="El panel de prueba">
          <Rompe />
        </Seguro>
        <p>Lo demás</p>
      </>,
    );
    expect(screen.getByText("El panel de prueba no está disponible ahora.")).toBeInTheDocument();
    expect(screen.getByText("Lo demás")).toBeInTheDocument();
  });
});
