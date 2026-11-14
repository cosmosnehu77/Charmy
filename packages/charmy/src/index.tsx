import type { CSSProperties } from "react";
import { charmySvg, normalizar, type OpcionesCharmy } from "./core.js";

export * from "./core.js";

export interface CharmyProps extends OpcionesCharmy {
  className?: string;
  style?: CSSProperties;
}

/**
 * Charmy, la vizcacha de fuego. API estable: <Charmy mood outfit size say />.
 * Si recibe `say`, muestra el texto en un globo al lado del dibujo y lo anuncia a los lectores de pantalla.
 */
export function Charmy({ className, style, ...op }: CharmyProps) {
  const n = normalizar(op);
  // charmySvg arma el SVG solo con constantes propias y enums validados; el único texto libre va escapado.
  const svg = <span className="charmy-dibujo" style={{ display: "inline-block", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: charmySvg(op) }} />;
  if (!n.conTexto) {
    return (
      <span className={["charmy-raiz", className].filter(Boolean).join(" ")} style={style}>
        {svg}
      </span>
    );
  }
  return (
    <span
      className={["charmy-raiz", "charmy-con-globo", className].filter(Boolean).join(" ")}
      style={{ display: "inline-flex", alignItems: "flex-start", gap: "0.5rem", ...style }}
    >
      {svg}
      <span
        className="charmy-globo"
        role="status"
        aria-live="polite"
        style={{
          background: "#FFFFFF",
          border: "2px solid #CBD5E1",
          borderRadius: "14px",
          padding: "0.5rem 0.75rem",
          color: "#1B2430",
          maxWidth: "22rem",
          lineHeight: 1.4,
        }}
      >
        {op.say}
      </span>
    </span>
  );
}

export default Charmy;
