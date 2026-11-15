# Imagen del servicio de predicción por zona (#336). Contexto: services/prediccion (no la raíz del repo),
# porque el servidor no usa `pipeline` ni nada de entrenamiento:
#   docker build -t charmy-prediccion services/prediccion
FROM python:3.12-slim

# LightGBM necesita OpenMP, que la imagen slim no trae.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
WORKDIR /app
COPY servir.txt pyproject.toml ./
COPY src ./src
# Solo lo que usa el servidor (servir.txt). El paquete va con --no-deps: sus otras dependencias (pipeline,
# polars, timesfm) son del entrenamiento y la comparación, y no entran en la imagen.
RUN uv pip install --system --no-cache -r servir.txt && uv pip install --system --no-cache --no-deps --no-sources .

# El modelo y las claves no van en la imagen: el modelo se baja del Release al arrancar (MODELO_URL,
# MODELO_SHA256) y el token llega como variable de entorno de la plataforma (PREDICCION_TOKEN).
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn prediccion.servir:app --host 0.0.0.0 --port ${PORT}"]
