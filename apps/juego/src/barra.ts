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
