"""Normalizacion de texto, fechas, URLs e identidad de notas."""

import hashlib
import re
import unicodedata
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Parametros de rastreo: no cambian el documento al que apunta la URL.
_BASURA_QUERY = ("utm_", "fbclid", "gclid", "mc_cid", "mc_eid", "igshid", "_ga")


def fold(s):
    """Minusculas, sin acentos, espacios colapsados.

    'Gutierrez' y 'GUTIERREZ' tienen que empatar: los medios publican
    titulares en mayusculas y con acentuacion inconsistente.
    """
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()


def fecha_iso(cruda):
    """Devuelve ('YYYY-MM-DD', ISO-8601 con offset) desde un pubDate de RSS.

    (None, None) si no se puede interpretar. La fecha es la del huso en que
    publico el medio; no se normaliza a America/Tijuana porque eso exige
    zoneinfo, que en Windows depende del paquete tzdata y romperia la regla
    de solo-stdlib.
    """
    cruda = (cruda or "").strip()
    if not cruda:
        return None, None
    dt = None
    try:
        # RFC 2822: 'Sat, 21 Jun 2026 09:12:00 -0700'
        dt = parsedate_to_datetime(cruda)
    except (TypeError, ValueError):
        dt = None
    if dt is None:
        try:
            dt = datetime.fromisoformat(cruda.replace("Z", "+00:00"))
        except ValueError:
            return None, None
    return dt.date().isoformat(), dt.isoformat()


def url_canonica(url):
    """Quita el fragmento y los parametros de rastreo; conserva lo demas."""
    url = (url or "").strip()
    if not url:
        return ""
    p = urlsplit(url)
    query = [
        (k, v)
        for k, v in parse_qsl(p.query, keep_blank_values=True)
        if not any(k.lower().startswith(b) for b in _BASURA_QUERY)
    ]
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(query), ""))


def dominio(url):
    """Host sin 'www.' ni puerto, para la etiqueta de fuente en el muro."""
    host = urlsplit(url or "").netloc.lower()
    host = host.split("@")[-1].split(":")[0]
    return host[4:] if host.startswith("www.") else host


def imagen_del_medio(url_imagen, medio):
    """La miniatura es del medio: su host es el dominio del medio, un subdominio
    suyo, o uno de los CDN que su fila declara en 'imagenes_de'.

    Es la regla que hace honesta la miniatura. El sondeo del 14 de septiembre
    de 2026 encontro en los feeds del catalogo fotos de stock (pexels.com,
    ecartelera.com en Noticias Ensenada), el sprite de emoji de WordPress
    (s.w.org) y fotos de OTRO medio (Radar BC y Tecate Noticias incrustan
    zetatijuana.com). Guardar cualquiera de esas acreditaria al medio una
    imagen que no hizo. Sin lista de sufijos publicos: el dominio del medio ya
    viene en su 'url' y basta con 'es ese o termina en .ese'.
    """
    host = dominio(url_imagen)
    if not host:
        return False
    permitidos = [dominio(medio.get("url"))]
    permitidos += [str(h).lower().strip() for h in (medio.get("imagenes_de") or [])]
    return any(p and (host == p or host.endswith("." + p)) for p in permitidos)


def id_nota(fuente_id, titulo):
    """Identidad estable: mismo medio + mismo titular = mismo id.

    Se recalcula en cada corrida y el validador lo verifica, asi que una
    edicion a mano de data/notas.json se detecta.
    """
    crudo = "{}|{}".format(fuente_id, fold(titulo)).encode("utf-8")
    return hashlib.sha256(crudo).hexdigest()[:16]


def dedup(notas):
    """Deja la primera aparicion de cada id y preserva el orden."""
    vistos, salida = set(), []
    for n in notas:
        if n["id"] in vistos:
            continue
        vistos.add(n["id"])
        salida.append(n)
    return salida
