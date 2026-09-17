"""Videos y comentarios de TikTok por BUSQUEDA, cosechados por Apify y sin sesion.

Es la seccion que la direccion del cliente pidio el 8 de septiembre de 2026
"igual que la de Instagram": una consulta ordenada por relevancia, las ultimas
24 horas, y los cinco comentarios con mas likes de cada video. Empezo con una
sola busqueda, "tijuana noticias"; desde el 15 de septiembre de 2026 hay una
por lugar del corredor mas una de Mexico y una del mundo. La logica compartida
vive en pulso/redes.py; aqui esta lo que solo TikTok sabe. Cinco reglas
ordenan el modulo, y ninguna es de estilo.

## Una busqueda no lleva zona: la zona sale del pie del video

A diferencia de una cuenta de medio (config/instagram.json), una consulta
devuelve videos de cualquier creador que TikTok considere relevante. Si la
consulta llevara zona, se la acreditaria a todo video que no nombre lugar
alguno: es el bug de El Imparcial y Hermosillo con otro disfraz
(config/busquedas.json, pulso/apify.py). Asi que cada video pasa por el
gacetero de pulso/zonas.py con su pie completo -- hashtags incluidos, porque
"#tijuana" pliega a "tijuana" y ahi suele estar el lugar.

## El ambito decide el residuo, nunca la zona

`ambito` entro el 15 de septiembre de 2026, cuando el cliente pidio una
busqueda de Mexico y una internacional. La regla de arriba las rompia de dos
maneras: "noticias mexico" tiraba Guadalajara y Monterrey por estar en la
lista FUERA -- o sea justo lo que la consulta iba a buscar -- y dejaba pasar
solo el residuo sin lugar; y un video de Ucrania no nombra nada de ningun
gacetero, asi que caia en "nacional" y quedaba indistinguible de una nota
nacional mexicana.

`ambito` NO acredita zona, y por eso el validador sigue rechazando un `zona`
en una busqueda. Cuando el pie nombra un lugar del gacetero manda el pie,
igual en los tres ambitos. Lo unico que cambia es que hacer con el residuo:

    veredicto del gacetero   regional     nacional      internacional
    una zona del producto    esa zona     esa zona      esa zona
    Baja California a secas  estatal      estatal       estatal
    un lugar de fuera        SE TIRA      nacional      nacional
    ningun lugar             nacional     nacional      internacional

De ahi sale el campo `alcance`, que es el veredicto crudo y viaja al lado de
la zona. Sin el, "nacional" significaria dos cosas a la vez -- "no nombro
lugar" y "nombro Guadalajara" -- y la etiqueta "sin lugar" que el panel ya
pinta seria falsa para la mitad de las filas. Es la misma disciplina de
"sin dato" contra "0": dos estados distintos no se colapsan en uno.

`nacional` sigue siendo el veredicto literal del gacetero; mapearlo a
`estatal` seria la acreditacion por consulta en un disfraz mas. Los
comentarios heredan la zona de su video.

## El creador si; quien comenta, no

Se publica el @handle del creador como fuente del video: es quien decidio
publicar, y la URL del video ya lo trae. Es la UNICA identidad que cruza a
data/, y el validador la exige igual a la de la URL. Quien comenta sigue
anonimo: `uniqueId`, `uid`, `avatarThumbnail` y `cid` no llegan ni al cache,
y las @menciones dentro del texto se enmascaran al publicar (pulso/redes.py).

## La ventana es de 24 horas y se impone AQUI, no en el actor

El actor acepta `videoSearchDateFilter: PAST_24_HOURS` (filtro cobrado, solo
con `searchSection: /video`). Su ficha publica no lista los valores; salieron
de un 400 del propio actor el 8 de septiembre de 2026 (la primera version
mandaba "YESTERDAY", copiado de la interfaz de TikTok, y el actor lo rechazo).
Aun asi la ventana no se le confia: `derivar` filtra por `publicado` -- la
hora exacta, con zona, en el mismo formato que `ahora` -- contra
`ventana_horas`. El filtro del actor solo recorta lo que se factura. El modo
`--probar` existe para ver los tres primeros videos antes de confiar en el
cron.

## Dos pasadas, dos actores, y por que

`clockworks~tiktok-scraper` devuelve los videos con `commentCount`, y sus
comentarios los deja en un dataset APARTE (`commentsDatasetURL`), que
`correr_actor` no lee. Por eso la segunda pasada es
`clockworks~tiktok-comments-scraper` por URL de video: tiene salida
documentada, no obliga a un segundo camino HTTP en pulso/apify.py, y deja
funcionar `vistos.json`, el freno que evita pagar los mismos comentarios en
las cuatro corridas del dia. Cobra ~5 USD por 1,000 resultados -- diez veces
el actor de videos --: 30 videos x 30 comentarios son ~4.50 USD en la primera
corrida del dia.

Dos detalles que muerden si no se escriben:

- Las URL de las dos pasadas no son identicas letra por letra (query, caso
  del handle). Se canonizan las dos a
  `https://www.tiktok.com/@{handle}/video/{id}`; sin eso el cruce por URL
  falla EN SILENCIO: `cosechados` queda en 0 y nada avisa.
- Con ventana de 24 h, `dias_entre_cosechas` solo deduplica las corridas del
  dia: un video sale de la ventana antes de volverse a cosechar. Los conteos
  de comentarios son la foto de la primera cosecha; likes, compartidos y
  reproducciones se refrescan en cada corrida (misma asimetria que Instagram).
- El actor trae `textLanguage`. Se ignora: el idioma sale del config, nunca
  del texto ni de lo que la plataforma adivine.
"""

import re
from datetime import datetime, timezone

from .apify import Presupuesto, SinToken, correr_actor, token
from .redes import (  # noqa: F401  (reexportados a proposito, como en instagram.py)
    COMENTARIOS_MAXIMO, COMENTARIOS_VISIBLES, DESTACADOS_MAXIMO, DIAS_ENTRE_COSECHAS,
    RE_MENCION, REGISTROS, RETENCION_DIAS, TEXTO_MAXIMO, TITULO_MAXIMO, _hoy,
    _id_comentario, _titulo, clasificar_cache, guardar_cache, guardar_publicaciones,
    guardar_vistos, leer_cache, leer_publicaciones, leer_vistos, pendientes, purgar,
)
from . import redes as _redes
from .zonas import alcance

ACTOR_VIDEOS = "clockworks~tiktok-scraper"
ACTOR_COMENTARIOS = "clockworks~tiktok-comments-scraper"
PLATAFORMA = "tiktok"
CACHE = "cache/tiktok"

# Solo con /video valen el orden y el filtro de fecha; "Top" mezcla perfiles.
SECCION_BUSQUEDA = "/video"
# Los valores salen de la validacion de entrada del actor (HTTP 400 con la
# lista completa), no de su ficha, que solo muestra un ejemplo de cada uno.
ORDENES = ("MOST_RELEVANT", "MOST_LIKED", "LATEST")
ORDEN = "MOST_RELEVANT"
FILTROS_FECHA = ("ALL_TIME", "PAST_24_HOURS", "PAST_WEEK", "PAST_MONTH", "LAST_3_MONTHS",
                 "LAST_6_MONTHS")
FILTRO_FECHA = "PAST_24_HOURS"
VENTANA_HORAS = 24

# Los subtitulos QUE TIKTOK YA GENERO, cuando el video los trae. Es lo unico
# del actor que se acerca a "lo que se dice en el video" y no cuesta un evento
# aparte: en la tabla de precios no existe ninguno para esta opcion, y el
# rotulo ($) de la ficha esta sobre las dos de transcripcion y no sobre esta.
# Las otras tres opciones, para que no se enciendan por descuido:
#   NEVER_DOWNLOAD_SUBTITLES  - lo de antes del 17 de septiembre de 2026.
#   DOWNLOAD_AND_TRANSCRIBE_VIDEOS_WITHOUT_SUBTITLES  ($) speech-to-text.
#   TRANSCRIBE_ALL_VIDEOS  ($) speech-to-text siempre.
# Las dos de pago cobran `transcription-minute`: 0.034 USD por minuto EMPEZADO
# y por video en el plan Scale (nivel Silver). Con ~232 videos por corrida y
# cuatro corridas al dia serian ~950 USD al mes, casi cinco veces el plan.
# `aiVideoSummary` y `aiVideoDescription` cobran por SEGUNDO de video
# (0.0008 USD) y salen aun mas caras; ademas las escribe un tercero, asi que
# `web/src/lib/analisis/reglas.ts` no puede vigilarlas. Ver docs/PLAN.md.
SUBTITULOS = "DOWNLOAD_SUBTITLES"

# Descargas cobradas que no hacen falta: aqui solo se lee texto y conteos.
SIN_DESCARGAS = {
    "shouldDownloadVideos": False,
    "shouldDownloadCovers": False,
    "shouldDownloadSlideshowImages": False,
    "shouldDownloadAvatars": False,
    "shouldDownloadMusicCovers": False,
}

# Ambitos de una busqueda. `regional` es la omision para que una fila sin el
# campo se comporte como antes del 15 de septiembre de 2026. NO es una zona:
# ver _zona() y el encabezado.
AMBITOS = ("regional", "nacional", "internacional")
AMBITO = "regional"

# Lo que cruza del registro del video a data/tiktok.json ademas de lo comun.
# `alcance` es el veredicto literal del gacetero y viaja junto a `zona` porque
# los dos dejaron de ser lo mismo cuando entraron los ambitos.
CAMPOS_EXTRA = ("creador", "alcance", "publicado", "compartidos", "guardados", "duracion")

# Nunca entran al cache. Documental: `_limpiar_comentario` es lista blanca.
IDENTIDAD_COMENTARIO = ("uniqueId", "uid", "avatarThumbnail", "cid", "user", "nickname")

RE_URL_VIDEO = re.compile(r"/@([^/?#]+)/video/(\d+)")
RE_ETIQUETAS_FINALES = re.compile(r"(?:\s+#\S+)+\s*$")

# El actor de videos devuelve algunos emoji del pie como TEXTO escapado:
# la cadena literal '🚦' (doce caracteres) en vez del semaforo. No
# es un problema de JSON -- json.loads ya corrio -- sino del propio actor, que
# escapa los pares sustitutos una vez de mas en algunos videos y no en otros.
# En la primera cosecha (8 de septiembre de 2026) fueron 7 pies de 30; los
# comentarios llegaron bien. Se desescapa al ingerir, uniendo los pares.
RE_ESCAPE_U = re.compile(r"(?:\\u[0-9a-fA-F]{4})+")


# ------------------------------------------------------------------ limpieza

def _desescapar(texto):
    """Convierte '\\ud83d\\udea6' literal en el emoji. Ver RE_ESCAPE_U.

    Una secuencia que no forme pares validos (un sustituto suelto) se deja tal
    cual: mejor doce caracteres raros que reventar la cosecha por un pie.
    """
    def _uno(m):
        try:
            return (m.group(0).encode("latin-1").decode("unicode_escape")
                    .encode("utf-16", "surrogatepass").decode("utf-16"))
        except (UnicodeDecodeError, UnicodeEncodeError):
            return m.group(0)
    return RE_ESCAPE_U.sub(_uno, texto or "")


def _url_video(url):
    """URL canonica del video, o None si no parece una."""
    m = RE_URL_VIDEO.search(url or "")
    if not m:
        return None
    # El handle va en minusculas: TikTok no distingue mayusculas en la URL y
    # las dos pasadas lo escriben distinto.
    return "https://www.tiktok.com/@{}/video/{}".format(m.group(1).lower(), m.group(2))


def _quitar_etiquetas_finales(texto):
    """Quita la cola de hashtags del pie; los de en medio son parte de la frase.

    Si al quitarlos no queda nada, se deja el pie intacto: un titulo que dice
    "#tijuana #noticias" es mas honesto que "sin descripcion".
    """
    limpio = RE_ETIQUETAS_FINALES.sub("", texto or "")
    # ¿Quedo alguna palabra que no sea hashtag? Si no, era un pie solo de
    # etiquetas y se deja como estaba.
    if not re.sub(r"#\S+", "", limpio).strip():
        return texto or ""
    return limpio


def _publicado(item):
    """Fecha-hora de publicacion en el formato de `ahora` (ISO con +00:00).

    `createTime` es epoch; `createTimeISO` llega con 'Z' y milisegundos.
    Se normaliza para poder comparar como fecha-hora y no como texto.
    """
    t = item.get("createTime")
    if isinstance(t, (int, float)) and t > 0:
        return datetime.fromtimestamp(int(t), timezone.utc).isoformat()
    iso = item.get("createTimeISO")
    if isinstance(iso, str) and iso:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(
                microsecond=0).astimezone(timezone.utc).isoformat()
        except ValueError:
            return None
    return None


def _zona(pie, ambito=AMBITO):
    """(zona, alcance) del video por lo que nombra su pie. zona None = se tira.

    `alcance` es el veredicto crudo del gacetero -- "zona", "estatal", "fuera"
    o "nacional" -- y se publica junto a la zona. Existe porque desde que hay
    ambitos los dos dejaron de coincidir: en una busqueda nacional un video de
    Guadalajara queda `zona: nacional`, y sin el alcance esa fila seria
    indistinguible de una que no nombro lugar alguno. El panel rotula
    "sin lugar" para una y "fuera del corredor" para la otra, que no es lo
    mismo; colapsarlas seria la version de zonas del cero que tapa un hueco.

    El ambito NO acredita zona. Cuando el pie nombra un lugar del gacetero
    manda el pie, igual en los tres; el ambito solo decide el residuo:

        veredicto            regional     nacional     internacional
        una zona             esa zona     esa zona     esa zona
        estatal              estatal      estatal      estatal
        un lugar de fuera    SE TIRA      nacional     nacional
        ningun lugar         nacional     nacional     internacional
    """
    alc, zonas = alcance(pie or "", None)
    if alc == "zona":
        return zonas[0], alc
    if alc == "estatal":
        return "estatal", alc
    if alc == "fuera":
        # Un lugar mexicano fuera de Baja California. En una busqueda regional
        # es ruido y se tira; en una nacional o internacional es exactamente
        # lo que la consulta fue a buscar, y tirarlo dejaria pasar solo el
        # residuo sin lugar.
        if ambito == "regional":
            return None, alc
        return "nacional", alc
    # El gacetero no nombro nada. En la edicion del mundo eso es el mundo; en
    # las otras dos sigue siendo el "nacional" literal de siempre.
    return ("internacional" if ambito == "internacional" else "nacional"), alc


def _limpiar_video(item, busqueda, ahora):
    """Lista blanca del item de video. Devuelve (registro, motivo_de_descarte).

    El motivo es None cuando hay registro; si no, dice por que se tiro:
    'anuncio', 'privado', 'sin_url', 'sin_creador', 'sin_fecha', 'futuro' o
    'fuera'. `salud` los cuenta para que un cambio del actor se note.
    """
    url = _url_video(item.get("webVideoUrl") or item.get("url") or "")
    if not url:
        return None, "sin_url"
    if item.get("isAd") or item.get("isSponsored"):
        return None, "anuncio"
    autor = item.get("authorMeta") or {}
    if autor.get("privateAccount"):
        return None, "privado"
    handle = (autor.get("name") or "").strip().lstrip("@").lower()
    if not handle:
        return None, "sin_creador"
    publicado = _publicado(item)
    if not publicado:
        return None, "sin_fecha"
    if datetime.fromisoformat(publicado) > datetime.fromisoformat(ahora):
        return None, "futuro"
    pie = _desescapar(item.get("text") or "")
    # La zona se calcula sobre el pie CRUDO, hashtags incluidos.
    zona, alc = _zona(pie, busqueda.get("ambito") or AMBITO)
    if zona is None:
        return None, "fuera"

    salida = {
        "url": url,
        "cuenta": busqueda["id"],
        "creador": "@" + handle,
        "zona": zona,
        "alcance": alc,
        "publicado": publicado,
        "fecha": publicado[:10],
        "titulo": _titulo(_quitar_etiquetas_finales(pie)),
        "tipo": "carrusel" if item.get("isSlideshow") else "video",
        "likes": max(0, int(item.get("diggCount") or 0)),
        "comentarios": max(0, int(item.get("commentCount") or 0)),
        # TikTok SI publica estos dos: un 0 es cero medido, y siempre viajan.
        "compartidos": max(0, int(item.get("shareCount") or 0)),
        "guardados": max(0, int(item.get("collectCount") or 0)),
    }
    vistas = max(0, int(item.get("playCount") or 0))
    if vistas > 0:
        salida["reproducciones"] = vistas
    # La duracion en segundos, solo si el actor la trae y es positiva. Viaja
    # porque decide el precio de todo lo que se cobre POR SEGUNDO de video
    # (`aiVideoSummary`, `aiVideoDescription`) y de lo que se cobra por minuto
    # empezado (`transcription-minute`): sin ella, cualquier presupuesto de esa
    # familia es una suposicion. No cuesta nada, viene en cada resultado.
    dur = _duracion(item)
    if dur:
        salida["duracion"] = dur
    return salida, None


def _duracion(item):
    """Segundos del video, o 0 si el actor no los trae."""
    meta = item.get("videoMeta") or {}
    try:
        return max(0, int(meta.get("duration") or 0))
    except (TypeError, ValueError):
        return 0


def _tiene_subtitulos(item):
    """Si TikTok ya genero subtitulos para este video.

    Se CUENTA, no se guarda: el texto de unos subtitulos es el cuerpo del
    video, y AGENTS.md deja la agregacion en titular, fuente y enlace. Lo que
    hace falta hoy es saber para cuantos videos existen, que es lo que decide
    si vale la pena leerlos; eso es un entero y no acredita nada a nadie.
    """
    meta = item.get("videoMeta") or {}
    enlaces = meta.get("subtitleLinks")
    return bool(enlaces) if isinstance(enlaces, list) else False


def _limpiar_comentario(comentario, url, busqueda, zona):
    """Deja solo lo que se puede guardar. La identidad se tira aqui.

    El comentario hereda la zona de su video (`zona_cuenta`, que es la clave
    del esquema compartido): un comentario en un video que nombra Ensenada es
    conversacion de Ensenada.
    """
    texto = _desescapar(comentario.get("text") or "").strip()
    if not texto:
        return None
    return {
        "id": _id_comentario(url, texto),
        "texto": texto,
        "post": url,
        "cuenta": busqueda["id"],
        "zona_cuenta": zona or "nacional",
        "idioma": busqueda.get("idioma", "es"),
        "fecha": (comentario.get("createTimeISO") or "")[:10],
        "likes": max(0, int(comentario.get("diggCount") or 0)),
        "respuestas": max(0, int(comentario.get("replyCommentTotal") or 0)),
        "plataforma": PLATAFORMA,
    }


def _fuentes(busquedas):
    """Las busquedas con la forma que `redes._catalogo_cuentas` espera.

    `zona: estatal` es la regla de fuente sintetica de pulso/busquedas.py (la
    fila de la fuente, no los videos, que traen la suya). `verificado` en una
    busqueda es una fecha informativa, no un interruptor: activa = activo.
    """
    return [{"id": b["id"], "nombre": b.get("nombre") or b["id"], "zona": "estatal",
             "activo": bool(b.get("activo")), "verificado": True} for b in busquedas]


# ------------------------------------------------------------------ cosecha

def _entrada_videos(consulta, cuantos, filtro_fecha, orden=ORDEN):
    return {
        "searchQueries": [consulta],
        "searchSection": SECCION_BUSQUEDA,
        "resultsPerPage": cuantos,
        "videoSearchSorting": orden,
        "videoSearchDateFilter": filtro_fecha,
        "downloadSubtitlesOptions": SUBTITULOS,
        **SIN_DESCARGAS,
    }


def probar(busquedas, ahora, tok=None, entorno=None, filtro_fecha=FILTRO_FECHA, orden=ORDEN,
           cuantos=3):
    """Pasada 1 con tres resultados y sin comentarios. No escribe nada.

    Para leer, con ojos humanos, que devuelve el filtro de fecha y como quedan
    zona y titulo antes de gastar en comentarios. Devuelve, por busqueda, los
    videos limpios y el conteo de descartes por motivo.
    """
    tok = tok or token(entorno)
    salida = []
    for b in busquedas:
        if not b.get("activo"):
            continue
        items = correr_actor(ACTOR_VIDEOS,
                             _entrada_videos(b["consulta"], cuantos, filtro_fecha, orden),
                             tok, cuantos)
        videos, descartes = [], {}
        for it in items:
            limpio, motivo = _limpiar_video(it, b, ahora)
            if limpio:
                videos.append(limpio)
            else:
                descartes[motivo] = descartes.get(motivo, 0) + 1
        salida.append({"busqueda": b["id"], "videos": sorted(videos, key=lambda v: v["publicado"],
                                                             reverse=True),
                       "descartes": dict(sorted(descartes.items()))})
    return salida


def cosechar(busquedas, ahora, tok=None, presupuesto=None, cache=CACHE,
             videos_por_busqueda=30, comentarios_por_video=30, filtro_fecha=FILTRO_FECHA,
             orden=ORDEN, entorno=None):
    """Dos pasadas contra Apify. Devuelve (nuevos, salud, gasto).

    Sin token no truena: devuelve vacio y lo dice en `salud`. El tablero tiene
    que poder mostrar prensa sin redes.
    """
    activas = [b for b in busquedas if b.get("activo")]
    presupuesto = presupuesto or Presupuesto()
    salud, nuevos = [], []

    try:
        tok = tok or token(entorno)
    except SinToken as e:
        for b in activas:
            salud.append({"cuenta": b["id"], "estado": "sin_token", "error": str(e),
                          "posts": 0, "comentarios": 0})
        return [], sorted(salud, key=lambda s: s["cuenta"]), presupuesto.resumen()

    purgar(cache, ahora)
    vistos = leer_vistos(cache)
    publicaciones = leer_publicaciones(cache)
    reparto = presupuesto.reparto(len(activas))

    for b in activas:
        try:
            items = correr_actor(ACTOR_VIDEOS,
                                 _entrada_videos(b["consulta"], videos_por_busqueda, filtro_fecha,
                                                 orden),
                                 tok, min(videos_por_busqueda, reparto))
            presupuesto.cobrar(b["id"], len(items))
        except Exception as e:
            salud.append({"cuenta": b["id"], "estado": "fallo",
                          "error": "{}: {}".format(type(e).__name__, e)[:200],
                          "posts": 0, "comentarios": 0})
            continue

        # El catalogo se actualiza ANTES del freno de costo: un video ya
        # cosechado sigue sumando likes y compartidos.
        urls, fuera, descartados, con_subtitulos = [], 0, 0, 0
        for it in items:
            limpio, motivo = _limpiar_video(it, b, ahora)
            if limpio is None:
                if motivo == "fuera":
                    fuera += 1
                else:
                    descartados += 1
                continue
            if _tiene_subtitulos(it):
                con_subtitulos += 1
            publicaciones[limpio["url"]] = {**publicaciones.get(limpio["url"], {}), **limpio}
            if limpio["url"] not in urls:
                urls.append(limpio["url"])

        toca = pendientes(urls, vistos, ahora)
        if not toca:
            salud.append({"cuenta": b["id"], "estado": "ok", "posts": len(urls),
                          "comentarios": 0, "crudos": 0, "fuera": fuera,
                          "descartados": descartados, "con_subtitulos": con_subtitulos,
                          "nota": "sin videos nuevos que cosechar"})
            continue

        entrada_coms = {"postURLs": toca, "commentsPerPost": comentarios_por_video,
                        "maxRepliesPerComment": 0}
        try:
            crudos = correr_actor(ACTOR_COMENTARIOS, entrada_coms, tok,
                                  max(1, reparto - len(items)))
            presupuesto.cobrar(b["id"], len(crudos))
        except Exception as e:
            salud.append({"cuenta": b["id"], "estado": "fallo",
                          "error": "{}: {}".format(type(e).__name__, e)[:200],
                          "posts": len(urls), "comentarios": 0, "fuera": fuera,
                          "descartados": descartados, "con_subtitulos": con_subtitulos})
            continue

        ingeridos = 0
        for c in crudos:
            # `videoWebUrl` viene en cada comentario; se canoniza para que cruce
            # con la URL de la pasada 1. Si no parsea, cae a la primera pedida.
            url = _url_video(c.get("videoWebUrl") or c.get("postURL") or "") or toca[0]
            zona = (publicaciones.get(url) or {}).get("zona")
            limpio = _limpiar_comentario(c, url, b, zona)
            if limpio:
                nuevos.append(limpio)
                ingeridos += 1

        for u in toca:
            vistos[u] = _hoy(ahora)
        salud.append({"cuenta": b["id"], "estado": "ok", "posts": len(urls),
                      "comentarios": ingeridos, "crudos": len(crudos), "fuera": fuera,
                      "descartados": descartados, "con_subtitulos": con_subtitulos})

    guardar_vistos(vistos, cache)
    guardar_publicaciones(publicaciones, ahora, cache)
    guardar_cache(nuevos, ahora, cache)
    return nuevos, sorted(salud, key=lambda s: s["cuenta"]), presupuesto.resumen()


# --------------------------------------------------------------- derivados

def derivar(comentarios, ahora, salud, gasto, temas=None, publicaciones=None,
            busquedas=None, ventana_horas=VENTANA_HORAS):
    """data/tiktok.json: conteos y videos destacados de las ultimas horas. Ver
    pulso/redes.py::derivar; aqui se fija la plataforma, la ventana en horas
    y los campos que cruzan del video (creador, publicado, compartidos,
    guardados)."""
    return _redes.derivar(comentarios, ahora, salud, gasto, temas, publicaciones,
                          _fuentes(busquedas or []), plataforma=PLATAFORMA,
                          ventana_horas=ventana_horas, campos_extra=CAMPOS_EXTRA)


def publicar_comentarios(comentarios, destacados, ahora,
                         visibles=COMENTARIOS_VISIBLES, maximo=COMENTARIOS_MAXIMO,
                         texto_maximo=TEXTO_MAXIMO):
    """efimero/tiktok-comentarios.json. Ver pulso/redes.py::publicar_comentarios."""
    return _redes.publicar_comentarios(comentarios, destacados, ahora, visibles, maximo,
                                       texto_maximo, plataforma=PLATAFORMA)
