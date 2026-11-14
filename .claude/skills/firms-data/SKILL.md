---
name: firms-data
description: Fuentes de datos de Charmy y cómo usarlas bien: NASA FIRMS (focos de MODIS y VIIRS, histórico y en vivo), Meteomatics (tiempo y riesgo de incendio) y Copernicus Data Space (imagen Sentinel-2). Campos, códigos, límites, filtros de armonización y condiciones de uso. Usar siempre que se lean, descarguen, filtren o muestren focos de calor, se llame a una de estas APIs o se toque services/pipeline, services/contexto, services/worker o data/muestras.
---

# Datos de Charmy

Vale lo que dicen `PLAN.md` (§1.1 y decisiones D-02 a D-04, D-13, D-18 a D-20) y el contrato
`packages/contracts/datos/esquema.md`. Si esta skill no coincide con ellos, valen ellos y se avisa en el tablero.

## Reglas que no se discuten

- FIRMS, Meteomatics y Copernicus se consultan **solo desde el servidor**, con caché. El navegador nunca los llama
  ni ve sus credenciales.
- Las claves van en `.env` (`FIRMS_MAP_KEY`, `METEOMATICS_USER`, `METEOMATICS_PASSWORD`, `CDSE_CLIENT_ID`,
  `CDSE_CLIENT_SECRET`), nunca en el código, los registros, los issues ni el tablero. Tampoco en una URL que se
  imprima o se registre: la clave de FIRMS va dentro de la ruta, así que hay que enmascararla en los registros.
- Si una fuente falla o agota la cuota, esa parte se muestra como no disponible y el resto sigue (RNF-14).
- Un número de ejemplo nunca se presenta como resultado: las muestras provisorias llevan `provisional = true`.
- De un sitio sin API ni licencia visible (por ejemplo currentwildfires.com) no se leen datos de forma automática:
  solo se lo cita y se lo enlaza (D-20).

## NASA FIRMS (focos de calor)

### Qué fuente para qué

| Uso | Fuente | Disponible |
|---|---|---|
| Histórico MODIS | `MODIS_SP` (Terra y Aqua, colección 6.1) | 2000-11 a 2026-08 |
| Histórico VIIRS S-NPP | `VIIRS_SNPP_SP` | 2012-01 a 2026-07. **S-NPP no publica datos nuevos desde el 2/11/2026** |
| Histórico VIIRS NOAA-20 | `VIIRS_NOAA20_SP` | 2018-04 a 2026-07 |
| Histórico VIIRS NOAA-21 | `VIIRS_NOAA21_SP` | 2023-03 a 2026-07 |
| Lo posterior al SP y lo vivo | `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT` (y `MODIS_NRT` para completar la serie MODIS) | últimos meses |

Los **focos en vivo** salen solo de NOAA-20 y NOAA-21. Disponibilidad verificada el 14/11/2026; para revisarla:
`https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/<MAP_KEY>/ALL`.

### Cómo se piden

- **API de área** (worker y pipeline):
  `https://firms.modaps.eosdis.nasa.gov/api/area/csv/<MAP_KEY>/<FUENTE>/<oeste,sur,este,norte>/<días 1-5>[/<AAAA-MM-DD>]`.
  Límite: **5.000 transacciones cada 10 minutos** por clave. Solo el worker consulta lo vivo, cada 30 minutos (D-13).
- **Archivo histórico**: se pide en el sitio de FIRMS (Download), llega por correo como CSV. No se guarda en el repo.
- **CSV públicos de 24 h y 7 días**, sin clave, por continente:
  `https://firms.modaps.eosdis.nasa.gov/data/active_fire/<noaa-20-viirs-c2|noaa-21-viirs-c2|modis-c6.1>/csv/<J1_VIIRS_C2|J2_VIIRS_C2|MODIS_C6_1>_South_America_<24h|7d>.csv`.
  Sirven para muestras y pruebas.

### Campos del CSV

| Campo | MODIS | VIIRS |
|---|---|---|
| Brillo principal / secundario (K) | `brightness` / `bright_t31` | `bright_ti4` / `bright_ti5` |
| `confidence` | entero 0–100 | `l`, `n`, `h` en SP; `low`, `nominal`, `high` en NRT |
| `satellite` | `Terra`, `Aqua` (SP) o `T`, `A` (NRT) | `N` (S-NPP), `N20`, `N21`. Algunos archivos usan `1` y `2` |
| `acq_date`, `acq_time` | fecha y hora UTC; `acq_time` es `HHMM` y puede venir sin ceros (`12` = 00:12) | igual |
| `type` | 0 vegetación, 1 volcán, 2 fuente fija en tierra, 3 en mar. **Solo en SP** | igual |
| `version` | `6.1NRT` en NRT; sin `NRT` en SP | `2.0NRT` en NRT |

Códigos NRT confirmados con los CSV de 7 días el 14/11/2026: `N20`, `N21`, `T`, `A`. Los del archivo SP de
NOAA-20/21 se confirman con la descarga de F0-B1.

### Cargarlos

No se parsea FIRMS a mano en cada carpeta: `services/pipeline` ya lo hace y deja la tabla `focos` del contrato
(nombres del OpenAPI, confianza MODIS pasada a `low`/`nominal`/`high`, `cell_id` de 0,1°, duplicados SP/NRT resueltos).

```bash
uv run --package pipeline python -m pipeline.firms <csv>... --out data/focos
uv run --package pipeline python -m pipeline.muestras <csv>... --out data/muestras --dia AAAA-MM-DD
```

Desde Python: `from pipeline.firms import cargar` devuelve un `polars.DataFrame` con esa forma.

### Armonización (D-02, D-03, D-04)

- **Filtros de entrada**: `type = 0`; MODIS con `confidence_pct >= 30`; VIIRS `nominal` o `high`.
- **Unidad**: días-celda con fuego en una grilla de 0,1°, expresados como "equivalente VIIRS". Un día-celda cuenta
  una vez aunque pasen varios satélites. El conteo crudo queda para el modo experto. No se inventa otra métrica.
- **Calibración en cadena** por región y mes: MODIS → S-NPP (solape 2012–2026) y NOAA-20 → S-NPP (solape
  2018–2026), validada dejando un año afuera. Cada tramo dice si es medido o convertido y su incertidumbre.
- Las fuentes fijas (antorchas de gas, industria; cerca de Comodoro es el falso positivo típico) no cuentan como quema.

### Condiciones de uso

Datos abiertos de NASA, sin restricción de uso. Se cita la fuente en la app, la descarga y la metodología:
"Datos de NASA FIRMS (https://earthdata.nasa.gov/firms), LANCE/EOSDIS". La clave es personal del equipo: no se comparte.

## Meteomatics (tiempo y riesgo de incendio en el foco)

- Lo usa `services/contexto` (`/weather`). Cuenta de la oferta del evento: **vence el 22/11/2026**. Después,
  el panel muestra "no disponible" hasta tener otra fuente.
- Pedido: `https://api.meteomatics.com/<fecha ISO o rango>/<parámetros separados por coma>/<lat,lon>/json`, con
  autenticación básica (`METEOMATICS_USER`, `METEOMATICS_PASSWORD`). Un pedido admite varios parámetros, horas y
  un área: juntar todo en uno.
- Parámetros probados el 14/11: `wind_speed_10m:ms`, `wind_dir_10m:d`, `t_2m:C`, `relative_humidity_2m:p`,
  `forest_fire_warning:idx`, `fosberg_fire_weather_index:idx`.
- **Límites: 1.000 pedidos por día**, 250 por minuto, 10 en paralelo. Caché obligatoria por celda de 0,1° y media hora.
- Uso: solo para mostrar el contexto del foco dentro de Charmy, citando "Meteomatics". No se republican sus datos
  crudos ni se expone la API a terceros.

## Copernicus Data Space (imagen Sentinel-2 del foco)

- Lo usa `services/contexto` (`/imagery`). Sentinel-2 L2A.
- Entrada OAuth `client_credentials`: el token se pide a
  `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token` con `CDSE_CLIENT_ID` y
  `CDSE_CLIENT_SECRET`. Las APIs están en `https://sh.dataspace.copernicus.eu`: **Catalog** para buscar la escena
  reciente más despejada y **Process** para generar la imagen. Las rutas exactas se confirman al crear el cliente.
- Cuenta gratuita: 10.000 unidades de proceso y 50.000 pedidos por mes, 300 por minuto. Cada imagen generada se
  guarda en caché para no gastar cuota dos veces.
- Dos estilos: color real y falso color (resalta lo quemado). Sirve para inspección visual, no como veredicto (D-19).
- Uso: datos abiertos de Copernicus. Toda imagen lleva la atribución
  "Contiene datos modificados de Copernicus Sentinel <año>".

## Referencias que solo se citan

- **currentwildfires.com**: comparación manual de cifras para la metodología. Sin API ni licencia: no se lee
  de forma automática ni se copian datos (D-20).
