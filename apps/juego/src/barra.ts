import type { Idioma } from "./idioma";
import { COSTOS, PREMIO_CORTAFUEGOS, type Herramienta } from "./partida";

/** Qué hace cada herramienta, para la ayuda de la barra. Corto y con voseo. */
export const AYUDAS: Record<Herramienta, string> = {
  bombero: "Agua: tocá un foco para apagarlo. Recargá en un lago o una represa.",
  piloto: `Avión (${COSTOS.piloto} puntos): tocá una zona y apaga todos los focos de ahí.`,
  cientifica: "Verificar: tocá un foco con \"?\". La mayoría es falsa alarma y desaparece sin gastar agua.",
  guia: `Cortafuegos (${COSTOS.guia} puntos): tocá cerca del fuego. Cada vez que lo frena, suma ${PREMIO_CORTAFUEGOS}.`,
  brigada: `Brigada (${COSTOS.brigada} puntos): tocá el mapa y un camión va solo de foco en foco. Apaga hasta tres.`,
  aguatero: `Aguatero (${COSTOS.aguatero} puntos): un Charmy bombero te trae 8 de agua en dos viajes y se va.`,
};

const AYUDAS_EN: Record<Herramienta, string> = {
  bombero: "Water: tap a fire to put it out. Refill at a lake or a reservoir.",
  piloto: `Plane (${COSTOS.piloto} points): tap an area and it puts out every fire there.`,
  cientifica: "Verify: tap a fire with \"?\". Most are false alarms and disappear without using water.",
  guia: `Firebreak (${COSTOS.guia} points): tap near the fire. Each time it stops it, you get ${PREMIO_CORTAFUEGOS}.`,
  brigada: `Crew (${COSTOS.brigada} points): tap the map and a truck goes on its own from fire to fire. It puts out up to three.`,
  aguatero: `Water carrier (${COSTOS.aguatero} points): a firefighter Charmy brings you 8 water in two trips and leaves.`,
};

export const ayudas = (idioma: Idioma) => (idioma === "en" ? AYUDAS_EN : AYUDAS);
