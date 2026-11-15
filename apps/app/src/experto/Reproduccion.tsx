import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { MESES_LARGOS } from "@/calendario/grilla";
import { Button } from "@/components/ui/button";
import { useConsulta } from "@/estado/consulta";
import { mesesDelPeriodo } from "./meses";

const PASO_MS = 1500;

export const nombreMes = (m: string) => `${MESES_LARGOS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

/** Muestra en el mapa los focos de un mes por vez, en orden (RF-MAP-07). */
export function Reproduccion() {
  const { desde, hasta, mesReproduccion, cambiar } = useConsulta();
  const [reproduciendo, setReproduciendo] = useState(false);
  const meses = mesesDelPeriodo(desde, hasta);

  useEffect(() => {
    if (!reproduciendo) return;
    const id = setInterval(() => {
      const actual = useConsulta.getState().mesReproduccion;
      const i = actual ? meses.indexOf(actual) : -1;
      if (i + 1 >= meses.length) {
        setReproduciendo(false);
        return;
      }
      cambiar({ mesReproduccion: meses[i + 1] ?? null });
    }, PASO_MS);
    return () => clearInterval(id);
  }, [reproduciendo, meses, cambiar]);

  const reproducir = () => {
    if (!mesReproduccion || mesReproduccion === meses.at(-1)) cambiar({ mesReproduccion: meses[0] ?? null });
    setReproduciendo(true);
  };

  if (meses.length < 2) return null;

  // Compacto, en la franja del resultado (F4-D8): el botón redondo y, si hay un mes elegido, el mes y la vuelta al período.
  const boton = "grid size-[34px] shrink-0 place-items-center rounded-full bg-charmy-llama text-tinta hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div role="group" aria-label="Reproducir por mes" className="flex flex-col items-end gap-1">
      {reproduciendo ? (
        <button type="button" aria-label="Pausar" title="Pausar" className={boton} onClick={() => setReproduciendo(false)}>
          <Pause aria-hidden="true" className="size-4" />
        </button>
      ) : (
        <button type="button" aria-label="Reproducir" title="Reproducir por mes" className={boton} onClick={reproducir}>
          <Play aria-hidden="true" className="size-4" />
        </button>
      )}
      {mesReproduccion && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-1 py-0 text-xs"
          onClick={() => {
            setReproduciendo(false);
            cambiar({ mesReproduccion: null });
          }}
        >
          Ver todo el período
        </Button>
      )}
    </div>
  );
}
