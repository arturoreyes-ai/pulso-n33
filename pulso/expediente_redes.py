"""Lo mas visto de un ano en redes para un expediente: sus cuentas y TikTok.

El caso: el 2 de octubre de 2026 el expediente de Ismael Burgueno tenia «En
redes» solo desde el 14 de septiembre, porque ahi empieza la historia de la
cosecha propia, y el cliente pidio «lo mas popular, lo mas visto, lo de mas
likes, en todo el ano», con unos 50 comentarios por publicacion «para cuidar
el costo», y solo de dos fuentes: la busqueda de TikTok y las cuentas de la
propia persona. Leer un ano de los 32 medios del catalogo eran ~190 mil posts
(~370 USD) pagados para tirar casi todos; esto lee lo que es suyo y lo que
TikTok devuelve al buscarlo, y paga comentarios solo de lo que se publica.

## Que hace

1. Lista el ano de cada cuenta propia (Instagram, Facebook, TikTok) y corre
   las busquedas de TikTok. Un ano no cabe en los 300 s del endpoint
   sincrono, asi que va por apify.correr_actor_largo, con `maxItems` y
   `maxTotalChargeUsd` en cada corrida. Es una lectura A MANO; el cron no la
   corre y no debe.
2. De la busqueda solo quedan los videos cuyo pie lo NOMBRA (`terminos`) y que
   ademas dicen algo del contexto (`contexto`): el apellido solo no basta,
   hay Burguenos en Sinaloa. Un video de su propia cuenta que aparece en la
   busqueda cuenta como propio.
3. Por mes y por red, las `por_mes` publicaciones de mas merito. El merito es
   de cada red y no se mezcla: vistas en TikTok, likes en Instagram,
   reacciones en Facebook. Son unidades distintas, como en
   publicaciones.ts::ordenarPublicaciones.
4. Solo de esas, `comentarios_por_post` comentarios, una corrida por post
   (asi el tope por post es exacto en los tres actores), y su tono con el
   modelo local si se pide.

## Donde queda cada cosa

- Conteos, el primer renglon del pie y el tono CONTADO: en
  web/src/lib/expedientes/<id>-redes.json, que va a git como el resto del
  expediente. Ningun texto de comentario ni identidad: lo revisa
  validador.validar_expediente_redes antes de escribir.
- El texto: data/expedientes-comentarios.json, que .gitignore excluye por la
  regla `data/*-comentarios.json`, regenerado del cache en cada corrida. El
  cache vive 30 dias desde la lectura, como el de Instagram; pasado eso,
  `--sin-cosecha` rehace el archivo sin texto y los conteos quedan.
- El tono va con consultas.SALVEDAD_TONO: es la excepcion de consultas y de
  seguimiento a la regla 5, no una nueva.

Lo que no esta: YouTube (el feed solo trae 15 entradas por canal) y las
cuentas de los medios del catalogo (ver arriba). Un mes sin publicaciones
de una cuenta leida es un cero medido de ESA cuenta; una red cuya lectura
fallo sale en `sin_dato` y la pantalla lo dice.
"""

import hashlib
import json
import os
import re
from datetime import datetime, timedelta

from . import facebook, instagram, tiktok
from . import redes as _redes
from .apify import correr_actor, correr_actor_largo, en_paralelo, token
from .consultas import SALVEDAD_TONO, _limpiar_comentario, _limpiar_post
from .normalizar import fold

CACHE = os.path.join("cache", "expedientes")
DESTINO = os.path.join("web", "src", "lib", "expedientes")
TEXTO = "expedientes-comentarios.json"
REDES = ("tiktok", "instagram", "facebook")
POR_MES = 3
COMENTARIOS_POR_POST = 50

# El orden de cada red. El url desempata para que dos corridas den lo mismo.
MERITO = {
    "tiktok": ("reproducciones", "likes", "comentarios"),
    "instagram": ("likes", "comentarios", "reproducciones"),
    "facebook": ("likes", "compartidos", "comentarios"),
}
UNIDAD = {"tiktok": "reproducciones", "instagram": "likes", "facebook": "reacciones"}

# Precios del nivel Silver, los de web/src/lib/redes-en-vivo/responder.ts
# (septiembre de 2026). Sirven para el ESTIMADO previo; el gasto real lo dice
# Apify por corrida (`usageTotalUsd`) y es lo que se reporta.
PRECIO = {
    ("tiktok", "post"): 0.0031,         # 0.0023 por video + 0.0008 por filtro
    ("tiktok", "comentario"): 0.00075,
    ("instagram", "post"): 0.0019,
    ("instagram", "comentario"): 0.0019,
    ("facebook", "post"): 0.002,
    ("facebook", "comentario"): 0.0017,
}
TOPE_USD_POR_CORRIDA = 5.0
# Facebook filtra comentarios por antiguedad; un post de hace un ano los
# tiene de hace un ano.
DIAS_COMENTARIOS_FB = 400

CLAVES_PUBLICACION = ("url", "cuenta", "propia", "fecha", "titulo", "likes",
                      "comentarios", "reproducciones", "compartidos")


# ------------------------------------------------------------------ config

def leer_config(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


def expediente(cfg, eid):
    for e in cfg.get("expedientes", []):
        if e.get("id") == eid:
            return e
    raise KeyError("no existe el expediente {!r} en el config".format(eid))


def validar_config(e):
    """Errores de una fila del config. Una cuenta activa sin `verificado` no
    corre: es la regla de las demas redes (sondear antes de encender)."""
    errores = []
    for k in ("id", "persona", "desde", "hasta", "terminos", "contexto", "idioma"):
        if not e.get(k):
            errores.append("{}: falta '{}'".format(e.get("id", "?"), k))
    for c in e.get("cuentas", []):
        et = "{}: cuenta {} {}".format(e.get("id"), c.get("red"), c.get("valor"))
        if c.get("red") not in REDES:
            errores.append("{}: red desconocida".format(et))
        if c.get("activo") and not c.get("verificado"):
            errores.append("{}: activa sin 'verificado'".format(et))
        if not c.get("razon"):
            errores.append("{}: falta 'razon'".format(et))
    for x in e.get("excluidos", []):
        if not str(x.get("url", "")).startswith("https://"):
            errores.append("{}: excluido sin url".format(e.get("id")))
        if len((x.get("razon") or "").strip()) < 12:
            errores.append("{}: el excluido {} necesita 'razon'".format(e.get("id"), x.get("url")))
    for b in e.get("busquedas_tiktok", []):
        if b.get("filtro_fecha", "ALL_TIME") not in tiktok.FILTROS_FECHA:
            errores.append("{}: filtro_fecha {!r}".format(e.get("id"), b.get("filtro_fecha")))
        if b.get("orden", "MOST_LIKED") not in tiktok.ORDENES:
            errores.append("{}: orden {!r}".format(e.get("id"), b.get("orden")))
    return errores


# --------------------------------------------------------------- fuentes

def _fuente(e, red, origen, valor):
    """La fila que esperan los limpiadores de pulso/consultas.py."""
    return {"cuenta": e["id"], "plataforma": red, "origen": origen, "valor": valor,
            "idioma": e.get("idioma", "es")}


def _entrada_cuenta(c, desde):
    red, valor, tope = c["red"], c["valor"], int(c.get("tope_posts") or 500)
    if red == "instagram":
        return {"directUrls": ["https://www.instagram.com/{}/".format(valor.lstrip("@"))],
                "resultsType": "posts", "resultsLimit": tope, "onlyPostsNewerThan": desde}
    if red == "facebook":
        return {"startUrls": [{"url": facebook.url_pagina(valor)}], "resultsLimit": tope,
                "onlyPostsNewerThan": desde}
    return tiktok._entrada_perfil(valor, tope)


def _actor_posts(red):
    return {"tiktok": tiktok.ACTOR_VIDEOS, "instagram": instagram.ACTOR_POSTS,
            "facebook": facebook.ACTOR_POSTS}[red]


def _actor_comentarios(red):
    return {"tiktok": tiktok.ACTOR_COMENTARIOS, "instagram": instagram.ACTOR_COMENTARIOS,
            "facebook": facebook.ACTOR_COMENTARIOS}[red]


def _entrada_comentarios(red, url, cuantos):
    if red == "tiktok":
        return {"postURLs": [url], "commentsPerPost": cuantos, "maxRepliesPerComment": 0}
    if red == "instagram":
        return {"directUrls": [url], "resultsType": "comments", "resultsLimit": cuantos}
    return facebook._entrada_comentarios([url], cuantos, DIAS_COMENTARIOS_FB)


def tareas(e):
    """Las lecturas de la pasada 1, en orden FIJO: cuentas y luego busquedas.

    El orden importa: una publicacion vista por dos caminos se queda con el
    primero, y asi un video propio que la busqueda tambien trae sigue siendo
    propio.
    """
    salida = []
    for c in e.get("cuentas", []):
        if c.get("activo") and c.get("verificado"):
            salida.append({"red": c["red"], "origen": "cuenta", "valor": c["valor"],
                           "tope": int(c.get("tope_posts") or 500),
                           "entrada": _entrada_cuenta(c, e["desde"])})
    for b in e.get("busquedas_tiktok", []):
        tope = int(b.get("tope") or 100)
        salida.append({"red": "tiktok", "origen": "busqueda", "valor": b["consulta"],
                       "tope": tope,
                       "entrada": tiktok._entrada_videos(b["consulta"], tope,
                                                         b.get("filtro_fecha", "ALL_TIME"),
                                                         b.get("orden", "MOST_LIKED"))})
    return salida


def estimado_usd(e):
    """Lo peor que puede costar una corrida completa, antes de llamar a nada."""
    posts = sum(t["tope"] * PRECIO[(t["red"], "post")] for t in tareas(e))
    por_mes = int(e.get("por_mes") or POR_MES)
    cuantos = int(e.get("comentarios_por_post") or COMENTARIOS_POR_POST)
    meses = len(meses_de(e["desde"], e["hasta"]))
    redes = {t["red"] for t in tareas(e)}
    coms = sum(meses * por_mes * cuantos * PRECIO[(r, "comentario")] for r in redes)
    return round(posts + coms, 2)


# ----------------------------------------------------------------- filtros

def _palabras(texto):
    return " {} ".format(re.sub(r"[^a-z0-9@#]+", " ", fold(texto)))


def _contiene(texto, termino):
    """Palabra entera, plegada: «Burgueno» no empata «burguenomania»."""
    aguja = " {} ".format(re.sub(r"[^a-z0-9@#]+", " ", fold(termino)).strip())
    return aguja.strip() != "" and aguja in _palabras(texto)


def nombra(texto, e):
    """El pie lo nombra (uno de `terminos`) y dice algo del contexto.

    El contexto existe porque el apellido es comun fuera de Tijuana: una
    busqueda por nombre trae a cualquiera que se llame igual.
    """
    if not any(_contiene(texto, t) for t in e["terminos"]):
        return False
    return any(_contiene(texto, c) for c in e["contexto"])


def _texto_crudo(item, red):
    if red == "instagram":
        return item.get("caption") or ""
    return item.get("text") or item.get("message") or ""


def _propias(e):
    """Handles propios plegados, por red, para reconocer lo suyo en la busqueda."""
    salida = {}
    for c in e.get("cuentas", []):
        salida.setdefault(c["red"], set()).add(fold(c["valor"]).lstrip("@").strip("/"))
    return salida


def limpiar(item, tarea, e, ahora):
    """(registro, motivo). Lista blanca de la red, y luego la ventana del ano."""
    red = tarea["red"]
    fuente = _fuente(e, red, tarea["origen"], tarea["valor"])
    crudo = _texto_crudo(item, red)
    if tarea["origen"] == "busqueda" and not nombra(crudo, e):
        return None, "no_lo_nombra"
    base, motivo = _limpiar_post(item, fuente, ahora)
    if base is None:
        return None, motivo
    fecha = base.get("fecha") or ""
    if not (e["desde"] <= fecha <= e["hasta"]):
        return None, "fuera_de_ventana"
    if red == "tiktok":
        quien = base.get("creador") or ""
        propia = fold(quien).lstrip("@") in _propias(e).get("tiktok", set())
        if tarea["origen"] == "cuenta" and not propia:
            return None, "otro_creador"
    else:
        quien = tarea["valor"]
        propia = True
    salida = {"url": base["url"], "red": red, "cuenta": quien, "propia": propia,
              "origen": tarea["origen"], "fecha": fecha, "titulo": base.get("titulo") or "",
              "likes": int(base.get("likes") or 0),
              "comentarios": int(base.get("comentarios") or 0)}
    for k in ("reproducciones", "compartidos"):
        if base.get(k):
            salida[k] = int(base[k])
    return salida, None


# ---------------------------------------------------------------- seleccion

def meses_de(desde, hasta):
    """'AAAA-MM' de cada mes de la ventana, en orden."""
    a, m = int(desde[:4]), int(desde[5:7])
    fin = (int(hasta[:4]), int(hasta[5:7]))
    salida = []
    while (a, m) <= fin:
        salida.append("{:04d}-{:02d}".format(a, m))
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    return salida


def _clave_merito(p):
    return tuple(-int(p.get(k) or 0) for k in MERITO[p["red"]]) + (p["url"],)


def excluidas(e):
    """URLs que una persona saco a mano, con su `razon` en el config.

    El caso, 5 de octubre de 2026: el TikTok mas visto del ano (301,592
    vistas, @patrullaespiritual33) nombraba a Burgueno en el pie y no trataba
    de el, y un video de un agente de Movilidad pidiendo «mordida» lo nombraba
    en la descripcion sin ser sobre el. El filtro de `nombra` lee el pie, no de
    que trata el video, y ningun filtro de texto lo sabe. Se compara por URL
    porque la de TikTok, Instagram y Facebook no cambia entre lecturas, al
    reves que el token de Google en la prensa de consultas.
    """
    return {x["url"] for x in e.get("excluidos", [])}


def seleccionar(publicaciones, e):
    """{red: {mes: [publicaciones]}} con las `por_mes` de mas merito.

    Lo excluido a mano no compite: su lugar lo toma la siguiente del mes."""
    por_mes = int(e.get("por_mes") or POR_MES)
    fuera = excluidas(e)
    salida = {}
    for p in sorted(publicaciones.values(), key=_clave_merito):
        if p["url"] in fuera:
            continue
        lista = salida.setdefault(p["red"], {}).setdefault(p["fecha"][:7], [])
        if len(lista) < por_mes:
            lista.append(p)
    return salida


# ------------------------------------------------------------------ sondeo

def _quien_es(red, items):
    """Lo que la cuenta dice de si misma en el primer resultado: nombre,
    seguidores y verificacion. Es la cuenta publica que se sondea, no un
    comentarista, y no se escribe en ningun archivo."""
    if not items:
        return {}
    it = items[0]
    if red == "instagram":
        return {"nombre": it.get("fullName") or it.get("ownerFullName"),
                "seguidores": it.get("followersCount"), "posts": it.get("postsCount"),
                "verificada": it.get("verified"), "bio": (it.get("biography") or "")[:120]}
    if red == "tiktok":
        a = it.get("authorMeta") or {}
        return {"nombre": a.get("nickName"), "handle": a.get("name"), "seguidores": a.get("fans"),
                "verificada": a.get("verified"), "bio": (a.get("signature") or "")[:120]}
    return {"nombre": it.get("pageName") or (it.get("user") or {}).get("name"),
            "url": it.get("facebookUrl") or it.get("pageUrl")}


def probar(e, ahora, tok, correr=correr_actor, cuantos=5):
    """Pocos resultados de cada cuenta (encendida o no) y de cada busqueda.

    Imprime quien es la cuenta y, de la busqueda, cuantos videos lo nombran;
    no escribe nada. Cuesta ~cuantos resultados por fila.
    """
    filas = []
    for c in e.get("cuentas", []):
        t = {"red": c["red"], "origen": "cuenta", "valor": c["valor"], "tope": cuantos}
        entrada = (_entrada_cuenta(dict(c, tope_posts=cuantos), e["desde"])
                   if c["red"] != "instagram" else
                   {"directUrls": ["https://www.instagram.com/{}/".format(c["valor"].lstrip("@"))],
                    "resultsType": "details", "resultsLimit": 1})
        try:
            items = correr(_actor_posts(c["red"]), entrada, tok, cuantos)
        except Exception as ex:     # noqa: BLE001 -- se reporta por fila
            filas.append({**t, "estado": "fallo", "error": str(ex)[:200]})
            continue
        filas.append({**t, "estado": "ok", "leidas": len(items), "quien": _quien_es(c["red"], items)})
    for b in e.get("busquedas_tiktok", []):
        t = {"red": "tiktok", "origen": "busqueda", "valor": b["consulta"], "tope": cuantos}
        entrada = tiktok._entrada_videos(b["consulta"], cuantos, b.get("filtro_fecha", "ALL_TIME"),
                                         b.get("orden", "MOST_LIKED"))
        try:
            items = correr(tiktok.ACTOR_VIDEOS, entrada, tok, cuantos)
        except Exception as ex:     # noqa: BLE001
            filas.append({**t, "estado": "fallo", "error": str(ex)[:200]})
            continue
        muestra = []
        for it in items:
            p, motivo = limpiar(it, t, e, ahora)
            # Lo descartado tambien muestra su primer renglon: es el pie que el
            # creador publico, y sin verlo no se sabe si el filtro tira de mas.
            muestra.append({"motivo": motivo, "creador": (p or {}).get("cuenta"),
                            "fecha": (p or {}).get("fecha"),
                            "titulo": (p or {}).get("titulo") or _redes._titulo(it.get("text")),
                            "reproducciones": (p or {}).get("reproducciones")})
        filas.append({**t, "estado": "ok", "leidas": len(items), "muestra": muestra})
    return filas


# ------------------------------------------------------------------ cosecha

def _dir(cache, eid, red=None):
    return os.path.join(cache, eid, red) if red else os.path.join(cache, eid)


def leer_catalogo(cache, eid):
    ruta = os.path.join(_dir(cache, eid), "publicaciones.json")
    if not os.path.exists(ruta):
        return {}, {}
    with open(ruta, encoding="utf-8") as fh:
        doc = json.load(fh)
    return doc.get("publicaciones", {}), doc.get("fuentes", {})


def guardar_catalogo(cache, eid, publicaciones, fuentes):
    """El catalogo NO se poda a 30 dias como el de las redes: es el ano entero
    a proposito, y lleva lo mismo que va a git (conteos y primer renglon)."""
    os.makedirs(_dir(cache, eid), exist_ok=True)
    with open(os.path.join(_dir(cache, eid), "publicaciones.json"), "w",
              encoding="utf-8", newline="\n") as fh:
        json.dump({"publicaciones": dict(sorted(publicaciones.items())),
                   "fuentes": dict(sorted(fuentes.items()))},
                  fh, ensure_ascii=False, indent=1)


def _clave_fuente(t):
    """Una clave por lectura. Lleva orden y filtro: el 2 de octubre de 2026 dos
    busquedas de la misma frase (ALL_TIME y LAST_6_MONTHS) compartian clave y
    la segunda borro las cifras de la primera."""
    e = t.get("entrada") or {}
    return "{}|{}|{}|{}|{}".format(t["red"], t["origen"], t["valor"],
                                    e.get("videoSearchSorting", ""), e.get("videoSearchDateFilter", ""))


def listar(e, ahora, tok, correr=correr_actor_largo, tope_usd=TOPE_USD_POR_CORRIDA):
    """Pasada 1. Devuelve (publicaciones, fuentes, usd). Una fuente que falla
    queda en `fuentes` con su error y no tumba a las demas."""
    lista = tareas(e)
    pedidos = en_paralelo([
        (lambda t=t: correr(_actor_posts(t["red"]), t["entrada"], tok, t["tope"],
                            max_usd=tope_usd))
        for t in lista])
    publicaciones, fuentes, usd = {}, {}, 0.0
    for t, (res, error) in zip(lista, pedidos):
        clave = _clave_fuente(t)
        if error is not None:
            fuentes[clave] = {"estado": "fallo", "error": "{}: {}".format(
                type(error).__name__, error)[:200], "leidas": 0, "quedan": 0}
            continue
        items, estado, gasto = res
        usd += gasto
        quedan, motivos = 0, {}
        for it in items:
            p, motivo = limpiar(it, t, e, ahora)
            if p is None:
                motivos[motivo] = motivos.get(motivo, 0) + 1
                continue
            quedan += 1
            if p["url"] not in publicaciones:
                publicaciones[p["url"]] = p
            else:
                # La misma publicacion por dos caminos: gana el primero, pero
                # las cifras son las de la lectura mas reciente.
                viejo = publicaciones[p["url"]]
                for k in ("likes", "comentarios", "reproducciones", "compartidos"):
                    if k in p:
                        viejo[k] = max(viejo.get(k, 0), p[k])
        fuentes[clave] = {"estado": "ok" if estado == "SUCCEEDED" else estado.lower(),
                          "leidas": len(items), "quedan": quedan,
                          "descartes": dict(sorted(motivos.items()))}
    return publicaciones, fuentes, round(usd, 4)


def comentar(e, seleccion, ahora, tok, cache, correr=correr_actor):
    """Pasada 2: comentarios de lo seleccionado que aun no se leyo.

    Devuelve (comentarios nuevos, {red: resultados facturados}, fallos), con
    `fallos` = [(url, error)]. Un post ya leido no se vuelve a pagar: `vistos`
    por red, como en las demas cosechas. Un post cuya lectura fallo NO entra a
    `vistos`, asi que la siguiente corrida lo intenta otra vez. El caso, 5 de
    octubre de 2026: la cuenta de Apify llego a su tope mensual (403
    «Monthly usage hard limit exceeded») y los tres TikToks que subieron tras
    una exclusion quedaron sin comentarios sin que la corrida lo dijera.
    """
    cuantos = int(e.get("comentarios_por_post") or COMENTARIOS_POR_POST)
    nuevos, facturados, fallos = [], {}, []
    for red, meses in sorted(seleccion.items()):
        d = _dir(cache, e["id"], red)
        _redes.purgar(d, ahora)
        vistos = _redes.leer_vistos(d)
        urls = [p["url"] for _, lista in sorted(meses.items()) for p in lista
                if p["comentarios"] > 0 and not vistos.get(p["url"])]
        pedidos = en_paralelo([
            (lambda u=u: correr(_actor_comentarios(red), _entrada_comentarios(red, u, cuantos),
                                tok, cuantos))
            for u in urls])
        fuente = _fuente(e, red, "cuenta", e["id"])
        propios = []
        for u, (crudos, error) in zip(urls, pedidos):
            if error is not None:
                fallos.append((u, "{}: {}".format(type(error).__name__, error)[:200]))
                continue
            facturados[red] = facturados.get(red, 0) + len(crudos)
            # Una corrida por post: el post de cada comentario es el pedido,
            # sin adivinarlo de la forma de URL que devuelva cada actor.
            for c in crudos[:cuantos]:
                limpio = _limpiar_comentario(red, c, u, fuente, "nacional")
                if limpio:
                    propios.append(limpio)
            vistos[u] = ahora[:10]
        _redes.guardar_cache(propios, ahora, d)
        _redes.guardar_vistos(vistos, d)
        nuevos.extend(propios)
    return nuevos, facturados, fallos


def usd_comentarios(facturados):
    """Estimado a precio de lista: el actor de comentarios corre por post y el
    endpoint sincrono no devuelve el cargo, asi que aqui no hay cifra de Apify."""
    return round(sum(n * PRECIO[(r, "comentario")] for r, n in facturados.items()), 4)


def clasificar(cache, e, analizador):
    """Tono de cada comentario del cache, con el modelo local. Solo en el
    idioma declarado de la fila, nunca adivinado del texto."""
    total = 0
    for red in REDES:
        etiquetados, _ = _redes.clasificar_cache(_dir(cache, e["id"], red), analizador)
        total += etiquetados
    return total


# ----------------------------------------------------------------- derivado

def _comentarios_por_post(cache, eid):
    salida = {}
    for red in REDES:
        for c in _redes.leer_cache(_dir(cache, eid, red)):
            salida.setdefault(c["post"], []).append(c)
    return salida


def derivar(e, publicaciones, fuentes, ahora, cache, gasto=None):
    """El documento de git: por mes y por red, conteos, sin texto."""
    seleccion = seleccionar(publicaciones, e)
    coms = _comentarios_por_post(cache, e["id"])
    leidas = {r for r in REDES if any(
        k.startswith(r + "|") and f.get("estado") in ("ok", "timed-out", "aborted")
        for k, f in fuentes.items())}
    meses = []
    for mes in meses_de(e["desde"], e["hasta"]):
        por_red = {}
        for red in REDES:
            if red not in leidas:
                continue
            filas = []
            for p in seleccion.get(red, {}).get(mes, []):
                fila = {k: p[k] for k in CLAVES_PUBLICACION if k in p}
                lista = coms.get(p["url"], [])
                fila["cosechados"] = len(lista)
                if lista:
                    fila["tono"] = _redes._conteo_tono(lista)[0]
                filas.append(fila)
            por_red[red] = filas
        meses.append({"mes": mes, "redes": por_red})
    return {
        "nota": ("Escrito por `python -m pulso expediente-redes` (pulso/expediente_redes.py). "
                 "Conteos y el primer renglon de cada pie; el texto de los comentarios "
                 "vive fuera de git, en data/" + TEXTO + "."),
        "id": e["id"],
        "generado": ahora,
        "desde": e["desde"],
        "hasta": e["hasta"],
        "por_mes": int(e.get("por_mes") or POR_MES),
        # Cuantas se sacaron a mano y estaban en lo leido: una lista curada que
        # no lo dijera afirmaria que la lectura trajo exactamente esto.
        "excluidos": len(excluidas(e) & set(publicaciones)),
        "comentarios_por_post": int(e.get("comentarios_por_post") or COMENTARIOS_POR_POST),
        "unidades": {r: UNIDAD[r] for r in REDES},
        "sin_dato": [r for r in REDES if r not in leidas],
        "fuentes": [dict(zip(("red", "origen", "valor", "orden", "filtro"), k.split("|")),
                         **{x: v for x, v in f.items() if x != "error"})
                    for k, f in sorted(fuentes.items())],
        "salvedad_tono": SALVEDAD_TONO,
        "gasto": gasto or {"resultados": 0, "usd": 0},
        "meses": meses,
    }


def firma(lista):
    """Huella de la lista de comentarios publicada de un post, en su orden.

    Un resumen se escribe sobre UNA lista y sus temas citan posiciones de ella;
    si la lista cambia (una relectura, la purga de 30 dias) las posiciones ya
    no apuntan a lo mismo y el resumen no se publica. web/scripts/
    resumir-expediente.cjs calcula la misma huella: sha256 de los textos
    unidos por salto de linea, 16 hex.
    """
    crudo = "\n".join(c["texto"] for c in lista)
    return hashlib.sha256(crudo.encode("utf-8")).hexdigest()[:16]


def leer_resumenes(cache, eid):
    """Los resumenes que escribio web/scripts/resumir-expediente.cjs."""
    ruta = os.path.join(_dir(cache, eid), "resumenes.json")
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


def publicar_texto(e, doc, ahora, cache, previo=None):
    """El archivo de texto, fuera de git: los comentarios de cada post del doc
    y el resumen de IA de cada uno, si lo hay y sigue valiendo.

    Hasta `comentarios_por_post` por post, no los diez de /redes: es lo que la
    hoja del expediente muestra al abrir una publicacion (cliente, 5 de octubre
    de 2026: el resumen por publicacion de «En redes», en «El año en redes»).
    Fuera la brigada y las reacciones, como en todo archivo de texto.

    Un resumen deriva del texto y vive lo mismo: se publica solo si su `firma`
    es la de la lista de hoy y si no pasa de la retencion del cache.
    """
    cuantos = int(e.get("comentarios_por_post") or COMENTARIOS_POR_POST)
    seleccionadas = [{"url": p["url"]} for m in doc["meses"]
                     for lista in m["redes"].values() for p in lista]
    todos = [c for lista in _comentarios_por_post(cache, e["id"]).values() for c in lista]
    hecho = _redes.publicar_comentarios(todos, seleccionadas, ahora, visibles=cuantos,
                                        maximo=cuantos, plataforma="varias")
    corte = (datetime.fromisoformat(ahora) - timedelta(days=_redes.RETENCION_DIAS)).isoformat()
    resumenes = {}
    for url, r in sorted(leer_resumenes(cache, e["id"]).items()):
        lista = hecho["por_post"].get(url)
        if not lista or r.get("firma") != firma(lista) or (r.get("fecha") or "") < corte:
            continue
        resumenes[url] = {"texto": r["texto"], "leidos": r["leidos"], "fecha": r["fecha"],
                          "temas": [{"nombre": t["nombre"], "detalle": t["detalle"],
                                     "comentarios": t["comentarios"]} for t in r.get("temas", [])]}
    salida = dict(previo or {"esquema": 2, "expedientes": {}})
    salida.update({"esquema": 2, "generado": ahora, "retencion_dias": _redes.RETENCION_DIAS})
    salida.pop("visibles", None)
    salida.pop("maximo", None)
    expedientes = {k: v for k, v in (salida.get("expedientes") or {}).items()
                   if isinstance(v, dict) and "comentarios" in v}
    expedientes[e["id"]] = {"visibles": hecho["visibles"], "maximo": hecho["maximo"],
                            "comentarios": hecho["por_post"], "resumenes": resumenes}
    salida["expedientes"] = dict(sorted(expedientes.items()))
    return salida
