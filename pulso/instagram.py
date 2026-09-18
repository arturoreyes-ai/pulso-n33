"""Comentarios publicos de Instagram, cosechados por Apify y sin sesion.

El actor es apify~instagram-scraper, que declara extraer "solo los
comentarios que ve un usuario NO logueado". Esa frase es la condicion de
entrada, no un detalle: es lo que mantiene el caso dentro de lo que
docs/PLAN.md seccion 3 permite. pulso/apify.py rechaza cualquier actor cuya
entrada traiga cookies o credenciales, y esa guardia cubre a este modulo.

## Son dos pasadas, y las dos se pagan

Es la restriccion que ordena todo el diseno: **`resultsType: "comments"` solo
acepta URLs de POST**, no de perfil. O sea que no hay forma de pedir "los
comentarios de esta cuenta" en una llamada. Hay que:

    pasada 1   resultsType=posts      sobre los perfiles  -> URLs de post
    pasada 2   resultsType=comments   sobre esas URLs     -> comentarios

Apify cobra por resultado en las dos. Un perfil con 5 posts y 15 comentarios
por post cuesta 5 + 75 resultados, no 75. El presupuesto de pulso/apify.py
cuenta las dos pasadas contra el mismo tope, porque la factura tampoco las
distingue.

## El registro de posts ya vistos existe para no pagar dos veces

Los comentarios de un post de hace tres dias no cambian casi nada, pero el
actor los vuelve a devolver enteros y los vuelve a cobrar enteros. Sin
`vistos.json`, un cron de cuatro corridas al dia paga cuatro veces por los
mismos comentarios y el deduplicado del cache lo esconde: los conteos salen
bien y la factura sale mal. Por eso un post no se vuelve a cosechar antes de
`DIAS_ENTRE_COSECHAS`, y el registro vive en cache/ junto al texto crudo.

## Retencion: 30 dias, y menos derecho a ellos que YouTube

Misma separacion que pulso/conversacion.py -- crudo en cache/ ignorado por git,
derivados en data/ -- pero el fundamento es mas debil, no mas fuerte. YouTube
al menos CONCEDE 30 dias por politica escrita (III.E.4.d). Meta no concede
nada: lo que ata aqui son sus terminos mas la LFPDPPP mexicana y la CPRA
californiana, porque un comentario con nombre propio es dato personal en las
dos. Ante la duda se aplica el plazo mas corto que ya esta implementado.

De ahi una diferencia real con el modulo de YouTube: **la identidad se tira
al momento de ingerir, no al derivar**. `ownerUsername`, `ownerProfilePicUrl`
y `ownerId` no llegan ni al cache. No hace falta ninguno para ningun conteo
del panel, y lo que no se guarda no se puede filtrar ni hay que borrarlo.

El id del comentario tampoco es el de Instagram: es sha256(post|texto
plegado), que es estable entre corridas -- o sea idempotente -- y no ata la
frase a una cuenta. Dos comentarios identicos en el mismo post colapsan en
uno a proposito, igual que en YouTube: el mismo comentario copiado dos veces
no son dos opiniones.

## El texto SI se publica, pero nunca se commitea

El 8 de septiembre de 2026 la direccion del cliente pidio ver el texto de los
comentarios mas votados de cada post en el tablero. Eso revierte, solo para
Instagram, el "nunca texto literal" que rige en YouTube (ahi hay politica
escrita; aqui la decision es del cliente y queda registrada en docs/PLAN.md).

Lo que NO cambia es lo que importa del canal: el texto no entra a GIT. Va a
`data/redes-comentarios.json`, que `.gitignore` excluye por nombre
(`data/*-comentarios.json`) y que `publicar_comentarios()` regenera en cada
corrida desde el cache. El sitio lo copia al construir con el resto de data/.
Hasta el 17 de septiembre de 2026 vivio en una carpeta aparte, efimero/, que
costaba un bucle de copia, un copytree, un respaldo en el servidor de
desarrollo y una derivacion de directorio hermano en el validador; lo que la
sustituye es una linea de .gitignore que pulso/validador.py verifica en cuanto
el archivo existe. Asi la retencion de 30 dias sigue siendo ejecutable -- lo
que se purga del cache desaparece de la pagina en la corrida siguiente -- y
el historial de git no conserva ni una frase. La identidad sigue sin
ingerirse: la pagina muestra el comentario, nunca quien lo escribio.

## Destacados: el post, no el comentario

`data/redes.json` tambien lleva los posts de las ultimas 24 horas con mas
likes (`destacados`), y de cada uno lo que dice el medio -- la primera linea
del pie como titular, la URL, la hora exacta de publicacion, likes,
comentarios, reproducciones -- mas los conteos de sus comentarios. El pie es
del medio y no de un particular: es la regla "titular, fuente y liga" de la
prensa aplicada a Instagram.

La ventana fue de 7 dias sobre `fecha` hasta el 10 de septiembre de 2026,
cuando el cliente pidio ver "lo ultimo de las 24 horas" de sus cuentas. Desde
entonces se mide en horas sobre `publicado`, igual que TikTok, y un corte
anterior sigue siendo valido para el validador (aviso, no error): data/ lo
escribe el bot y no se edita a mano. Dos consecuencias que hay que saber:

- El cache que restaura el cron (`actions/cache`) trae registros sin
  `publicado`. La primera pasada los pisa (`{**viejo, **limpio}`) para los
  ultimos N posts de cada cuenta, y los demas quedan fuera de la ventana
  hasta que la retencion los pode. No hay nada que migrar.
- Con ventana de 24 h, `dias_entre_cosechas` solo deduplica las corridas del
  dia: un post sale de la ventana antes de volverse a cosechar. `cosechados`
  y sus conteos son la foto de la primera cosecha; likes, comentarios y
  reproducciones se refrescan en cada corrida (misma asimetria que TikTok).
  Y "los de mas likes de 24 horas" son los de mas likes entre los ultimos
  `posts_por_cuenta` que cada corrida ve de cada cuenta: una cuenta que
  publica mas de cinco veces entre corridas pierde posts, y subir ese numero
  encarece las dos pasadas.

`_limpiar_post()` es una LISTA BLANCA y no una resta de IDENTIDAD, porque el
item de post trae `latestComments[]` y `firstComment` con texto de comentarios
y su `ownerUsername`, campos que ninguna lista de identidad contempla.

Tres limites del dato que hay que saber antes de leerlo:

- Instagram no publica compartidos, reposts ni guardados de cuentas ajenas, y
  el actor no trae ningun campo para eso. El panel lo rotula "sin dato".
- `likesCount` llega en -1 cuando la cuenta oculta los likes. Se recorta a 0
  y el post se va al fondo del ranking; no se inventa un numero.
- Un post que ya salio de los ultimos N de su cuenta conserva la ultima
  metrica vista, sin marca de tiempo: anadirla haria que cada corrida
  ensuciara el diff de data/.

## Por que no hay porcentajes aqui

Los planes gratuitos de Apify devuelven ~15 comentarios por post. La cuarta
regla de PRODUCT.md dice que por debajo de 30 elementos se emiten conteos y
no porcentajes, asi que un post -- y muchas veces una cuenta entera en una
corrida -- cae debajo del minimo. Este modulo simplemente no calcula
porcentajes en ningun nivel; el tablero los saca de sumas mas grandes o no
los saca.

## Zona

A diferencia de una busqueda (ver pulso/busquedas.py), una cuenta SI lleva
zona, por la misma razon que la lleva un canal de YouTube en
config/canales.json: es un medio identificado y verificable, no una consulta
que devuelve lo que sea. Un hashtag no llevaria zona y por eso no hay
hashtags en la configuracion.
"""

from datetime import datetime, timezone

from .apify import Presupuesto, SinToken, correr_actor, token
# El nucleo neutro vive en pulso/redes.py desde que TikTok pidio "lo mismo".
# Se reexporta aqui para que `instagram.leer_cache`, `instagram.derivar` y
# compania sigan siendo la puerta de este modulo (y de sus pruebas).
from .redes import (  # noqa: F401  (reexportados a proposito)
    COMENTARIOS_MAXIMO, COMENTARIOS_VISIBLES, DESTACADOS_MAXIMO, DIAS_ENTRE_COSECHAS,
    ETIQUETAS_TONO, MENCION_ENMASCARADA, RE_MENCION, REGISTROS, RETENCION_DIAS,
    TEXTO_MAXIMO, TITULO_MAXIMO, UMBRAL_BRIGADA, _catalogo_cuentas, _conteo_tono,
    _contar_temas, _hoy, _id_comentario, _marcar_repetidos, _sin_palabras, _titulo,
    clasificar_cache, guardar_cache, guardar_publicaciones, guardar_vistos, leer_archivo,
    leer_cache, leer_publicaciones, leer_vistos, pendientes, purgar,
)
from . import redes as _redes

ACTOR_POSTS = "apify~instagram-scraper"
ACTOR_COMENTARIOS = "apify~instagram-scraper"
PLATAFORMA = "instagram"
CACHE = "cache/instagram"

# Nunca entran al cache. No hacen falta para ningun conteo y son dato
# personal bajo LFPDPPP y CPRA. La lista es documental: `_limpiar` y
# `_limpiar_post` construyen su salida campo por campo y no restan de esta.
IDENTIDAD = ("ownerUsername", "ownerProfilePicUrl", "ownerId", "owner",
             "ownerIsVerified", "username", "ownerFullName", "latestComments",
             "firstComment", "taggedUsers")

# Ventana de los posts destacados en data/redes.json, en horas sobre
# `publicado`, igual que TikTok. Hasta el 10 de septiembre de 2026 fue de 7
# dias sobre `fecha`; ese dia el cliente pidio "lo ultimo de las 24 horas".
# Es la omision: manda `cosecha.ventana_horas` en config/instagram.json. Se
# calcula con `ahora` inyectado; el tablero nunca la recalcula.
VENTANA_HORAS = 24

# Lo que cruza del registro del post a data/redes.json ademas de lo comun: la
# hora exacta, que es sobre lo que se mide la ventana y se ordena el dia.
CAMPOS_EXTRA = ("publicado",)

# El actor devuelve el tipo en ingles; en data/ los valores van en espanol.
TIPOS = {"Image": "imagen", "Video": "video", "Sidecar": "carrusel"}


def _limpiar(comentario, post_url, cuenta):
    """Deja solo lo que se puede guardar. La identidad se tira aqui."""
    texto = (comentario.get("text") or "").strip()
    if not texto:
        return None
    return {
        "id": _id_comentario(post_url, texto),
        "texto": texto,
        "post": post_url,
        "cuenta": cuenta["id"],
        "zona_cuenta": cuenta.get("zona") or "estatal",
        "idioma": cuenta.get("idioma", "es"),
        "fecha": (comentario.get("timestamp") or "")[:10],
        "likes": int(comentario.get("likesCount") or 0),
        "respuestas": int(comentario.get("repliesCount") or 0),
        "plataforma": PLATAFORMA,
    }


def _publicado(item):
    """Hora exacta de publicacion en UTC, sin microsegundos, en el mismo
    formato que `ahora` ("2026-09-01T10:00:00+00:00"). Sin timestamp, None.

    El actor la trae como "2026-09-01T10:00:00.000Z". El replace de la Z es
    el mismo truco del validador: fromisoformat no la acepta en Python 3.9.
    Una hora sin zona se toma como UTC en vez de pasarla por astimezone(),
    que en un datetime ingenuo usa la zona de la maquina y haria que el runner
    y una laptop en Tijuana escribieran archivos distintos.
    """
    crudo = item.get("timestamp")
    if not isinstance(crudo, str) or not crudo.strip():
        return None
    try:
        dt = datetime.fromisoformat(crudo.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.replace(microsecond=0).isoformat()


def _limpiar_post(item, cuenta):
    """Lista blanca del item de post. Ver el encabezado: no es una resta.

    `likesCount` viene en -1 cuando la cuenta oculta los likes; se recorta a
    0. `reproducciones` solo existe en video, y solo si es mayor que 0: un
    cero aqui se leeria como "nadie lo vio" y no como "no es video".
    `publicado` es la hora exacta y va solo si el actor la trajo; `fecha` es
    su dia y va siempre, aunque vacia, porque es la llave de la retencion del
    catalogo (redes.guardar_publicaciones poda lo que no tiene fecha).
    """
    url = (item.get("url") or item.get("postUrl") or "").strip()
    if not url:
        return None
    publicado = _publicado(item)
    salida = {
        "url": url,
        "cuenta": cuenta["id"],
        "zona": cuenta.get("zona") or "estatal",
        "fecha": publicado[:10] if publicado else "",
        "titulo": _titulo(item.get("caption")),
        "tipo": TIPOS.get(item.get("type"), "otro"),
        "likes": max(0, int(item.get("likesCount") or 0)),
        "comentarios": max(0, int(item.get("commentsCount") or 0)),
    }
    vistas = max(int(item.get("videoViewCount") or 0), int(item.get("videoPlayCount") or 0))
    if vistas > 0:
        salida["reproducciones"] = vistas
    if publicado:
        salida["publicado"] = publicado
    return salida


# ------------------------------------------------------------- verificacion

# Debajo de esto una cuenta no es el medio: es un handle ocupado por alguien
# que lo aparto y nunca publico. Los numeros salen de la sonda real del
# 8 de septiembre de 2026, donde @zetatijuana tenia 16 seguidores y 0 posts
# mientras el medio de verdad publica a diario.
MINIMO_POSTS = 20
MINIMO_SEGUIDORES = 1000


def sondear(handles, tok=None, entorno=None):
    """`resultsType: details` sobre varios handles: 1 resultado por cuenta.

    Existe porque adivinar el handle a partir del nombre del medio falla, y
    falla EN SILENCIO. La sonda del 8 de septiembre de 2026 sobre los seis
    handles derivados devolvio: tres cuentas ocupadas con 0 publicaciones,
    dos inexistentes, y `@afnoticias`, que es un portal de Tocantins, Brasil,
    con 113 mil seguidores y biografia en portugues. Ninguno de los cinco
    habria dado error al cosechar: habrian dado vacio, o peor, texto en
    portugues metido a un modelo de tono espanol, que no devuelve error sino
    una etiqueta plausible.

    Es barato a proposito -- un resultado por handle -- para que verificar
    siempre salga mas barato que cosechar a ciegas.
    """
    urls = ["https://www.instagram.com/{}/".format(h.lstrip("@")) for h in handles]
    items = correr_actor(ACTOR_POSTS,
                         {"directUrls": urls, "resultsType": "details"},
                         tok or token(entorno), len(urls) + 5)

    salida = []
    for it in items:
        posts = it.get("postsCount")
        seguidores = it.get("followersCount")
        # Cada rama mira el campo que TIENE, nunca el que falta. La primera
        # version daba 'no_existe' en cuanto postsCount venia nulo, y el
        # actor lo devuelve nulo a veces: asi reprobo @zeta.tijuana, que
        # tiene 49,525 seguidores y es la cuenta real del semanario. Un
        # veredicto falso aqui es caro en las dos direcciones -- descarta el
        # medio bueno y deja pasar el handle ocupado.
        if it.get("error") or (posts is None and seguidores is None):
            veredicto = "no_existe"
        elif posts is not None and posts < MINIMO_POSTS:
            veredicto = "ocupado"
        elif seguidores is not None and seguidores < MINIMO_SEGUIDORES:
            veredicto = "dudoso"
        else:
            veredicto = "vivo"
        salida.append({
            "handle": "@" + (it.get("username") or "?"),
            "nombre": it.get("fullName") or "",
            "seguidores": seguidores,
            "posts": posts,
            "veredicto": veredicto,
            # La biografia se imprime para que un humano vea "Tocantins" o
            # "Hermosillo": la region no se puede deducir del handle y el
            # actor no la declara.
            "bio": (it.get("biography") or "").replace("\n", " ")[:110],
        })
    return sorted(salida, key=lambda s: s["handle"])


# --------------------------------------------------------------- cosecha

def _urls_de_posts(items):
    salida = []
    for p in items:
        u = (p.get("url") or p.get("postUrl") or "").strip()
        if u and u not in salida:
            salida.append(u)
    return salida


def cosechar(cuentas, ahora, tok=None, presupuesto=None, cache="cache/instagram",
             posts_por_cuenta=5, comentarios_por_post=15, entorno=None):
    """Dos pasadas contra Apify. Devuelve (nuevos, salud, gasto).

    Sin token no truena: devuelve vacio y lo dice en `salud`, igual que el
    panel de YouTube sin llave. El tablero tiene que poder mostrar prensa sin
    redes.
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

    for cuenta in activas:
        entrada_posts = {
            "directUrls": ["https://www.instagram.com/{}/".format(cuenta["handle"].lstrip("@"))],
            "resultsType": "posts",
            "resultsLimit": posts_por_cuenta,
        }
        try:
            posts = correr_actor(ACTOR_POSTS, entrada_posts, tok,
                                 min(posts_por_cuenta, reparto))
            presupuesto.cobrar(cuenta["id"], len(posts))
        except Exception as e:
            salud.append({"cuenta": cuenta["id"], "estado": "fallo",
                          "error": "{}: {}".format(type(e).__name__, e)[:200],
                          "posts": 0, "comentarios": 0})
            continue

        urls = _urls_de_posts(posts)
        # El catalogo se actualiza ANTES del freno de costo: una cuenta sin
        # posts nuevos que cosechar sigue teniendo likes que cambian, y sin
        # esto sus destacados se congelarian en la primera lectura.
        for p in posts:
            limpio = _limpiar_post(p, cuenta)
            if limpio:
                publicaciones[limpio["url"]] = {**publicaciones.get(limpio["url"], {}), **limpio}
        # El freno de costo: los posts cosechados hace menos de tres dias no
        # se vuelven a pedir. Ver el encabezado.
        toca = pendientes(urls, vistos, ahora)
        if not toca:
            salud.append({"cuenta": cuenta["id"], "estado": "ok", "posts": len(urls),
                          "comentarios": 0, "crudos": 0,
                          "nota": "sin posts nuevos que cosechar"})
            continue

        entrada_coms = {
            "directUrls": toca,
            "resultsType": "comments",
            "resultsLimit": comentarios_por_post,
        }
        try:
            crudos = correr_actor(ACTOR_COMENTARIOS, entrada_coms, tok,
                                  max(1, reparto - len(posts)))
            presupuesto.cobrar(cuenta["id"], len(crudos))
        except Exception as e:
            salud.append({"cuenta": cuenta["id"], "estado": "fallo",
                          "error": "{}: {}".format(type(e).__name__, e)[:200],
                          "posts": len(urls), "comentarios": 0})
            continue

        # postUrl viene en cada comentario cuando se piden varias URLs de una
        # vez; si el actor no lo trae, cae a la primera pedida y se nota en
        # el conteo por post, nunca en el conteo por cuenta.
        ingeridos = 0
        for c in crudos:
            url = (c.get("postUrl") or c.get("inputUrl") or toca[0]).strip()
            limpio = _limpiar(c, url, cuenta)
            if limpio:
                nuevos.append(limpio)
                ingeridos += 1

        for u in toca:
            vistos[u] = _hoy(ahora)
        # `comentarios` es lo INGERIDO y `crudos` lo FACTURADO, y no son lo
        # mismo: un post sin comentarios devuelve igual un item de relleno con
        # `text` vacio, que _limpiar() descarta pero Apify ya cobro. En la
        # primera cosecha (2026-09-08) El Vigia y Sintesis reportaban 5
        # comentarios cada uno y habian ingerido CERO; los cinco eran relleno.
        # Reportar solo el crudo hacia parecer sana una cuenta muda.
        salud.append({"cuenta": cuenta["id"], "estado": "ok", "posts": len(urls),
                      "comentarios": ingeridos, "crudos": len(crudos)})

    guardar_vistos(vistos, cache)
    guardar_publicaciones(publicaciones, ahora, cache)
    guardar_cache(nuevos, ahora, cache)
    return nuevos, sorted(salud, key=lambda s: s["cuenta"]), presupuesto.resumen()


# --------------------------------------------------------------- derivados

def derivar(comentarios, ahora, salud, gasto, temas=None, publicaciones=None,
            cuentas=None, ventana_horas=VENTANA_HORAS):
    """data/redes.json: conteos y posts destacados de las ultimas 24 horas.

    Ver pulso/redes.py::derivar; aqui solo se fijan la plataforma, la ventana
    (en horas desde el 10 de septiembre de 2026; `cosecha.ventana_horas` del
    config manda), que `publicado` cruza al destacado -- sin el, el validador
    no puede medir la ventana ni el tablero ordenar el dia por hora -- y que
    los destacados se reparten por turnos entre cuentas.

    El reparto (`turnos`) se enciende AQUI y no en el nucleo porque aqui
    `cuenta` es un medio con sede declarada, que es lo que se quiere repartir.
    En TikTok `cuenta` es el id de una busqueda y repartirla seria repartir el
    mecanismo; ver pulso/redes.py::_por_turnos para el caso que lo motivo.
    """
    return _redes.derivar(comentarios, ahora, salud, gasto, temas, publicaciones,
                          cuentas, plataforma=PLATAFORMA, ventana_horas=ventana_horas,
                          campos_extra=CAMPOS_EXTRA, turnos=True)


def publicar_comentarios(comentarios, destacados, ahora,
                         visibles=COMENTARIOS_VISIBLES, maximo=COMENTARIOS_MAXIMO,
                         texto_maximo=TEXTO_MAXIMO):
    """data/redes-comentarios.json (fuera de git). Ver pulso/redes.py::publicar_comentarios."""
    return _redes.publicar_comentarios(comentarios, destacados, ahora, visibles, maximo,
                                       texto_maximo, plataforma=PLATAFORMA)
