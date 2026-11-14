import { Component, type ReactNode } from "react";

/**
 * Límite de errores para las partes complementarias (RNF-14): si una tira un error (por ejemplo, una
 * respuesta con otra forma), se muestra «no disponible» en su lugar y el resto de la app sigue.
 */
export class Seguro extends Component<{ nombre: string; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`${this.props.nombre}:`, error);
  }

  render() {
    if (this.state.fallo) {
      return <p className="rounded-control bg-superficie-2 p-2 text-sm">{this.props.nombre} no está disponible ahora.</p>;
    }
    return this.props.children;
  }
}
