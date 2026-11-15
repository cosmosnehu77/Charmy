import { rampaAnomalia, rampaConteo, relieve } from "@charmy/ui";
import {
  alturaDelDia,
  capaRegiones,
  capasRegionesVisibles,
  colorFoco,
  escalaRegion,
  hace,
  maximo,
  nivelFoco,
  nivelPercentil,
  nivelRegion,
  radioFoco,
  rankingRegiones,
  serieDelIndicador,
  tendencia,
  regionDePunto,
  AGRUPAR_VIVO,
  AGRUPAR_ZONA,
  estiloGrupo,
  enNiveles,
  conPrediccion,
  focosVivoVisibles,
  focosPorRegion,
  type MesPrediccion,
  plazoPrediccion,
  textoPrediccion,
  textoProbabilidad,
  colorPrediccion,
  comparacionPrediccion,
  porQuePrediccion,
  cajaDeRegion,
  periodoUltimoMes,
  serieUltimoMes,
  nombresPorZoom,
  ubicarGlobo,
  type RegionResumen,
  valorIndicador,
} from "@/relieve/logica";

function region(id: string, hotspots: number | null, frp: number | null, percentil?: number): RegionResumen {
  return {
    type: "Feature",
    id,
    geometry: { type: "Polygon", coordinates: [] },
    properties: {
      region: id,
      name: `Región ${id}`,
      country: "Argentina",
      hotspots,
      frp_mw: frp,
      by_day: hotspots === null ? null : [hotspots],
      frp_by_day: frp === null ? null : [frp],
      // Focos mide el último mes cerrado (#373): el mismo número va al mes, para que las pruebas sigan legibles.
      last_month:
        hotspots === null ? null : { year: 2026, month: 10, value: hotspots, median: 8, percentile: percentil ?? null },
    },
  };
}

const REGIONES = [region("A", 300, 1200, 80), region("B", 0, 0), region("C", 12, 40), region("D", 75, 300, 20)];

describe("valor de cada indicador", () => {
  it("focos, intensidad y anomalía salen de la región, y predicción solo si llegó", () => {
    const a = REGIONES[0]!.properties;
    expect(valorIndicador(a, "focos")).toBe(300);
    expect(valorIndicador(a, "frp")).toBe(1200);
    expect(valorIndicador(a, "anomalia")).toBe(80);
    expect(valorIndicador(a, "prediccion")).toBeNull();
    expect(valorIndicador(REGIONES[1]!.properties, "anomalia")).toBeNull();
  });
  it("focos es el último mes cerrado, no los focos de los últimos días (#373)", () => {
    const p = { ...REGIONES[0]!.properties, hotspots: 5 };
    expect(valorIndicador(p, "focos")).toBe(300);
  });
  it("sin último mes, el valor de focos es null", () => {
    expect(valorIndicador(region("X", null, null).properties, "focos")).toBeNull();
  });
});

describe("escala de cada región", () => {
  it("conteos: raíz del valor sobre el máximo, con la rampa YlOrRd", () => {
    const max = maximo(REGIONES, "focos");
    expect(max).toBe(300);
    expect(escalaRegion(300, max, "focos")).toEqual({ color: rampaConteo[6], altura: 1 });
    expect(escalaRegion(75, max, "focos").altura).toBeCloseTo(0.5);
    expect(escalaRegion(75, max, "focos").color).toBe(rampaConteo[3]);
  });
  it("sin focos queda baja y sin color de fuego; sin dato, gris", () => {
    expect(escalaRegion(0, 300, "focos")).toEqual({ color: relieve.sinDato, altura: 0 });
    expect(escalaRegion(null, 300, "focos")).toEqual({ color: relieve.sinDato, altura: 0 });
  });
  it("anomalía: el percentil con la rampa PuOr", () => {
    expect(escalaRegion(80, 100, "anomalia")).toEqual({ color: rampaAnomalia[5], altura: 0.8 });
    expect(escalaRegion(5, 100, "anomalia").color).toBe(rampaAnomalia[0]);
  });
});

describe("ranking", () => {
  it("ordena de mayor a menor, sin regiones en cero ni sin dato", () => {
    const r = rankingRegiones(REGIONES, "focos", 5);
    expect(r.map((x) => x.id)).toEqual(["A", "D", "C"]);
    expect(r[0]).toMatchObject({ nombre: "Región A", valor: 300 });
  });
  it("respeta el tope", () => {
    expect(rankingRegiones(REGIONES, "focos", 2)).toHaveLength(2);
  });
});

describe("nivel de la ficha", () => {
  it("de más a menos fuego", () => {
    expect(nivelRegion(300, 0)).toEqual({ texto: "Entre las de más fuego", tono: "alto" });
    expect(nivelRegion(12, 5)).toEqual({ texto: "Con fuego activo", tono: "medio" });
    expect(nivelRegion(4, 8)).toEqual({ texto: "Poca actividad", tono: "bajo" });
    expect(nivelRegion(0, -1)).toEqual({ texto: "Sin fuego ese mes", tono: "cero" });
    expect(nivelRegion(null, -1)).toEqual({ texto: "Focos no disponibles", tono: "cero" });
  });
  it("el percentil en palabras", () => {
    expect(nivelPercentil(80)).toBe("bastante por encima de lo normal");
    expect(nivelPercentil(60)).toBe("un poco por encima de lo normal");
    expect(nivelPercentil(50)).toBe("dentro de lo normal");
    expect(nivelPercentil(30)).toBe("un poco por debajo de lo normal");
    expect(nivelPercentil(10)).toBe("bastante por debajo de lo normal");
  });
});

describe("línea de tiempo", () => {
  it("la altura del día es la de la semana por el día sobre el día con más focos", () => {
    expect(alturaDelDia(0.8, [1, 4, 2], 1)).toBeCloseTo(0.8);
    expect(alturaDelDia(0.8, [1, 4, 2], 2)).toBeCloseTo(0.4);
    expect(alturaDelDia(0.8, [0, 0, 0], 0)).toBe(0);
  });
});

describe("focos en vivo", () => {
  it("el radio crece con la raíz de la intensidad", () => {
    expect(radioFoco(0)).toBe(3);
    expect(radioFoco(100)).toBe(19);
    expect(radioFoco(null)).toBe(3);
  });
  it("color y nivel por intensidad", () => {
    expect(colorFoco(2)).toBe(rampaConteo[1]);
    expect(colorFoco(100)).toBe(rampaConteo[6]);
    expect(nivelFoco(5)).toBe("Bajo");
    expect(nivelFoco(10)).toBe("Fuerte");
    expect(nivelFoco(30)).toBe("Muy fuerte");
  });
  it("hace cuánto, en horas", () => {
    const ahora = new Date("2026-11-14T12:00:00Z");
    expect(hace(ahora, "2026-11-14T11:40:00Z")).toBe("hace menos de 1 h");
    expect(hace(ahora, "2026-11-14T07:00:00Z")).toBe("hace 5 h");
  });
});

describe("En vivo en 3D (#373)", () => {
  const foco = (region: string | null, horas: number, frp: number) => ({
    region,
    t: Date.UTC(2026, 10, 15, 12) - horas * 3_600_000,
    frp,
  });
  const focos = [foco("A", 0, 5), foco("A", 1, 40), foco("B", 30, 5), foco(null, 0, 5)];
  it("cuenta por región los focos que se ven, con la ventana y los niveles elegidos", () => {
    expect(focosPorRegion(focos, 48, [])).toEqual(new Map([["A", 2], ["B", 1]]));
    expect(focosPorRegion(focos, 24, [])).toEqual(new Map([["A", 2]]));
    expect(focosPorRegion(focos, 48, ["Muy fuerte"])).toEqual(new Map([["A", 1]]));
  });
  it("sin focos, ninguna región", () => {
    expect(focosPorRegion([], 48, []).size).toBe(0);
  });
});

describe("región de un punto", () => {
  const cuadrado = (id: string, x: number): RegionResumen => ({
    ...region(id, 0, 0),
    geometry: { type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
  });
  const multi: RegionResumen = {
    ...region("M", 0, 0),
    geometry: { type: "MultiPolygon", coordinates: [[[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]] },
  };
  it("encuentra la región que contiene el punto, también en multipolígonos", () => {
    const regiones = [cuadrado("A", 0), cuadrado("B", 2), multi];
    expect(regionDePunto(regiones, 0.5, 0.5)).toBe("A");
    expect(regionDePunto(regiones, 2.2, 0.9)).toBe("B");
    expect(regionDePunto(regiones, 5.5, 5.5)).toBe("M");
    expect(regionDePunto(regiones, 1.5, 0.5)).toBeNull();
  });
});

describe("globo de Charmy guía (#226)", () => {
  const caja = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  const ventana = { W: 1389, H: 635, ancho: 430, alto: 160 };

  it("con un elemento de arriba (indicadores), el globo va justo debajo y centrado en él", () => {
    const r = caja(443, 20, 581, 42);
    const p = ubicarGlobo(r, ventana);
    expect(p.y).toBe(r.bottom + 16);
    expect(p.x + ventana.ancho / 2).toBeCloseTo(r.left + r.width / 2);
  });

  it("con la lupa, arriba a la derecha, el globo va debajo y no se sube a la píldora", () => {
    const r = caja(1030, 24, 34, 34);
    const p = ubicarGlobo(r, ventana);
    expect(p.y).toBe(r.bottom + 16);
    expect(p.x + ventana.ancho).toBeLessThanOrEqual(ventana.W - 12);
  });

  it("con un elemento al costado (ranking), el globo va a su lado", () => {
    const r = caja(16, 76, 250, 90);
    const p = ubicarGlobo(r, ventana);
    expect(p).toMatchObject({ x: r.right + 16, izquierda: false });
  });

  it("sin elemento, el globo va al centro", () => {
    expect(ubicarGlobo(null, ventana)).toEqual({ x: (1389 - 430) / 2, y: (635 - 160) / 2, izquierda: false });
  });
});

describe("nombres del mapa según el zoom (#236)", () => {
  const capa = (id: string) => ({ id, type: "symbol" as const, source: "openmaptiles", "source-layer": "place" });
  const estilo = {
    version: 8 as const,
    sources: {},
    layers: [
      capa("place_country_major"),
      capa("place_city_large"),
      capa("place_state"),
      capa("place_city"),
      capa("place_town"),
      capa("place_village"),
      { id: "water_name", type: "symbol" as const, source: "openmaptiles", "source-layer": "water_name" },
    ],
  };

  it("los nombres aparecen de a poco: países, ciudades grandes, provincias, ciudades, pueblos", () => {
    const capas = nombresPorZoom(estilo).layers;
    const min = (id: string) => capas.find((c) => c.id === id)?.minzoom ?? 0;
    expect(min("place_country_major")).toBe(0);
    expect(min("place_city_large")).toBeGreaterThan(min("place_country_major"));
    expect(min("place_state")).toBeGreaterThan(min("place_city_large"));
    expect(min("place_city")).toBeGreaterThan(min("place_state"));
    expect(min("place_town")).toBeGreaterThan(min("place_city"));
    expect(min("place_village")).toBeGreaterThan(min("place_town"));
  });

  it("las capas que no son de lugares no cambian", () => {
    expect(nombresPorZoom(estilo).layers.find((c) => c.id === "water_name")).toEqual(estilo.layers[6]);
  });
});

describe("filtro por intensidad de En vivo (#251)", () => {
  it("sin niveles elegidos entran todos; con niveles, solo los de esos niveles", () => {
    expect([2, 15, 40].map((frp) => enNiveles(frp, []))).toEqual([true, true, true]);
    expect([2, 9.9, 10, 29.9, 30, 80].map((frp) => enNiveles(frp, ["Fuerte"]))).toEqual([false, false, true, true, false, false]);
    expect([2, 15, 40].map((frp) => enNiveles(frp, ["Bajo", "Muy fuerte"]))).toEqual([true, false, true]);
  });
});

describe("tendencia del ranking (F4-D6)", () => {
  const dias = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];
  it("compara la segunda mitad de los días con la primera", () => {
    expect(tendencia([2, 3, 8, 9], dias.slice(0, 4), "2026-11-20")).toBe("sube");
    expect(tendencia([9, 8, 3, 2], dias.slice(0, 4), "2026-11-20")).toBe("baja");
  });
  it("el día de hoy no cuenta: todavía no terminó", () => {
    // Sin hoy: [2, 2, 2, 2] → estable, aunque hoy vaya en 0.
    expect(tendencia([2, 2, 2, 2, 0], dias, "2026-11-14")).toBe("estable");
  });
  it("una diferencia chica se dice estable", () => {
    expect(tendencia([10, 10, 11, 11], dias.slice(0, 4), "2026-11-20")).toBe("estable");
    expect(tendencia([0, 0, 1, 0], dias.slice(0, 4), "2026-11-20")).toBe("estable");
  });
  it("con menos de dos días o sin serie no hay tendencia", () => {
    expect(tendencia([5], dias.slice(0, 1), "2026-11-20")).toBeNull();
    expect(tendencia(null, dias, "2026-11-20")).toBeNull();
  });
  it("la serie sale del indicador: focos y potencia tienen serie diaria; la anomalía no", () => {
    const p = { by_day: [1, 2], frp_by_day: [3.5, 4] } as Parameters<typeof serieDelIndicador>[0];
    // Focos es del mes: no tiene serie diaria (#373).
    expect(serieDelIndicador(p, "focos")).toBeNull();
    expect(serieDelIndicador(p, "frp")).toEqual([3.5, 4]);
    expect(serieDelIndicador(p, "anomalia")).toBeNull();
  });
});

describe("agrupado de En vivo (#333)", () => {
  const h = 3_600_000;
  const focos = [
    { k: 1, t: 10 * h, frp: 2 },
    { k: 2, t: 9 * h, frp: 15 },
    { k: 3, t: 5 * h, frp: 40 },
    { k: 4, t: 3 * h, frp: 50 },
  ];

  it("deja solo la ventana de horas, contada desde el último foco", () => {
    expect(focosVivoVisibles(focos, 6, []).map((f) => f.k)).toEqual([1, 2, 3]);
  });

  it("y solo los niveles elegidos", () => {
    expect(focosVivoVisibles(focos, 24, ["Muy fuerte"]).map((f) => f.k)).toEqual([3, 4]);
    expect(focosVivoVisibles(focos, 6, ["Bajo", "Fuerte"]).map((f) => f.k)).toEqual([1, 2]);
  });

  it("sin focos no falla", () => {
    expect(focosVivoVisibles([], 6, [])).toEqual([]);
  });

  it("agrupa a menos de 50 px, desde 3 focos y hasta el zoom 8", () => {
    expect(AGRUPAR_VIVO).toEqual({ clusterRadius: 50, clusterMinPoints: 3, clusterMaxZoom: 8 });
  });
});

describe("agrupado de Experto (#343)", () => {
  it("agrupa a menos de 50 px, desde 3 focos y hasta el zoom 12", () => {
    expect(AGRUPAR_ZONA).toEqual({ clusterRadius: 50, clusterMinPoints: 3, clusterMaxZoom: 12 });
  });
});

describe("aspecto de un grupo de focos (#343)", () => {
  it("crece con la cantidad", () => {
    expect([3, 9, 10, 49, 50, 199, 200, 5000].map((n) => estiloGrupo(n, 5).diametro)).toEqual([30, 30, 36, 36, 44, 44, 54, 54]);
  });

  it("late desde 100 focos", () => {
    expect(estiloGrupo(99, 5).late).toBe(false);
    expect(estiloGrupo(100, 5).late).toBe(true);
  });

  it("toma el color de su foco más intenso", () => {
    expect(estiloGrupo(12, 80).color).toBe(colorFoco(80));
    expect(estiloGrupo(12, null).color).toBe(colorFoco(0));
  });

  it("muestra la cantidad con separador de miles", () => {
    expect(estiloGrupo(42, 5).texto).toBe("42");
    expect(estiloGrupo(8567, 5).texto).toBe("8.567");
  });
});

describe("predicción por región (F4-D12, #347)", () => {
  const mes = (m: string, horizon: number, esperadas: number, habituales: number): MesPrediccion => ({
    month: m,
    horizon,
    kind: horizon <= 2 ? "forecast" : "usual_adjusted",
    probability: 0.9,
    usual_probability: 0.8,
    expected_cells: esperadas,
    usual_cells: habituales,
    level: "muy alta",
    skill_vs_climatology: 0.12,
  });
  const meses = [mes("2026-11", 1, 33.7, 20), mes("2026-12", 2, 9, 9.4), mes("2027-01", 3, 2, 6)];

  it("suma los meses a cada región; las que no vinieron quedan sin predicción", () => {
    const juntas = conPrediccion(REGIONES, { model: "m", emission: "2026-10", regions: [{ region: "A", zone: { cells: 5, no_history: false }, months: meses }] });
    expect(juntas[0]!.properties.prediccion).toEqual(meses);
    expect(juntas[1]!.properties.prediccion).toBeUndefined();
    expect(conPrediccion(REGIONES, undefined)).toBe(REGIONES);
  });

  it("el valor del mapa son las celdas esperadas el mes que viene", () => {
    const [a] = conPrediccion(REGIONES, { model: "m", emission: "2026-10", regions: [{ region: "A", zone: { cells: 5, no_history: false }, months: meses }] });
    expect(valorIndicador(a!.properties, "prediccion")).toBe(33.7);
  });

  it("dice si se espera más, lo mismo o menos que lo habitual", () => {
    expect(textoPrediccion(meses[0]!)).toBe("Se esperan 33,7 celdas con fuego, más que las 20 habituales.");
    expect(textoPrediccion(meses[1]!)).toBe("Se esperan 9 celdas con fuego, como las 9,4 habituales.");
    expect(textoPrediccion(meses[2]!)).toBe("Se esperan 2 celdas con fuego, menos que las 6 habituales.");
  });

  it("en un área chica habla de probabilidad, contra la habitual", () => {
    const area = (p: number, h: number) => ({ ...meses[0]!, probability: p, usual_probability: h });
    expect(textoProbabilidad(area(0.0793, 0.0785))).toBe("Probabilidad de fuego: 8 %, como el 8 % habitual.");
    expect(textoProbabilidad(area(0.31, 0.2))).toBe("Probabilidad de fuego: 31 %, más que el 20 % habitual.");
    expect(textoProbabilidad(area(0.05, 0.2))).toBe("Probabilidad de fuego: 5 %, menos que el 20 % habitual.");
  });

  it("1 y 2 meses son pronóstico; desde 3, lo habitual ajustado", () => {
    expect(meses.map(plazoPrediccion)).toEqual(["Pronóstico", "Pronóstico", "Lo habitual, ajustado"]);
  });
});

describe("capas de regiones en 2D y 3D", () => {
  it("usa reg-2d en modo plano y reg-3d en relieve", () => {
    expect(capaRegiones(true)).toBe("reg-2d");
    expect(capaRegiones(false)).toBe("reg-3d");
  });

  it("muestra las divisiones en todos los mapas 2D (plano, En vivo y Experto) y las oculta en 3D", () => {
    expect(capasRegionesVisibles(false, false)).toEqual({ vivoGris: false, reg2d: false, regBorde: false, reg3d: true });
    expect(capasRegionesVisibles(true, false)).toEqual({ vivoGris: false, reg2d: true, regBorde: true, reg3d: false });
    expect(capasRegionesVisibles(false, true)).toEqual({ vivoGris: true, reg2d: false, regBorde: true, reg3d: false });
    expect(capasRegionesVisibles(true, true)).toEqual({ vivoGris: true, reg2d: false, regBorde: true, reg3d: false });
  });
});

describe("predicción contra lo habitual (F4-D15, #377)", () => {
  const mes = (esperadas: number, habituales: number, horizon = 1): MesPrediccion => ({
    month: "2026-11",
    horizon,
    kind: horizon <= 2 ? "forecast" : "usual_adjusted",
    probability: 0.5,
    usual_probability: 0.5,
    expected_cells: esperadas,
    usual_cells: habituales,
    level: "media",
    skill_vs_climatology: 0.12,
  });

  it("el color va de violeta intenso (mucho menos) a claro (lo habitual) y naranja intenso (mucho más)", () => {
    expect(colorPrediccion(mes(2, 10))).toBe(rampaAnomalia[0]);
    expect(colorPrediccion(mes(10, 10))).toBe(rampaAnomalia[3]);
    expect(colorPrediccion(mes(11, 10))).toBe(rampaAnomalia[3]);
    expect(colorPrediccion(mes(40, 10))).toBe(rampaAnomalia[6]);
    expect(colorPrediccion(mes(5, 10))).toBe(rampaAnomalia[1]);
    expect(colorPrediccion(mes(20, 10))).toBe(rampaAnomalia[5]);
  });

  it("sin habitual: con algo esperado es más; sin nada, sin dato", () => {
    expect(colorPrediccion(mes(3, 0))).toBe(rampaAnomalia[6]);
    expect(colorPrediccion(mes(0, 0))).toBe(relieve.sinDato);
    expect(colorPrediccion(undefined)).toBe(relieve.sinDato);
  });

  it("en la pestaña Predicción, el mapa se pinta contra lo habitual y la altura sigue las celdas", () => {
    const [a] = conPrediccion(REGIONES, {
      model: "m",
      emission: "2026-10",
      regions: [{ region: "A", zone: { cells: 5, no_history: false }, months: [mes(40, 10)] }],
    });
    expect(escalaRegion(40, 40, "prediccion", a!.properties)).toEqual({ color: rampaAnomalia[6], altura: 1 });
    expect(rankingRegiones([a!], "prediccion", 5)[0]!.color).toBe(rampaAnomalia[6]);
  });

  it("compara con ±15 % como lo habitual", () => {
    expect(comparacionPrediccion(mes(20, 10)).sentido).toBe("mas");
    expect(comparacionPrediccion(mes(10.5, 10)).sentido).toBe("igual");
    expect(comparacionPrediccion(mes(5, 10)).sentido).toBe("menos");
    expect(comparacionPrediccion(mes(20, 10)).veces).toBeCloseTo(2);
  });

  it("explica por qué: nombra el último mes si va en el mismo sentido", () => {
    const ultimo = (percentile: number) => ({ year: 2026, month: 10, value: 10, median: 8, percentile });
    expect(porQuePrediccion(mes(20, 10), ultimo(85))).toBe(
      "Se espera el doble de lo habitual. Octubre vino con más fuego que lo normal acá, y el modelo lo arrastra a los meses que vienen.",
    );
    expect(porQuePrediccion(mes(5, 10), ultimo(10))).toBe(
      "Se espera la mitad de lo habitual. Octubre vino con menos fuego que lo normal acá, y el modelo lo arrastra a los meses que vienen.",
    );
    expect(porQuePrediccion(mes(10, 10), ultimo(50))).toBe(
      "Se espera algo parecido a lo habitual: el fuego de los últimos meses no se aleja de lo normal para la época.",
    );
    expect(porQuePrediccion(mes(13, 10), null)).toBe(
      "Se espera un 30 % más que lo habitual, por el fuego de los últimos meses y del mismo mes del año pasado.",
    );
  });
});

describe("el último mes de una región (F4-D15, #377)", () => {
  const cuadrado = { type: "Polygon", coordinates: [[[-66, -28], [-63, -28], [-63, -25], [-66, -25], [-66, -28]]] };

  it("el período son los 30 días hasta ayer", () => {
    expect(periodoUltimoMes("2026-11-15")).toEqual({ desde: "2026-10-16", hasta: "2026-11-14" });
  });

  it("la caja de la región sale de su contorno", () => {
    expect(cajaDeRegion(cuadrado)).toEqual([-66, -28, -63, -25]);
  });

  it("cuenta por día UTC solo los focos dentro del contorno, con 0 en los días sin focos", () => {
    const foco = (lon: number, lat: number, acq: string) => ({
      geometry: { coordinates: [lon, lat] },
      properties: { acq_datetime: acq },
    });
    const serie = serieUltimoMes(
      [
        foco(-64, -26, "2026-10-16T18:00:00Z"),
        foco(-64, -26, "2026-10-16T05:00:00Z"),
        foco(-64, -27, "2026-11-14T23:59:00Z"),
        foco(-70, -26, "2026-10-17T18:00:00Z"),
      ],
      cuadrado,
      "2026-10-16",
      30,
    );
    expect(serie).toHaveLength(30);
    expect(serie[0]).toEqual({ dia: "2026-10-16", focos: 2 });
    expect(serie[1]).toEqual({ dia: "2026-10-17", focos: 0 });
    expect(serie[29]).toEqual({ dia: "2026-11-14", focos: 1 });
  });
});
