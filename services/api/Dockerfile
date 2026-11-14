# Imagen de la API. Contexto: la raíz del repo (docker-compose.yml y Render), porque la API monta
# services/contexto (carril B). Dockerfile: services/api/Dockerfile.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
WORKDIR /app
COPY services/contexto /src/contexto
COPY services/api/pyproject.toml ./
COPY services/api/src ./src
# contexto se instala desde su carpeta; --no-sources ignora la fuente "workspace" del pyproject.
RUN uv pip install --system --no-cache --no-sources /src/contexto .

# Las claves llegan como variables de entorno de la plataforma, nunca dentro de la imagen.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
