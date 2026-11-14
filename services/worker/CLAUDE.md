# services/worker: reglas para los agentes

Worker de focos recientes. Dueño: `@BrunoAguinaga0` (carril C). Consulta FIRMS (`VIIRS_NOAA20_NRT` y
`VIIRS_NOAA21_NRT`, Argentina y Chile) y guarda los focos de las últimas 120 horas en Postgres para `/live`.

## Comandos

```bash
uv run --package worker python -m worker            # una vuelta (para un cron)
uv run --package worker python -m worker --cada 30  # sigue corriendo, una vuelta cada 30 minutos
docker compose --profile vivo up                    # base, API y worker en contenedores
```

Necesita `DATABASE_URL` y `FIRMS_MAP_KEY` en el entorno.

## Reglas

- Solo el worker consulta FIRMS, y como máximo una vez cada 30 minutos (D-13). El control está en la base
  (`estado_vivo.attempted_at`): aunque corran dos workers, no se pide de más.
- La clave de FIRMS va dentro de la URL: nunca se imprime, ni en registros ni en errores (`***`).
- Solo NOAA-20 y NOAA-21: S-NPP no publica datos nuevos desde el 2/11/2026. Las filas de otro satélite se descartan.
- Si FIRMS falla, no se borra nada: se guarda el error y `/live` sigue con la consulta anterior y lo avisa.
- Tablas `focos_vivo` y `estado_vivo`: las crea el worker y las lee `services/api`. Cambiar una columna es cambiar
  las dos carpetas a la vez.
- La imagen se construye con contexto `services/worker` (como en `docker-compose.yml`).
- Cuidá el cupo de la clave (5.000 transacciones cada 10 minutos, compartido con el pipeline): un pedido de un área
  grande cuenta como varios. Para mirar el uso: `mapserver/mapkey_status/?MAP_KEY=…` (no gasta cupo).
