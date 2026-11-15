"""Noticias como señal (RF-VIV-03): titulares de Google News por provincia, etiquetados por el modelo.

El modelo solo etiqueta cada titular (apoya, contradice, sin_informacion); nunca decide el veredicto (D-09,
RF-VIV-04). Si Google News o el modelo fallan, se sigue sin la señal de noticias.
"""

import json
import os
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import httpx

RSS = "https://news.google.com/rss/search"
MODELO_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODELO = "google/gemma-4-31b-it"
ETIQUETAS = {"apoya", "contradice", "sin_informacion"}
MAX_TITULARES = 8
ESPERA_MODELO_S = 20  # con 60 s, un modelo caído alargaba cada vuelta varios minutos (#279)


class NoticiasNoDisponibles(Exception):
    """Google News o el modelo no respondieron. El mensaje nunca incluye la clave."""


def buscar(provincia: str, pais: str, cliente: httpx.Client) -> list[dict]:
    """Titulares de los últimos dos días sobre incendios en la provincia, del más nuevo al más viejo."""
    consulta = f'incendio "{provincia}" {pais} when:2d'
    try:
        respuesta = cliente.get(
            RSS,
            params={"q": consulta, "hl": "es-419", "gl": "AR", "ceid": "AR:es-419"},
            headers={"User-Agent": "charmy-worker/0.1"},
            follow_redirects=True,
            timeout=30,
        )
        respuesta.raise_for_status()
        items = ET.fromstring(respuesta.text).findall("./channel/item")
    except (httpx.HTTPError, ET.ParseError) as error:
        raise NoticiasNoDisponibles(f"Google News: {type(error).__name__}") from None
    titulares = []
    for item in items:
        fecha = item.findtext("pubDate")
        titulares.append(
            {
                "title": (item.findtext("title") or "").strip(),
                "url": item.findtext("link") or "",
                "published": parsedate_to_datetime(fecha).isoformat() if fecha else None,
            }
        )
    titulares.sort(key=lambda t: t["published"] or "", reverse=True)
    return [t for t in titulares if t["title"]][:MAX_TITULARES]


def etiquetar(
    titulares: list[dict],
    provincia: str,
    pais: str,
    cliente: httpx.Client,
    modelo: str = MODELO,
    opciones: dict | None = None,
) -> list[str]:
    """Una etiqueta por titular, en el mismo orden. `modelo` y `opciones` (campos extra del pedido, como
    apagar el razonamiento) solo cambian para medir otros modelos (#279)."""
    if not titulares:
        return []
    clave = os.environ.get("NVIDIA_API_KEY", "").strip()
    if not clave:
        raise NoticiasNoDisponibles("Falta NVIDIA_API_KEY")
    pedido = (
        "Sos un asistente que etiqueta titulares. Para cada titular, decí si informa un incendio de "
        f"vegetación (bosque, pastizal, monte) activo o reciente en {provincia}, {pais}: 'apoya' si lo "
        "informa, 'contradice' si dice que no hay fuego o que fue una falsa alarma, 'sin_informacion' si no "
        "trata de eso (casas, prevención, política). Respondé solo un arreglo JSON de cadenas, una por "
        "titular, en el mismo orden.\n\n"
        + "\n".join(f"{i + 1}. {t['title']}" for i, t in enumerate(titulares))
    )
    try:
        respuesta = cliente.post(
            MODELO_URL,
            headers={"Authorization": f"Bearer {clave}"},
            json={
                "model": modelo,
                "temperature": 0,
                "max_tokens": 200,
                "messages": [{"role": "user", "content": pedido}],
            }
            | (opciones or {}),
            timeout=ESPERA_MODELO_S,
        )
        respuesta.raise_for_status()
        eleccion = respuesta.json()["choices"][0]
        texto = eleccion["message"]["content"]
        if not isinstance(texto, str):
            # Un modelo que razona puede gastar los tokens pensando y devolver content null (#279).
            motivo = eleccion.get("finish_reason") or "sin motivo"
            raise NoticiasNoDisponibles(f"Modelo de lenguaje: respuesta sin texto ({motivo})")
        # El modelo a veces envuelve el JSON en un bloque de código.
        etiquetas = json.loads(texto[texto.index("[") : texto.rindex("]") + 1])
    except httpx.HTTPStatusError as error:
        # Solo el código: la URL y los encabezados no se imprimen.
        raise NoticiasNoDisponibles(f"Modelo de lenguaje: HTTP {error.response.status_code}") from None
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as error:
        raise NoticiasNoDisponibles(f"Modelo de lenguaje: {type(error).__name__}") from None
    if len(etiquetas) != len(titulares) or not set(etiquetas) <= ETIQUETAS:
        raise NoticiasNoDisponibles("Modelo de lenguaje: respuesta con otra forma")
    return etiquetas
