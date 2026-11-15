import { t, useIdioma } from "@/relieve/idioma";

/** Aviso fijo: Charmy no reemplaza a los servicios de emergencia (regla de producto). */
export function AvisoEmergencias() {
  useIdioma((s) => s.idioma);
  return (
    <p className="text-xs text-tinta-suave">
      {t(
        <>
          Charmy no reemplaza a los servicios de emergencia. Si ves fuego, llamá al{" "}
          <a className="font-semibold text-aviso-texto underline" href="tel:100">
            100
          </a>{" "}
          en Argentina o al{" "}
          <a className="font-semibold text-aviso-texto underline" href="tel:132">
            132
          </a>{" "}
          en Chile.
        </>,
        <>
          Charmy does not replace emergency services. If you see fire, call{" "}
          <a className="font-semibold text-aviso-texto underline" href="tel:100">
            100
          </a>{" "}
          in Argentina or{" "}
          <a className="font-semibold text-aviso-texto underline" href="tel:132">
            132
          </a>{" "}
          in Chile.
        </>,
      )}
    </p>
  );
}
