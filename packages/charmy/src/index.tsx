import type { CSSProperties } from "react";
import { CHARMY_CSS, charmySvg, normalizar, type OpcionesCharmy } from "./core.js";

export * from "./core.js";

export interface CharmyProps extends OpcionesCharmy {
  className?: string;
  style?: CSSProperties;
}

/**
 * Charmy, la vizcacha de fuego. API estable: <Charmy mood outfit size say />.
 * Si recibe `say`, muestra el texto en un globo al lado del dibujo y lo anuncia a los lectores de pantalla.
 * Las animaciones son CSS: React 19 inserta la hoja una sola vez aunque haya varios Charmy en la página.
 */
export function Charmy({ className, style, ...op }: CharmyProps) {
  const n = normalizar(op);
  const clases = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
  const estilos = (
    <style href="charmy-estilos" precedence="default">
      {CHARMY_CSS}
    </style>
  );
  // charmySvg arma el SVG solo con constantes propias y enums validados; el único texto libre va escapado.
  const svg = (
    <span
      className="charmy-dibujo"
      style={{ display: "inline-block", lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: charmySvg(op) }}
    />
  );
  return (
    <span
      className={clases("charmy-raiz", n.conTexto && "charmy-con-globo", className)}
      data-globo={n.conTexto ? n.sayPosition : undefined}
      data-animado={n.animate ? undefined : "no"}
      style={style}
    >
      {estilos}
      {svg}
      {n.conTexto && (
        <span className="charmy-globo" role="status" aria-live="polite">
          {op.say}
        </span>
      )}
    </span>
  );
}

export default Charmy;
