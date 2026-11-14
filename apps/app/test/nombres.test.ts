// @vitest-environment node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** En Windows y macOS, Calendario.tsx y calendario.ts son el mismo archivo para los imports sin extensión. */
function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("nombres de archivo", () => {
  it("no hay dos módulos de src que difieran solo en mayúsculas", () => {
    const src = fileURLToPath(new URL("../src", import.meta.url));
    const vistos = new Map<string, string>();
    const choques: string[] = [];
    for (const ruta of archivos(src)) {
      const clave = ruta.replace(/\.[^./]+$/, "").toLowerCase();
      const otro = vistos.get(clave);
      if (otro) choques.push(`${otro} ↔ ${ruta}`);
      vistos.set(clave, ruta);
    }
    expect(choques).toEqual([]);
  });
});
