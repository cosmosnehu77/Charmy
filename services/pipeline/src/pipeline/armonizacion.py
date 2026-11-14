"""Armonización v1 (F2-B1): filtros D-04, días-celda D-02 y calibración en cadena D-03.

Unidad: días-celda con fuego por región y mes, en "equivalente VIIRS S-NPP".
- Hasta 2011: MODIS convertido a S-NPP.
- Mientras hay S-NPP: S-NPP medido.
- Después: NOAA-20 convertido a S-NPP.
Calibración log-lineal ln(y) = a + b·ln(x) por región y mes del año, con respaldo en la región entera y
luego en todo el conjunto cuando faltan puntos. Se valida dejando un año afuera.

Uso: uv run --package pipeline python -m pipeline.armonizacion --focos data/focos \
       --regiones data/muestras/regiones.geojson --out data/armonizado
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import polars as pl

from pipeline.esquema import ESQUEMAS
from pipeline.regiones import region_de_celdas

GRUPOS = {"Terra": "modis", "Aqua": "modis", "N": "snpp", "N20": "noaa20", "N21": "noaa21"}
MIN_PUNTOS = 5  # meses con fuego en ambos sensores para ajustar un nivel
Z90 = 1.645  # intervalo del 90 % en escala logarítmica
CLAVE = ["region", "year", "month"]


def filtrar(focos: pl.DataFrame) -> pl.DataFrame:
    """D-04: vegetación (type 0; NRT no trae type y se conserva), MODIS ≥ 30, VIIRS nominal o alta."""
    modis = pl.col("instrument") == "MODIS"
    return focos.filter(
        (pl.col("type").is_null() | (pl.col("type") == 0))
        & pl.when(modis)
        .then(pl.col("confidence_pct") >= 30)
        .otherwise(pl.col("confidence").is_in(["nominal", "high"]))
    )


def dias_celda_mensuales(
    focos: pl.DataFrame, celda_region: pl.DataFrame, regiones: list[str] | None = None
) -> pl.DataFrame:
    """D-02: cada (celda, día UTC) cuenta una vez por grupo de sensor. Meses sin fuego quedan en 0.

    `regiones` suma con ceros las que no tuvieron ningún foco.
    """
    dias = (
        focos.lazy()
        .select(
            grupo=pl.col("satellite").replace_strict(GRUPOS),
            dia=pl.col("acq_datetime").dt.date(),
            cell_id="cell_id",
        )
        .unique()
        .join(celda_region.lazy(), on="cell_id")
    )
    conteo = (
        dias.group_by("region", "grupo", mes=pl.col("dia").dt.truncate("1mo"))
        .agg(value=pl.len().cast(pl.Float64))
        .collect()
    )
    # Grilla completa: cada grupo cubre de su primer a su último mes con datos, en todas las regiones.
    rangos = conteo.group_by("grupo").agg(desde=pl.col("mes").min(), hasta=pl.col("mes").max())
    grilla = (
        rangos.select("grupo", mes=pl.date_ranges("desde", "hasta", "1mo"))
        .explode("mes")
        .join(
            pl.DataFrame(
                {"region": regiones or celda_region["region"].unique()}, schema={"region": pl.String}
            ),
            how="cross",
        )
    )
    return (
        grilla.join(conteo, on=["region", "grupo", "mes"], how="left")
        .select(
            "region",
            year=pl.col("mes").dt.year().cast(pl.Int16),
            month=pl.col("mes").dt.month().cast(pl.Int8),
            grupo="grupo",
            value=pl.col("value").fill_null(0.0),
        )
        .sort("region", "grupo", "year", "month")
    )


def _pares(m: pl.DataFrame, desde: str, hacia: str) -> pl.DataFrame:
    x = m.filter(pl.col("grupo") == desde).select(*CLAVE, x="value")
    y = m.filter(pl.col("grupo") == hacia).select(*CLAVE, y="value")
    return x.join(y, on=CLAVE)


def _ols(pares: pl.DataFrame, claves: list[str]) -> pl.DataFrame:
    """Recta en escala log sobre los meses con fuego en ambos sensores, por grupo de claves."""
    lx, ly = pl.col("x").log(), pl.col("y").log()
    b = pl.cov(lx, ly) / lx.var()
    resid = (ly - ly.mean()) - b * (lx - lx.mean())
    datos = pares.filter((pl.col("x") > 0) & (pl.col("y") > 0)).with_columns(_todo=pl.lit(1))
    coef = datos.group_by(claves or ["_todo"]).agg(
        n=pl.len(), b=b, a=ly.mean() - b * lx.mean(), sigma=((resid**2).sum() / (pl.len() - 2)).sqrt()
    )
    return coef.filter(pl.col("b").is_finite())  # sin variación en x no hay recta


def calibrar(m: pl.DataFrame, desde: str, hacia: str, min_puntos: int = MIN_PUNTOS) -> pl.DataFrame:
    """Coeficientes por región y mes; si faltan puntos, los de la región entera, y si no, los globales."""
    pares = _pares(m, desde, hacia)
    base = (
        m.select("region")
        .unique()
        .join(pl.DataFrame({"month": pl.Series(range(1, 13), dtype=pl.Int8)}), how="cross")
    )
    niveles = [("region_mes", ["region", "month"]), ("region", ["region"]), ("global", [])]
    elegidos = base.with_columns(a=None, b=None, sigma=None, nivel=None).cast(
        {"a": pl.Float64, "b": pl.Float64, "sigma": pl.Float64, "nivel": pl.String}
    )
    for nombre, claves in niveles:
        coef = _ols(pares, claves).filter(pl.col("n") >= min_puntos).drop("n")
        coef = (
            base.join(coef, on=claves, how="inner") if claves else base.join(coef.drop("_todo"), how="cross")
        )
        elegidos = _completar(elegidos, coef.with_columns(nivel=pl.lit(nombre)))
    if elegidos["a"].null_count():
        raise ValueError(f"No hay meses con fuego en {desde} y {hacia} a la vez para calibrar")
    return elegidos.sort("region", "month")


def _completar(elegidos: pl.DataFrame, nuevos: pl.DataFrame) -> pl.DataFrame:
    """Llena solo las filas que todavía no tienen coeficientes."""
    falta = elegidos.filter(pl.col("a").is_null()).select("region", "month")
    llenas = falta.join(nuevos, on=["region", "month"], how="left").select(elegidos.columns)
    return pl.concat([elegidos.filter(pl.col("a").is_not_null()), llenas])


def convertir(origen: pl.DataFrame, coefs: pl.DataFrame) -> pl.DataFrame:
    """Lleva valores de un sensor a la escala del otro con su intervalo del 90 %. Cero sigue siendo cero."""
    pred = (
        pl.when(pl.col("value") > 0)
        .then((pl.col("a") + pl.col("b") * pl.col("value").log()).exp())
        .otherwise(0.0)
    )
    ancho = (Z90 * pl.col("sigma").fill_null(0.0)).exp()
    return (
        origen.join(coefs, on=["region", "month"])
        .with_columns(value=pred)
        .select(*CLAVE, "value", lower=pl.col("value") / ancho, upper=pl.col("value") * ancho)
    )


def validar(m: pl.DataFrame, desde: str, hacia: str) -> pl.DataFrame:
    """Para cada año de solape, calibra sin ese año y predice sus meses."""
    anios = _pares(m, desde, hacia)["year"].unique().sort()
    partes = []
    for anio in anios:
        coefs = calibrar(m.filter(pl.col("year") != anio), desde, hacia)
        x = m.filter((pl.col("grupo") == desde) & (pl.col("year") == anio)).select(*CLAVE, "value")
        obs = m.filter((pl.col("grupo") == hacia) & (pl.col("year") == anio)).select(*CLAVE, obs="value")
        partes.append(convertir(x, coefs).select(*CLAVE, pred="value").join(obs, on=CLAVE))
    return pl.concat(partes).sort(*CLAVE)


def _tramos(m: pl.DataFrame) -> list[tuple[str, str]]:
    return [(g, f"{g}_snpp") for g in ("modis", "noaa20") if (m["grupo"] == g).any()]


def metricas(m: pl.DataFrame) -> pl.DataFrame:
    """RF-ARM-04: r², sesgo relativo y error medio absoluto de los años dejados afuera, por región y tramo."""
    partes = []
    for grupo, par in _tramos(m):
        v = validar(m, grupo, "snpp")
        partes.append(
            v.group_by("region")
            .agg(
                r2=1
                - ((pl.col("obs") - pl.col("pred")) ** 2).sum()
                / ((pl.col("obs") - pl.col("obs").mean()) ** 2).sum(),
                bias=(pl.col("pred") - pl.col("obs")).sum() / pl.col("obs").sum(),
                mae=(pl.col("pred") - pl.col("obs")).abs().mean(),
                n_months=pl.len().cast(pl.Int32),
            )
            .with_columns(pair=pl.lit(par))
        )
    return (
        pl.concat(partes)
        .select("region", "pair", "r2", "bias", "mae", "n_months", provisional=pl.lit(False))
        .with_columns(pl.col("r2", "bias", "mae").fill_nan(None))  # 0/0 sin fuego: null, JSON no tiene NaN
        .sort("region", "pair")
    )


def serie(m: pl.DataFrame) -> pl.DataFrame:
    """Tabla `serie` del contrato: armonizada y cada sensor por separado."""
    mes = pl.col("year").cast(pl.Int32) * 12 + pl.col("month").cast(pl.Int32)
    snpp = m.filter(pl.col("grupo") == "snpp")
    if snpp.is_empty():
        raise ValueError("Faltan datos de S-NPP: es la referencia de la calibración")
    inicio, fin = snpp.select(mes.min()).item(), snpp.select(mes.max()).item()

    def crudo(grupo: str, source: str, origin: str) -> pl.DataFrame:
        d = m.filter(pl.col("grupo") == grupo).select(*CLAVE, "value")
        return d.with_columns(lower="value", upper="value", source=pl.lit(source), origin=pl.lit(origin))

    medido = crudo("snpp", "harmonized", "viirs_medido")
    antes = convertir(m.filter((pl.col("grupo") == "modis") & (mes < inicio)), calibrar(m, "modis", "snpp"))
    partes = [antes.with_columns(source=pl.lit("harmonized"), origin=pl.lit("modis_convertido")), medido]
    despues = m.filter((pl.col("grupo") == "noaa20") & (mes > fin))
    if not despues.is_empty():
        conv = convertir(despues, calibrar(m, "noaa20", "snpp"))
        partes.append(conv.with_columns(source=pl.lit("harmonized"), origin=pl.lit("viirs_convertido")))
    partes += [crudo("modis", "modis", "modis_medido"), crudo("snpp", "viirs", "viirs_medido")]
    return (
        pl.concat([p.select(*CLAVE, "source", "value", "lower", "upper", "origin") for p in partes])
        .with_columns(pl.col("value", "lower", "upper").round(3), provisional=pl.lit(False))
        .sort("region", "source", "year", "month")
    )


def calendario(serie: pl.DataFrame) -> pl.DataFrame:
    """RF-CAL-02: serie armonizada, mediana del mes en los años anteriores al último, anomalía y percentil.

    El año en curso se compara con su historia sin entrar en ella. El percentil es entre todos los años.
    """
    h = serie.filter(pl.col("source") == "harmonized").drop("source")
    if h.is_empty():
        return pl.DataFrame(schema=ESQUEMAS["calendario"])
    grupo = ["region", "month"]
    historia = h.filter(pl.col("year") < h["year"].max()).group_by(grupo).agg(median=pl.col("value").median())
    rango = (pl.col("value").rank("average").over(grupo) - 0.5) / pl.len().over(grupo) * 100
    return (
        h.join(historia, on=grupo, how="left")
        .with_columns(anomaly=pl.col("value") - pl.col("median"), percentile=rango.round(1))
        .select({k: pl.col(k).cast(v) for k, v in ESQUEMAS["calendario"].items()}.values())
        .sort("region", "year", "month")
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Armonización v1: focos -> serie y métricas")
    p.add_argument("--focos", type=Path, required=True, help="Carpeta de focos de pipeline.firms")
    p.add_argument("--regiones", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)
    # Solo las columnas que usa la armonización: con el histórico completo, leer todo no entra en memoria.
    columnas = ["satellite", "instrument", "confidence", "confidence_pct", "type", "cell_id", "acq_datetime"]
    # D-02 cuenta (satélite, día, celda) una vez: deduplicar cada archivo antes de juntarlos baja la memoria.
    focos = pl.concat(
        [
            filtrar(pl.scan_parquet(ruta).select(columnas))
            .select("satellite", "cell_id", acq_datetime=pl.col("acq_datetime").dt.truncate("1d"))
            .unique()
            .collect()
            for ruta in sorted(args.focos.glob("*.parquet"))
        ]
    )
    regiones = json.loads(args.regiones.read_text())
    codigos = [f["properties"]["region"] for f in regiones["features"]]
    m = dias_celda_mensuales(focos, region_de_celdas(focos["cell_id"], regiones), codigos)
    args.out.mkdir(parents=True, exist_ok=True)
    s = serie(m)
    s.write_parquet(args.out / "serie.parquet")
    calendario(s).write_parquet(args.out / "calendario.parquet")
    metricas(m).write_parquet(args.out / "metricas.parquet")
    shutil.copyfile(args.regiones, args.out / "regiones.geojson")
    print(f"serie, calendario, metricas y regiones en {args.out}: listo para publicar (infra/README.md)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
