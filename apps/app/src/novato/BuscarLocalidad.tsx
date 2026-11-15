import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { areaDesdePunto } from "@/consulta/consulta";
import { useConsulta } from "@/estado/consulta";
import { t, useIdioma } from "@/relieve/idioma";
import { buscarLocalidades } from "./georef";

const RADIO_KM = 25;

/** Elegir el área buscando una localidad por nombre (RF-MAP-03). Si Georef falla, el resto sigue. */
export function BuscarLocalidad() {
  useIdioma((s) => s.idioma);
  const id = useId();
  const cambiar = useConsulta((s) => s.cambiar);
  const [nombre, setNombre] = useState("");
  const busqueda = useMutation({ mutationFn: (n: string) => buscarLocalidades(n) });

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length >= 2) busqueda.mutate(nombre.trim());
  };

  return (
    <form onSubmit={buscar} className="flex flex-col gap-2" role="search">
      <label htmlFor={id} className="text-sm font-medium">
        {t("Buscar una localidad", "Search for a locality")}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="min-h-9 w-full rounded-control border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Esquel, El Bolsón…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button type="submit" variant="outline" size="icon" aria-label={t("Buscar", "Search")}>
          <Search aria-hidden="true" />
        </Button>
      </div>
      <p className="text-xs text-tinta-suave">{t("Por ahora solo localidades de Argentina.", "Currently only localities in Argentina.")}</p>
      {busqueda.isPending && <p className="text-sm text-tinta-suave">{t("Buscando…", "Searching…")}</p>}
      {busqueda.isError && (
        <p role="alert" className="text-sm">
          {t(
            "La búsqueda de localidades no está disponible ahora. Podés dibujar el área o escribir un punto.",
            "Locality search is not available right now. You can draw an area or enter coordinates.",
          )}
        </p>
      )}
      {busqueda.isSuccess && busqueda.data.length === 0 && (
        <p className="text-sm text-tinta-suave">
          {t("No encontramos esa localidad. Probá con otro nombre.", "We couldn’t find that locality. Try another name.")}
        </p>
      )}
      {busqueda.isSuccess && busqueda.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {busqueda.data.map((l) => (
            <li key={l.id}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  cambiar({ area: areaDesdePunto(l.lat, l.lon, RADIO_KM), dibujando: null });
                  busqueda.reset();
                }}
              >
                {l.nombre}, {l.provincia}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
