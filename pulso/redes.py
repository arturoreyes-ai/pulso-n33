"""Nucleo comun de los paneles de redes: cache, conteos, destacados y texto.

Existe porque el 8 de septiembre de 2026 se pidio una seccion de TikTok "igual
que la de Instagram", y la de Instagram tenia ~800 lineas de las que solo
`_limpiar`, `_limpiar_post`, `sondear` y `cosechar` hablaban de Instagram. Lo
demas -- el cache con retencion, la marca de brigada, las cinco cubetas de
tono, el cruce con temas de prensa, la union de top-15 general y por zona, el
archivo de texto de efimero/ con la regla del "ver mas" -- es la misma logica
para cualquier plataforma, y copiarla dos veces era garantizar que una
correccion llegara a una sola.

Lo que NO vive aqui, a proposito:

- `cosechar`. Cada modulo de plataforma tiene el suyo porque es el punto que
  las pruebas parchean (`patch.object(instagram, "correr_actor", ...)`), y
  `cosechar` resuelve `correr_actor` en el modulo donde esta definido.
- Los `_limpiar*`. Son la lista blanca de campos del actor de cada
  plataforma; la identidad se tira ahi, con los nombres de campo que ese
  actor usa.
- Cualquier `cache=` por omision. Un modulo neutro con `cache/instagram` de
  omision es el bug del cache equivocado esperando a pasar: aqui `cache` es
  obligatorio en todas las funciones.

Las reglas de fondo estan en el encabezado de pulso/instagram.py y en
AGENTS.md: el texto crudo vive en cache/ (30 dias, fuera de git), a data/
llegan conteos y posts destacados, el texto publicado va a efimero/ (fuera de
git), y la identidad de quien comenta no se guarda en ningun lado.
"""

import hashlib
import json
import os
import re
from datetime import datetime, timedelta

from .normalizar import fold

# Mismo plazo que YouTube. Meta y TikTok no conceden ninguno: se aplica el mas
# corto ya implementado (LFPDPPP y CPRA).
RETENCION_DIAS = 30

# Un post no se vuelve a cosechar antes de esto. Sin este freno el cron paga
# cuatro veces al dia por los mismos comentarios.
DIAS_ENTRE_COSECHAS = 3

# Tope de la lista de posts destacados. La ventana la fija cada plataforma --
# desde el 10 de septiembre de 2026 las dos la miden en horas sobre
# `publicado`; Instagram la midio en dias sobre `fecha` hasta entonces -- y se
# calcula con `ahora` inyectado; el tablero nunca la recalcula.
DESTACADOS_MAXIMO = 15
# Cuantas publicaciones de una misma cuenta entran ANTES de que las demas
# tengan la suya. Con 1: primero la mejor de cada cuenta y lo que sobre del
# tope se sigue llenando por likes. Subirlo a 2 da mas variedad y cuesta los
# segundos puestos del que mas suena; es la perilla, y no hay otra.
VUELTAS_GARANTIZADAS = 1
# El pie de un post puede tener parrafos; se publica su primera linea como
# titular, recortada. 160 es el largo con que ya se leen los titulares.
TITULO_MAXIMO = 160

# Comentarios publicados por post en efimero/: los primeros VISIBLES siempre;
# del sexto al MAXIMO solo si tienen likes (regla del cliente del 8 de
# septiembre de 2026). El texto se recorta: la mediana del cache de Instagram
# es 30 caracteres y el maximo 807.
COMENTARIOS_VISIBLES = 5
COMENTARIOS_MAXIMO = 10
TEXTO_MAXIMO = 300

# Archivos del cache que NO son una cosecha diaria: los recorridos que leen
# comentarios los saltan, y purgar() no los borra.
REGISTROS = ("vistos.json", "publicaciones.json")

# Una mencion dentro de un comentario es la identidad de un TERCERO, y la
# regla de no publicar identidad no distingue entre quien escribe y a quien
# etiqueta. El caso: la primera publicacion (8 de septiembre de 2026) saco un
# comentario que era solo "@aa_boxeador". Se enmascara al publicar, y un
# comentario que no dice nada mas que la mencion no se publica.
RE_MENCION = re.compile(r"@[A-Za-z0-9_.]{2,}")
MENCION_ENMASCARADA = "@…"

ETIQUETAS_TONO = {"POS": "positivo", "NEG": "negativo", "NEU": "neutral"}

# Un mismo texto repetido en tantos posts DISTINTOS de la misma fuente ya no
# es conversacion, es una sola persona insistiendo. El caso: la cosecha del
# 8 de septiembre de 2026 trajo "PAGINA DE 4SC0 Y APARTE FAKE!!" identico en
# NUEVE posts de AFN, el 20% de los comentarios de esa cuenta. El deduplicado
# no lo agarra a proposito -- el id es sha256(post|texto) porque el mismo
# comentario en dos posts si son dos hechos -- y plegar el texto tampoco,
# porque el "4SC0" es evasion deliberada y no un acento.
UMBRAL_BRIGADA = 3


def _hoy(ahora):
    return ahora[:10]


def _id_comentario(post_url, texto):
    """sha256(post|texto plegado). Estable entre corridas, sin identidad."""
    crudo = "{}|{}".format(post_url, fold(texto)[:400])
    return hashlib.sha256(crudo.encode("utf-8")).hexdigest()[:16]


def _titulo(caption, maximo=TITULO_MAXIMO):
    """Primera linea no vacia del pie, espacios colapsados, recortada.

    El pie de un post de noticias suele ser titular + parrafo + hashtags; solo
    el primer renglon es el titular, y es lo unico que se publica.
    """
    for linea in (caption or "").splitlines():
        limpio = " ".join(linea.split())
        if limpio:
            if len(limpio) > maximo:
                return limpio[:maximo - 1].rstrip() + "…"
            return limpio
    return ""


# -------------------------------------------------------------- sentimiento

def _sentimiento_vigente(s, modelo):
    return isinstance(s, dict) and s.get("modelo") == modelo and s.get("etiqueta")


def clasificar_cache(cache, analizador=None):
    """Etiqueta el tono de cada comentario y lo guarda EN EL CACHE.

    Igual que en pulso/youtube.py: la etiqueta vive los mismos 30 dias que el
    texto y nunca sale de ahi; a data/ solo llegan conteos. Volver a correr es
    barato porque solo se manda lo que no traiga etiqueta vigente del mismo
    modelo.

    La diferencia con YouTube: **solo se etiqueta lo que esta en un idioma que
    el modelo habla**. El analizador es espanol (RoBERTuito) y a texto en otro
    idioma no devuelve error, devuelve una etiqueta plausible -- fue asi como
    98 notas de San Diego llevaron meses con tono calculado por un modelo que
    no lee ingles. El idioma sale del config de cada plataforma, nunca del
    texto.
    """
    if not os.path.isdir(cache):
        return 0, 0
    if analizador is None:
        from .sentimiento import Analizador
        analizador = Analizador()
    modelo = getattr(analizador, "modelo", None)
    idioma_modelo = getattr(analizador, "idioma", "es")

    etiquetados = omitidos = 0
    for nombre in sorted(os.listdir(cache)):
        if not nombre.endswith(".json") or nombre in REGISTROS:
            continue
        ruta = os.path.join(cache, nombre)
        registros = leer_archivo(ruta)
        otro_idioma = [c for c in registros if c.get("idioma") != idioma_modelo]
        omitidos += len(otro_idioma)
        pendientes = [c for c in registros
                      if c.get("idioma") == idioma_modelo
                      and not _sentimiento_vigente(c.get("sentimiento"), modelo)]
        if not pendientes:
            continue
        for c, r in zip(pendientes,
                        analizador.predecir([c.get("texto") or "" for c in pendientes])):
            c["sentimiento"] = {"etiqueta": r["etiqueta"], "confianza": r["confianza"],
                                "modelo": r["modelo"]}
        with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(sorted(registros, key=lambda c: c["id"]),
                      fh, ensure_ascii=False, indent=1)
        etiquetados += len(pendientes)
    return etiquetados, omitidos


# ------------------------------------------------------------------ cache

def purgar(cache, ahora, retencion=RETENCION_DIAS):
    """Tira los archivos de cosecha que pasaron la ventana de retencion.

    `ahora` se inyecta, nunca se lee del reloj: ver el invariante de tiempo
    en AGENTS.md.
    """
    if not os.path.isdir(cache):
        return 0
    corte = (datetime.fromisoformat(ahora) - timedelta(days=retencion)).date().isoformat()
    tirados = 0
    for nombre in sorted(os.listdir(cache)):
        if not nombre.endswith(".json") or nombre in REGISTROS:
            continue
        if nombre[:-5] < corte:
            os.remove(os.path.join(cache, nombre))
            tirados += 1
    return tirados


def leer_archivo(ruta):
    if not os.path.exists(ruta):
        return []
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


def leer_cache(cache):
    """Todos los comentarios vigentes, deduplicados por id."""
    if not os.path.isdir(cache):
        return []
    por_id = {}
    for nombre in sorted(os.listdir(cache)):
        if not nombre.endswith(".json") or nombre in REGISTROS:
            continue
        for c in leer_archivo(os.path.join(cache, nombre)):
            por_id[c["id"]] = c
    return sorted(por_id.values(), key=lambda c: c["id"])


def guardar_cache(nuevos, ahora, cache):
    if not nuevos:
        return None
    os.makedirs(cache, exist_ok=True)
    ruta = os.path.join(cache, "{}.json".format(_hoy(ahora)))
    por_id = {c["id"]: c for c in leer_archivo(ruta)}
    for c in nuevos:
        por_id[c["id"]] = {**por_id.get(c["id"], {}), **c}
    with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(sorted(por_id.values(), key=lambda c: c["id"]),
                  fh, ensure_ascii=False, indent=1)
    return ruta


def leer_vistos(cache):
    return leer_archivo(os.path.join(cache, "vistos.json")) or {}


def guardar_vistos(vistos, cache):
    os.makedirs(cache, exist_ok=True)
    with open(os.path.join(cache, "vistos.json"), "w",
              encoding="utf-8", newline="\n") as fh:
        json.dump(dict(sorted(vistos.items())), fh, ensure_ascii=False, indent=1)


def leer_publicaciones(cache):
    """Catalogo de posts vistos, {url: registro de _limpiar_post}."""
    return leer_archivo(os.path.join(cache, "publicaciones.json")) or {}


def guardar_publicaciones(publicaciones, ahora, cache, retencion=RETENCION_DIAS):
    """Escribe el catalogo, podado a la misma retencion que el texto.

    El pie de un medio no es dato personal, pero una sola regla de retencion
    es mas facil de sostener que dos. Un registro sin `fecha` (el actor no
    trajo timestamp) se poda tambien: sin fecha no puede entrar a la ventana
    de destacados y guardarlo seria acumular basura.
    """
    os.makedirs(cache, exist_ok=True)
    corte = (datetime.fromisoformat(ahora) - timedelta(days=retencion)).date().isoformat()
    vivas = {u: p for u, p in publicaciones.items() if (p.get("fecha") or "") >= corte}
    with open(os.path.join(cache, "publicaciones.json"), "w",
              encoding="utf-8", newline="\n") as fh:
        json.dump(dict(sorted(vivas.items())), fh, ensure_ascii=False, indent=1)
    return vivas


def pendientes(urls, vistos, ahora, dias=DIAS_ENTRE_COSECHAS):
    """URLs que toca cosechar. El resto ya se pago hace poco."""
    corte = (datetime.fromisoformat(ahora) - timedelta(days=dias)).date().isoformat()
    return [u for u in urls if (vistos.get(u) or "") < corte]


# --------------------------------------------------------------- derivados

def _sin_palabras(texto):
    """True si no queda nada al quitar emoji y puntuacion: es una reaccion."""
    return not any(c.isalnum() for c in texto)


def _marcar_repetidos(comentarios, umbral=UMBRAL_BRIGADA):
    """Marca los textos que se repiten en varios posts de la MISMA fuente.

    Se marca, no se borra: borrar dato crudo por sospecha es una decision que
    el panel no puede revisar despues. Lo que si se hace es dejarlos fuera de
    los conteos por tema, porque ahi una sola persona inflaria un tema entero.

    "Fuente" es `cuenta`: en Instagram una cuenta de medio, en TikTok una
    busqueda entera. Ahi la regla es mas estricta -- el mismo texto en tres
    videos de toda la busqueda -- y se acepta asi.
    """
    posts_por_texto = {}
    for c in comentarios:
        clave = (c["cuenta"], fold(c["texto"]))
        posts_por_texto.setdefault(clave, set()).add(c["post"])
    for c in comentarios:
        clave = (c["cuenta"], fold(c["texto"]))
        c["repetido_en"] = len(posts_por_texto[clave])
        c["brigada"] = c["repetido_en"] >= umbral
    return comentarios


def _conteo_tono(opinion):
    """Cinco cubetas que suman exactamente len(opinion).

    Cada comentario de opinion cae en UNA: las tres etiquetas, o
    `sin_modelo_idioma` si el modelo no habla su idioma, o `sin_clasificar` si
    el modelo no corrio. Sin las dos ultimas, un modelo apagado se veria como
    "todo neutral". Nunca se cruza con figuras (PRODUCT.md, cuarta regla).
    Devuelve (conteo, modelo_usado).
    """
    conteo = {"positivo": 0, "negativo": 0, "neutral": 0,
              "sin_clasificar": 0, "sin_modelo_idioma": 0}
    modelo_usado = None
    for c in opinion:
        if c.get("idioma") != "es":
            conteo["sin_modelo_idioma"] += 1
            continue
        s = c.get("sentimiento")
        if not isinstance(s, dict) or not s.get("etiqueta"):
            conteo["sin_clasificar"] += 1
            continue
        modelo_usado = modelo_usado or s.get("modelo")
        conteo[ETIQUETAS_TONO.get(s["etiqueta"], "neutral")] += 1
    return conteo, modelo_usado


def _contar_temas(opinion, temas, con_posts=True):
    """Cruza los temas de prensa con la opinion. Solo opinion: ver derivar()."""
    salida = []
    for t in (temas or []):
        termino = t.get("termino") if isinstance(t, dict) else None
        if not termino:
            continue
        aguja = fold(termino)
        casos = [c for c in opinion if aguja in fold(c["texto"])]
        if not casos:
            continue
        fila = {"tema": termino, "comentarios": len(casos)}
        if con_posts:
            # Cuantos posts DISTINTOS lo sostienen. Sin esto un tema de un
            # solo post parece conversacion de la ciudad: es la leccion del
            # cluster "agua" de YouTube, que resulto ser un solo vlog.
            fila["posts"] = len(set(c["post"] for c in casos))
        salida.append(fila)
    salida.sort(key=lambda t: (-t["comentarios"], t["tema"]))
    return salida


def _orden_destacado(p):
    return (-p["likes"], -p["comentarios"], p["url"])


def _por_turnos(candidatos, maximo, vueltas=VUELTAS_GARANTIZADAS):
    """Los `maximo` de `candidatos`, con una vuelta por cuenta antes del merito.

    El caso: entre el 15 y el 17 de septiembre de 2026 tjnoticias_ig encabezo
    TODAS las corridas de Tijuana con entre siete y diez de los quince lugares,
    y la zona bajo a entre dos y cuatro cuentas de las doce activas. afn_ig no
    entro una sola vez en veinte corridas teniendo comentarios cosechados en
    todas. Una cuenta con mas seguidores gana todos los desempates de likes, y
    sin repartir la primera vuelta el panel de una ciudad de doce medios es el
    panel de uno.

    `candidatos` ya viene en `_orden_destacado`, asi que el turno de un post
    dentro de su cuenta es su posicion en esa cola y la primera vuelta sale en
    orden de likes: el post mas grande de la zona sigue siendo el primero.

    NO es una cuota por cuenta, y la diferencia es el motivo de `min`: pasada
    la primera vuelta todos compiten por likes otra vez. Un turno a secas
    sentaria los tres posts de un medio de diez likes por delante de tres de
    nueve mil, que es justo lo que el cliente pidio no hacer.

    Tampoco rellena: emite los mismos `min(maximo, len(candidatos))` de
    siempre. Donde publica una sola cuenta -- Tecate, `estatal`, y elvigia_ig
    con los catorce de Ensenada -- `min(turno, vueltas)` vale 0 y luego 1 en
    una lista ya ordenada por likes, asi que la salida es identica a la de
    antes. Inventar un hueco es el mismo error que rellenarlo (regla 4).
    """
    turno, vistos = {}, {}
    for d in candidatos:
        n = vistos.get(d["cuenta"], 0)
        turno[d["url"]] = n
        vistos[d["cuenta"]] = n + 1
    orden = sorted(candidatos,
                   key=lambda d: (min(turno[d["url"]], vueltas),) + _orden_destacado(d))
    return orden[:maximo]


def _dentro_por_dias(ahora, ventana_dias):
    """Predicado de ventana en dias sobre `fecha`.

    Ya no lo usa ninguna plataforma: Instagram paso a horas el 10 de
    septiembre de 2026. Se queda porque el contrato de derivar() sigue siendo
    "exactamente una de las dos ventanas" y porque el validador acepta los
    cortes anteriores a ese dia con la regla de dias.
    """
    corte = (datetime.fromisoformat(ahora) - timedelta(days=ventana_dias)).date().isoformat()
    hoy = _hoy(ahora)

    def dentro(p):
        fecha = p.get("fecha") or ""
        # Una fecha posterior a `ahora` es reloj roto, no noticia: fuera.
        return corte <= fecha <= hoy
    return dentro


def _dentro_por_horas(ahora, ventana_horas):
    """Predicado de ventana en horas sobre `publicado` (TikTok, e Instagram
    desde el 10 de septiembre de 2026).

    `publicado` es ISO con zona, en el mismo formato que `ahora`, asi que se
    compara como fecha-hora y no como texto.
    """
    fin = datetime.fromisoformat(ahora)
    inicio = fin - timedelta(hours=ventana_horas)

    def dentro(p):
        try:
            publicado = datetime.fromisoformat(p.get("publicado") or "")
        except ValueError:
            return False
        return inicio <= publicado <= fin
    return dentro


def _destacados(publicaciones, comentarios, opinion, temas, cuentas, dentro,
                maximo=DESTACADOS_MAXIMO, campos_extra=(), turnos=False):
    """Los posts de la ventana con mas likes, con los conteos de sus comentarios.

    Es la union del top `maximo` general con el top `maximo` de cada zona,
    para que la pagina de una zona tenga sus propios quince sin que el
    pipeline emita un bloque por zona. El tablero filtra por `zona` y corta.

    `dentro(p)` decide la ventana (dias o horas, segun la plataforma);
    `campos_extra` son claves que se copian del registro cuando existen
    (creador, publicado, compartidos, guardados en TikTok; publicado en
    Instagram).

    `turnos` arma cada uno de esos dos cortes repartiendo por cuenta en vez de
    por likes a secas (ver `_por_turnos`). Lo enciende Instagram, donde
    `cuenta` es un medio. TikTok lo deja apagado a peticion del cliente, y
    ademas ahi `cuenta` es el id de una busqueda: repartir por busqueda seria
    repartir por mecanismo, no por voz. Su equivalente seria `creador`.

    Cambia QUE se elige, nunca en que orden se emite: la ultima linea sigue
    devolviendo en el orden global, que es lo que el validador exige para que
    dos corridas iguales no ensucien el diff.
    """
    conocidas = {c["id"] for c in cuentas}
    por_post, opinion_por_post = {}, {}
    for c in comentarios:
        por_post.setdefault(c["post"], []).append(c)
    for c in opinion:
        opinion_por_post.setdefault(c["post"], []).append(c)

    candidatos = []
    for url, p in publicaciones.items():
        if not dentro(p) or p.get("cuenta") not in conocidas:
            continue
        propia = opinion_por_post.get(url, [])
        conteo, _ = _conteo_tono(propia)
        d = {
            "url": url,
            "cuenta": p["cuenta"],
            "zona": p.get("zona") or "estatal",
            "fecha": p.get("fecha") or "",
            "titulo": p.get("titulo") or "",
            "tipo": p.get("tipo") or "otro",
            "likes": int(p.get("likes") or 0),
            "comentarios": int(p.get("comentarios") or 0),
        }
        if p.get("reproducciones"):
            d["reproducciones"] = int(p["reproducciones"])
        for k in campos_extra:
            if k in p:
                d[k] = p[k]
        d["cosechados"] = len(por_post.get(url, []))
        d["opinion"] = len(propia)
        d["sentimiento"] = conteo
        d["temas"] = _contar_temas(propia, temas, con_posts=False)[:3]
        candidatos.append(d)
    candidatos.sort(key=_orden_destacado)

    def corte(lista):
        return _por_turnos(lista, maximo) if turnos else lista[:maximo]

    elegidos = {d["url"] for d in corte(candidatos)}
    por_zona = {}
    for d in candidatos:
        por_zona.setdefault(d["zona"], []).append(d)
    for lista in por_zona.values():
        elegidos.update(d["url"] for d in corte(lista))
    return [d for d in candidatos if d["url"] in elegidos]


def _catalogo_cuentas(cuentas):
    """Lo que el tablero necesita del config: id, nombre, zona y si esta
    activa. Sin handle, que es clave prohibida en data/. Las fuentes apagadas
    viajan tambien: son el registro deliberado de un hueco (Mexicali, San
    Quintin) y permiten rotular "sin cuenta" en vez de un cero."""
    salida = []
    for c in cuentas or []:
        salida.append({
            "cuenta": c["id"],
            "nombre": c.get("nombre") or c["id"],
            "zona": c.get("zona") or "estatal",
            "activa": bool(c.get("activo") and c.get("verificado")),
        })
    return sorted(salida, key=lambda c: c["cuenta"])


def derivar(comentarios, ahora, salud, gasto, temas=None, publicaciones=None,
            cuentas=None, *, plataforma, ventana_dias=None, ventana_horas=None,
            campos_extra=(), turnos=False):
    """Lo que se commitea: conteos y los posts destacados, sin texto de
    comentarios ni identidad.

    Sin porcentajes en ningun nivel: con ~15 comentarios por post, casi
    cualquier corte cae debajo del minimo de 30 que fija PRODUCT.md.

    Exactamente UNA ventana: `ventana_dias` (sobre `fecha`) o `ventana_horas`
    (sobre `publicado`). Se emite con la clave de la que se uso, en la misma
    posicion, para que el archivo de cada plataforma no cambie de forma.
    """
    if (ventana_dias is None) == (ventana_horas is None):
        raise ValueError("derivar: exactamente una de ventana_dias o ventana_horas")
    if ventana_horas is not None:
        dentro = _dentro_por_horas(ahora, ventana_horas)
        ventana = ("ventana_horas", ventana_horas)
    else:
        dentro = _dentro_por_dias(ahora, ventana_dias)
        ventana = ("ventana_dias", ventana_dias)

    comentarios = _marcar_repetidos(list(comentarios))

    por_zona, por_cuenta, por_idioma = {}, {}, {}
    posts = set()
    brigada = reacciones = 0
    for c in comentarios:
        por_zona[c["zona_cuenta"]] = por_zona.get(c["zona_cuenta"], 0) + 1
        por_cuenta[c["cuenta"]] = por_cuenta.get(c["cuenta"], 0) + 1
        por_idioma[c["idioma"]] = por_idioma.get(c["idioma"], 0) + 1
        posts.add(c["post"])
        if c["brigada"]:
            brigada += 1
        if _sin_palabras(c["texto"]):
            reacciones += 1

    # Los temas y el tono se cuentan SOLO sobre opinion: fuera lo repetido en
    # varios posts (una persona insistiendo) y fuera las reacciones de puro
    # emoji, que no dicen de que hablan. Contarlas seria inflar un tema con
    # aplausos, y un aplauso repetido en nueve posts no es sentimiento de la
    # ciudad.
    opinion = [c for c in comentarios
               if not c["brigada"] and not _sin_palabras(c["texto"])]
    conteo, modelo_usado = _conteo_tono(opinion)

    return {
        "esquema": 1,
        "generado": ahora,
        "plataforma": plataforma,
        "retencion_dias": RETENCION_DIAS,
        "comentarios_vigentes": len(comentarios),
        "posts_vigentes": len(posts),
        # Los tres se publican por separado y NO se restan entre si en el
        # tablero: son lecturas distintas del mismo total, no una jerarquia.
        # `opinion` es lo unico sobre lo que se cuentan temas.
        "opinion": len(opinion),
        "repetidos": brigada,
        "reacciones": reacciones,
        # Los conteos van ordenados: dos corridas sobre la misma entrada
        # tienen que producir archivos identicos byte a byte.
        "por_zona": dict(sorted(por_zona.items())),
        "por_cuenta": dict(sorted(por_cuenta.items())),
        "por_idioma": dict(sorted(por_idioma.items())),
        "por_tema": _contar_temas(opinion, temas),
        "sentimiento": dict(conteo, modelo=modelo_usado,
                            metodo="modelo" if modelo_usado else "ninguno"),
        ventana[0]: ventana[1],
        "destacados_maximo": DESTACADOS_MAXIMO,
        "cuentas": _catalogo_cuentas(cuentas),
        "destacados": _destacados(publicaciones or {}, comentarios, opinion, temas,
                                  cuentas or [], dentro, campos_extra=campos_extra,
                                  turnos=turnos),
        "salud": sorted(salud, key=lambda s: s["cuenta"]),
        "gasto": gasto,
    }


# --------------------------------------------------------- texto publicado

def _ordenar_comentarios(lista):
    """Mas likes primero; a igual likes, el mas reciente. El id desempata para
    que dos corridas den el mismo orden."""
    lista = sorted(lista, key=lambda c: (c.get("fecha") or "", c["id"]), reverse=True)
    lista.sort(key=lambda c: -c["likes"])
    return lista


def publicar_comentarios(comentarios, destacados, ahora,
                         visibles=COMENTARIOS_VISIBLES, maximo=COMENTARIOS_MAXIMO,
                         texto_maximo=TEXTO_MAXIMO, *, plataforma):
    """El archivo de efimero/: texto de los comentarios mas votados por post.

    Es la decision del 8 de septiembre de 2026 (ver pulso/instagram.py).
    Reglas que la acotan y no son de estilo:

    - Solo posts que estan en `destacados`; el resto del cache no se publica.
    - Orden por likes y, a igual likes, el mas reciente primero. Los primeros
      `visibles` van siempre; del siguiente al `maximo` solo con likes > 0.
      Es la regla del cliente, literal: "ver mas" no destapa comentarios que
      nadie voto.
    - Fuera la brigada y las reacciones: "PAGINA DE 4SC0 Y APARTE FAKE!!" en
      nueve posts de AFN no es la voz de nadie mas que de quien lo pego, y
      un emoji no dice nada que valga una fila.
    - Sin id, sin identidad, y eso incluye a los TERCEROS: las menciones
      "@fulano" dentro del texto se enmascaran, y un comentario que es solo
      una mencion no se publica. El texto se recorta a `texto_maximo`.
    """
    marcados = _marcar_repetidos(list(comentarios))
    urls = {d["url"] for d in destacados}
    por_post = {}
    for c in marcados:
        # Sin la mencion, ¿queda algo? "@fulano" solo es una etiqueta a un
        # tercero, no una opinion, y ademas es su identidad.
        sin_mencion = RE_MENCION.sub("", c["texto"])
        if c["post"] in urls and not c["brigada"] and not _sin_palabras(sin_mencion):
            por_post.setdefault(c["post"], []).append(c)

    salida = {}
    for url in sorted(por_post):
        lista = _ordenar_comentarios(por_post[url])
        elegidos = lista[:visibles] + [c for c in lista[visibles:] if c["likes"] > 0]
        filas = []
        for c in elegidos[:maximo]:
            texto = RE_MENCION.sub(MENCION_ENMASCARADA, c["texto"])
            if len(texto) > texto_maximo:
                texto = texto[:texto_maximo - 1].rstrip() + "…"
            s = c.get("sentimiento") if c.get("idioma") == "es" else None
            etiqueta = ETIQUETAS_TONO.get(s.get("etiqueta")) if isinstance(s, dict) else None
            filas.append({"texto": texto, "likes": c["likes"],
                          "fecha": c.get("fecha") or "", "sentimiento": etiqueta})
        salida[url] = filas

    return {
        "esquema": 1,
        "generado": ahora,
        "plataforma": plataforma,
        "retencion_dias": RETENCION_DIAS,
        "visibles": visibles,
        "maximo": maximo,
        "por_post": salida,
    }
