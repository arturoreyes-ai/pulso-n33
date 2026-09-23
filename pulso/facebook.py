"""Paginas publicas de Facebook: lista blanca de los actores de Apify, sin sesion.

No tiene `cosechar` propio. Lo corre pulso/consultas.py, que es el unico
llamador, con el mismo bucle de dos pasadas que TikTok e Instagram; aqui vive
lo que solo Facebook sabe: como se canoniza la URL de un post, que campos trae
cada actor y cuales NO pueden sobrevivir a la ingesta.

## El hecho que motiva el modulo

`apify~facebook-comments-scraper` devuelve, POR CADA COMENTARIO, el nombre del
comentarista (`profileName`), su id (`profileId`), la URL de su perfil
(`profileUrl`) y su foto (`profilePicture`). Eso es dato personal bajo la
LFPDPPP y la CPRA en cuanto va atado a la frase, y a diferencia de YouTube
Meta no concede ningun plazo de retencion por escrito. Asi que ninguno de esos
campos llega al cache: `_limpiar_comentario` construye su salida campo por
campo y `IDENTIDAD_COMENTARIO` es documental, no una lista de la que se resta.
El id del comentario tampoco: es sha256(post|texto plegado), como en las otras
dos plataformas.

## Paginas si, busqueda por palabra no (por ahora)

`apify~facebook-posts-scraper` lee la pagina publica de una marca sin iniciar
sesion: es lo que docs/PLAN.md seccion 3 permite. Cobra ~2 USD por 1,000
posts y acepta `onlyPostsNewerThan`, que recorta lo facturado a la ventana.

La BUSQUEDA por palabra es otra cosa. El unico actor que la hace
(`scraper_one~facebook-posts-search`) declara una entrada sin cookies, asi que
la guardia de pulso/apify.py lo dejaria pasar; pero la pagina de busqueda de
Facebook exige sesion para cualquier visitante, o sea que el proveedor casi
con certeza busca con cuentas propias. AGENTS.md refusa el raspado logueado
«whether the login is yours or a vendor's», y esa regla no distingue quien
pone la cuenta. Por eso `ACTOR_BUSQUEDA` es None y `_entrada_busqueda` lanza
`ActorProhibido`: el origen `busqueda` queda cableado en pulso/consultas.py
para que encenderlo sea un cambio de datos, pero encenderlo es una decision
legal del cliente y queda registrada en docs/PLAN.md sea cual sea.

El 23 de septiembre de 2026 el cliente la tomo, y para UN solo camino: la
busqueda en vivo de un termino del sitio (web/src/lib/redes-en-vivo/), detras
de un boton y con topes, sabiendo que el proveedor inicia sesion y sin opinion
legal todavia. Aqui NO cambia nada: `ACTOR_BUSQUEDA` sigue en None y las
consultas programadas siguen leyendo solo paginas. Encenderla tambien aqui es
una linea, y una decision aparte que tiene que quedar escrita igual.

## Lo que el actor publica y lo que no

Facebook SI publica compartidos (`shares`): un 0 es cero medido y siempre
viaja, como en TikTok. No publica guardados. `viewsCount` solo existe en
video y solo se emite si es mayor que 0, con la regla compartida: un cero se
leeria como «nadie lo vio» y no como «no es video».

La zona sale del texto del post con el gacetero, con `ambito="nacional"` por
omision: la pagina de una marca no es un lugar, y estamparle uno acreditaria
esa zona a todo post que no nombre ninguno (pulso/busquedas.py, El Imparcial
y Hermosillo). Un post que nombra Guadalajara queda `nacional/fuera`, no se
tira: es justo lo que una consulta por termino fue a buscar.
"""

import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit

from .apify import ActorProhibido
from .redes import _id_comentario, _titulo, zona_por_ambito

ACTOR_POSTS = "apify~facebook-posts-scraper"
ACTOR_COMENTARIOS = "apify~facebook-comments-scraper"
# Ver el encabezado: mientras sea None, el origen `busqueda` esta prohibido.
ACTOR_BUSQUEDA = None
PLATAFORMA = "facebook"
PREFIJO = "https://www.facebook.com/"

# Los comentarios en el orden que Facebook llama «mas relevantes» pero sin el
# filtro de la plataforma, que esconde los de cuentas nuevas y los que su
# propio modelo considera de baja calidad. Es la vista mas completa que el
# actor ofrece; RANKED_THREADED y RECENT_ACTIVITY son las otras dos.
VISTA_COMENTARIOS = "RANKED_UNFILTERED"

# Nunca entran al cache. Documental: `_limpiar_comentario` es lista blanca.
IDENTIDAD_COMENTARIO = ("profileName", "profileId", "profileUrl", "profilePicture",
                        "user", "commentId", "id", "facebookId", "feedbackId")

# Lo que cruza del registro del post al destacado ademas de lo comun.
CAMPOS_EXTRA = ("alcance", "publicado", "compartidos")

HOSTS = ("facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com",
         "mbasic.facebook.com")

RE_PAGINA = r"[A-Za-z0-9.\-_]{1,80}"
RE_POST = re.compile(r"^/(" + RE_PAGINA + r")/posts/([A-Za-z0-9]+)/?$")
RE_VIDEO = re.compile(r"^/(" + RE_PAGINA + r")/videos/(?:[^/]+/)?(\d+)/?$")
RE_REEL = re.compile(r"^/reel/(\d+)/?$")
RE_WATCH = re.compile(r"^/watch/?$")
RE_PERMALINK = re.compile(r"^/permalink\.php$")
# Rutas que parecen una pagina y no lo son: `/permalink.php/posts/…` no existe,
# pero `/groups/x/posts/1` y `/profile.php` si, y un perfil personal no es una
# fuente de este modulo.
RESERVADAS = ("groups", "profile.php", "photo.php", "photo", "events", "marketplace",
              "watch", "reel", "stories", "share", "login", "people")


def url_pagina(pagina):
    """URL publica de una pagina a partir de su slug (con o sin @ o URL)."""
    slug = (pagina or "").strip()
    if slug.startswith("http"):
        slug = urlsplit(slug).path
    slug = slug.strip("/").lstrip("@")
    return PREFIJO + slug + "/"


def _url_post(url):
    """URL canonica del post, o None si no es un post de pagina.

    Canoniza el host (m., web., mbasic. y el desnudo -> www.), tira la query
    de rastreo (`__cft__`, `__tn__`, `mibextid`…) y conserva SOLO lo que
    identifica al post: en `permalink.php` son `story_fbid` e `id`, y en
    `/watch/` es `v`. Sin esto las dos pasadas -- el post viene con una forma
    y su comentario con otra -- no cruzan, `cosechados` queda en 0 y nada
    avisa (es la leccion de pulso/tiktok.py).
    """
    if not isinstance(url, str) or not url.strip():
        return None
    p = urlsplit(url.strip())
    host = (p.hostname or "").lower()
    if host not in HOSTS:
        return None
    ruta = p.path or "/"
    query = dict(parse_qsl(p.query, keep_blank_values=False))

    if RE_PERMALINK.match(ruta):
        historia, pagina = query.get("story_fbid"), query.get("id")
        if not historia or not pagina:
            return None
        return PREFIJO + "permalink.php?" + urlencode(
            (("story_fbid", historia), ("id", pagina)))
    if RE_WATCH.match(ruta):
        v = query.get("v")
        if not v or not v.isdigit():
            return None
        return PREFIJO + "watch/?v=" + v
    m = RE_REEL.match(ruta)
    if m:
        return PREFIJO + "reel/" + m.group(1)
    m = RE_POST.match(ruta)
    if m and m.group(1).lower() not in RESERVADAS:
        return PREFIJO + "{}/posts/{}".format(m.group(1), m.group(2))
    m = RE_VIDEO.match(ruta)
    if m and m.group(1).lower() not in RESERVADAS:
        return PREFIJO + "{}/videos/{}".format(m.group(1), m.group(2))
    return None


def _publicado(item):
    """Fecha-hora de publicacion en el formato de `ahora` (ISO con +00:00).

    El actor trae `time` como "2026-09-10T15:00:00.000Z" y `timestamp` como
    epoch en segundos. Se normaliza a UTC sin microsegundos para poder
    comparar como fecha-hora y no como texto.
    """
    t = item.get("timestamp")
    if isinstance(t, (int, float)) and not isinstance(t, bool) and t > 0:
        # Algunos actores mandan milisegundos; trece digitos son ms.
        segundos = int(t) // 1000 if t > 10 ** 11 else int(t)
        return datetime.fromtimestamp(segundos, timezone.utc).isoformat()
    iso = item.get("time") or item.get("date")
    if isinstance(iso, str) and iso.strip():
        try:
            dt = datetime.fromisoformat(iso.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()
    return None


def _tipo(item):
    """video | imagen | otro. El actor no trae un campo de tipo: se infiere de
    la URL y de la lista `media`, y ante la duda es `otro`."""
    url = item.get("url") or item.get("topLevelUrl") or ""
    if item.get("isVideo") or "/videos/" in url or "/reel/" in url or "/watch" in url:
        return "video"
    media = item.get("media")
    if isinstance(media, list) and media:
        tipos = {str((m or {}).get("__typename") or "").lower() for m in media
                 if isinstance(m, dict)}
        if "video" in tipos:
            return "video"
        if "photo" in tipos or "image" in tipos:
            return "imagen"
    if item.get("image") or item.get("photo"):
        return "imagen"
    return "otro"


def _limpiar_post(item, fuente, ahora, ambito="nacional"):
    """Lista blanca del item de post. Devuelve (registro, motivo_de_descarte).

    `fuente` es la fila de pulso/consultas.py::_fuentes: trae `cuenta` (el id
    del termino), `origen` (pagina | busqueda) y `valor` (el slug). El
    motivo es None cuando hay registro; si no: 'sin_url', 'anuncio',
    'sin_fecha', 'futuro' o 'fuera'.
    """
    url = _url_post(item.get("url") or item.get("topLevelUrl") or item.get("postUrl") or "")
    if not url:
        return None, "sin_url"
    if item.get("isSponsored") or item.get("isAd"):
        return None, "anuncio"
    publicado = _publicado(item)
    if not publicado:
        return None, "sin_fecha"
    if datetime.fromisoformat(publicado) > datetime.fromisoformat(ahora):
        return None, "futuro"
    texto = item.get("text") or item.get("message") or ""
    zona, alc = zona_por_ambito(texto, ambito)
    if zona is None:
        return None, "fuera"

    salida = {
        "url": url,
        "cuenta": fuente["cuenta"],
        "origen": fuente["origen"],
        "fuente": fuente["valor"],
        "zona": zona,
        "alcance": alc,
        "publicado": publicado,
        "fecha": publicado[:10],
        "titulo": _titulo(texto),
        "tipo": _tipo(item),
        "likes": max(0, int(item.get("likes") or item.get("reactionCount") or 0)),
        "comentarios": max(0, int(item.get("comments") or item.get("commentCount") or 0)),
        # Facebook SI publica compartidos: un 0 es cero medido y siempre viaja.
        "compartidos": max(0, int(item.get("shares") or item.get("shareCount") or 0)),
    }
    vistas = max(0, int(item.get("viewsCount") or item.get("videoViewCount") or 0))
    if vistas > 0:
        salida["reproducciones"] = vistas
    return salida, None


def _limpiar_comentario(item, url, fuente, zona):
    """Deja solo lo que se puede guardar. La identidad se tira aqui.

    El comentario hereda la zona de su post (`zona_cuenta`, la clave del
    esquema compartido) y el idioma de la fuente, nunca del texto.
    """
    texto = (item.get("text") or "").strip()
    if not texto:
        return None
    return {
        "id": _id_comentario(url, texto),
        "texto": texto,
        "post": url,
        "cuenta": fuente["cuenta"],
        "zona_cuenta": zona or "nacional",
        "idioma": fuente.get("idioma", "es"),
        "fecha": (item.get("date") or "")[:10],
        "likes": max(0, int(item.get("likesCount") or 0)),
        "respuestas": max(0, int(item.get("commentsCount") or 0)),
        "plataforma": PLATAFORMA,
    }


def _url_comentario(item, pedidas):
    """El post al que pertenece un comentario, entre las URLs pedidas.

    `inputUrl` es la URL tal cual se pidio y cruza exacta; si no viene,
    `facebookUrl` es la del post en la forma del actor y se canoniza; si
    tampoco, cae a la primera pedida y se nota en el conteo por post, nunca
    en el conteo por termino.
    """
    entrada = item.get("inputUrl")
    if isinstance(entrada, str) and entrada in pedidas:
        return entrada
    canon = _url_post(entrada or "")
    if canon and canon in pedidas:
        return canon
    canon = _url_post(item.get("facebookUrl") or item.get("postUrl") or "")
    if canon:
        return canon
    return pedidas[0]


def _entrada_pagina(url, cuantos, dias):
    """Entrada del actor de posts para UNA pagina. Sin sesion: pasa la guardia."""
    return {
        "startUrls": [{"url": url}],
        "resultsLimit": cuantos,
        # Recorta lo FACTURADO a la ventana. La ventana de verdad se impone
        # en pulso/consultas.py sobre `publicado`, como en TikTok.
        "onlyPostsNewerThan": "{} days".format(dias),
    }


def _entrada_comentarios(urls, cuantos, dias):
    """Entrada del actor de comentarios para varias URLs de post."""
    return {
        "startUrls": [{"url": u} for u in urls],
        "resultsLimit": cuantos,
        "viewOption": VISTA_COMENTARIOS,
        "onlyCommentsNewerThan": "{} days".format(dias),
    }


def _entrada_busqueda(consulta, cuantos, dias):
    """Prohibida mientras ACTOR_BUSQUEDA sea None. Ver el encabezado."""
    if ACTOR_BUSQUEDA is None:
        raise ActorProhibido(
            "la busqueda por palabra en Facebook esta apagada: la pagina de busqueda "
            "exige sesion para cualquier visitante, asi que el proveedor casi con "
            "certeza busca con cuentas propias, y AGENTS.md refusa el raspado "
            "logueado sea de quien sea la cuenta. Es decision legal del cliente; "
            "mientras tanto solo se leen paginas.")
    return {"query": consulta, "resultsLimit": cuantos,
            "onlyPostsNewerThan": "{} days".format(dias)}
