"""Descubrimiento transitorio GDELT -> paginas de publisher.

GDELT solo aporta URLs candidatas. Los titulos, dominios y fechas que llegan al
pipeline se extraen de la pagina publisher; no se guarda ningun snippet ni
texto del indice de GDELT.
"""

import ipaddress
import hashlib
import json
import re
import socket
import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

from .delegaciones import tiene_delegacion_directa, delegaciones_en
from .fetch import AGENTE
from .normalizar import fecha_iso, url_canonica, dominio

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_INTERVALO = 6.0
MAX_HTML = 2 * 1024 * 1024
MAX_ROBOTS = 256 * 1024
_DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})(?:[T ]|\b)")

CONSULTAS = (
    '(Tijuana OR "Playas de Tijuana" OR "Sanchez Taboada" OR Otay OR "Cerro Colorado") sourcelang:spanish',
    '("Camino Verde" OR "Villa Fontana" OR "Mariano Matamoros" OR Guaycura OR "La Morita" OR Salvatierra) sourcelang:spanish',
)


class _PublisherParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.meta = {}
        self.canonical = None
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = (attrs.get("property") or attrs.get("name") or attrs.get("itemprop") or "").lower()
            value = (attrs.get("content") or "").strip()
            if key and value and key not in self.meta:
                self.meta[key] = value
        elif tag == "link" and (attrs.get("rel") or "").lower() == "canonical":
            self.canonical = (attrs.get("href") or "").strip() or None

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title.append(data)


def _host(url):
    return (urlsplit(url).hostname or "").lower().rstrip(".")


def url_segura(url, resolver=socket.getaddrinfo):
    """Rechaza SSRF, credenciales, protocolos no HTTP y puertos raros."""
    try:
        p = urlsplit(url)
        if p.scheme.lower() not in ("http", "https") or p.username or p.password:
            return False
        host = _host(url)
        if not host:
            return False
        if p.port not in (None, 80, 443):
            return False
        for info in resolver(host, None, type=socket.SOCK_STREAM):
            ip = ipaddress.ip_address(info[4][0])
            if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast
                    or ip.is_reserved or ip.is_unspecified):
                return False
        return True
    except (ValueError, OSError, socket.gaierror):
        return False


def _robots_permite(url, timeout=10):
    robots_url = urljoin(url, "/robots.txt")
    if not url_segura(robots_url):
        return False, "robots_url_insegura"
    try:
        req = Request(robots_url, headers={"User-Agent": AGENTE})
        with urlopen(req, timeout=timeout) as response:
            if not url_segura(response.geturl()):
                return False, "robots_redirect_inseguro"
            raw = response.read(MAX_ROBOTS + 1)
        if len(raw) > MAX_ROBOTS:
            return False, "robots_demasiado_grande"
        from urllib.robotparser import RobotFileParser
        parser = RobotFileParser()
        parser.parse(raw.decode("utf-8", "replace").splitlines())
        return parser.can_fetch(AGENTE, url), None
    except Exception as exc:
        # Si no podemos leer robots, no tocamos la pagina: es la degradacion
        # conservadora que evita que una caida de robots se vuelva bypass.
        return False, "robots: {}".format(type(exc).__name__)


def _fecha_publicacion(parser, fallback=None):
    cruda = (parser.meta.get("article:published_time")
             or parser.meta.get("datepublished")
             or parser.meta.get("date")
             or parser.meta.get("pubdate")
             or parser.meta.get("og:updated_time"))
    if not cruda:
        cruda = fallback or ""
    fecha, iso = fecha_iso(cruda)
    if fecha:
        return fecha, iso
    m = _DATE_RE.search(cruda)
    return (m.group(1), m.group(1) + "T00:00:00+00:00") if m else (None, None)


def _publisher(url, timeout=15):
    req = Request(url, headers={"User-Agent": AGENTE, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(req, timeout=timeout) as response:
        destino = response.geturl()
        if not url_segura(destino):
            raise ValueError("redirect_inseguro")
        tipo = (response.headers.get("Content-Type") or "").lower()
        raw = response.read(MAX_HTML + 1)
    if len(raw) > MAX_HTML:
        raise ValueError("html_demasiado_grande")
    if tipo and "html" not in tipo and "xhtml" not in tipo:
        raise ValueError("publisher_no_html")
    parser = _PublisherParser()
    parser.feed(raw.decode("utf-8", "replace"))
    titulo = (parser.meta.get("og:title") or parser.meta.get("twitter:title")
              or " ".join(parser.title)).strip()
    canonical = url_canonica(urljoin(url, parser.canonical)) if parser.canonical else url_canonica(url)
    fecha, publicado = _fecha_publicacion(parser)
    return {"titulo": " ".join(titulo.split()), "url": canonical,
            "fecha": fecha, "publicado": publicado}


def _gdelt(query, timeout=20):
    params = {"query": query, "mode": "artlist", "format": "json",
              "maxrecords": "100", "timespan": "12h", "sort": "datedesc"}
    req = Request(GDELT_URL + "?" + urlencode(params), headers={"User-Agent": AGENTE})
    with urlopen(req, timeout=timeout) as response:
        doc = json.loads(response.read(2 * 1024 * 1024).decode("utf-8", "replace"))
    # Solo URLs: no conservar title, snippet, seendate ni otros campos del
    # indice, ni siquiera en el resultado que cruza el pipeline.
    return [x.get("url") for x in doc.get("articles", []) if isinstance(x, dict) and x.get("url")]


def descubrir(*, ahora=None, consultas=CONSULTAS, gdelt=_gdelt,
              publisher=_publisher, robots=_robots_permite, limite=60):
    """Devuelve ``(items, health)``; cada item trae solo campos publicables."""
    ahora = ahora or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    ahora_dt = datetime.fromisoformat(ahora.replace("Z", "+00:00"))
    inicio = time.monotonic()
    urls, metrics = [], {"candidatos": 0, "publisher_pages": 0, "aceptadas": 0,
                         "rechazadas": 0, "robots_exclusiones": 0, "fallos": 0}
    last = 0.0
    error = None
    try:
        for consulta in consultas:
            espera = GDELT_INTERVALO - (time.monotonic() - last)
            if last and espera > 0:
                time.sleep(espera)
            last = time.monotonic()
            urls.extend(gdelt(consulta))
    except Exception as exc:
        error = "{}: {}".format(type(exc).__name__, exc)[:300]
    metrics["candidatos"] = len(urls)
    items, vistos = [], set()
    for original in urls:
        if len(items) >= limite:
            break
        if not isinstance(original, str) or not url_segura(original):
            metrics["rechazadas"] += 1
            continue
        page = url_canonica(original)
        if page in vistos:
            continue
        vistos.add(page)
        permitido, motivo = robots(page)
        if not permitido:
            metrics["robots_exclusiones"] += 1
            continue
        metrics["publisher_pages"] += 1
        try:
            dato = publisher(page)
        except Exception:
            metrics["fallos"] += 1
            continue
        titulo = dato.get("titulo") or ""
        canonical = dato.get("url") or page
        if not titulo or not url_segura(canonical) or not dato.get("fecha"):
            metrics["rechazadas"] += 1
            continue
        try:
            fecha_dt = datetime.fromisoformat(str(dato["fecha"]) + "T00:00:00+00:00")
        except ValueError:
            metrics["rechazadas"] += 1
            continue
        if fecha_dt < ahora_dt - timedelta(days=7) or fecha_dt > ahora_dt + timedelta(days=1):
            metrics["rechazadas"] += 1
            continue
        if not tiene_delegacion_directa(titulo):
            metrics["rechazadas"] += 1
            continue
        source_hash = hashlib.sha256(dominio(canonical).encode("utf-8")).hexdigest()[:12]
        items.append({"medio": {"id": "web-{}".format(source_hash),
                                 "nombre": dominio(canonical), "url": canonical,
                                 "zona": "estatal", "tipo": "descubrimiento"},
                      "item": {"titulo": titulo, "url": canonical,
                               "fecha_cruda": dato.get("publicado") or dato.get("fecha")},
                      "origen": "descubrimiento_web", "descubierta_por": "gdelt"})
        metrics["aceptadas"] += 1
    salud = {"id": "descubrimiento-web", "nombre": "Descubrimiento web",
             "url": GDELT_URL, "metodo": "descubrimiento", "zona": "estatal",
             "estado": "ok" if error is None else "fallo", "obtenidas": len(items),
             "nuevas": 0, "ms": int((time.monotonic() - inicio) * 1000),
             "ultima_ok": ahora if error is None else None,
             "error": error, "detalle": metrics}
    return items, salud
