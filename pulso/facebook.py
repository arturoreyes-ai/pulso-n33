"""Paginas publicas de Facebook: lista blanca de los actores de Apify, sin sesion.

Tiene dos llamadores. pulso/consultas.py corre sus limpiadores con su propio
bucle de dos pasadas, sobre las paginas de un termino; y desde el 23 de
septiembre de 2026 `cosechar`, abajo, lee las paginas de medios de
config/facebook.json para la pagina de Redes (ver la ultima seccion). Aqui
vive lo que solo Facebook sabe: como se canoniza la URL de un post, que
campos trae cada actor y cuales NO pueden sobrevivir a la ingesta.

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

## Paginas de medios en /redes (23 de septiembre de 2026)

El cliente pidio Facebook en la pagina de Redes con cinco paginas: Blanco y
Negro, Noticias de Tijuana, PSN, TV Azteca Baja California y Blanco y Rojo.
`cosechar` y `derivar` de abajo escriben data/facebook.json con el mismo
contrato que data/redes.json, y el texto a data/facebook-comentarios.json,
fuera de git por el glob de siempre. Las consultas no cambian.

Tres decisiones, cada una con su caso:

- **Cada fila lleva `ambito`, nunca `zona`.** Es la leccion de El Vigia en
  YouTube: la pagina de un medio del corredor publica lo que sea. En el
  sondeo del 23 de septiembre TV Azteca Baja California traia a la alcaldesa
  de San Quintin y un avion cazahuracanes en la misma hora, y Blanco y Negro
  la captura de «Don Flaco» del Cartel de Sinaloa. Cada post se zonifica por
  su primera linea (redes.zona_por_titulo) y el residuo de un medio del
  corredor es Corredor, «sin precisar» (redes.residuo_de_medio).
- **Un post que solo comparte otro no entra** (`compartido`). Los tres posts
  sondeados de Blanco y Rojo eran eso: su texto era un enlace
  `facebook.com/share/p/...` y el contenido era de La Prensa Baja California.
  Titularlo con el pie ajeno le acreditaria a Blanco y Rojo lo que publico
  otro -- y el post compartido puede ser de una persona --; titularlo con el
  enlace publica basura. Se cuenta en `salud[].compartidos` y no se pagan sus
  comentarios.
- **Los comentarios se pagan solo para los posts que pueden destacar.** Estas
  paginas publican decenas de veces al dia. `comentarios_para` (4 por pagina
  y corrida) elige los de mas reacciones dentro de la ventana que no se han
  cosechado; los demas entran al catalogo con sus cifras y sin texto.

`likes` es el total de reacciones (`likes` del actor, que ya suma me gusta,
me encanta, me asombra...), no solo los me gusta: es lo que Facebook muestra
junto al post y lo que ordena el corte.
"""

import math
import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit

from .apify import ActorProhibido, Presupuesto, SinToken, correr_actor, token
from .redes import (_dentro_por_horas, _hoy, _id_comentario, _titulo, guardar_cache,
                    guardar_publicaciones, guardar_vistos, leer_publicaciones, leer_vistos,
                    pendientes, purgar, residuo_de_medio, zona_por_ambito, zona_por_titulo)
# Reexportados para `pulso facebook`, igual que instagram.leer_cache.
from .redes import clasificar_cache, leer_cache  # noqa: F401
from . import redes as _redes

ACTOR_POSTS = "apify~facebook-posts-scraper"
ACTOR_COMENTARIOS = "apify~facebook-comments-scraper"
# Ver el encabezado: mientras sea None, el origen `busqueda` esta prohibido.
ACTOR_BUSQUEDA = None
PLATAFORMA = "facebook"
PREFIJO = "https://www.facebook.com/"
CACHE = "cache/facebook"
# Ventana de los destacados de data/facebook.json, en horas sobre `publicado`,
# como Instagram y TikTok. Manda `cosecha.ventana_horas` de config/facebook.json.
VENTANA_HORAS = 24

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


def _limpiar_post(item, fuente, ahora, ambito="nacional", zonificar=None):
    """Lista blanca del item de post. Devuelve (registro, motivo_de_descarte).

    `zonificar(titulo, texto)` devuelve (zona, alcance). Por omision es la
    tabla de la consulta: el texto entero con `ambito`. Las paginas de /redes
    pasan la de un medio (titular primero y residuo de corredor; ver `_zona`).

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
    if zonificar is None:
        zona, alc = zona_por_ambito(texto, ambito)
    else:
        zona, alc = zonificar(_titulo(texto), texto)
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


# ------------------------------------------------------ paginas de /redes

# Un enlace suelto no es un titular. Sirve para reconocer el post que solo
# comparte otro: su texto, sin enlaces, queda vacio.
RE_ENLACE = re.compile(r"https?://\S+")

# Lo que cruza del registro a data/facebook.json ademas de lo comun.
CAMPOS_EXTRA_PAGINAS = ("alcance", "publicado")
# Facebook SI publica compartidos: van con las cifras obligatorias.
CIFRAS = ("likes", "comentarios", "compartidos")


def _zona(ambito):
    """La zonificacion de un medio: el titular manda, el pie desempata, y el
    residuo regional sin lugar es Corredor. Es la de Instagram con `ambito`."""
    def zonificar(titulo, texto):
        zona, alc = zona_por_titulo(titulo, texto, ambito)
        return residuo_de_medio(zona, alc, ambito, texto)
    return zonificar


def _limpiar_de_pagina(item, cuenta, ahora):
    """(registro, motivo) de un post de una pagina de config/facebook.json.

    El registro es el de `_limpiar_post` sin `origen` ni `fuente`, que son de
    la consulta: aqui la fuente ES la cuenta. `compartido` se decide antes que
    nada, porque el pie de un post compartido es un enlace y el gacetero lo
    leeria como «ningun lugar».
    """
    texto = item.get("text") or item.get("message") or ""
    if item.get("sharedPost") and not RE_ENLACE.sub("", texto).strip():
        return None, "compartido"
    fuente = {"cuenta": cuenta["id"], "origen": "pagina", "valor": cuenta["pagina"]}
    limpio, motivo = _limpiar_post(item, fuente, ahora, zonificar=_zona(cuenta["ambito"]))
    if limpio:
        limpio.pop("origen", None)
        limpio.pop("fuente", None)
    return limpio, motivo


def _url_de_pagina(cuenta):
    """Una pagina sin nombre de usuario solo tiene id numerico, y su URL
    publica es `profile.php?id=`: es la forma que el sondeo del 23 de
    septiembre de 2026 probo con Blanco y Rojo."""
    pagina = cuenta["pagina"]
    if pagina.isdigit():
        return PREFIJO + "profile.php?id=" + pagina
    return url_pagina(pagina)


def _dias(ventana_horas):
    """`onlyPostsNewerThan` va en dias enteros; se redondea hacia arriba y la
    ventana de verdad se impone sobre `publicado`."""
    return max(1, int(math.ceil(ventana_horas / 24.0)))


def sondear(cuentas, ahora, cuantos=3, tok=None, entorno=None):
    """Los ultimos `cuantos` posts de cada pagina, limpios como los limpiaria
    la cosecha, sin comentarios y sin escribir nada. Cuesta `cuantos`
    resultados por pagina.

    Es el `--sondear --muestra` de Instagram en una sola llamada: aqui no hay
    un resultado de «detalles» barato, y lo que delata una pagina equivocada
    es lo que sus posts nombran (@noticiasensenada era de Buenos Aires).
    """
    tok = tok or token(entorno)
    salida = []
    for c in cuentas:
        items = correr_actor(ACTOR_POSTS, _entrada_pagina(_url_de_pagina(c), cuantos, 7),
                             tok, cuantos)
        posts, descartes, nombre = [], {}, None
        for it in items[:cuantos]:
            nombre = nombre or (it.get("user") or {}).get("name") or it.get("pageName")
            limpio, motivo = _limpiar_de_pagina(it, c, ahora)
            if limpio:
                posts.append(limpio)
            else:
                descartes[motivo] = descartes.get(motivo, 0) + 1
        salida.append({"cuenta": c["id"], "nombre": nombre, "posts": posts,
                       "descartes": dict(sorted(descartes.items()))})
    return salida


def cosechar(cuentas, ahora, tok=None, presupuesto=None, cache=CACHE, posts_por_pagina=8,
             comentarios_por_post=10, comentarios_para=4, ventana_horas=VENTANA_HORAS,
             dias_entre_cosechas=3, entorno=None):
    """Dos pasadas contra Apify por pagina. Devuelve (nuevos, salud, gasto).

    Igual que instagram.cosechar, con dos diferencias: la ventana se impone
    ANTES de pagar comentarios (el actor de posts filtra por dia, no por
    hora), y de lo que queda solo se pagan los `comentarios_para` de mas
    reacciones. Sin token no truena: lo dice en `salud`.
    """
    activas = [c for c in cuentas if c.get("activo") and c.get("verificado")]
    presupuesto = presupuesto or Presupuesto()
    salud, nuevos = [], []

    try:
        tok = tok or token(entorno)
    except SinToken as e:
        for c in activas:
            salud.append({"cuenta": c["id"], "estado": "sin_token", "error": str(e),
                          "posts": 0, "comentarios": 0})
        return [], sorted(salud, key=lambda s: s["cuenta"]), presupuesto.resumen()

    purgar(cache, ahora)
    vistos = leer_vistos(cache)
    publicaciones = leer_publicaciones(cache)
    reparto = presupuesto.reparto(len(activas))
    dentro = _dentro_por_horas(ahora, ventana_horas)

    for cuenta in activas:
        try:
            items = correr_actor(ACTOR_POSTS,
                                 _entrada_pagina(_url_de_pagina(cuenta), posts_por_pagina,
                                                 _dias(ventana_horas)),
                                 tok, min(posts_por_pagina, reparto))
            presupuesto.cobrar(cuenta["id"], len(items))
        except Exception as e:
            salud.append({"cuenta": cuenta["id"], "estado": "fallo",
                          "error": "{}: {}".format(type(e).__name__, e)[:200],
                          "posts": 0, "comentarios": 0})
            continue

        motivos, limpios = {}, []
        for it in items:
            limpio, motivo = _limpiar_de_pagina(it, cuenta, ahora)
            if limpio:
                publicaciones[limpio["url"]] = {**publicaciones.get(limpio["url"], {}), **limpio}
                limpios.append(limpio)
            else:
                motivos[motivo] = motivos.get(motivo, 0) + 1
        extra = {"fuera": motivos.get("fuera", 0), "compartidos": motivos.get("compartido", 0)}

        # Solo lo que esta en la ventana y no se cosecho hace poco, y de eso
        # los de mas reacciones: es el orden del corte, asi que se paga por lo
        # que tiene mas probabilidad de salir en pantalla.
        en_ventana = sorted((p for p in limpios if dentro(p)),
                            key=lambda p: (-p["likes"], -p["comentarios"], p["url"]))
        toca = pendientes([p["url"] for p in en_ventana], vistos, ahora,
                      dias_entre_cosechas)[:comentarios_para]
        zona_de = {p["url"]: p["zona"] for p in limpios}
        if not toca:
            salud.append({"cuenta": cuenta["id"], "estado": "ok", "posts": len(limpios),
                          "comentarios": 0, "crudos": 0,
                          "nota": "sin posts nuevos que cosechar", **extra})
            continue

        try:
            crudos = correr_actor(ACTOR_COMENTARIOS,
                                  _entrada_comentarios(toca, comentarios_por_post,
                                                       _dias(ventana_horas)),
                                  tok, max(1, min(comentarios_por_post * len(toca),
                                                  reparto - len(items))))
            presupuesto.cobrar(cuenta["id"], len(crudos))
        except Exception as e:
            salud.append({"cuenta": cuenta["id"], "estado": "fallo",
                          "error": "{}: {}".format(type(e).__name__, e)[:200],
                          "posts": len(limpios), "comentarios": 0, **extra})
            continue

        fila = {"cuenta": cuenta["id"], "idioma": cuenta.get("idioma", "es")}
        ingeridos = 0
        for c in crudos:
            url = _url_comentario(c, toca)
            limpio = _limpiar_comentario(c, url, fila, zona_de.get(url))
            if limpio:
                nuevos.append(limpio)
                ingeridos += 1
        for u in toca:
            vistos[u] = _hoy(ahora)
        salud.append({"cuenta": cuenta["id"], "estado": "ok", "posts": len(limpios),
                      "comentarios": ingeridos, "crudos": len(crudos), **extra})

    guardar_vistos(vistos, cache)
    guardar_publicaciones(publicaciones, ahora, cache)
    guardar_cache(nuevos, ahora, cache)
    return nuevos, sorted(salud, key=lambda s: s["cuenta"]), presupuesto.resumen()


def derivar(comentarios, ahora, salud, gasto, temas=None, publicaciones=None,
            cuentas=None, ventana_horas=VENTANA_HORAS):
    """data/facebook.json. Ver pulso/redes.py::derivar.

    Reparte por turnos como Instagram: aqui `cuenta` es un medio con nombre
    impreso, y Blanco y Negro, con cientos de reacciones por post, se llevaria
    el corte entero.
    """
    return _redes.derivar(comentarios, ahora, salud, gasto, temas, publicaciones,
                          cuentas, plataforma=PLATAFORMA, ventana_horas=ventana_horas,
                          campos_extra=CAMPOS_EXTRA_PAGINAS, turnos=True, cifras=CIFRAS)


def publicar_comentarios(comentarios, destacados, ahora):
    """data/facebook-comentarios.json (fuera de git). Ver redes.publicar_comentarios."""
    return _redes.publicar_comentarios(comentarios, destacados, ahora, plataforma=PLATAFORMA)
