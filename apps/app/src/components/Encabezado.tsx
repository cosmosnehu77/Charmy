import { Flame, Mountain, Map as MapaIcono } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Modo, type PerfilMapa, useApp } from "@/estado/app";
import { EstadoApi } from "./EstadoApi";

export function Encabezado() {
  const { modo, perfilMapa, cambiarModo, cambiarPerfilMapa } = useApp();
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2">
      <div className="flex items-center gap-2">
        <Flame aria-hidden="true" className="size-5 text-acento" />
        <h1 className="text-xl font-extrabold tracking-tight">Charmy</h1>
      </div>
      <EstadoApi />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          aria-label="Modo"
          value={modo}
          onValueChange={(v) => v && cambiarModo(v as Modo)}
        >
          <ToggleGroupItem value="novato">Novato</ToggleGroupItem>
          <ToggleGroupItem value="experto">Experto</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          aria-label="Vista del mapa"
          value={perfilMapa}
          onValueChange={(v) => v && cambiarPerfilMapa(v as PerfilMapa)}
        >
          <ToggleGroupItem value="2d" aria-label="Mapa 2D, carga rápida">
            <MapaIcono aria-hidden="true" />
            2D
          </ToggleGroupItem>
          <ToggleGroupItem value="3d" aria-label="Mapa 3D con relieve">
            <Mountain aria-hidden="true" />
            3D
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </header>
  );
}
