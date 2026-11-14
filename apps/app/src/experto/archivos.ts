/** Descargas extra del modo experto (RF-EXP-02): calendario en CSV y como imagen SVG. */
import { interfaz } from "@charmy/ui";
import {
  colorCelda,
  colorTexto,
  type FilaCalendario,
  formatear,
  MESES,
  type RespuestaCalendario,
  type Vista,
} from "@/calendario/grilla";

export function calendarioCsv(cal: RespuestaCalendario): string {
  const filas = cal.cells.map((c) =>
    [c.year, c.month, c.value, c.median, c.anomaly, c.percentile, c.origin, cal.region ?? "", cal.provisional].join(","),
  );
  return `${["anio,mes,valor,mediana,anomalia,percentil,origen,region,provisional", ...filas].join("\n")}\n`;
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** El calendario como SVG autónomo, con los mismos colores de la tabla. */
export function calendarioSvg(grilla: FilaCalendario[], vista: Vista, titulo: string): string {
  const celda = 44;
  const alto = 22;
  const izquierda = 48;
  const arriba = 48;
  const ancho = izquierda + celda * 12 + 8;
  const total = arriba + alto * grilla.length + 8;
  const partes = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${total}" font-family="IBM Plex Mono, monospace" font-size="10" style="background:${interfaz.superficie}">`,
    `<text x="8" y="18" font-size="13" fill="${interfaz.tinta}">${escapar(titulo)}</text>`,
    ...MESES.map((m, i) => `<text x="${izquierda + i * celda + celda / 2}" y="40" text-anchor="middle" fill="${interfaz.tintaSuave}">${m}</text>`),
  ];
  grilla.forEach((fila, f) => {
    const y = arriba + f * alto;
    partes.push(`<text x="8" y="${y + 15}" fill="${interfaz.tinta}">${fila.year}</text>`);
    fila.meses.forEach((c, i) => {
      const x = izquierda + i * celda;
      const fondo = colorCelda(c, vista);
      partes.push(`<rect x="${x + 1}" y="${y + 1}" width="${celda - 2}" height="${alto - 2}" rx="2" fill="${fondo}"/>`);
      partes.push(
        `<text x="${x + celda / 2}" y="${y + 15}" text-anchor="middle" fill="${colorTexto(fondo)}">${c ? formatear(c.value) : "—"}</text>`,
      );
    });
  });
  partes.push("</svg>");
  return partes.join("");
}

/** Descarga un texto como archivo, sin pasar por el servidor. */
export function descargarArchivo(contenido: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  // Algunos navegadores cancelan la descarga si la URL se libera en el mismo instante del clic.
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
