"""Los boletines de Tecate no deben inflar la cobertura de prensa.

Lee la misma portada con Scrapy, pero escribe un documento independiente:
sin temas, figuras ni sentimiento. Un fallo conserva el ultimo corte bueno.
"""

import json
import os
import re
import time
from datetime import date

from .normalizar import id_nota
from .pipeline import _escribir
from .validador import validar_comunicados


def leer_fuente(ruta):
    with open(ruta, encoding="utf-8") as archivo:
        config = json.load(archivo)
    fuente = config["fuente"]
    if (fuente.get("id"), fuente.get("nombre"), fuente.get("url")) != (
            "gobtecate", "Gobierno de Tecate", "https://tecate.gob.mx/"):
        raise ValueError("comunicados: fuente municipal inesperada")
    if not config.get("nota") or not all(
            isinstance(fuente.get("scrapy", {}).get(clave), str)
            and fuente["scrapy"][clave] for clave in ("item", "titulo", "url", "fecha")):
        raise ValueError("comunicados: faltan nota o selectores")
    return fuente


def extraer(fuente, html):
    """La fixture recorre el mismo parser que la respuesta de red."""
    from scrapy.http import HtmlResponse
    from .spiders.noticias import NoticiasSpider
    spider = NoticiasSpider(medios=[fuente])
    spider._inicio[fuente["id"]] = time.monotonic()
    spider.parse_medio(HtmlResponse(url=fuente["url"], body=html, encoding="utf-8"), fuente)
    return spider.resultados[fuente["id"]]


def derivar(items, fuente, ahora, anterior=None, error=None, sin_red=False):
    por_url = {}
    for item in items:
        url = item.get("url", "")
        titulo = item.get("titulo", "").strip()
        if not re.fullmatch(r"https://tecate\.gob\.mx/noticias/[0-9]+", url) or not titulo:
            continue
        try:
            fecha = date.fromisoformat(item.get("fecha_cruda") or "").isoformat()
        except ValueError:
            fecha = None
        fila = {"id": id_nota(fuente["id"], titulo), "titulo": titulo, "url": url, "fecha": fecha}
        por_url[url] = fila
    filas = sorted(por_url.values(), key=lambda f: (
        -date.fromisoformat(f["fecha"]).toordinal() if f["fecha"] else 0, f["url"]))
    error = error or (None if filas else "La portada no devolvio titulares municipales")
    modo = "sin_red" if sin_red else "red"
    # Una corrida real nunca reutiliza ejemplos offline como noticias vigentes.
    previo = anterior if anterior and anterior.get("modo") == modo else None
    datos = {
        "esquema": 1,
        "fuente": {k: fuente[k] for k in ("id", "nombre", "url")},
        "zona": "Tecate", "modo": modo, "consultado": ahora,
        "ultimo_exito": (previo.get("ultimo_exito") if previo else None) if error else ahora,
        "estado": "fallo" if error else "ok", "error": error,
        "comunicados": (previo["comunicados"] if previo else []) if error else filas,
    }
    errores, _ = validar_comunicados(datos)
    if errores:
        raise ValueError("; ".join(errores))
    return datos


def correr(fuente, salida, ahora, sin_red=False):
    ruta = os.path.join(salida, "comunicados.json")
    anterior = None
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as archivo:
            anterior = json.load(archivo)
        errores, _ = validar_comunicados(anterior)
        if errores:
            raise ValueError("; ".join(errores))
    error = None
    if sin_red:
        with open(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "comunicados.html"), "rb") as archivo:
            items = extraer(fuente, archivo.read())
    else:
        from .scraping import scrapear_medios
        try:
            resultados, errores, _ = scrapear_medios([fuente])
            items = resultados.get(fuente["id"], [])
            error = errores.get(fuente["id"])
        except Exception as exc:
            items, error = [], str(exc)[:300] or "Fallo de Scrapy"
    datos = derivar(items, fuente, ahora, anterior, error, sin_red)
    _escribir(ruta, datos)
    return datos
