import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { MESES_LARGOS } from "@/calendario/calendario";
import { Button } from "@/components/ui/button";
import { useConsulta } from "@/estado/consulta";
import { mesesDelPeriodo } from "./reproduccion";

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

  return (
    <div role="group" aria-label="Reproducir por mes" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Reproducir por mes</h3>
      <div className="flex flex-wrap items-center gap-2">
        {reproduciendo ? (
          <Button variant="outline" size="sm" onClick={() => setReproduciendo(false)}>
            <Pause aria-hidden="true" />
            Pausar
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={reproducir}>
            <Play aria-hidden="true" />
            Reproducir
          </Button>
        )}
        {mesReproduccion && (
          <>
            <span className="font-mono text-xs" aria-live="polite">
              {nombreMes(mesReproduccion)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReproduciendo(false);
                cambiar({ mesReproduccion: null });
              }}
            >
              Ver todo el período
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
