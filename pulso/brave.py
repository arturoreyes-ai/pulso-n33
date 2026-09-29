"""Brave Search: que enlaces de redes y de la web nombran un termino. Solo sondea.

El caso que lo motivo: la busqueda por palabra de los actores de Apify trae
ruido. El sondeo del 18 de septiembre de 2026 devolvio tres TikToks ajenos de
tres para cada termino del cliente, y el de la busqueda en vivo del 23 de
septiembre, para «Vive la Baja», 1 de 20 en TikTok y 1 de 22 en Facebook. Leer
una publicacion POR SU URL, en cambio, funciona sin sesion: es lo que hace
/seguimiento. La idea que este modulo mide es separar las dos cosas -- un indice
web encuentra las URL que nombran el termino y Apify lee solo esas -- y antes de
construirla hay que saber si el indice las tiene.

## Por que Brave y no Google

Google no se raspa: su robots.txt dice `Disallow: /search` a todo agente, y
alquilar el raspador (el actor de Google de Apify, SerpAPI, Serper) no cambia
nada, por lo mismo que en publicidad_meta_navegador.py. Su API oficial, Custom
Search JSON, esta cerrada a clientes nuevos y se apaga el 1 de enero de 2027;
la de Bing se retiro en 2025. Brave es un indice propio con API oficial: acepta
`site:` y la frase entre comillas, filtra por rango de fechas (`freshness`) y
cobra 5 USD por 1,000 consultas, con 5 USD de credito al mes (precios de
septiembre de 2026).

## Que hace y que no

Una pagina de 20 resultados por consulta y cuatro consultas por termino:
TikTok, Instagram, Facebook y la web sin esas tres. Cuenta cuantos resultados
son publicaciones que Apify sabria leer por URL, cuantos nombran el termino,
cuantos son perfiles y, en la web, cuantos son medios del catalogo. No escribe
nada, no llama a Apify y no toca data/. Si los numeros salen buenos, una fuente
`origen: "web"` en consultas.py es la decision siguiente, y es del cliente:
pone la cosecha de terminos en un horario.

- La llave va en la cabecera `X-Subscription-Token`, nunca en la URL: una URL
  acaba en logs y en el historial de la terminal.
- El termino va entre comillas: sin ellas llega cualquier pagina con las
  palabras sueltas. `spellcheck=0` porque un corrector "arregla" nombres
  propios, y Valente Marquez no es una errata.
- `search_lang` sale del `idioma` DECLARADO de la fila, nunca del texto
  (AGENTS.md, regla del idioma). Omitirlo no es neutral: Brave supone ingles.
- La ventana es la de las redes de consultas.py (30 dias) y la decide la
  fecha que Brave le conoce a la pagina, que no es la de publicacion: un post
  viejo que el indice releyo ayer entra. Por eso cada enlace imprime la suya.
- Una publicacion se reconoce con las MISMAS reglas que la cosecha
  (tiktok._url_video, facebook._url_post); lo que ninguna acepta no es
  publicacion aunque lo parezca, porque Apify no lo leeria igual.
"""

import html
import json
import re
import time
from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from . import VERSION, facebook, tiktok
from .consultas import VENTANA_DIAS, _nombra, red_de_url
from .normalizar import dominio

ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
AGENTE = "PulsoN33/{}".format(VERSION)
# Dos nombres, como APIFY_TOKEN y APIFY_API_TOKEN (ver pulso/entorno.py): la
# consola de Brave la llama "API key" y su documentacion "subscription token".
NOMBRES_LLAVE = ("BRAVE_API_KEY", "BRAVE_SEARCH_API_KEY")
POR_PAGINA = 20                 # el maximo que acepta `count`
USD_POR_CONSULTA = 0.005        # 5 USD por 1,000, septiembre de 2026
# El plan de pago admite 50 por segundo; el viejo plan gratuito, 1. Un segundo
# entre consultas no cuesta nada en un sondeo de doce y no depende del plan.
PAUSA_SEGUNDOS = 1.1
PAIS = "MX"

REDES = ("tiktok", "instagram", "facebook")
SITIOS = {"tiktok": "tiktok.com", "instagram": "instagram.com", "facebook": "facebook.com"}

# La forma de canonizarPublicacion (web/src/lib/dominio/publicaciones.ts), que
# no tiene gemela en Python porque el pipeline arma la URL del post con el
# shortCode del actor. Acepta ademas `/<usuario>/p/<codigo>/`, otra forma que
# Instagram sirve y el sitio no acepta: si el sondeo la encuentra seguido, el
# canonizador del sitio tiene que aprenderla antes de leer estas URL.
RE_POST_INSTAGRAM = re.compile(r"^/(?:[A-Za-z0-9_.]{1,30}/)?(?:p|reel)/([A-Za-z0-9_-]+)/?$")
HOSTS_INSTAGRAM = ("instagram.com", "www.instagram.com")
RE_PERFIL_TIKTOK = re.compile(r"^/@[A-Za-z0-9_.]+/?$")
RE_PERFIL_INSTAGRAM = re.compile(r"^/([A-Za-z0-9_.]{1,30})/?$")
RE_PERFIL_FACEBOOK = re.compile(r"^/(" + facebook.RE_PAGINA + r")/?$")
# Rutas de un segmento que no son una cuenta.
NO_SON_PERFIL = {
    "instagram": ("explore", "accounts", "stories", "reels", "reel", "p", "tv", "direct",
                  "about", "legal", "developer", "web"),
    "facebook": facebook.RESERVADAS + ("hashtag", "search", "pages", "public", "business",
                                       "help", "policies", "privacy"),
}


class SinLlave(Exception):
    """No hay llave de Brave: el sondeo no llama a nada."""


class LlaveRechazada(Exception):
    """Brave respondio 401 o 403: todas las consultas siguientes fallarian igual."""

    def __init__(self, codigo):
        super().__init__("HTTP {}".format(codigo))
        self.codigo = codigo


# ------------------------------------------------------------ consultas

def busquedas_de(termino):
    """Las cuatro busquedas de un termino, como (fuente, q)."""
    frase = '"{}"'.format(" ".join(termino.replace('"', " ").split()))
    filas = [(red, "{} site:{}".format(frase, SITIOS[red])) for red in REDES]
    filas.append(("web", frase + "".join(" -site:" + SITIOS[r] for r in REDES)))
    return filas


def rango(ahora, dias=VENTANA_DIAS):
    """`freshness` de Brave para los ultimos `dias`: 'AAAA-MM-DDtoAAAA-MM-DD'."""
    fin = datetime.fromisoformat(ahora).date()
    return "{}to{}".format((fin - timedelta(days=dias)).isoformat(), fin.isoformat())


def url_de_busqueda(q, freshness, idioma):
    """La URL de una consulta. La llave NO va aqui: ver el encabezado."""
    return ENDPOINT + "?" + urlencode((
        ("q", q), ("count", POR_PAGINA), ("freshness", freshness), ("country", PAIS),
        ("search_lang", idioma), ("spellcheck", "0"), ("text_decorations", "0"),
        ("result_filter", "web"),
    ))


def pedir_brave(url, llave, timeout=20):
    """GET a Brave con la llave en la cabecera. Devuelve el JSON."""
    req = Request(url, headers={
        "Accept": "application/json",
        "User-Agent": AGENTE,
        "X-Subscription-Token": llave,
    })
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


# -------------------------------------------------------- clasificacion

def _url_instagram(url):
    p = urlsplit(url or "")
    if (p.hostname or "").lower() not in HOSTS_INSTAGRAM:
        return None
    m = RE_POST_INSTAGRAM.match(p.path or "")
    return "https://www.instagram.com/p/{}/".format(m.group(1)) if m else None


def publicacion(url, red):
    """URL canonica si es una publicacion que la cosecha sabria leer, o None."""
    if red == "tiktok":
        return tiktok._url_video(url)
    if red == "facebook":
        return facebook._url_post(url)
    if red == "instagram":
        return _url_instagram(url)
    return None


def _es_perfil(url, red):
    p = urlsplit(url or "")
    ruta = p.path or "/"
    if red == "tiktok":
        return bool(RE_PERFIL_TIKTOK.match(ruta))
    if red == "facebook" and ruta == "/profile.php":
        return "id" in p.query
    m = (RE_PERFIL_INSTAGRAM if red == "instagram" else RE_PERFIL_FACEBOOK).match(ruta)
    return bool(m) and m.group(1).lower() not in NO_SON_PERFIL[red]


def clasificar(url, fuente, dominios=()):
    """(tipo, url) de un resultado.

    En una busqueda de red: publicacion (con su URL canonica), perfil u otro
    -- un hashtag, una pagina de ayuda, o un host que `site:` dejo pasar. En la
    web: prensa si el host es de un medio del catalogo, youtube, web, u otro
    si una red se colo pese al `-site:`.
    """
    red = red_de_url(url)
    if fuente in REDES:
        if red != fuente:
            return "otro", url
        canonica = publicacion(url, red)
        if canonica:
            return "publicacion", canonica
        return ("perfil" if _es_perfil(url, red) else "otro"), url
    if red:
        return "otro", url
    host = dominio(url)
    if host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com"):
        return "youtube", url
    if any(host == d or host.endswith("." + d) for d in dominios):
        return "prensa", url
    return "web", url


def _fecha(page_age):
    """'AAAA-MM-DD' de `page_age`, o None. Brave no siempre la trae."""
    s = (page_age or "")[:10]
    return s if re.match(r"^\d{4}-\d{2}-\d{2}$", s) else None


def _donde_nombra(titulo, extracto, termino):
    en_titulo, en_extracto = _nombra(titulo, termino), _nombra(extracto, termino)
    if en_titulo and en_extracto:
        return "ambos"
    return "titulo" if en_titulo else "extracto" if en_extracto else None


def enlaces(resultados, fuente, termino, dominios=()):
    """Los resultados de una consulta, clasificados y sin repetir por URL canonica."""
    salida, vistos = [], set()
    for r in resultados:
        url = (r.get("url") or "").strip()
        if not url:
            continue
        tipo, clave = clasificar(url, fuente, dominios)
        if clave in vistos:
            continue
        vistos.add(clave)
        titulo = html.unescape(r.get("title") or "").strip()
        extracto = html.unescape(r.get("description") or "").strip()
        salida.append({"tipo": tipo, "url": clave, "fecha": _fecha(r.get("page_age")),
                       "nombra": _donde_nombra(titulo, extracto, termino), "titulo": titulo})
    return salida


def dominios_de(medios):
    """Los hosts de los medios del catalogo (config/medios.json), sin 'www.'."""
    return tuple(sorted({dominio(m["url"]) for m in medios if m.get("url")}))


# ---------------------------------------------------------------- sondeo

def sondear(consultas, ahora, llave, pedir=None, dormir=None, dominios=(), solo=None,
            ventana_dias=VENTANA_DIAS):
    """Cuatro consultas por termino. Devuelve una fila por consulta.

    Recorre todas las filas, apagadas incluidas, como `consultas --probar`: el
    sondeo es lo que se corre ANTES de encender. Un error de una consulta queda
    en su fila y el sondeo sigue; una llave rechazada lo detiene, porque las
    demas fallarian igual.
    """
    if not llave:
        raise SinLlave("falta {}".format(" o ".join(NOMBRES_LLAVE)))
    pedir = pedir or pedir_brave
    dormir = dormir or time.sleep
    freshness = rango(ahora, ventana_dias)
    filas, hechas = [], 0
    for c in consultas:
        if solo and c.get("id") not in solo:
            continue
        for fuente, q in busquedas_de(c["termino"]):
            if hechas:
                dormir(PAUSA_SEGUNDOS)
            hechas += 1
            fila = {"consulta": c["id"], "termino": c["termino"], "fuente": fuente, "q": q}
            try:
                doc = pedir(url_de_busqueda(q, freshness, c["idioma"]), llave)
            except HTTPError as e:
                if e.code in (401, 403):
                    raise LlaveRechazada(e.code)
                filas.append(dict(fila, estado="error", error="HTTP {}".format(e.code),
                                  enlaces=[]))
                continue
            except (URLError, OSError, ValueError) as e:
                filas.append(dict(fila, estado="error", error=type(e).__name__, enlaces=[]))
                continue
            resultados = (doc.get("web") or {}).get("results") or []
            filas.append(dict(
                fila, estado="ok", resultados=len(resultados),
                mas=bool((doc.get("query") or {}).get("more_results_available")),
                enlaces=enlaces(resultados, fuente, c["termino"], dominios)))
    return filas
