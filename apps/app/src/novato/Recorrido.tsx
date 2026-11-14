import { Charmy, type Mood } from "@charmy/charmy";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/estado/app";

/** Pasos del recorrido del modo novato: cortos, en segunda persona y sin jerga. */
const PASOS: { mood: Mood; texto: string }[] = [
  { mood: "saluda", texto: "¡Hola! Soy Charmy. Te ayudo a ver dónde y cuándo hubo fuego en tu zona." },
  { mood: "explica", texto: "Primero elegí una zona: dibujala en el mapa, escribí un punto o buscá tu localidad." },
  { mood: "explica", texto: "Después elegí las fechas. Arrancamos con los últimos cinco años." },
  {
    mood: "explica",
    texto: "Cada cuadrito del calendario es un mes. Naranja es más fuego que lo normal; violeta, menos.",
  },
  {
    mood: "alerta",
    texto: "Si ves fuego, llamá al 100 en Argentina o al 132 en Chile. Yo no reemplazo a los servicios de emergencia.",
  },
];

export function Recorrido() {
  const marcarRecorrido = useApp((s) => s.marcarRecorrido);
  const [paso, setPaso] = useState(0);
  const actual = PASOS[paso] ?? PASOS[0];
  const ultimo = paso === PASOS.length - 1;
  const cerrar = () => marcarRecorrido(true);

  return (
    <section
      aria-label="Recorrido de Charmy"
      className="absolute inset-x-3 bottom-3 z-10 flex items-end gap-2 md:right-auto md:max-w-md"
    >
      <Charmy mood={actual?.mood} outfit="guia" size={96} decorative className="shrink-0" />
      <div className="flex min-w-0 flex-col gap-2 rounded-tarjeta border bg-card p-3 shadow-tarjeta">
        <p className="font-mono text-xs text-tinta-suave">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <p className="text-sm" aria-live="polite">
          {actual?.texto}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cerrar}>
            Saltar
          </Button>
          <Button variant="outline" size="sm" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
            Atrás
          </Button>
          {ultimo ? (
            <Button size="sm" onClick={cerrar}>
              Terminar
            </Button>
          ) : (
            <Button size="sm" onClick={() => setPaso((p) => p + 1)}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
