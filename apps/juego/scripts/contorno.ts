// Genera src/fondo.json a partir de data/muestras/regiones.geojson y del recuadro de dia-juego.json.
// Uso: pnpm --filter @charmy/juego contorno
import { readFileSync, writeFileSync } from "node:fs";
import { contornoDelDia, type GeoJson, type Recuadro } from "../src/contorno.ts";

const leer = (ruta: string) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
const regiones = leer("../../../data/muestras/regiones.geojson") as GeoJson;
const { bbox } = leer("../../../data/muestras/dia-juego.json") as { bbox: Recuadro };

const contorno = contornoDelDia(regiones, bbox);
writeFileSync(new URL("../src/fondo.json", import.meta.url), JSON.stringify(contorno) + "\n");
console.log(`fondo.json: ${contorno.anillos.length} anillos, ${contorno.anillos.flat().length} puntos`);
