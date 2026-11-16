import { Compass, Minus, Plus, RotateCw, Satellite } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { controlMapa } from "./controlMapa";
import { useRelieve } from "./estado";
import { t, useIdioma } from "./idioma";

/**
 * Botones de la derecha del mapa (#414, boceto 7 con la barra y el globo del 9): una cápsula de vidrio por función.
 * Un modo encendido lleva una barra naranja en el borde de su cápsula; el nombre de cada botón sale en un globo.
 * El giro queda para los indicadores: en En vivo y Experto los grupos de focos se rearman al mover el mapa.
 */
export function ControlesMapa({ conGiro }: { conGiro: boolean }) {
  useIdioma((s) => s.idioma);
  const { plano, satelital, giro, cambiar } = useRelieve();
  return (
    <div
      role="toolbar"
      aria-label={t("Controles del mapa", "Map controls")}
      aria-orientation="vertical"
      data-guia="controles"
      className="pointer-events-auto absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end gap-2.5 md:top-[72px] md:translate-y-0"
    >
      <Grupo nombre={t("Zoom", "Zoom")}>
        <Boton etiqueta={t("Acercar", "Zoom in")} onClick={() => controlMapa.zoom(0.75)}>
          <Plus aria-hidden="true" className="size-4" />
        </Boton>
        <Boton etiqueta={t("Alejar", "Zoom out")} onClick={() => controlMapa.zoom(1.33)}>
          <Minus aria-hidden="true" className="size-4" />
        </Boton>
      </Grupo>
      <Grupo nombre={t("Norte", "North")}>
        <Boton etiqueta={t("Mirar al norte", "Reset north")} onClick={() => controlMapa.norte()}>
          <Compass aria-hidden="true" className="size-4 text-relieve-brillo" />
        </Boton>
      </Grupo>
      <Grupo nombre={t("Vista", "View")}>
        <Boton
          etiqueta={plano ? t("Ver en 3D", "View in 3D") : t("Ver en 2D, más liviano", "View in 2D, lighter")}
          onClick={() => cambiar({ plano: !plano })}
        >
          <span className="text-[10px] font-bold">{plano ? "3D" : "2D"}</span>
        </Boton>
        <Boton
          etiqueta={satelital ? t("Volver al modelo", "Back to the model") : t("Ver imagen satelital", "View satellite imagery")}
          activo={satelital}
          onClick={() => cambiar({ satelital: !satelital })}
        >
          <Satellite aria-hidden="true" className="size-4" />
        </Boton>
      </Grupo>
      {conGiro && (
        <Grupo nombre={t("Giro", "Rotation")}>
          <Boton
            etiqueta={giro ? t("Detener el giro", "Stop rotation") : t("Girar el mapa", "Rotate map")}
            activo={giro}
            onClick={() => cambiar({ giro: !giro })}
          >
            <RotateCw aria-hidden="true" className="size-4" />
          </Boton>
        </Grupo>
      )}
    </div>
  );
}

function Grupo({ nombre, children }: { nombre: string; children: ReactNode[] | ReactNode }) {
  const botones = Array.isArray(children) ? children : [children];
  return (
    <div role="group" aria-label={nombre} className="control-grupo vidrio-relieve">
      {botones.map((boton, i) => (
        <Fragment key={i}>
          {i > 0 && <i aria-hidden="true" className="control-sep" />}
          {boton}
        </Fragment>
      ))}
    </div>
  );
}

function Boton({
  etiqueta,
  onClick,
  activo,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  activo?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={etiqueta} aria-pressed={activo} onClick={onClick} className="control-boton">
      {children}
      <span aria-hidden="true" className="control-globo">
        {etiqueta}
      </span>
      {activo !== undefined && <i aria-hidden="true" className="control-barra" />}
    </button>
  );
}
