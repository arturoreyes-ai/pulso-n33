"""Ingesta de RSS/Atom y portadas Scrapy con salud por fuente.

Una fuente caida no tumba la corrida: se convierte en un registro 'fallo'
en data/fuentes.json. Scrapy se importa de forma diferida para que una falta de
dependencia degrade solo esas fuentes y no esconda los RSS disponibles.
"""

import time
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from . import VERSION

AGENTE = "PulsoN33/{} (+https://github.com/arturoreyes-ai/pulso-n33)".format(VERSION)
ACEPTA = "application/rss+xml, application/atom+xml, application/xml, text/xml"
_ATOM = "{http://www.w3.org/2005/Atom}"
_DC = "{http://purl.org/dc/elements/1.1/}"


def _texto(el, tag):
    hijo = el.find(tag)
    return (hijo.text or "").strip() if hijo is not None and hijo.text else ""


class NoEsFeed(Exception):
    """La URL respondio 200 pero con una pagina, no con un feed.

    Es el fallo mas comun de un catalogo sin verificar: el sitio contesta la
    portada en HTML en vez de un 404. Sin este chequeo el motivo llega como
    'ParseError: not well-formed', que manda a depurar el parser en vez de
    corregir la URL.
    """


def fetch_rss(url, timeout=15):
    """Baja y parsea un feed. Lanza excepcion si falla: la registra el llamador."""
    req = Request(url, headers={"User-Agent": AGENTE, "Accept": ACEPTA})
    with urlopen(req, timeout=timeout) as r:
        crudo = r.read()
        tipo = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()

    cabeza = crudo[:1024].lstrip().lower()
    if cabeza.startswith(b"<!doctype html") or cabeza.startswith(b"<html") or tipo == "text/html":
        raise NoEsFeed("respuesta HTML, no RSS (Content-Type: {}); revisa la URL".format(
            tipo or "sin declarar"))

    raiz = ElementTree.fromstring(crudo)

    salida = []
    for item in raiz.iter("item"):                    # RSS 2.0
        salida.append({
            "titulo": _texto(item, "title"),
            "url": _texto(item, "link"),
            "fecha_cruda": _texto(item, "pubDate") or _texto(item, _DC + "date"),
        })
    for entry in raiz.iter(_ATOM + "entry"):          # Atom 1.0
        enlace = entry.find(_ATOM + "link")
        salida.append({
            "titulo": _texto(entry, _ATOM + "title"),
            "url": (enlace.get("href") or "").strip() if enlace is not None else "",
            "fecha_cruda": (_texto(entry, _ATOM + "published")
                            or _texto(entry, _ATOM + "updated")),
        })
    return [s for s in salida if s["titulo"] and s["url"]]


def fetch_medios(medios, ahora, timeout=15):
    """Devuelve ([(medio, items)], salud). `tipo` es rss (omision) o scrapy."""
    activos = [m for m in medios if m.get("activo", True)]
    por_id, meta = {}, {}

    for m in activos:
        if m.get("tipo", "rss") == "scrapy":
            continue
        t0 = time.monotonic()
        try:
            items = fetch_rss(m["url"], timeout=timeout)
            estado, error = "ok", None
        except Exception as e:            # red, HTTP, XML mal formado
            items, estado = [], "fallo"
            error = "{}: {}".format(type(e).__name__, e)[:300]
        por_id[m["id"]] = items
        meta[m["id"]] = (estado, error, int((time.monotonic() - t0) * 1000))

    de_html = [m for m in activos if m.get("tipo", "rss") == "scrapy"]
    if de_html:
        try:
            from .scraping import scrapear_medios
            items_html, errores_html, ms_html = scrapear_medios(de_html)
        except Exception as e:
            items_html, ms_html = {}, {}
            error = "{}: {}".format(type(e).__name__, e)[:300]
            errores_html = {m["id"]: error for m in de_html}
        for m in de_html:
            mid = m["id"]
            por_id[mid] = items_html.get(mid, [])
            error = errores_html.get(mid)
            meta[mid] = ("fallo" if error else "ok", error, ms_html.get(mid, 0))

    resultados, salud = [], []
    for m in activos:
        items = por_id.get(m["id"], [])
        estado, error, ms = meta[m["id"]]
        resultados.append((m, items))
        salud.append({
            "id": m["id"],
            "nombre": m["nombre"],
            "url": m["url"],
            "metodo": m.get("tipo", "rss"),
            "zona": m.get("zona"),
            "estado": estado,
            "obtenidas": len(items),
            "nuevas": 0,
            "ms": ms,
            "ultima_ok": ahora if estado == "ok" else None,
            "error": error,
        })
    return resultados, salud
