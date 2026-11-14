// Escribe dist/charmy.css a partir de src/estilos.ts ya compilado, para usarlo sin React.
import { writeFileSync } from "node:fs";
import { CHARMY_CSS } from "../dist/estilos.js";

writeFileSync(new URL("../dist/charmy.css", import.meta.url), CHARMY_CSS.trimStart());
