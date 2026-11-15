import { HERRAMIENTAS, type Herramienta } from "./partida";

/** Qué hace cada herramienta, para el rótulo del nivel. Corto y con voseo. */
export const AYUDAS: Record<Herramienta, string> = {
  bombero: "Agua: tocá un foco para apagarlo. Recargá en un lago.",
  piloto: "Avión: tocá una zona y apaga todos los focos de ahí.",
  cientifica: "Verificar: tocá un foco con \"?\" para ver si es real.",
  guia: "Cortafuegos: tocá cerca del fuego para frenarlo.",
};

/** La barra de herramientas de la página (index.html): botones de HTML, para el dedo, el teclado y el lector. */
export interface Barra {
  mostrar(): void;
  ocultar(): void;
  marcar(h: Herramienta): void;
  /** Segundos que faltan para el avión, o 0 si está listo. */
  avion(segundos: number): void;
}

export function barra(alElegir: (h: Herramienta) => void): Barra {
  const caja = document.querySelector<HTMLElement>("#herramientas");
  const botones = new Map(
    HERRAMIENTAS.map((h) => [h, caja?.querySelector<HTMLButtonElement>(`[data-herramienta="${h}"]`) ?? null]),
  );
  for (const [h, boton] of botones) {
    boton?.addEventListener("click", () => alElegir(h));
    // Enter o Espacio sobre un botón no deben llegar al juego.
    boton?.addEventListener("keydown", (e) => e.stopPropagation());
  }
  const avion = botones.get("piloto");
  const textoAvion = avion?.innerHTML ?? "";
  let ultimo = -1;
  return {
    mostrar: () => caja?.removeAttribute("hidden"),
    ocultar: () => caja?.setAttribute("hidden", ""),
    marcar(elegida) {
      for (const [h, boton] of botones) boton?.setAttribute("aria-pressed", String(h === elegida));
    },
    avion(segundos) {
      if (!avion || segundos === ultimo) return;
      ultimo = segundos;
      avion.innerHTML = segundos > 0 ? `${textoAvion} (${segundos} s)` : textoAvion;
    },
  };
}
