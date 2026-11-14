# Imagen del servicio de avisos. Contexto: services/alertas (como en docker-compose.yml).
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN uv pip install --system --no-cache .

# Las claves llegan como variables de entorno de la plataforma, nunca dentro de la imagen.
CMD ["python", "-m", "alertas"]
