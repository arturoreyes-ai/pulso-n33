"""Ingesta de RSS/Atom y portadas Scrapy con salud por fuente.

Una fuente caida no tumba la corrida: se convierte en un registro 'fallo'
en data/fuentes.json. Scrapy se importa de forma diferida para que una falta de
dependencia degrade solo esas fuentes y no esconda los RSS disponibles.

MINIATURAS (14 de septiembre de 2026, a peticion del cliente). De cada item se
saca, si la hay, la URL de la imagen que el medio publica en su propio feed.
Se sondearon los quince feeds RSS del catalogo ese dia y el resultado decide
el orden de busqueda de aqui abajo:

  - <enclosure> NUNCA fue una imagen: Zeta manda video/mp4 e inewsource
    audio/mpeg. Solo se acepta si su 'type' empieza con image/.
  - <media:thumbnail> y <media:content> los traen El Imparcial, KPBS y
    Noticias Ensenada.
  - Lo mas comun (siete feeds) es un <img> dentro de <description> o de
    <content:encoded>. Se lee ese fragmento HTML SOLO para sacar el src del
    primer <img> util y se descarta: ni una palabra del texto llega al item.
  - Trampas: el primer <img> de Tecate Noticias suele ser el sprite de emoji
    de WordPress (s.w.org, class wp-smiley, 72px), y varios feeds incrustan
    fotos de stock o de otro medio. Las descarta normalizar.imagen_del_medio.

La URL se guarda tal como viene: los sufijos -WxH de WordPress, el ?fit= de
Photon y el ?auth= de Arc son derivados estables del original, y reescribirlos
puede dar 404.
"""

import time
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from . import VERSION
from .normalizar import imagen_del_medio

AGENTE = "PulsoN33/{} (+https://github.com/arturoreyes-ai/pulso-n33)".format(VERSION)
ACEPTA = "application/rss+xml, application/atom+xml, application/xml, text/xml"
_ATOM = "{http://www.w3.org/2005/Atom}"
_DC = "{http://purl.org/dc/elements/1.1/}"
_MEDIA = "{http://search.yahoo.com/mrss/}"
_CONTENT = "{http://purl.org/rss/1.0/modules/content/}"

# El sprite de emoji de WordPress mide 72px; una miniatura de nota, no.
IMAGEN_LADO_MINIMO = 100
IMAGEN_LARGO_MAXIMO = 500


def _texto(el, tag):
    hijo = el.find(tag)
    return (hijo.text or "").strip() if hijo is not None and hijo.text else ""


class _Imagenes(HTMLParser):
    """Recoge los <img> de un fragmento HTML. Solo atributos, nunca texto."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.vistas = []

    def handle_starttag(self, tag, attrs):
        if tag != "img":
            return
        a = dict(attrs)
        self.vistas.append({
            "src": (a.get("src") or "").strip(),
            "class": (a.get("class") or "").lower(),
            "width": a.get("width"), "height": a.get("height"),
        })


def _lado(valor):
    try:
        return int(str(valor).strip().rstrip("px"))
    except (TypeError, ValueError):
        return None


def _imgs_de_html(fragmento):
    """URLs de <img> utiles de un fragmento: fuera el sprite de emoji y todo
    lo que declare medir menos de IMAGEN_LADO_MINIMO."""
    if not fragmento:
        return []
    lector = _Imagenes()
    try:
        lector.feed(fragmento)
    except Exception:              # HTML roto: sin imagen, no sin nota
        return []
    salida = []
    for img in lector.vistas:
        if "wp-smiley" in img["class"] or img["src"].startswith("data:"):
            continue
        lados = [_lado(img["width"]), _lado(img["height"])]
        if any(l is not None and l <= IMAGEN_LADO_MINIMO for l in lados):
            continue
        salida.append(img["src"])
    return salida


def _aceptable(url, medio):
    return (isinstance(url, str) and url.startswith("https://")
            and not any(c.isspace() for c in url)
            and len(url) <= IMAGEN_LARGO_MAXIMO
            and imagen_del_medio(url, medio))


def imagen_de(item, medio):
    """URL de la miniatura del item, o None. Ver el docstring del modulo."""
    candidatas = []
    for el in item.iter(_MEDIA + "thumbnail"):
        candidatas.append(el.get("url"))
    for el in item.iter(_MEDIA + "content"):
        tipo = (el.get("type") or "").lower()
        if (el.get("medium") or "").lower() == "image" or tipo.startswith("image/"):
            candidatas.append(el.get("url"))
    for el in item.iter("enclosure"):
        if (el.get("type") or "").lower().startswith("image/"):
            candidatas.append(el.get("url"))
    for tag in ("description", _CONTENT + "encoded", _ATOM + "summary", _ATOM + "content"):
        candidatas.extend(_imgs_de_html(_texto(item, tag)))
    for url in candidatas:
        url = (url or "").strip()
        if _aceptable(url, medio):
            return url
    return None


class NoEsFeed(Exception):
    """La URL respondio 200 pero con una pagina, no con un feed.

    Es el fallo mas comun de un catalogo sin verificar: el sitio contesta la
    portada en HTML en vez de un 404. Sin este chequeo el motivo llega como
    'ParseError: not well-formed', que manda a depurar el parser en vez de
    corregir la URL.
    """


def fetch_rss(url, timeout=15, medio=None):
    """Baja y parsea un feed. Lanza excepcion si falla: la registra el llamador.

    Con `medio` (la fila del catalogo) cada item trae ademas 'imagen', la
    miniatura del propio medio o None. Sin medio no hay contra que comprobar
    el host, asi que no se busca: es el caso de Google Noticias, cuyo feed
    tampoco la trae.
    """
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
        origen = item.find("source")
        salida.append({
            "titulo": _texto(item, "title"),
            "url": _texto(item, "link"),
            "fecha_cruda": _texto(item, "pubDate") or _texto(item, _DC + "date"),
            # <source> es RSS 2.0 de toda la vida -- 'el canal del que viene
            # este item' -- no una extension de Google. Casi ningun feed del
            # catalogo lo trae y estas dos claves quedan vacias sin estorbar.
            # El de Google Noticias lo trae en todos, y es el UNICO dato que
            # dice de que medio es la nota: su <link> es un redirector propio.
            "fuente_texto": _texto(item, "source"),
            "fuente_url": (origen.get("url") or "").strip() if origen is not None else "",
        })
        if medio is not None:
            salida[-1]["imagen"] = imagen_de(item, medio)
    for entry in raiz.iter(_ATOM + "entry"):          # Atom 1.0
        enlace = entry.find(_ATOM + "link")
        salida.append({
            "titulo": _texto(entry, _ATOM + "title"),
            "url": (enlace.get("href") or "").strip() if enlace is not None else "",
            "fecha_cruda": (_texto(entry, _ATOM + "published")
                            or _texto(entry, _ATOM + "updated")),
        })
        if medio is not None:
            salida[-1]["imagen"] = imagen_de(entry, medio)
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
            items = fetch_rss(m["url"], timeout=timeout, medio=m)
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
