import { CircleHelp, Flame, Mountain, Map as MapaIcono } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Modo, type PerfilMapa, useApp } from "@/estado/app";
import { URL_JUEGO, URL_LANDING } from "@/lib/enlaces";
import { EstadoApi } from "./EstadoApi";

export function Encabezado() {
  const { modo, perfilMapa, recorridoVisto, cambiarModo, cambiarPerfilMapa, marcarRecorrido } = useApp();
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2">
      <div className="flex items-center gap-2">
        <Flame aria-hidden="true" className="size-5 text-acento" />
        <h1 className="text-xl font-extrabold tracking-tight">Charmy</h1>
      </div>
      <EstadoApi />
      <nav aria-label="Otras partes de Charmy" className="flex gap-3 text-sm">
        <a className="text-tinta-suave underline-offset-2 hover:text-tinta hover:underline" href={URL_LANDING}>
          Qué es Charmy
        </a>
        <a className="text-tinta-suave underline-offset-2 hover:text-tinta hover:underline" href={URL_JUEGO}>
          Charmy Brigada
        </a>
      </nav>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {modo === "novato" && recorridoVisto && (
          <Button variant="ghost" size="sm" onClick={() => marcarRecorrido(false)}>
            <CircleHelp aria-hidden="true" />
            Ver el recorrido
          </Button>
        )}
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
