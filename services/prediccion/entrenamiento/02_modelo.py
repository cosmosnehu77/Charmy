"""Paso 2: LightGBM que da la probabilidad de un evento de fuego por celda y mes, y la lleva a un área.

Evento (por celda de 0,1° y mes, visto por VIIRS S-NPP con los filtros de la armonización):
  alto_o_persistente  al menos un foco de confianza alta, o fuego en 2 o más días del mes  (por defecto)
  alto                al menos un foco de confianza alta
  cualquiera          al menos un foco nominal o alto

Un modelo por horizonte (1 a 6 meses). Todas las variables salen de la historia de focos hasta el mes de
emisión: nada del futuro. Se compara contra la climatología (frecuencia del evento en ese mes del año en los
años anteriores, por celda), que es la vara de la compuerta D-10.

Uso: uv run --package prediccion python services/prediccion/entrenamiento/02_modelo.py \
  [--evento alto] [--solo-metricas]
"""

import argparse
import json
from datetime import date
from pathlib import Path

import lightgbm as lgb
import numpy as np
import polars as pl

AQUI = Path(__file__).parent
DATOS = AQUI / "datos"
SALIDAS = AQUI / "salidas"

HORIZONTES = (1, 2, 3, 4, 5, 6)
MESES_PRUEBA = 24  # últimos meses objetivo, nunca vistos al entrenar
MESES_VALID = 12  # los 12 anteriores: frenan el entrenamiento y ajustan la fórmula de área
FRAC_NEG = 0.2  # parte de los negativos que entra al entrenamiento (con peso 1/FRAC_NEG); cuida la memoria
BLOQUES = (0.3, 0.5, 1.0, 2.0)  # lado, en grados, de las áreas cuadradas con que se prueba la agregación
PARAMS = {
    "objective": "binary",
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_data_in_leaf": 200,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "lambda_l2": 1.0,
    "seed": 0,
    "deterministic": True,
    "force_row_wise": True,
    "verbose": -1,
}
EVENTOS = {
    "alto_o_persistente": lambda m: (m["altos"] > 0) | (m["dias"] >= 2),
    "alto": lambda m: m["altos"] > 0,
    "cualquiera": lambda m: m["dias"] >= 1,
}


# ---------- datos como matrices celda × mes ----------


def indice_mes(d: date) -> int:
    return (d.year - 2012) * 12 + d.month - 1


def mes_de(i: int) -> str:
    return f"{2012 + i // 12}-{i % 12 + 1:02d}"


def cargar():
    m = pl.read_parquet(SALIDAS / "mensual-N.parquet")
    completos = pl.read_parquet(DATOS / "entrenamiento.parquet", columns=["month"])["month"].unique()
    completos = sorted(indice_mes(date(int(s[:4]), int(s[5:]), 1)) for s in completos.to_list())
    T = completos[-1] + 1
    celdas = m.select("cell_id", "region").unique().sort("cell_id")
    fila = {c: i for i, c in enumerate(celdas["cell_id"].to_list())}
    ci = np.array([fila[c] for c in m["cell_id"].to_list()])
    ti = np.array([indice_mes(d) for d in m["mes"].to_list()])
    dentro = ti < T
    mats = {}
    for col in ("dias", "focos", "altos", "frp_max"):
        a = np.zeros((celdas.height, T), np.float32)
        a[ci[dentro], ti[dentro]] = m[col].to_numpy()[dentro]
        a[:, [t for t in range(T) if t not in completos]] = (
            np.nan
        )  # mes incompleto: falta el dato, no es cero
        mats[col] = a
    sw = celdas["cell_id"].str.split_exact("_", 1).struct.unnest()
    lat = sw["field_0"].cast(pl.Float64).to_numpy()
    lon = sw["field_1"].cast(pl.Float64).to_numpy()
    return celdas, lat, lon, mats, T


def matriz_sensor(nombre: str, celdas: pl.DataFrame, T: int, desde: date, atras: int = 0):
    """Días con fuego y evento de otro sensor, alineados a las mismas celdas. `atras`: meses antes de 2012
    que se conservan (MODIS llega a 2000). Antes de `desde` el sensor no existía: falta el dato, no es
    cero."""
    m = pl.read_parquet(SALIDAS / f"mensual-{nombre}.parquet").join(celdas.with_row_index("i"), on="cell_id")
    ti = np.array([indice_mes(d) for d in m["mes"].to_list()]) + atras
    ok = (ti >= 0) & (ti < T + atras)
    ci = m["i"].to_numpy()[ok]
    D = np.zeros((celdas.height, T + atras), np.float32)
    D[ci, ti[ok]] = m["dias"].to_numpy()[ok]
    E = np.zeros_like(D)
    E[ci, ti[ok]] = ((m["altos"] > 0) | (m["dias"] >= 2)).to_numpy()[ok]
    sin_dato = np.arange(T + atras) < indice_mes(desde) + atras
    D[:, sin_dato], E[:, sin_dato] = np.nan, np.nan
    return D, E


ATRAS_MODIS = 132  # meses entre 2001-01 y 2012-01
ATRAS_CLIMA = 252  # meses entre 1991-01 y 2012-01
VARS_CLIMA = ("lluvia", "tmax", "humedad", "viento", "suelo")


class Clima:
    """Clima mensual de NASA POWER como anomalías: cuánto se aparta cada mes de lo normal para ese mes del año
    (normal = 1991-2010, anterior a todo el entrenamiento, así no se filtra información del futuro)."""

    def __init__(self, lat: np.ndarray, lon: np.ndarray, T: int):
        c = pl.read_parquet(SALIDAS / "clima.parquet")
        puntos = c.select("lat", "lon").unique().sort("lat", "lon").with_row_index("g")
        c = c.join(puntos, on=["lat", "lon"])
        ti = (
            c["mes"].str.slice(0, 4).cast(pl.Int32).to_numpy() * 12
            + c["mes"].str.slice(5).cast(pl.Int32).to_numpy()
        )
        ti = ti - 1991 * 12 - 1
        n = T + ATRAS_CLIMA
        ok = ti < n
        self.z, self.normal, self.crudo = {}, {}, {}
        for v in VARS_CLIMA:
            a = np.full((puntos.height, n), np.nan, np.float32)
            a[c["g"].to_numpy()[ok], ti[ok]] = c[v].to_numpy()[ok]
            ref = a[:, :240].reshape(puntos.height, 20, 12)  # 1991-2010
            media, desvio = np.nanmean(ref, axis=1), np.nanstd(ref, axis=1)
            mes = np.arange(n) % 12
            self.z[v] = (a - media[:, mes]) / np.maximum(desvio[:, mes], 1e-3 + 0.05 * np.abs(media[:, mes]))
            self.normal[v], self.crudo[v] = media, a
        # Cada celda toma el punto de la grilla de clima más cercano (0,5° de latitud × 0,625° de longitud).
        glat, glon = puntos["lat"].to_numpy(), puntos["lon"].to_numpy()
        clave = {(round(a, 3), round(b, 3)): i for i, (a, b) in enumerate(zip(glat, glon, strict=True))}
        la = np.clip(np.round((lat + 0.05) / 0.5) * 0.5, glat.min(), glat.max())
        lo = np.clip(np.round((lon + 0.05) / 0.625) * 0.625, glon.min(), glon.max())
        self.g = np.array([clave[(round(a, 3), round(b, 3))] for a, b in zip(la, lo, strict=True)])

    def media(self, v: str, t: int, meses: int) -> np.ndarray:
        """Anomalía media de los últimos `meses` meses hasta t inclusive, por celda."""
        i = t + ATRAS_CLIMA
        return np.nanmean(self.z[v][:, i - meses + 1 : i + 1], axis=1)[self.g]


def vecinos(M: np.ndarray, gi: np.ndarray, gj: np.ndarray, radio: int) -> np.ndarray:
    """Promedio de M en las celdas vecinas (cuadrado de lado 2·radio+1, sin el centro).
    Fuera de la grilla, 0."""
    n = (2 * radio + 1) ** 2 - 1
    g = np.zeros((gi.max() + 1 + 2 * radio, gj.max() + 1 + 2 * radio, M.shape[1]), np.float32)
    g[gi + radio, gj + radio] = np.nan_to_num(M)
    suma = np.zeros_like(g)
    for di in range(-radio, radio + 1):
        for dj in range(-radio, radio + 1):
            if di or dj:
                suma += np.roll(g, (di, dj), axis=(0, 1))
    return suma[gi + radio, gj + radio] / n


def climatologia(E: np.ndarray, extra: int) -> np.ndarray:
    """Para cada mes τ (hasta `extra` meses después del último): promedio de E en τ-12, τ-24, …"""
    C, T = E.shape
    clim = np.full((C, T + extra), np.nan, np.float32)
    for k in range(12):
        cols = np.arange(k, T, 12)
        x = E[:, cols]
        suma = np.cumsum(np.nan_to_num(x), axis=1)
        cuenta = np.cumsum(~np.isnan(x), axis=1)
        destino = cols + 12
        ok = destino < T + extra
        with np.errstate(invalid="ignore", divide="ignore"):
            clim[:, destino[ok]] = (suma / cuenta)[:, ok]
    return clim


class Variables:
    """Todo lo que el modelo mira, precalculado como matrices celda × mes."""

    NOMBRES = [
        "ev_0", "ev_1", "ev_2", "dias_0", "dias_1", "dias_2", "focos_0", "frp_0",
        "ev_12m", "dias_12m", "ev_hist", "meses_sin_ev",
        "ev_hace1a", "dias_hace1a", "ev_hace2a",
        "clim_ev", "clim_dias", "clim_ev_0",
        "vec1_ev_0", "vec2_ev_0", "vec1_ev_12m", "vec1_clim_ev",
        "reg_ev_0", "reg_clim_0", "reg_ev_3m", "reg_clim_3m", "reg_clim_obj",
        "lat", "lon", "mes_obj",
    ]  # fmt: skip

    SATELITES = [
        "n20_dias_0", "n20_ev_0", "n20_dias_12m", "n21_dias_0",
        "modis_dias_0", "modis_dias_1", "modis_dias_12m", "modis_hist", "modis_clim", "vec1_modis_clim",
        "modis_hace1a",
    ]  # fmt: skip
    CLIMA = [
        "lluvia_a1", "lluvia_a3", "lluvia_a6", "lluvia_a12", "tmax_a1", "tmax_a3", "humedad_a1", "humedad_a3",
        "suelo_a1", "suelo_a3", "viento_a1", "suelo_0", "tmax_0",
        "lluvia_normal_obj", "tmax_normal_obj", "humedad_normal_obj", "suelo_normal_obj",
    ]  # fmt: skip
    # Solo para el experimento "si supiéramos el clima del mes que viene":
    # no se puede usar al emitir de verdad.
    ORACULO = ["lluvia_a_obj", "tmax_a_obj", "humedad_a_obj", "suelo_a_obj", "viento_a_obj"]

    def __init__(self, celdas, lat, lon, mats, T, evento: str, extra: int, grupos: tuple[str, ...] = ()):
        self.T, self.lat, self.lon = T, lat.astype(np.float32), lon.astype(np.float32)
        self.grupos = grupos
        self.NOMBRES = list(Variables.NOMBRES)
        for g in grupos:
            self.NOMBRES += {"sat": self.SATELITES, "clima": self.CLIMA, "oraculo": self.ORACULO}[g]
        D = mats["dias"]
        E = EVENTOS[evento](mats).astype(np.float32)
        E[np.isnan(D)] = np.nan
        self.E, self.D = E, D
        self.F, self.R = np.log1p(mats["focos"]), np.log1p(mats["frp_max"])
        gi = np.round((lat - lat.min()) / 0.1).astype(int)
        gj = np.round((lon - lon.min()) / 0.1).astype(int)

        def ventana(M, n):  # suma de los últimos n meses, hasta el mes inclusive
            c = np.cumsum(np.nan_to_num(M), axis=1)
            c[:, n:] -= c[:, :-n].copy()
            return c

        self.E12, self.D12 = ventana(E, 12), ventana(D, 12)
        with np.errstate(invalid="ignore"):
            self.Ehist = np.cumsum(np.nan_to_num(E), axis=1) / np.maximum(np.cumsum(~np.isnan(E), axis=1), 1)
        sin = np.zeros_like(E)
        ultimo = np.full(E.shape[0], 60, np.float32)
        for t in range(T):
            ultimo = np.where(E[:, t] == 1, 0, np.minimum(ultimo + 1, 60))
            sin[:, t] = ultimo
        self.sin = sin
        self.clim, self.climD = climatologia(E, extra), climatologia(D, extra)
        self.v1, self.v2 = vecinos(E, gi, gj, 1), vecinos(E, gi, gj, 2)
        self.v1_12, self.v1clim = vecinos(self.E12, gi, gj, 1), vecinos(self.clim, gi, gj, 1)
        if "sat" in grupos:
            self.n20D, self.n20E = matriz_sensor("N20", celdas, T, date(2018, 5, 1))
            self.n20D12 = ventana(self.n20D, 12)
            self.n20D12[np.isnan(self.n20D)] = np.nan
            self.n21D, _ = matriz_sensor("N21", celdas, T, date(2023, 4, 1))
            mD, _ = matriz_sensor("MODIS", celdas, T, date(2001, 1, 1), ATRAS_MODIS)
            self.mD = mD[:, ATRAS_MODIS:]
            self.mD12 = ventana(mD, 12)[:, ATRAS_MODIS:]
            with np.errstate(invalid="ignore"):
                hist = np.cumsum(np.nan_to_num(mD), axis=1) / np.maximum(np.cumsum(~np.isnan(mD), axis=1), 1)
            self.mHist = hist[:, ATRAS_MODIS:]
            self.mClim = climatologia(mD, extra)[:, ATRAS_MODIS:]  # desde 2001: más años que VIIRS
            self.mClimV = vecinos(self.mClim, gi, gj, 1)
        if "clima" in grupos or "oraculo" in grupos:
            self.clima = Clima(lat, lon, T)
        # Señales de la provincia entera: qué parte de sus celdas tuvo el evento, y lo habitual para ese mes.
        codigos = celdas["region"].to_list()
        self.regiones = sorted(set(codigos))
        self.reg = np.array([self.regiones.index(r) for r in codigos])
        with np.errstate(invalid="ignore"):
            self.regE = np.stack([np.nanmean(E[self.reg == r], axis=0) for r in range(len(self.regiones))])
            self.regClim = np.stack(
                [np.nanmean(self.clim[self.reg == r], axis=0) for r in range(len(self.regiones))]
            )

    def bloque(self, t: int, h: int) -> np.ndarray:
        """Variables de todas las celdas al emitir en el mes t para el mes t+h."""
        tau = t + h

        def en(M, i):
            return M[:, i] if 0 <= i < M.shape[1] else np.full(M.shape[0], np.nan, np.float32)

        def reg(M, i):
            return M[self.reg, i] if 0 <= i < M.shape[1] else np.full(len(self.reg), np.nan, np.float32)

        with np.errstate(invalid="ignore"):
            reg3 = np.nanmean([reg(self.regE, t - k) for k in range(3)], axis=0)
            regc3 = np.nanmean([reg(self.regClim, t - k) for k in range(3)], axis=0)
        cols = [
            en(self.E, t), en(self.E, t - 1), en(self.E, t - 2),
            en(self.D, t), en(self.D, t - 1), en(self.D, t - 2), en(self.F, t), en(self.R, t),
            en(self.E12, t), en(self.D12, t), en(self.Ehist, t), en(self.sin, t),
            en(self.E, tau - 12), en(self.D, tau - 12), en(self.E, tau - 24),
            en(self.clim, tau), en(self.climD, tau), en(self.clim, t),
            en(self.v1, t), en(self.v2, t), en(self.v1_12, t), en(self.v1clim, tau),
            reg(self.regE, t), reg(self.regClim, t), reg3, regc3, reg(self.regClim, tau),
            self.lat, self.lon, np.full(len(self.lat), tau % 12 + 1, np.float32),
        ]  # fmt: skip
        if "sat" in self.grupos:
            cols += [
                en(self.n20D, t), en(self.n20E, t), en(self.n20D12, t), en(self.n21D, t),
                en(self.mD, t), en(self.mD, t - 1), en(self.mD12, t), en(self.mHist, t),
                en(self.mClim, tau), en(self.mClimV, tau), en(self.mD, tau - 12),
            ]  # fmt: skip
        if "clima" in self.grupos:
            k, m = self.clima, tau % 12
            with np.errstate(invalid="ignore"):
                cols += [
                    k.media("lluvia", t, 1), k.media("lluvia", t, 3), k.media("lluvia", t, 6),
                    k.media("lluvia", t, 12), k.media("tmax", t, 1), k.media("tmax", t, 3),
                    k.media("humedad", t, 1), k.media("humedad", t, 3), k.media("suelo", t, 1),
                    k.media("suelo", t, 3), k.media("viento", t, 1),
                    k.crudo["suelo"][k.g, t + ATRAS_CLIMA], k.crudo["tmax"][k.g, t + ATRAS_CLIMA],
                    k.normal["lluvia"][k.g, m], k.normal["tmax"][k.g, m], k.normal["humedad"][k.g, m],
                    k.normal["suelo"][k.g, m],
                ]  # fmt: skip
        if "oraculo" in self.grupos:
            k = self.clima
            cols += [k.media(v, tau, 1) for v in ("lluvia", "tmax", "humedad", "suelo", "viento")]
        return np.column_stack(cols).astype(np.float32)


# ---------- métricas ----------


def auc(y, p, w=None) -> float:
    w = np.ones_like(p) if w is None else w
    orden = np.argsort(p, kind="stable")
    y, p, w = y[orden], p[orden], w[orden]
    _, inicio, inv = np.unique(p, return_index=True, return_inverse=True)
    neg_acum = np.cumsum(w * (1 - y))
    neg_antes = np.concatenate([[0], neg_acum])[inicio][inv]  # negativos con puntaje menor
    neg_igual = np.add.reduceat(w * (1 - y), inicio)[inv]
    pos, neg = (w * y).sum(), (w * (1 - y)).sum()
    return float((w * y * (neg_antes + neg_igual / 2)).sum() / (pos * neg)) if pos and neg else float("nan")


def precision_media(y, p) -> float:
    orden = np.argsort(-p, kind="stable")
    y = y[orden]
    aciertos = np.cumsum(y)
    return float((aciertos / np.arange(1, len(y) + 1) * y).sum() / max(y.sum(), 1))


def brier(y, p, w=None) -> float:
    return float(np.average((p - y) ** 2, weights=w))


def perdida_log(y, p) -> float:
    """El equivalente del desvío de Poisson para un sí/no: castiga fuerte decir ~0 donde hubo evento."""
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def top10(y, p, mes) -> tuple[float, float]:
    """Cada mes se marca el 10 % de celdas con más riesgo. Da (aciertos: parte de las marcadas que tuvo
    evento; captura: parte de todos los eventos que cayó en las marcadas)."""
    marcadas = np.zeros(len(y), bool)
    for m in np.unique(mes):
        i = np.flatnonzero(mes == m)
        marcadas[i[np.argsort(-p[i], kind="stable")[: max(len(i) // 10, 1)]]] = True
    return float(y[marcadas].mean()), float(y[marcadas].sum() / max(y.sum(), 1))


def deteccion(y, p, corte: float = 0.5) -> tuple[float, float]:
    """Con «se predice evento si p ≥ corte»: (recall: parte de los eventos avisados;
    precisión de los avisos)."""
    aviso = p >= corte
    return float(y[aviso].sum() / max(y.sum(), 1)), float(y[aviso].mean()) if aviso.any() else float("nan")


def metricas(y, p, clim, mes) -> dict:
    b, bc = brier(y, p), brier(y, clim)
    extra = {}
    for nombre, q in (("", p), ("_clim", clim)):
        aciertos, captura = top10(y, q, mes)
        extra |= {f"top10_aciertos{nombre}": round(aciertos, 4), f"top10_captura{nombre}": round(captura, 4)}
        for corte in (0.5, 0.2):
            r, pr = deteccion(y, q, corte)
            c = int(corte * 100)
            extra |= {f"recall_{c}{nombre}": round(r, 4), f"precision_{c}{nombre}": round(pr, 4)}
        extra[f"perdida_log{nombre}"] = round(perdida_log(y, q), 5)
    extra["mejora_perdida_log"] = round(1 - extra["perdida_log"] / extra["perdida_log_clim"], 4)
    return extra | {
        "n": int(len(y)),
        "tasa_evento": round(float(y.mean()), 4),
        "auc": round(auc(y, p), 4),
        "auc_clim": round(auc(y, clim), 4),
        "prec_media": round(precision_media(y, p), 4),
        "prec_media_clim": round(precision_media(y, clim), 4),
        "brier": round(b, 5),
        "brier_clim": round(bc, 5),
        "mejora_brier": round(1 - b / bc, 4),  # la compuerta: > 0 es mejor que la climatología
    }


def fiabilidad(y, p) -> list[dict]:
    """¿Cuando el modelo dice 30 %, pasa el 30 % de las veces?"""
    cortes = [0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001]
    filas = []
    for a, b in zip(cortes, cortes[1:], strict=False):
        s = (p >= a) & (p < b)
        if s.sum():
            filas.append(
                {
                    "rango": f"{a:.0%}-{min(b, 1):.0%}",
                    "casos": int(s.sum()),
                    "predicho": round(float(p[s].mean()), 4),
                    "observado": round(float(y[s].mean()), 4),
                }
            )
    return filas


def calibrador(p, y, w, cajas: int = 100) -> dict:
    """Regresión isotónica sobre cajas de igual peso: tabla (predicho -> observado) que no decrece."""
    orden = np.argsort(p, kind="stable")
    p, y, w = p[orden], y[orden], w[orden]
    caja = np.minimum((np.cumsum(w) / w.sum() * cajas).astype(int), cajas - 1)
    xs, ys, ws = [], [], []
    for c in np.unique(caja):
        s = caja == c
        x, v, peso = np.average(p[s], weights=w[s]), np.average(y[s], weights=w[s]), w[s].sum()
        xs.append(x), ys.append(v), ws.append(peso)
        while len(ys) > 1 and ys[-2] > ys[-1]:  # junta cajas vecinas que rompen el orden
            peso = ws[-2] + ws[-1]
            ys[-2:] = [(ys[-2] * ws[-2] + ys[-1] * ws[-1]) / peso]
            xs[-2:] = [(xs[-2] * ws[-2] + xs[-1] * ws[-1]) / peso]
            ws[-2:] = [peso]
    return {"predicho": [0.0, *map(float, xs), 1.0], "observado": [0.0, *map(float, ys), float(ys[-1])]}


def aplicar(cal: dict, p: np.ndarray) -> np.ndarray:
    return np.interp(p, cal["predicho"], cal["observado"])


# ---------- agregación a un área ----------


def prob_area(p: np.ndarray, grupo: np.ndarray, n_grupos: int, kappa: float) -> np.ndarray:
    """P(al menos un evento en el área) = 1 - Π(1 - p_i)^κ. κ = 1 sería celdas independientes; como el fuego
    de celdas vecinas va junto, κ < 1 (se ajusta con los meses de validación)."""
    s = np.zeros(n_grupos)
    np.add.at(s, grupo, np.log1p(-np.clip(p, 0, 1 - 1e-6)))
    return 1 - np.exp(kappa * s)


def ajustar_kappa(p, y, grupo, n_grupos) -> float:
    obs = np.zeros(n_grupos)
    np.maximum.at(obs, grupo, y)
    mejor, mejor_err = 1.0, np.inf
    for k in np.arange(0.2, 1.01, 0.02):
        err = brier(obs, prob_area(p, grupo, n_grupos, k))
        if err < mejor_err:
            mejor, mejor_err = float(k), err
    return round(mejor, 2)


def grupos_bloque(lat, lon, lado, meses) -> tuple[np.ndarray, int]:
    """Agrupa filas (celdas repetidas por mes) en cuadrados de `lado` grados, separados por mes."""
    bi = np.floor((lat + 90) / lado + 1e-6).astype(np.int64)
    bj = np.floor((lon + 180) / lado + 1e-6).astype(np.int64)
    _, g = np.unique(np.stack([meses, bi, bj]), axis=1, return_inverse=True)
    g = g.ravel()
    return g, int(g.max()) + 1


# ---------- entrenamiento ----------


def armar(V: Variables, h: int, emisiones, rng=None):
    """Filas de las emisiones dadas. Con `rng`, submuestrea negativos (peso 1/FRAC_NEG) para el
    entrenamiento."""
    X, y, w, tau = [], [], [], []
    for t in emisiones:
        yt = V.E[:, t + h]
        if np.isnan(yt).all():
            continue  # el mes objetivo está incompleto
        x = V.bloque(t, h)
        pesos = np.ones(len(yt), np.float32)
        if rng is not None:
            queda = (yt == 1) | (rng.random(len(yt)) < FRAC_NEG)
            pesos[yt == 0] = 1 / FRAC_NEG
            x, yt, pesos = x[queda], yt[queda], pesos[queda]
        X.append(x), y.append(yt), w.append(pesos), tau.append(np.full(len(yt), t + h))
    return np.concatenate(X), np.concatenate(y), np.concatenate(w), np.concatenate(tau)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--evento", choices=list(EVENTOS), default="alto_o_persistente")
    ap.add_argument("--solo-metricas", action="store_true")
    ap.add_argument("--variables", default="sat", help="grupos extra: sat, clima, oraculo; 'base' = ninguno")
    ap.add_argument("--horizontes", default="1,2,3,4,5,6")
    ap.add_argument("--sin-backtest", action="store_true", help="sin la prueba año por año ni calibración")
    ap.add_argument(
        "--rb1", action="store_true", help="medir como R-B1: 3.000 celdas, emisiones 2025-01 a 2026-09"
    )
    ap.add_argument("--nombre", default="", help="sufijo de metricas-<nombre>.json")
    args = ap.parse_args()
    celdas, lat, lon, mats, T = cargar()
    grupos = () if args.variables == "base" else tuple(args.variables.split(","))
    horizontes = tuple(int(h) for h in args.horizontes.split(","))
    V = Variables(celdas, lat, lon, mats, T, args.evento, extra=max(HORIZONTES), grupos=grupos)
    print("variables:", len(V.NOMBRES), grupos)
    C = celdas.height
    ini_prueba, ini_valid = T - MESES_PRUEBA, T - MESES_PRUEBA - MESES_VALID
    print(f"{C} celdas, meses {mes_de(0)} a {mes_de(T - 1)}; evento '{args.evento}'")
    print(
        f"validación: objetivos {mes_de(ini_valid)} a {mes_de(ini_prueba - 1)}; "
        f"prueba: {mes_de(ini_prueba)} a {mes_de(T - 1)}"
    )

    resumen = {
        "evento": args.evento,
        "variables": list(grupos),
        "prueba": [mes_de(ini_prueba), mes_de(T - 1)],
    }
    resumen |= {"horizontes": {}, "area": {}, "por_anio": {}}
    pred_celdas, importancias, pruebas = [], {}, {}
    if args.rb1:
        # La misma muestra que services/prediccion/__main__.py: celdas de `entrenamiento`, ordenadas,
        # semilla 0.
        todas = (
            pl.read_parquet(DATOS / "entrenamiento.parquet", columns=["cell_id"])["cell_id"].unique().sort()
        )
        muestra = set(todas.sample(3000, seed=0).to_list())
        en_muestra = np.array([c in muestra for c in celdas["cell_id"].to_list()])
        resumen["rb1"] = {"celdas_pedidas": 3000, "celdas_en_este_modelo": int(en_muestra.sum())}
        print("R-B1:", resumen["rb1"])
    for h in horizontes:
        rng = np.random.default_rng(h)
        # Un objetivo τ = t + h cae en entrenamiento, validación o prueba según su fecha.
        Xe, ye, we, te = armar(V, h, range(13, T - h), rng)  # todo lo conocido, submuestreado
        Xv, yv, _, tv = armar(V, h, range(ini_valid - h, ini_prueba - h))
        Xp, yp, _, tp = armar(V, h, range(ini_prueba - h, T - h))
        antes = te < ini_valid
        dtrain = lgb.Dataset(Xe[antes], ye[antes], weight=we[antes], feature_name=V.NOMBRES)
        modelo = lgb.train(
            PARAMS,
            dtrain,
            num_boost_round=1500,
            valid_sets=[lgb.Dataset(Xv, yv, reference=dtrain)],
            callbacks=[lgb.early_stopping(50, verbose=False)],
        )
        rondas = modelo.best_iteration
        climp = np.nan_to_num(Xp[:, V.NOMBRES.index("clim_ev")])
        climv = np.nan_to_num(Xv[:, V.NOMBRES.index("clim_ev")])

        # Año por año, entrenando solo con lo anterior: mide la estabilidad y da predicciones fuera de muestra
        # de varios años, con las que se corrige la calibración (que el 30 % sea 30 %).
        por_anio, fuera = {}, []
        clime = np.nan_to_num(Xe[:, V.NOMBRES.index("clim_ev")])
        for anio in [] if args.sin_backtest else range(2019, 2027):
            a, b = indice_mes(date(anio, 1, 1)), indice_mes(date(anio, 12, 1))
            tr, pr = te < a, (te >= a) & (te <= b)
            mod = lgb.train(PARAMS, lgb.Dataset(Xe[tr], ye[tr], weight=we[tr]), num_boost_round=rondas)
            p = mod.predict(Xe[pr])
            por_anio[anio] = round(1 - brier(ye[pr], p, we[pr]) / brier(ye[pr], clime[pr], we[pr]), 4)
            fuera.append((te[pr], p, ye[pr], we[pr]))
        resumen["por_anio"][h] = por_anio
        print(f"h={h}: mejora por año:", por_anio)
        identidad = {"predicho": [0.0, 1.0], "observado": [0.0, 1.0]}
        cal = identidad
        if fuera:
            tf, pf, yf, wf = (np.concatenate(x) for x in zip(*fuera, strict=True))
            previo = tf < ini_prueba  # para medir en la prueba, la calibración no puede haber visto la prueba
            cal = calibrador(pf[previo], yf[previo], wf[previo])
        pp_cruda = modelo.predict(Xp, num_iteration=rondas)
        pp, pv = aplicar(cal, pp_cruda), aplicar(cal, modelo.predict(Xv, num_iteration=rondas))
        m = metricas(yp, pp, climp, tp)
        m["rondas"] = rondas
        m["brier_sin_calibrar"] = round(brier(yp, pp_cruda), 5)
        m["mejora_brier_cruda"] = round(1 - brier(yp, pp_cruda) / brier(yp, climp), 4)
        m["auc_cruda"] = round(auc(yp, pp_cruda), 4)
        m["prec_media_cruda"] = round(precision_media(yp, pp_cruda), 4)
        m["fiabilidad"] = fiabilidad(yp, pp)
        resumen["horizontes"][h] = m
        print("   " + ", ".join(f"{k}={v}" for k, v in m.items() if k != "fiabilidad"))

        if args.rb1:
            emision = tp - h
            sub = en_muestra[np.tile(np.arange(C), len(yp) // C)]
            sub &= (emision >= indice_mes(date(2025, 1, 1))) & (emision <= indice_mes(date(2026, 9, 1)))
            fila = {"filas": int(sub.sum()), "tasa": round(float(yp[sub].mean()), 4)}
            for nombre, q in (("modelo", pp), ("climatologia", climp)):
                r, pr = deteccion(yp[sub], q[sub], 0.5)
                n = max(1, round(0.1 * sub.sum()))  # top 10 % de celdas-mes, global, como medicion.py
                arriba = yp[sub][np.argsort(-q[sub], kind="stable")[:n]].sum()
                fila[nombre] = {
                    "recall": round(r, 4),
                    "precision": round(pr, 4),
                    "precision_top10": round(float(arriba / n), 4),
                    "captura_top10": round(float(arriba / yp[sub].sum()), 4),
                    "perdida_log": round(perdida_log(yp[sub], q[sub]), 5),
                }
            resumen["rb1"][h] = fila
            print(f"   R-B1 h={h}:", fila)

        # Áreas: cuadrados de varios tamaños y provincias. κ se ajusta en validación y se mide en la prueba.
        cv, cp = np.tile(np.arange(C), len(yv) // C), np.tile(np.arange(C), len(yp) // C)
        area = {}
        tamanos = [(f"{lado}°", lado) for lado in BLOQUES] + [("provincia", None)]
        for nombre, lado in tamanos:
            if lado is None:
                gv = np.unique(np.stack([tv, V.reg[cv]]), axis=1, return_inverse=True)[1].ravel()
                gp = np.unique(np.stack([tp, V.reg[cp]]), axis=1, return_inverse=True)[1].ravel()
            else:
                gv, _ = grupos_bloque(lat[cv], lon[cv], lado, tv)
                gp, _ = grupos_bloque(lat[cp], lon[cp], lado, tp)
            nv, npr = int(gv.max()) + 1, int(gp.max()) + 1
            kappa = ajustar_kappa(pv, yv, gv, nv)
            obs, cuenta, esperado, esperado_clim = np.zeros(npr), np.zeros(npr), np.zeros(npr), np.zeros(npr)
            np.maximum.at(obs, gp, yp)
            np.add.at(cuenta, gp, yp)
            np.add.at(esperado, gp, pp)
            np.add.at(esperado_clim, gp, climp)
            pa, pa1 = prob_area(pp, gp, npr, kappa), prob_area(pp, gp, npr, 1.0)
            # La climatología se agrega con su propio κ, ajustado igual: si no, la comparación es injusta.
            kappa_clim = ajustar_kappa(climv, yv, gv, nv)
            pac = prob_area(climp, gp, npr, kappa_clim)
            area[nombre] = {
                "areas": npr,
                "kappa": kappa,
                "kappa_clim": kappa_clim,
                "tasa_evento": round(float(obs.mean()), 4),
                "auc": round(auc(obs, pa), 4),
                "brier": round(brier(obs, pa), 5),
                "brier_independiente": round(brier(obs, pa1), 5),
                "brier_clim": round(brier(obs, pac), 5),
                "mejora_brier": round(1 - brier(obs, pa) / brier(obs, pac), 4),
                "mae_celdas": round(float(np.abs(cuenta - esperado).mean()), 3),
                "mae_celdas_clim": round(float(np.abs(cuenta - esperado_clim).mean()), 3),
                "fiabilidad": fiabilidad(obs, pa),
            }
            print(
                f"   área {nombre}: "
                + ", ".join(f"{k}={v}" for k, v in area[nombre].items() if k != "fiabilidad")
            )
        resumen["area"][h] = area
        if h == 1:
            pruebas = {"p": pp, "y": yp, "clim": climp, "tau": tp, "celda": cp}

        if args.solo_metricas:
            continue
        # Modelo final: aprende de todo lo conocido y emite desde el último mes con datos.
        final = lgb.train(
            PARAMS, lgb.Dataset(Xe, ye, weight=we, feature_name=V.NOMBRES), num_boost_round=rondas
        )
        final.save_model(SALIDAS / f"modelo-h{h}.txt")
        ganancia = final.feature_importance("gain")
        importancias[h] = dict(zip(V.NOMBRES, np.round(ganancia / ganancia.sum(), 4).tolist(), strict=True))
        cal_final = calibrador(pf, yf, wf) if fuera else identidad
        (SALIDAS / f"calibracion-h{h}.json").write_text(json.dumps(cal_final))
        xf = V.bloque(T - 1, h)
        pred_celdas.append(
            pl.DataFrame(
                {
                    "cell_id": celdas["cell_id"],
                    "region": celdas["region"],
                    "lat": np.round(lat + 0.05, 2),
                    "lon": np.round(lon + 0.05, 2),
                    "mes": mes_de(T - 1 + h),
                    "horizonte": h,
                    "prob": np.round(aplicar(cal_final, final.predict(xf)), 4),
                    "prob_habitual": np.round(np.nan_to_num(xf[:, V.NOMBRES.index("clim_ev")]), 4),
                }
            )
        )

    sufijo = (
        f"-{args.nombre}"
        if args.nombre
        else ("" if args.evento == "alto_o_persistente" else f"-{args.evento}")
    )
    (SALIDAS / f"metricas{sufijo}.json").write_text(json.dumps(resumen, indent=1, ensure_ascii=False))
    if args.solo_metricas:
        return
    (SALIDAS / "importancias.json").write_text(json.dumps(importancias, indent=1))
    pred = pl.concat(pred_celdas)
    pred.write_csv(SALIDAS / "prediccion_celdas.csv")
    # Historia observada por provincia y mes del año, para poner el pronóstico en contexto.
    hist = []
    for r, codigo in enumerate(V.regiones):
        en_region = V.reg == r
        cuenta = np.nansum(V.E[en_region], axis=0)
        cuenta[np.isnan(V.E[0])] = np.nan
        for k in range(12):
            x = cuenta[k::12]
            x = x[~np.isnan(x)]
            hist.append(
                {
                    "region": codigo,
                    "mes_del_anio": k + 1,
                    "anios": len(x),
                    "anios_con_evento": int((x > 0).sum()),
                    "celdas_mediana": float(np.median(x)),
                    "celdas_max": float(x.max()),
                }
            )
    pl.DataFrame(hist).write_csv(SALIDAS / "historia_provincias.csv")
    np.savez_compressed(SALIDAS / "prueba-h1.npz", **pruebas)
    print("listo:", pred.height, "filas en prediccion_celdas.csv")


if __name__ == "__main__":
    main()
