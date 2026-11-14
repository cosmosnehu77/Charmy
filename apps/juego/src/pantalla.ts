/**
 * Tamaño lógico del lienzo según la pantalla. En un teléfono vertical, un lienzo de 800 × 600 se achica a menos de
 * la mitad y los textos no se leen; uno vertical aprovecha el alto (y la Patagonia es alta y angosta).
 */
export interface Dimensiones {
  ancho: number;
  alto: number;
}

export function dimensiones(anchoPantalla: number, altoPantalla: number): Dimensiones {
  return altoPantalla > anchoPantalla * 1.1 ? { ancho: 480, alto: 720 } : { ancho: 800, alto: 600 };
}
