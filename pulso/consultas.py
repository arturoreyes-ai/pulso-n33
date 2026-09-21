"""Consultas: que se dice de un TERMINO en redes (30 dias) y en la prensa (seis meses).

El 18 de septiembre de 2026 el cliente pidio saber que dicen las redes y la
prensa de tres terminos -- dos empresas y una persona: «Valente Marquez»,
«Vive la Baja», «Grupo Concordia» -- y entregarselo a su direccion en PDF.
Ninguno de los tres aparece en las ~6,000 notas del archivo de prensa, y la
seccion de Redes lee las ultimas 24 horas de cuentas de MEDIOS: el material
tiene que venir de fuentes vivas y de una ventana mas larga. De ahi este
modulo, con terminos configurados en config/consultas.json y FUERA del cron
hasta que la demo se juzgue.

## Un termino no es un lugar ni una cuenta

Es la decision que ordena el esquema. En Instagram y TikTok `cuenta` es un
medio con sede declarada o una busqueda; aqui `cuenta` es el id del termino
(`cq_vivelabaja`) y cada publicacion lleva ademas `origen` (busqueda | cuenta
| hashtag | pagina) y `fuente` (la consulta literal, el @handle, la etiqueta o
el slug de la pagina). La zona sale del texto de la publicacion con el
gacetero, con `ambito="nacional"`, en las TRES plataformas -- tambien en
Instagram, donde el panel de medios la estampa desde la fila --: una marca no
es un lugar, y un post que nombra Guadalajara es justo lo que la consulta fue
a buscar, asi que queda `nacional/fuera` en vez de tirarse.

## El cache es por termino

`cache/consultas/<cq_id>/<plataforma>/`, no un cache por plataforma. Un
video de TikTok que encuentran dos terminos distintos se guardaria una sola
vez en un cache compartido y su `cuenta` seria la del termino que corrio al
ultimo; separados, cada termino conserva lo suyo. Dentro, la misma disciplina
de pulso/redes.py: texto crudo con 30 dias de retencion y fuera de git,
`vistos.json` como freno de costo, `publicaciones.json` como catalogo.

## Una sola cosecha generica, un solo punto de parche

No se llama a `tiktok.cosechar` ni a `instagram.cosechar`: ninguno acepta
`dias_entre_cosechas`, cada uno construye su presupuesto y las pruebas
necesitarian tres puntos de parche. Aqui hay UN bucle de dos pasadas guiado por
una tabla de adaptadores que reusa las listas blancas de cada plataforma
(`tiktok._limpiar_video`, `instagram._limpiar_post`, `facebook._limpiar_post`
y sus `_limpiar*` de comentarios), y `correr_actor` importado en ESTE modulo
es lo unico que las pruebas sustituyen. El presupuesto es uno y se reparte
entre todas las fuentes de todos los terminos, no por plataforma.

## Lo que se publica y lo que no

- `data/consultas.json` (git): por termino, conteos y destacados por
  plataforma, la prensa con el tono de cada titular, las coincidencias del
  archivo propio, el tono de los comentarios en cinco cubetas y los temas. Sin
  porcentajes: una publicacion tiene entre 1 y 20 comentarios, debajo del piso
  de 30 de PRODUCT.md.
- `data/consultas-comentarios.json` (fuera de git, `.gitignore` lo excluye
  por el glob `data/*-comentarios.json`): el texto de los comentarios mas
  votados de cada destacado, con menciones enmascaradas y sin identidad, igual
  que redes-comentarios.json.
- YouTube y X salen como `estado: sin_dato` sin un solo conteo: no hay
  busqueda por termino en YouTube sin la API de datos (que vive detras de
  YOUTUBE_HABILITADO) y de X solo se leen tendencias, nunca tuits. El bloque
  lleva `razon` para quien lea el archivo; la pantalla y el PDF dicen solo
  «sin dato», por pedido del cliente del 18 de septiembre de 2026: la interfaz
  no explica el mecanismo ni siquiera para decir lo que no hace.

## La prensa mide seis meses y cada titular lleva tono

La ventana de redes es de 30 dias porque el texto de los comentarios se
retiene 30 dias. Un titular no es conversacion y no tiene esa atadura, y el
cliente pidio ver seis meses de prensa: `ventana_prensa_dias` (180) es otra
ventana, publicada en la raiz y en cada bloque de prensa, y el archivo propio
se cuenta sobre la misma. Cada titular trae `tono` (favorable | adversa |
neutral, el vocabulario de la prensa del muro, nunca el de los comentarios) y
el bloque lo suma en cinco cubetas y por medio, para que se pueda leer de que
medio viene lo adverso sin afirmar nada que el conteo no diga.

Dos caminos, los dos publicos: el buscador de noticias (pulso/busquedas.py) y
el buscador propio de cada medio de `buscadores` en config/consultas.json (el
RSS de busqueda de WordPress, con robots.txt consultado con el agente del
pipeline). El segundo existe por un caso: Blanco y Negro Noticias publico
tres titulares adversos sobre Grupo Concordia entre marzo y abril de 2026 y
ninguno esta en el indice de noticias. Solo entran los titulares que NOMBRAN
el termino, porque el buscador del medio empareja contra el cuerpo y aqui no
se lee ningun cuerpo; los anteriores a la ventana se cuentan (`anteriores`) y
no se muestran. La prensa se lee de TODAS las filas, apagadas incluidas:
`activo` gobierna el gasto en Apify, y leer titulares no cuesta.

## El tono tambien para la persona, y la salvedad que lo acompana

PRODUCT.md, regla 5: el tono no es postura y nunca se cruza con una figura. El
18 de septiembre de 2026 el cliente decidio publicar el conteo de tono de los
comentarios de los tres terminos, INCLUIDA la persona. Se publica como
conteos, junto con `SALVEDAD_TONO` -- el texto exacto, que el validador
compara por igualdad, en la misma postura que `SALVEDAD_FIJA` en web/ -- y el
cruce con `figuras` del roster sigue prohibido. Lo que dice la salvedad es lo
que el modelo mide de verdad: si cada frase suena a queja, a celebracion o a
informacion, no lo que quien escribe piensa de la persona o de la marca.
"""

import json
import os
import urllib.robotparser
from datetime import datetime, timedelta
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

from . import facebook, instagram, tiktok
from . import redes as _redes
from .apify import ActorProhibido, Presupuesto, SinToken, correr_actor, token
from .archivo import leer_todo
from .busquedas import cosechar as cosechar_prensa
from .fetch import AGENTE, fetch_rss
from .normalizar import dominio, fecha_iso, fold
from .sentimiento import A_TONO, IDIOMA_OMISION
from .redes import (
    COMENTARIOS_MAXIMO, COMENTARIOS_VISIBLES, RETENCION_DIAS, TEXTO_MAXIMO, _conteo_tono,
    _dentro_por_horas, _hoy, _marcar_repetidos, _orden_destacado, _sin_palabras,
    guardar_cache, guardar_publicaciones, guardar_vistos, leer_cache, leer_publicaciones,
    leer_vistos, pendientes, purgar, zona_por_ambito,
)
from .temas import temas as _temas

PLATAFORMAS = ("tiktok", "instagram", "facebook")
# Se publican con `estado: sin_dato` y su razon, nunca con un cero.
SIN_DATO = ("youtube", "x")
RAZON_SIN_DATO = {
    "youtube": "No se consulta YouTube por término.",
    "x": "De X solo se leen tendencias, no publicaciones.",
}
# Un termino puede no tener fuentes en una plataforma (la persona no tiene
# cuenta de marca). Se dice, en registro de producto, en vez de un bloque
# con ceros.
RAZON_SIN_FUENTE = {
    "tiktok": "Esta consulta no tiene búsqueda en TikTok.",
    "instagram": "Esta consulta no sigue cuentas ni etiquetas en Instagram.",
    "facebook": "Esta consulta no sigue páginas en Facebook.",
}
RAZON_SIN_LECTURA = "Todavía no se ha leído esta plataforma para este término."
RAZON_SIN_PRENSA = "Esta consulta no se busca en la prensa."
RAZON_PRENSA_FALLO = "No se pudo leer la prensa esta vez."
RAZON_PRENSA_OMITIDA = "La prensa no se consultó esta vez."

ORIGENES = {
    "tiktok": ("busqueda",),
    "instagram": ("cuenta", "hashtag"),
    "facebook": ("pagina", "busqueda"),
}
TIPOS = ("persona", "empresa", "tema")
# Las cifras que cada plataforma publica de verdad en un destacado; una
# ausente es «sin dato» y no cero. `reproducciones` y `duracion` son
# opcionales y solo se emiten si son mayores que 0.
CIFRAS = {
    "tiktok": ("likes", "comentarios", "compartidos", "guardados"),
    "instagram": ("likes", "comentarios"),
    "facebook": ("likes", "comentarios", "compartidos"),
}

VENTANA_DIAS = 30
DESTACADOS_MAXIMO = 10
# Con una ventana de 30 dias, 3 (el valor de Instagram y TikTok) repagaria los
# comentarios de cada post ~10 veces al mes; 7 los repaga ~4.
DIAS_ENTRE_COSECHAS = 7
TEMAS_MINIMO = 3
CACHE = os.path.join("cache", "consultas")

# La ventana de la prensa es OTRA, mas larga que la de redes: seis meses
# (pedido del cliente del 18 de septiembre de 2026). Puede serlo porque un
# titular no es texto de conversacion: no hay retencion de 30 dias que lo
# ate. `url_de` de pulso/busquedas.py honra `ventana` por renglon ("when:Nd";
# Google Noticias acepta dias y no meses: `when:6m` devuelve vacio, medido) y
# `dias_atras` es el filtro que de verdad manda.
VENTANA_PRENSA_DIAS = 180
VENTANA_PRENSA_MAXIMA = 365
PREFIJO_PRENSA = "https://news.google.com/rss/articles/"
# Los buscadores de los medios (WordPress: `/?s=<termino>&feed=rss2`) traen
# diez titulares por pagina, los mas recientes primero. Se piden hasta estas
# paginas mientras la ultima siga dentro de la ventana.
PAGINAS_BUSCADOR = 2
TITULARES_POR_PAGINA = 10
# Los titulares que nombran el termino pero son anteriores a la ventana se
# publican APARTE, con fecha, hasta este tope: no cuentan en el bloque de tono
# ni en `por_medio`, pero esconderlos seria perder lo que el buscador del medio
# ya devolvio. El caso: los dos titulares mas duros de Blanco y Negro sobre
# Grupo Concordia son del 11 de marzo de 2026, una semana fuera de los 180
# dias, y el unico que nombra a Valente Marquez es de marzo de 2024.
ANTERIORES_MAXIMO = 10
# Tono de un titular: el vocabulario de la prensa (favorable | neutral |
# adversa), que docs/PLAN.md seccion 6 separa a proposito del de los
# comentarios (positivo | negativo | neutral): las dos series nunca se suman
# y por eso tampoco comparten etiquetas.
TONOS_PRENSA = ("favorable", "adversa", "neutral")
ESTADOS_BUSCADOR = ("ok", "fallo", "robots")

COSECHA_OMISION = {
    "ventana_dias": VENTANA_DIAS,
    "ventana_prensa_dias": VENTANA_PRENSA_DIAS,
    "posts_por_fuente": 20,
    "comentarios_por_post": 20,
    "dias_entre_cosechas": DIAS_ENTRE_COSECHAS,
    "presupuesto_resultados": 7000,
    "prensa_por_consulta": 20,
    "destacados_maximo": DESTACADOS_MAXIMO,
    "filtro_fecha_tiktok": "PAST_MONTH",
    "orden_tiktok": "MOST_RELEVANT",
}

# El texto exacto. El validador lo compara por igualdad: no se parafrasea ni
# se recorta en ningun consumidor. Ver el encabezado.
SALVEDAD_TONO = (
    "Conteo del tono de cada comentario según un modelo que lee frases, no posturas: "
    "dice si el texto suena a queja, a celebración o a información, no lo que quien "
    "escribe piensa de la persona o de la marca. Son comentarios de quien decidió "
    "comentar, no una muestra de nadie."
)


# ------------------------------------------------------------------ fuentes

def _activas(consultas, solo=None):
    """Las filas que se cosechan: `activo` Y `verificado`, como Instagram.

    `solo` acota a esos ids; una fila pedida pero apagada se omite igual (el
    comando lo imprime) porque `--probar` es el camino para una fila sin
    verificar, y cosechar a ciegas un handle adivinado se cobra igual que uno
    bueno.
    """
    salida = []
    for c in consultas or []:
        if solo is not None and c.get("id") not in solo:
            continue
        if c.get("activo") and c.get("verificado"):
            salida.append(c)
    return sorted(salida, key=lambda c: c["id"])


def _seleccion(consultas, solo=None):
    """Todas las filas pedidas, activas o no. Es lo que `probar` recorre."""
    return sorted([c for c in consultas or [] if solo is None or c.get("id") in solo],
                  key=lambda c: c["id"])


def _fuentes(consulta):
    """Las sub-fuentes de un termino, en orden FIJO.

    TikTok; Instagram cuentas y luego hashtags; Facebook paginas y luego
    busqueda. Las cuentas van antes que los hashtags a proposito: un post de
    la marca aparece por los dos caminos, y el primero que lo ve fija `origen`
    y `fuente` (gana el primero, como `capturado` en las notas), asi que la
    publicacion propia queda como `cuenta` y no como `hashtag`.
    """
    cid = consulta["id"]
    idioma = consulta.get("idioma", "es")

    def fila(plataforma, origen, valor):
        return {"cuenta": cid, "plataforma": plataforma, "origen": origen,
                "valor": valor, "idioma": idioma}

    salida = []
    tk = consulta.get("tiktok") or {}
    if (tk.get("consulta") or "").strip():
        salida.append(fila("tiktok", "busqueda", tk["consulta"].strip()))
    ig = consulta.get("instagram") or {}
    for h in ig.get("cuentas") or []:
        salida.append(fila("instagram", "cuenta", "@" + h.strip().lstrip("@")))
    for t in ig.get("hashtags") or []:
        salida.append(fila("instagram", "hashtag", t.strip().lstrip("#").lower()))
    fb = consulta.get("facebook") or {}
    for p in fb.get("paginas") or []:
        salida.append(fila("facebook", "pagina", p.strip().strip("/").lstrip("@")))
    if (fb.get("busqueda") or "").strip():
        salida.append(fila("facebook", "busqueda", fb["busqueda"].strip()))
    return salida


def _dir_cache(cache, cid, plataforma):
    return os.path.join(cache, cid, plataforma)


# ------------------------------------------------------------ adaptadores

def _entrada_posts(fuente, cuantos, cosecha):
    """La entrada de la pasada 1 para una fuente. Ninguna trae sesion."""
    p, origen, valor = fuente["plataforma"], fuente["origen"], fuente["valor"]
    dias = cosecha["ventana_dias"]
    if p == "tiktok":
        return tiktok._entrada_videos(valor, cuantos, cosecha["filtro_fecha_tiktok"],
                                      cosecha["orden_tiktok"])
    if p == "instagram":
        if origen == "hashtag":
            url = "https://www.instagram.com/explore/tags/{}/".format(valor)
        else:
            url = "https://www.instagram.com/{}/".format(valor.lstrip("@"))
        return {"directUrls": [url], "resultsType": "posts", "resultsLimit": cuantos,
                "onlyPostsNewerThan": "{} days".format(dias)}
    if origen == "busqueda":
        return facebook._entrada_busqueda(valor, cuantos, dias)
    return facebook._entrada_pagina(facebook.url_pagina(valor), cuantos, dias)


def _entrada_comentarios(plataforma, urls, cuantos, cosecha):
    if plataforma == "tiktok":
        return {"postURLs": urls, "commentsPerPost": cuantos, "maxRepliesPerComment": 0}
    if plataforma == "instagram":
        return {"directUrls": urls, "resultsType": "comments", "resultsLimit": cuantos}
    return facebook._entrada_comentarios(urls, cuantos, cosecha["ventana_dias"])


def _actores(fuente):
    p, origen = fuente["plataforma"], fuente["origen"]
    if p == "tiktok":
        return tiktok.ACTOR_VIDEOS, tiktok.ACTOR_COMENTARIOS
    if p == "instagram":
        return instagram.ACTOR_POSTS, instagram.ACTOR_COMENTARIOS
    if origen == "busqueda":
        return facebook.ACTOR_BUSQUEDA, facebook.ACTOR_COMENTARIOS
    return facebook.ACTOR_POSTS, facebook.ACTOR_COMENTARIOS


def _limpiar_post(item, fuente, ahora):
    """(registro, motivo) con la lista blanca de la plataforma de la fuente.

    El registro lleva siempre `cuenta` (id del termino), `origen`, `fuente`,
    `zona` y `alcance` -- la zona sale del texto con `ambito="nacional"` en las
    tres plataformas, ver el encabezado -- y `publicado`, sin el cual no entra
    a una ventana de horas y se descarta como 'sin_fecha'.
    """
    p = fuente["plataforma"]
    if p == "tiktok":
        v, motivo = tiktok._limpiar_video(
            item, {"id": fuente["cuenta"], "ambito": "nacional", "idioma": fuente["idioma"]},
            ahora)
        if v is None:
            return None, motivo
        salida = {"url": v["url"], "cuenta": v["cuenta"], "origen": fuente["origen"],
                  "fuente": fuente["valor"], "creador": v["creador"]}
        salida.update({k: val for k, val in v.items() if k not in salida})
        return salida, None
    if p == "facebook":
        return facebook._limpiar_post(item, fuente, ahora, ambito="nacional")

    base = instagram._limpiar_post(item, {"id": fuente["cuenta"], "zona": "nacional"})
    if base is None:
        return None, "sin_url"
    if not base.get("publicado"):
        return None, "sin_fecha"
    if datetime.fromisoformat(base["publicado"]) > datetime.fromisoformat(ahora):
        return None, "futuro"
    zona, alc = zona_por_ambito(item.get("caption") or "", "nacional")
    salida = {
        "url": base["url"], "cuenta": base["cuenta"], "origen": fuente["origen"],
        "fuente": fuente["valor"], "zona": zona, "alcance": alc,
        "publicado": base["publicado"], "fecha": base["fecha"], "titulo": base["titulo"],
        "tipo": base["tipo"], "likes": base["likes"], "comentarios": base["comentarios"],
    }
    if "reproducciones" in base:
        salida["reproducciones"] = base["reproducciones"]
    return salida, None


def _url_comentario(plataforma, item, pedidas):
    """El post de un comentario, canonizado para que cruce con la pasada 1."""
    if plataforma == "tiktok":
        return tiktok._url_video(item.get("videoWebUrl") or item.get("postURL") or "") or pedidas[0]
    if plataforma == "instagram":
        return (item.get("postUrl") or item.get("inputUrl") or pedidas[0]).strip()
    return facebook._url_comentario(item, pedidas)


def _limpiar_comentario(plataforma, item, url, fuente, zona):
    """Lista blanca del comentario; la identidad se tira aqui, en las tres."""
    if plataforma == "tiktok":
        return tiktok._limpiar_comentario(
            item, url, {"id": fuente["cuenta"], "idioma": fuente["idioma"]}, zona)
    if plataforma == "instagram":
        return instagram._limpiar(
            item, url, {"id": fuente["cuenta"], "zona": zona or "nacional",
                        "idioma": fuente["idioma"]})
    return facebook._limpiar_comentario(item, url, fuente, zona)


# ------------------------------------------------------------------ cosecha

def _fila_salud(fuente, estado, **resto):
    fila = {"consulta": fuente["cuenta"], "plataforma": fuente["plataforma"],
            "origen": fuente["origen"], "fuente": fuente["valor"], "estado": estado,
            "posts": 0, "comentarios": 0}
    fila.update(resto)
    return fila


def _orden_salud(s):
    return (s["consulta"], s["plataforma"], s["origen"], s["fuente"])


def _error(e):
    return "{}: {}".format(type(e).__name__, e)[:200]


def _cosechar_fuente(fuente, ahora, tok, presupuesto, reparto, vistos, publicaciones,
                     cosecha):
    """Dos pasadas para UNA fuente. Devuelve (comentarios nuevos, fila de salud).

    Actualiza `vistos` y `publicaciones` del cache del termino en su
    plataforma; el llamador los escribe. Un fallo de una fuente no tumba las
    demas: se vuelve una fila 'fallo' con el motivo.
    """
    p = fuente["plataforma"]
    cuantos = cosecha["posts_por_fuente"]
    try:
        actor_posts, actor_coms = _actores(fuente)
        items = correr_actor(actor_posts, _entrada_posts(fuente, cuantos, cosecha), tok,
                             min(cuantos, reparto))
        presupuesto.cobrar(fuente["cuenta"], len(items))
    except Exception as e:      # ActorProhibido, PresupuestoAgotado, red
        return [], _fila_salud(fuente, "fallo", error=_error(e))

    # El catalogo se actualiza ANTES del freno de costo: una publicacion ya
    # cosechada sigue sumando likes. `origen` y `fuente` los fija quien la vio
    # primero (ver _fuentes).
    urls, fuera, descartados = [], 0, 0
    for it in items:
        limpio, motivo = _limpiar_post(it, fuente, ahora)
        if limpio is None:
            if motivo == "fuera":
                fuera += 1
            else:
                descartados += 1
            continue
        viejo = publicaciones.get(limpio["url"], {})
        nuevo = {**viejo, **limpio}
        for k in ("origen", "fuente"):
            if k in viejo:
                nuevo[k] = viejo[k]
        publicaciones[limpio["url"]] = nuevo
        if limpio["url"] not in urls:
            urls.append(limpio["url"])

    toca = pendientes(urls, vistos, ahora, dias=cosecha["dias_entre_cosechas"])
    if not toca:
        return [], _fila_salud(fuente, "ok", posts=len(urls), comentarios=0, crudos=0,
                               descartados=descartados, fuera=fuera,
                               nota="sin publicaciones nuevas que cosechar")

    try:
        crudos = correr_actor(actor_coms,
                              _entrada_comentarios(p, toca, cosecha["comentarios_por_post"],
                                                   cosecha),
                              tok, max(1, reparto - len(items)))
        presupuesto.cobrar(fuente["cuenta"], len(crudos))
    except Exception as e:
        return [], _fila_salud(fuente, "fallo", error=_error(e), posts=len(urls),
                               descartados=descartados, fuera=fuera)

    nuevos = []
    for c in crudos:
        url = _url_comentario(p, c, toca)
        zona = (publicaciones.get(url) or {}).get("zona")
        limpio = _limpiar_comentario(p, c, url, fuente, zona)
        if limpio:
            nuevos.append(limpio)
    for u in toca:
        vistos[u] = _hoy(ahora)
    # `comentarios` es lo ingerido y `crudos` lo facturado: un post sin
    # comentarios devuelve relleno con texto vacio que se cobra igual.
    return nuevos, _fila_salud(fuente, "ok", posts=len(urls), comentarios=len(nuevos),
                               crudos=len(crudos), descartados=descartados, fuera=fuera)


def cosechar(consultas, ahora, tok=None, presupuesto=None, cache=CACHE, cosecha=None,
             entorno=None, solo=None):
    """Todas las fuentes de los terminos activos, contra Apify. Devuelve
    (nuevos, salud, gasto).

    Sin token no truena: devuelve vacio y lo dice en `salud`, una fila por
    fuente. El presupuesto es UNO y se reparte entre todas las fuentes de
    todos los terminos; el reparto se fija antes de la primera llamada para
    que el orden del archivo no decida quien cosecha.
    """
    cosecha = dict(COSECHA_OMISION, **(cosecha or {}))
    fuentes = [f for c in _activas(consultas, solo) for f in _fuentes(c)]
    presupuesto = presupuesto or Presupuesto(cosecha["presupuesto_resultados"])

    try:
        tok = tok or token(entorno)
    except SinToken as e:
        salud = [_fila_salud(f, "sin_token", error=str(e)) for f in fuentes]
        return [], sorted(salud, key=_orden_salud), presupuesto.resumen()

    reparto = presupuesto.reparto(len(fuentes))
    salud, nuevos = [], []
    estados = {}    # (cid, plataforma) -> (dir, vistos, publicaciones, nuevos)
    for f in fuentes:
        clave = (f["cuenta"], f["plataforma"])
        if clave not in estados:
            d = _dir_cache(cache, *clave)
            purgar(d, ahora)
            estados[clave] = (d, leer_vistos(d), leer_publicaciones(d), [])
        d, vistos, publicaciones, propios = estados[clave]
        frescos, fila = _cosechar_fuente(f, ahora, tok, presupuesto, reparto, vistos,
                                         publicaciones, cosecha)
        propios.extend(frescos)
        nuevos.extend(frescos)
        salud.append(fila)

    for d, vistos, publicaciones, propios in estados.values():
        guardar_vistos(vistos, d)
        guardar_publicaciones(publicaciones, ahora, d)
        guardar_cache(propios, ahora, d)
    return nuevos, sorted(salud, key=_orden_salud), presupuesto.resumen()


def probar(consultas, ahora, tok=None, entorno=None, cosecha=None, cuantos=3, solo=None):
    """Pasada 1 con pocos resultados y sin comentarios. No escribe nada.

    Recorre TODAS las filas pedidas, apagadas incluidas: es el paso previo a
    poner `activo: true`, y lo que devuelve -- publicaciones limpias con zona
    y titulo, y los descartes por motivo -- es lo que va a la `nota` de la fila.
    Sin token no truena: cada fuente sale `sin_token`.
    """
    cosecha = dict(COSECHA_OMISION, **(cosecha or {}))
    fuentes = [f for c in _seleccion(consultas, solo) for f in _fuentes(c)]
    try:
        tok = tok or token(entorno)
    except SinToken as e:
        return [_fila_salud(f, "sin_token", error=str(e)) for f in fuentes]

    salida = []
    for f in fuentes:
        try:
            actor_posts, _ = _actores(f)
            items = correr_actor(actor_posts, _entrada_posts(f, cuantos, cosecha), tok, cuantos)
        except Exception as e:      # ActorProhibido incluida: la busqueda de Facebook
            salida.append(_fila_salud(f, "fallo", error=_error(e)))
            continue
        posts, descartes, claves = [], {}, set()
        for it in items:
            limpio, motivo = _limpiar_post(it, f, ahora)
            if limpio:
                posts.append(limpio)
            else:
                descartes[motivo] = descartes.get(motivo, 0) + 1
                # Solo los NOMBRES de campo del item descartado, nunca su
                # contenido: es lo que hace falta para saber si el actor
                # devolvio un error, un perfil en vez de posts o un campo de
                # fecha con otro nombre, sin que una identidad cruce a la
                # consola. El sondeo del 18 de septiembre de 2026 devolvio
                # 'sin_url' en las dos paginas de Facebook y 'sin_fecha' en
                # una cuenta de Instagram, y sin esto no se sabe por que.
                if isinstance(it, dict):
                    claves.update(str(k) for k in it)
        fila = _fila_salud(f, "ok", posts=len(posts))
        fila["publicaciones"] = sorted(posts, key=lambda v: (v["publicado"], v["url"]),
                                       reverse=True)
        fila["descartes"] = dict(sorted(descartes.items()))
        if descartes:
            fila["claves_descartadas"] = sorted(claves)
        salida.append(fila)
    return salida


# ------------------------------------------------------------------ prensa

def _buscadores_activos(buscadores):
    """Las filas de `buscadores` que se consultan: `activo` Y `verificado`,
    con la misma regla que una fila de termino. Orden fijo por id."""
    salida = [b for b in (buscadores or []) if b.get("activo") and b.get("verificado")]
    return sorted(salida, key=lambda b: b["id"])


def url_buscador(buscador, termino, pagina=1):
    """La URL de una pagina del buscador de un medio. Pura.

    `{q}` se sustituye por el termino SIN comillas y codificado: WordPress
    manda las comillas al LIKE tal cual, asi que «"Grupo Concordia"» solo
    encuentra las notas que traen las comillas en el cuerpo (medido el 18 de
    septiembre de 2026 en Sintesis). El filtro fino lo hace `_nombra`.
    """
    url = buscador["url"].replace("{q}", quote(termino, safe=""))
    if pagina > 1:
        url += ("&" if "?" in url else "?") + "paged={}".format(pagina)
    return url


def _nombra(titulo, termino):
    """Si el titular nombra el termino, plegados los dos."""
    aguja = fold(termino)
    return bool(aguja) and aguja in fold(titulo or "")


def permitido_por_robots(url, timeout=10):
    """robots.txt del sitio, con el agente del pipeline. Un robots que no se
    puede leer (403, 5xx, red) se lee como PROHIBIDO: es la postura de
    ROBOTSTXT_OBEY, y el caso es real -- cuatro de los sitios del catalogo
    devuelven 403 a un agente generico y 200 al nuestro."""
    partes = urlsplit(url)
    try:
        with urlopen(Request("{}://{}/robots.txt".format(partes.scheme, partes.netloc),
                             headers={"User-Agent": AGENTE}), timeout=timeout) as r:
            texto = r.read().decode("utf-8", "replace")
    except HTTPError as e:
        # Sin robots.txt (404) todo esta permitido; con robots ilegible, nada.
        return e.code == 404
    except Exception:
        return False
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(texto.splitlines())
    return rp.can_fetch(AGENTE, url)


def _buscar_en_medio(buscador, termino, desde, feed, robots, cosecha):
    """Un buscador de un medio para un termino. Devuelve (resultados,
    anteriores, fila de salud). Cada resultado trae `idioma` para el tono.

    Solo entran los titulares que NOMBRAN el termino: el buscador del medio
    empareja contra el cuerpo, que aqui no se lee, y sin comillas empareja
    palabra por palabra («Concordia» trae la Concordia de Sinaloa). Un
    titular que no nombra el termino no se puede mostrar como un titular
    sobre el termino sin haber leido el cuerpo. Los que lo nombran pero son
    anteriores a la ventana se cuentan, no se muestran.
    """
    # `dominio` y no `netloc`: Sintesis enlaza sus notas con `www.` y su
    # buscador vive sin el, y con netloc sus dos titulares de febrero de 2026
    # se perdian en silencio (medido el 18 de septiembre de 2026).
    host = dominio(buscador["url"].replace("{q}", "x")) or urlsplit(buscador["url"]).netloc.lower()
    primera = url_buscador(buscador, termino)
    if not robots(primera):
        return [], [], {"id": buscador["id"], "nombre": buscador["nombre"], "estado": "robots",
                        "titulares": 0, "anteriores": 0}
    resultados, anteriores = [], []
    pagina = 1
    while pagina <= PAGINAS_BUSCADOR:
        try:
            crudos = feed(url_buscador(buscador, termino, pagina), timeout=15)
        except Exception as e:
            if pagina > 1:
                break       # lo que trajo la primera pagina vale
            return [], [], {"id": buscador["id"], "nombre": buscador["nombre"],
                            "estado": "fallo", "titulares": 0, "anteriores": 0,
                            "error": _error(e)}
        ultima = None
        for c in crudos:
            fecha, _publicado = fecha_iso(c.get("fecha_cruda"))
            if not fecha:
                continue
            ultima = fecha if ultima is None else min(ultima, fecha)
            titulo = (c.get("titulo") or "").strip()
            url = (c.get("url") or "").strip()
            if not _nombra(titulo, termino) or not url:
                continue
            if urlsplit(url).scheme != "https" or dominio(url) != host:
                continue    # el enlace tiene que ser del propio medio
            fila = {"titulo": titulo, "url": url, "dominio": dominio(url) or host,
                    "fuente": buscador["nombre"], "fecha": fecha, "origen": "medio",
                    "idioma": buscador.get("idioma", IDIOMA_OMISION)}
            (anteriores if fecha < desde else resultados).append(fila)
        # Una pagina llena cuya ultima fecha sigue dentro de la ventana puede
        # seguir; una corta o ya fuera de la ventana, no.
        if len(crudos) < TITULARES_POR_PAGINA or ultima is None or ultima < desde:
            break
        pagina += 1
    return resultados, anteriores, {"id": buscador["id"], "nombre": buscador["nombre"],
                                    "estado": "ok", "titulares": len(resultados),
                                    "anteriores": len(anteriores)}


def _tono_titulares(resultados, analizador):
    """Etiqueta `tono` en cada resultado, en sitio, y devuelve el conteo.

    Cinco cubetas que suman `titulares`, como `_conteo_tono` con los
    comentarios: las tres etiquetas de prensa, `sin_modelo_idioma` para el
    idioma que el analizador no habla (la leccion de San Diego), y
    `sin_clasificar` si no corrio el modelo. `tono` es null donde no hay
    etiqueta, nunca «neutral».
    """
    conteo = {k: 0 for k in TONOS_PRENSA}
    conteo.update({"sin_clasificar": 0, "sin_modelo_idioma": 0})
    habla = getattr(analizador, "idioma", IDIOMA_OMISION) if analizador else None
    propios = []
    for r in resultados:
        r["tono"] = None
        if analizador is None:
            conteo["sin_clasificar"] += 1
        elif r.get("idioma", IDIOMA_OMISION) != habla:
            conteo["sin_modelo_idioma"] += 1
        else:
            propios.append(r)
    modelo = None
    if propios:
        etiquetas = analizador.predecir([r["titulo"] for r in propios])
        for r, e in zip(propios, etiquetas):
            r["tono"] = A_TONO[e["etiqueta"]]
            conteo[r["tono"]] += 1
            modelo = modelo or e.get("modelo")
    conteo["titulares"] = len(resultados)
    conteo["metodo"] = "modelo" if analizador is not None else "ninguno"
    conteo["modelo"] = modelo if analizador is not None else None
    return conteo


def _por_medio(resultados):
    """Titulares y tono por medio, para leer de que medio viene lo adverso.
    Orden (-titulares, fuente): el que mas publico primero."""
    por = {}
    for r in resultados:
        fila = por.setdefault(r["fuente"], {"fuente": r["fuente"], "dominio": r["dominio"],
                                            "titulares": 0, "favorable": 0, "adversa": 0,
                                            "neutral": 0})
        fila["titulares"] += 1
        if r.get("tono") in TONOS_PRENSA:
            fila[r["tono"]] += 1
    return sorted(por.values(), key=lambda f: (-f["titulares"], f["fuente"]))


def _muestra_prensa(n_buscadores, dias):
    medios = ("el buscador propio de {} {}".format(n_buscadores, "medio" if n_buscadores == 1
                                                   else "medios") if n_buscadores else None)
    partes = ["el buscador de noticias"] + ([medios] if medios else [])
    return "{}, titulares de los últimos {} días".format(" y ".join(partes), dias).capitalize()


def prensa(consultas, medios, ahora, alias=None, feed=fetch_rss, cosecha=None, solo=None,
           buscadores=None, analizador=None, robots=permitido_por_robots):
    """La prensa de cada termino, seis meses: {cid: bloque}. TODAS las filas,
    apagadas incluidas: leer titulares no cuesta ni exige sondear un handle.

    Dos caminos, los dos publicos y sin sesion:

    - Google Noticias sobre `prensa.q` (la frase con comillas), reusando
      pulso/busquedas.py con filas sinteticas y SIN tocar notas.json. El
      enlace es el token opaco tal cual y el dominio y el nombre salen del
      <source>. Medido el 18 de septiembre de 2026: dos titulares en seis meses
      para «Grupo Concordia», ninguno para «Valente Marquez».
    - El buscador propio de cada medio de `buscadores` (config/consultas.json),
      el RSS de busqueda de WordPress, con el termino sin comillas y el filtro
      de `_nombra`. Es lo que trae la cobertura que Google no indexa: Blanco y
      Negro Noticias publico tres titulares adversos sobre Grupo Concordia
      entre marzo y abril de 2026 y ninguno esta en el indice de noticias.

    El tono de cada titular lo pone `analizador` (el mismo modelo de la
    prensa del muro, vocabulario favorable | adversa | neutral) segun el
    idioma del medio, nunca adivinado del texto; sin analizador queda null y
    se cuenta como `sin_clasificar`. Los titulares repetidos entre caminos se
    quedan con el enlace del medio (va primero); los anteriores a la ventana
    que devuelve el buscador de un medio se publican aparte en `anteriores`,
    con fecha y tono por fila, fuera del conteo del bloque.
    """
    cosecha = dict(COSECHA_OMISION, **(cosecha or {}))
    dias = cosecha["ventana_prensa_dias"]
    desde = (datetime.fromisoformat(ahora) - timedelta(days=dias)).date().isoformat()
    activos = _buscadores_activos(buscadores)
    salida, filas = {}, []
    for c in _seleccion(consultas, solo):
        q = ((c.get("prensa") or {}).get("q") or "").strip()
        if not q:
            salida[c["id"]] = {"estado": "sin_dato", "razon": RAZON_SIN_PRENSA}
            continue
        filas.append({"id": c["id"], "nombre": c["termino"], "q": q,
                      "idioma": c.get("idioma", IDIOMA_OMISION),
                      "ventana": "when:{}d".format(dias), "activo": True})
    if not filas:
        return salida

    cupo = cosecha["prensa_por_consulta"]
    items, salud = cosechar_prensa(filas, medios, ahora=ahora, alias=alias, feed=feed,
                                   max_por_busqueda=cupo, max_por_corrida=cupo * len(filas),
                                   dias_atras=dias)
    por_medio_idioma = {m["id"]: m.get("idioma", IDIOMA_OMISION) for m in medios}
    de_noticias = {}
    for it in items:
        fecha, _publicado = fecha_iso(it["item"].get("fecha_cruda"))
        medio = it["medio"]
        de_noticias.setdefault(it["descubierta_por"], []).append({
            "titulo": it["item"]["titulo"],
            "url": it["item"].get("url") or "",
            "dominio": it["item"].get("dominio") or "",
            "fuente": medio.get("nombre") or medio["id"],
            "fecha": fecha or "",
            "origen": "noticias",
            # El idioma del medio si esta en el catalogo; si no, el de la
            # consulta, que es el de la edicion que se pidio.
            "idioma": por_medio_idioma.get(medio["id"]) or medio.get("idioma")
            or next(f["idioma"] for f in filas if f["id"] == it["descubierta_por"]),
        })
    salud_noticias = {s["id"]: s for s in salud}

    def _ordenar(lista):
        lista.sort(key=lambda r: (r["titulo"], r["url"]))
        lista.sort(key=lambda r: r["fecha"], reverse=True)
        return lista

    for f in filas:
        cid, termino = f["id"], f["nombre"]
        resultados, anteriores, buscadores_salud = [], [], []
        vistos, vistos_viejos = set(), set()
        for b in activos:
            propios, viejos, fila_b = _buscar_en_medio(b, termino, desde, feed, robots, cosecha)
            buscadores_salud.append(fila_b)
            for r in propios:
                clave = fold(r["titulo"])
                if clave not in vistos:
                    vistos.add(clave)
                    resultados.append(r)
            for r in viejos:
                clave = fold(r["titulo"])
                if clave not in vistos_viejos:
                    vistos_viejos.add(clave)
                    anteriores.append(r)
        s = salud_noticias[cid]
        if s["estado"] == "ok":
            for r in de_noticias.get(cid, []):
                clave = fold(r["titulo"])
                if clave not in vistos:
                    vistos.add(clave)
                    resultados.append(r)
        # El buscador de noticias ya filtro la ventana en pulso/busquedas.py:
        # sus anteriores son un conteo (`detalle.fuera_de_ventana`), no filas.
        buscadores_salud.insert(0, {"id": "noticias", "nombre": "buscador de noticias",
                                    "estado": "ok" if s["estado"] == "ok" else "fallo",
                                    "titulares": len(de_noticias.get(cid, [])),
                                    "anteriores": (s.get("detalle") or {}).get(
                                        "fuera_de_ventana", 0)})
        if all(fb["estado"] != "ok" for fb in buscadores_salud):
            salida[cid] = {"estado": "fallo", "razon": RAZON_PRENSA_FALLO}
            continue
        _ordenar(resultados)
        anteriores = _ordenar(anteriores)[:ANTERIORES_MAXIMO]
        # Un solo paso por el modelo para los dos grupos; el conteo del bloque
        # es SOLO de la ventana. Los anteriores llevan su tono por fila.
        tono = _tono_titulares(resultados, analizador)
        _tono_titulares(anteriores, analizador)
        for r in resultados + anteriores:
            r.pop("idioma", None)
        salida[cid] = {
            "estado": "ok",
            "ventana_dias": dias,
            "resultados": resultados,
            "anteriores": anteriores,
            "tono": tono,
            "por_medio": _por_medio(resultados),
            "buscadores": buscadores_salud,
            "muestra": _muestra_prensa(len(activos), dias),
        }
    return salida


def _leer_json(ruta, omision):
    try:
        with open(ruta, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return omision


def archivo(consultas, dir_datos, ahora, medios_cfg=None, busquedas_cfg=None,
            ventana_dias=VENTANA_PRENSA_DIAS, solo=None):
    """Cuantos titulares del archivo propio nombran cada termino. {cid: bloque}.

    Lee notas.json mas data/archivo/*.json y cuenta las notas de la ventana
    cuyo titular plegado contiene el termino plegado. La ventana es la de la
    PRENSA (seis meses), no la de redes: son las dos cifras de prensa del
    termino y tienen que medir lo mismo. `medios` y `busquedas` son los
    renglones activos de los dos catalogos -- se calculan, no se escriben --,
    porque son lo que dice de que muestra sale el conteo. Todas las filas,
    apagadas incluidas, como `prensa`.

    La clave es `coincidencias` y no `notas`: `notas` es clave prohibida en
    data/ (texto literal de conversacion) y el validador la rechazaria.

    Si el archivo no trae una sola nota devuelve {} en vez de ceros: un 0
    sobre un archivo vacio afirmaria «nadie lo nombro» cuando lo cierto es que
    no habia nada que revisar. Es por esto que `--archivo` va aparte de
    `--salida` en el comando.
    """
    notas = leer_todo(dir_datos, _leer_json)
    if not notas:
        return {}
    hoy = ahora[:10]
    desde = (datetime.fromisoformat(ahora) - timedelta(days=ventana_dias)).date().isoformat()
    vigentes = [n for n in notas.values() if desde <= (n.get("fecha") or "") <= hoy]
    medios = sum(1 for m in (medios_cfg or {}).get("medios", []) if m.get("activo", True))
    busquedas = sum(1 for b in (busquedas_cfg or {}).get("busquedas", [])
                    if b.get("activo", True))
    salida = {}
    for c in _seleccion(consultas, solo):
        aguja = fold(c["termino"])
        n = sum(1 for nota in vigentes if aguja and aguja in fold(nota.get("titulo") or ""))
        salida[c["id"]] = {
            "coincidencias": n,
            "medios": medios,
            "busquedas": busquedas,
            "muestra": "{} medios del catálogo y {} búsquedas, titulares de los últimos {} días"
                       .format(medios, busquedas, ventana_dias),
        }
    return salida


# ------------------------------------------------------------- sentimiento

def clasificar_cache(cache, consultas, analizador=None, solo=None):
    """Etiqueta el tono en el cache de cada termino y plataforma. Devuelve
    (etiquetados, omitidos) sumados. Ver pulso/redes.py::clasificar_cache."""
    if analizador is None:
        from .sentimiento import Analizador
        analizador = Analizador()
    etiquetados = omitidos = 0
    for c in _activas(consultas, solo):
        for p in PLATAFORMAS:
            e, o = _redes.clasificar_cache(_dir_cache(cache, c["id"], p), analizador)
            etiquetados += e
            omitidos += o
    return etiquetados, omitidos


# --------------------------------------------------------------- derivados

def _estado_bloque(filas):
    if not filas:
        return "ok"
    estados = {s["estado"] for s in filas}
    if estados == {"sin_token"}:
        return "sin_token"
    if "ok" in estados:
        return "ok"
    return "fallo"


def _destacados_termino(vigentes, comentarios, opinion, plataforma, maximo):
    """Las publicaciones de la ventana con mas likes, con sus conteos.

    Un solo corte global, sin union por zona ni turnos: aqui la pregunta es
    «que se dice del termino», no «que pasa en cada ciudad». Orden
    (-likes, -comentarios, url), el mismo del validador.
    """
    por_post, opinion_por_post = {}, {}
    for c in comentarios:
        por_post.setdefault(c["post"], []).append(c)
    for c in opinion:
        opinion_por_post.setdefault(c["post"], []).append(c)
    filas = []
    for url, p in vigentes.items():
        propia = opinion_por_post.get(url, [])
        conteo, _ = _conteo_tono(propia)
        d = {"url": url, "cuenta": p["cuenta"], "origen": p.get("origen") or "",
             "fuente": p.get("fuente") or ""}
        if plataforma == "tiktok":
            d["creador"] = p.get("creador") or ""
        d.update({
            "zona": p.get("zona") or "nacional",
            "alcance": p.get("alcance") or "nacional",
            "publicado": p.get("publicado") or "",
            "fecha": p.get("fecha") or "",
            "titulo": p.get("titulo") or "",
            "tipo": p.get("tipo") or "otro",
        })
        for k in CIFRAS[plataforma]:
            d[k] = int(p.get(k) or 0)
        if p.get("reproducciones"):
            d["reproducciones"] = int(p["reproducciones"])
        if plataforma == "tiktok" and p.get("duracion"):
            d["duracion"] = int(p["duracion"])
        d["cosechados"] = len(por_post.get(url, []))
        d["opinion"] = len(propia)
        d["sentimiento"] = conteo
        filas.append(d)
    filas.sort(key=_orden_destacado)
    return filas[:maximo]


def _temas_termino(opinion, termino, ahora, ventana_dias, minimo):
    """Temas sobre la opinion del termino: solo {termino, n}.

    `temas.temas()` devuelve ademas `ejemplos` (texto de comentarios, que no
    entra a data/) y `n_previo`/`momento` (la ventana anterior nunca esta en
    un cache de 30 dias: saldrian siempre en cero, relleno). Y se quita el
    propio termino: que «valente marquez» sea el tema de los comentarios sobre
    Valente Marquez no dice nada.
    """
    registros = [{"id": c["id"], "titulo": c["texto"], "fecha": c.get("fecha") or ""}
                 for c in opinion]
    doc = _temas(registros, ahora, origen="comentarios", ventana_dias=ventana_dias,
                 minimo=minimo)
    aguja = fold(termino)
    filas = [{"termino": t["termino"], "n": t["n"]} for t in doc["temas"]
             if t["termino"] not in aguja]
    filas.sort(key=lambda t: (-t["n"], t["termino"]))
    return {"minimo": minimo, "comentarios": len(opinion), "temas": filas}


def _derivar_consulta(c, ahora, salud, cache, prensa_de, archivo_de, cosecha, dentro):
    cid = c["id"]
    con_fuente = {f["plataforma"] for f in _fuentes(c)}
    por_plataforma = {}
    todos = []
    for p in PLATAFORMAS:
        d = _dir_cache(cache, cid, p)
        por_plataforma[p] = (leer_cache(d), leer_publicaciones(d))
        todos.extend(por_plataforma[p][0])

    # Brigada y reacciones se juzgan sobre TODO el termino: el mismo texto
    # pegado en tres videos y dos posts es una persona insistiendo, en la
    # plataforma que sea. El tono y los temas solo cuentan opinion.
    marcados = _marcar_repetidos(list(todos))
    opinion = [x for x in marcados if not x["brigada"] and not _sin_palabras(x["texto"])]

    bloques = {}
    for p in PLATAFORMAS:
        comentarios, publicaciones = por_plataforma[p]
        filas = sorted((s for s in salud if s["consulta"] == cid and s["plataforma"] == p),
                       key=lambda s: (s["origen"], s["fuente"]))
        if p not in con_fuente and not filas and not publicaciones:
            bloques[p] = {"estado": "sin_dato", "razon": RAZON_SIN_FUENTE[p]}
            continue
        if not filas and not publicaciones:
            bloques[p] = {"estado": "sin_dato", "razon": RAZON_SIN_LECTURA}
            continue
        vigentes = {u: pb for u, pb in publicaciones.items() if dentro(pb)}
        propios = [x for x in marcados if x["plataforma"] == p]
        opinion_p = [x for x in opinion if x["plataforma"] == p]
        bloques[p] = {
            "estado": _estado_bloque(filas),
            "publicaciones": len(vigentes),
            "comentarios_cosechados": len(propios),
            "opinion": len(opinion_p),
            "destacados": _destacados_termino(vigentes, propios, opinion_p, p,
                                              cosecha["destacados_maximo"]),
            "salud": filas,
        }
    for p in SIN_DATO:
        bloques[p] = {"estado": "sin_dato", "razon": RAZON_SIN_DATO[p]}

    conteo, modelo = _conteo_tono(opinion)
    tono = dict(conteo)
    tono.update({
        "comentarios": len(opinion),
        "metodo": "modelo" if modelo else "ninguno",
        "modelo": modelo,
        "salvedad_tono": SALVEDAD_TONO,
    })

    bloque_prensa = dict((prensa_de or {}).get(cid)
                         or {"estado": "sin_dato", "razon": RAZON_PRENSA_OMITIDA})
    if (archivo_de or {}).get(cid):
        bloque_prensa["archivo"] = archivo_de[cid]

    return {
        "id": cid,
        "termino": c["termino"],
        "tipo": c.get("tipo") or "tema",
        "idioma": c.get("idioma", "es"),
        "plataformas": bloques,
        "prensa": bloque_prensa,
        "tono": tono,
        "temas": _temas_termino(opinion, c["termino"], ahora, cosecha["ventana_dias"],
                                TEMAS_MINIMO),
    }


def derivar(consultas, ahora, salud, gasto, cache=CACHE, prensa=None, archivo=None,
            cosecha=None, solo=None):
    """data/consultas.json: lo que se commitea. Conteos, destacados, prensa,
    tono y temas por termino; sin texto de comentarios ni identidad.

    `prensa` y `archivo` son los diccionarios {cid: bloque} de prensa() y
    archivo(); si faltan, el bloque de prensa lo dice (`sin_dato`) y el de
    archivo se omite, nunca se rellena con cero.
    """
    cosecha = dict(COSECHA_OMISION, **(cosecha or {}))
    dentro = _dentro_por_horas(ahora, cosecha["ventana_dias"] * 24)
    # TODAS las filas, apagadas incluidas: la prensa se lee de todas, y una
    # fila apagada sale con sus tres redes en `sin_dato` (no hay cache ni
    # salud), que es exactamente lo que le paso. `activo` gobierna el gasto,
    # no la existencia del termino.
    return {
        "esquema": 1,
        "generado": ahora,
        "ventana_dias": cosecha["ventana_dias"],
        "ventana_prensa_dias": cosecha["ventana_prensa_dias"],
        "retencion_dias": RETENCION_DIAS,
        "destacados_maximo": cosecha["destacados_maximo"],
        "consultas": [_derivar_consulta(c, ahora, salud, cache, prensa, archivo, cosecha, dentro)
                      for c in _seleccion(consultas, solo)],
        "gasto": gasto,
    }


def publicar_comentarios(doc, ahora, cache=CACHE, visibles=COMENTARIOS_VISIBLES,
                         maximo=COMENTARIOS_MAXIMO, texto_maximo=TEXTO_MAXIMO):
    """data/consultas-comentarios.json (fuera de git): el texto mas votado de
    cada destacado, de las tres plataformas en un solo mapa por url.

    Reusa pulso/redes.py::publicar_comentarios por termino y plataforma -- las
    mismas reglas: solo destacados, «ver mas» solo con likes, menciones
    enmascaradas, brigada y reacciones fuera -- y une los mapas. Las URLs de
    las tres plataformas no chocan: cada una tiene su prefijo.
    """
    por_post = {}
    for c in doc.get("consultas", []):
        for p in PLATAFORMAS:
            bloque = c["plataformas"].get(p) or {}
            if bloque.get("estado") == "sin_dato":
                continue
            comentarios = leer_cache(_dir_cache(cache, c["id"], p))
            parcial = _redes.publicar_comentarios(comentarios, bloque.get("destacados") or [],
                                                  ahora, visibles, maximo, texto_maximo,
                                                  plataforma=p)
            por_post.update(parcial["por_post"])
    return {
        "esquema": 1,
        "generado": ahora,
        "plataforma": "consultas",
        "retencion_dias": RETENCION_DIAS,
        "visibles": visibles,
        "maximo": maximo,
        "por_post": dict(sorted(por_post.items())),
    }
