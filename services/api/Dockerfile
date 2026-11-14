# Imagen de la API. Contexto: services/api (como en docker-compose.yml y en la plataforma de despliegue).
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN uv pip install --system --no-cache .

# Las claves llegan como variables de entorno de la plataforma, nunca dentro de la imagen.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
