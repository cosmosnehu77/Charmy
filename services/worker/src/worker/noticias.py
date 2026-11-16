"""Noticias como señal (RF-VIV-03): titulares de Google News por provincia, etiquetados por el modelo.

El modelo solo etiqueta cada titular (apoya, contradice, sin_informacion); nunca decide el veredicto (D-09,
RF-VIV-04). Si Google News o el modelo fallan, se sigue sin la señal de noticias.
"""

import json
import os
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import httpx

RSS = "https://news.google.com/rss/search"
MODELO_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
# Medición del 15/11 (#391, medir-noticias.yml) con el razonamiento apagado: 36/36 en titulares reales y
# 0,4 s por pedido. nemotron-3.5-lightning, el anterior, acertaba 18/36 con el mismo pedido.
MODELO = "nvidia/nemotron-3.5-bolt-e4b"
OPCIONES_MODELO = {"chat_template_kwargs": {"enable_thinking": False}}  # si razona, gasta los tokens pensando
ETIQUETAS = {"apoya", "contradice", "sin_informacion"}
MAX_TITULARES = 8
ESPERA_MODELO_S = 20  # con 60 s, un modelo caído alargaba cada vuelta varios minutos (#279)
# #407: "Santa Cruz", "Misiones" o "La Rioja" también son de otros países, y Google News trae sus medios.
# Se descarta un medio cuyo dominio es de un país de la región o de España que no es el de la provincia.
DOMINIO_PAIS = {"Argentina": "ar", "Chile": "cl"}
DOMINIOS_DE_PAIS = {
    "ar", "bo", "br", "cl", "co", "cr", "cu", "do", "ec", "es", "gt", "hn", "mx", "ni", "pa", "pe", "pr",
    "py", "sv", "uy", "ve",
}  # fmt: skip


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
        if _medio_de_otro_pais(item, pais):
            continue
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


def _medio_de_otro_pais(item: ET.Element, pais: str) -> bool:
    fuente = item.find("source")
    host = urlparse(fuente.get("url", "") if fuente is not None else "").hostname or ""
    dominio = host.rsplit(".", 1)[-1]
    return dominio in DOMINIOS_DE_PAIS and dominio != DOMINIO_PAIS.get(pais)


def etiquetar(
    titulares: list[dict],
    provincia: str,
    pais: str,
    cliente: httpx.Client,
    modelo: str = MODELO,
    opciones: dict | None = OPCIONES_MODELO,
) -> list[str]:
    """Una etiqueta por titular, en el mismo orden. `modelo` y `opciones` (campos extra del pedido, como
    apagar el razonamiento) solo cambian para medir otros modelos (#279)."""
    if not titulares:
        return []
    clave = os.environ.get("NVIDIA_API_KEY", "").strip()
    if not clave:
        raise NoticiasNoDisponibles("Falta NVIDIA_API_KEY")
    # #391: solo "apoya" el fuego que un satélite puede ver. Las noticias son por provincia: un incendio de
    # una casa en la capital no puede confirmar un foco en el monte.
    pedido = (
        "Etiquetás titulares de noticias para saber si hay fuego en vegetación o al aire libre en "
        f"{provincia}, {pais}, donde un satélite detectó focos de calor. Para cada titular elegí una "
        "etiqueta:\n"
        f'- "apoya": informa un incendio activo o de los últimos días en {provincia}, en vegetación o al '
        "aire libre: bosque, monte, pastizal, campo, banquina, humedal, isla o basural.\n"
        f'- "contradice": dice que en {provincia} no hubo fuego en vegetación, que se descartó o que fue '
        "una falsa alarma o una quema controlada.\n"
        '- "sin_informacion": todo lo demás. Por ejemplo: incendios de casas, departamentos, comercios, '
        "galpones, depósitos, fábricas o vehículos; explosiones; incendios de otra provincia u otro país "
        "o de años anteriores; prevención, alertas, simulacros, balances, policiales, deportes y política.\n"
        f"Cada titular termina con el nombre del medio: un titular o un medio de otro país que no es {pais} "
        'es "sin_informacion". Ante la duda, "sin_informacion". Respondé solo un arreglo JSON de cadenas, '
        "una por titular, en el mismo orden.\n\n"
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
