/** Aviso fijo: Charmy no reemplaza a los servicios de emergencia (regla de producto). */
export function AvisoEmergencias() {
  return (
    <p className="text-xs text-tinta-suave">
      Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
      <a className="font-semibold text-aviso-texto underline" href="tel:100">
        100
      </a>{" "}
      en Argentina o al{" "}
      <a className="font-semibold text-aviso-texto underline" href="tel:132">
        132
      </a>{" "}
      en Chile.
    </p>
  );
}
