"""Pruebas mínimas de F3-B1 (#42). Datos sintéticos: ninguna prueba llama a FIRMS."""

from datetime import UTC, datetime, timedelta

import polars as pl
from pipeline.esquema import ESQUEMAS
from pipeline.firms import _celda
from pipeline.fuentes_fijas import main, mascara


def _celda_de(lat, lon):
    df = pl.DataFrame({"latitude": [lat], "longitude": [lon]})
    return df.select(_celda("latitude") + "_" + _celda("longitude")).item()


# Antorcha de gas en Cerro Dragón, al oeste de Comodoro Rivadavia (persistente en VIIRS 2012-2021).
ANTORCHA = (-45.7612, -68.2868)


def focos(puntos, sat="N", tipo=0):
    filas = [
        {
            "satellite": sat,
            "latitude": lat,
            "longitude": lon,
            "cell_id": _celda_de(lat, lon),
            "type": tipo,
            "acq_datetime": cuando,
        }
        for lat, lon, cuando in puntos
    ]
    return pl.DataFrame(
        filas,
        schema={
            "satellite": pl.String,
            "latitude": pl.Float64,
            "longitude": pl.Float64,
            "cell_id": pl.String,
            "type": pl.Int8,
            "acq_datetime": pl.Datetime("us", "UTC"),
        },
    )


def cada_semana(lat, lon, anios=6):
    """Un foco por semana en el mismo punto durante varios años: casi todas las pasadas despejadas."""
    inicio = datetime(2015, 1, 1, 5, tzinfo=UTC)
    return [(lat, lon, inicio + timedelta(days=7 * i)) for i in range(52 * anios)]


def test_celda_con_focos_casi_todos_los_dias_queda_marcada_y_un_foco_aislado_no():
    aislado = [(-30.05, -60.05, datetime(2019, 8, 10, 4, tzinfo=UTC))]
    m = mascara(focos(cada_semana(-38.75, -67.64) + aislado))
    assert m["cell_id"].to_list() == [_celda_de(-38.75, -67.64)]


def test_quema_agricola_que_se_repite_cada_anio_no_es_fuente_fija():
    # La misma parcela arde unos días de agosto todos los años: estacional, no fija.
    quema = [
        (-27.5, -59.5, datetime(anio, 8, dia, 4, tzinfo=UTC))
        for anio in range(2012, 2022)
        for dia in (1, 5, 9)
    ]
    assert mascara(focos(quema)).is_empty()


def test_foco_sobre_antorcha_conocida_de_comodoro_queda_marcado():
    m = mascara(focos(cada_semana(*ANTORCHA)))
    nuevo = focos(
        [(ANTORCHA[0] + 0.001, ANTORCHA[1] - 0.001, datetime(2026, 11, 14, 5, tzinfo=UTC))], sat="N21"
    )
    assert nuevo["cell_id"].is_in(m["cell_id"]).all()


def test_celda_que_firms_ya_marca_como_estatica_entra():
    estatica = [(-34.15, -58.98, datetime(2020, 3, d, 4, tzinfo=UTC)) for d in (1, 2)]
    assert mascara(focos(estatica, tipo=2))["cell_id"].to_list() == [_celda_de(-34.15, -58.98)]


def test_modis_no_cuenta_para_la_mascara():
    assert mascara(focos(cada_semana(*ANTORCHA), sat="Aqua")).is_empty()


def test_mascara_publicada_cumple_su_esquema(tmp_path):
    entrada = tmp_path / "focos"
    entrada.mkdir()
    focos(cada_semana(*ANTORCHA)).write_parquet(entrada / "N-2015.parquet")
    salida = tmp_path / "pub"
    assert main(["--focos", str(entrada), "--out", str(salida)]) == 0
    publicada = pl.read_csv(salida / "fuentes_fijas.csv", schema=ESQUEMAS["fuentes_fijas"])
    assert publicada.columns == list(ESQUEMAS["fuentes_fijas"])
    assert publicada["cell_id"].to_list() == [_celda_de(*ANTORCHA)]
