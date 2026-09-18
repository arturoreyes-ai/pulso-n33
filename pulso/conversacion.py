"""Comentarios de YouTube por la API de datos: la conversacion publica.

OJO, hay DOS modulos de YouTube y no se mezclan. Este lee la **API de datos**
con llave y produce data/conversacion.json; pulso/youtube.py lee los **feeds
Atom publicos** de cada canal y produce data/youtube.json. La diferencia no es
de estilo: los datos de la API caen bajo las Politicas para Desarrolladores
(III.E.2.a sobre agregar canales de distintos duenos, III.E.4.d sobre los 30
dias) y un documento de sindicacion publico no, igual que los quince feeds de
prensa que ya lee pulso/fetch.py. Por eso este viene apagado detras de
YOUTUBE_HABILITADO y aquel no, y por eso **sus datos no se suman en un mismo
agregado**: seria meter datos de la API en un conteo que la politica no
cubre.


Por que YouTube y no Facebook, Instagram, TikTok o WhatsApp: son los unicos
comentarios en espanol, de residentes y sobre el tema, que se pueden leer con
una API oficial y sin iniciar sesion. El razonamiento legal esta en
docs/PLAN.md seccion 3; el resumen es que iniciar sesion para raspar convierte
al operador en 'usuario' y lo somete a los terminos de la plataforma, que es
justo la defensa que en Meta v. Bright Data dependio de NO estar logueado.
Aqui se usa solo la API oficial con llave.

## Retencion: 30 dias, y por eso los comentarios NO se commitean

Las Politicas para Desarrolladores de YouTube, seccion III.E.4.d, limitan el
almacenamiento de datos no autorizados (que es lo que devuelve una llave de
API sobre contenido publico) a **30 dias naturales**, tras los cuales hay que
borrarlos o refrescarlos. Ademas obligan a mantener los datos consistentes
con YouTube, o sea a propagar borrados y ediciones.

Un repo de git no puede cumplir eso: lo commiteado vive en cada clon y en
cada commit anterior, asi que 'borrar en 30 dias' es imposible una vez que
entro al historial. De ahi la separacion que impone este modulo:

    cache/comentarios/   texto crudo, IGNORADO POR GIT, con TTL de 30 dias
    data/conversacion.json   solo metricas DERIVADAS, sin texto literal
                             ni identidad de quien comento

`purgar()` corre en cada cosecha y tira lo que paso de 30 dias. `derivar()`
produce lo unico que se commitea: conteos y etiquetas calculadas por nosotros.

Hay una excepcion para desarrolladores auditados (politica de metricas
derivadas, vigente desde el 1 de junio de 2026) que permite guardar metricas
36 meses, pero **el contenido cualitativo, o sea titulos y texto de
comentarios, sigue bajo la regla de 30 dias incluso auditado**. Asi que el
corpus crudo no se archiva nunca.

Las mismas politicas (III.E.2.a) restringen AGREGAR datos de canales de
distintos duenos. Un tablero que suma comentarios de varios medios roza esa
linea. Conviene la opinion de un abogado antes de publicar el panel de
conversacion, y por eso viene apagado.

## La regla de la cuota (modelo vigente desde el 1 de junio de 2026)

YouTube paso a cubetas de cuota separadas. Ya no es cierto que search.list
cueste 100 unidades del presupuesto general:

    Cubeta general    10,000 unidades/dia, todo a 1 unidad por llamada
                      (channels, playlistItems, videos, commentThreads,
                      comments). Cada PAGINA cuesta aparte.
    search.list       cubeta propia, 1 unidad por llamada pero **tope de
                      100 llamadas al dia**. No se compra.

O sea que search.list ya no quema el dia, pero tampoco se puede escalar. El
  diseno usa como maximo tres busquedas por corrida para conectar los temas
  principales de prensa con videos recientes. Aun con un cron horario son 72
  llamadas al dia; la lista fija de canales sigue siendo la base del panel.

La cuota se reinicia a medianoche del Pacifico, no a la local. Ampliarla
requiere una auditoria manual (formulario de extension de cuota).

## Degradacion

Sin `YOUTUBE_API_KEY` el paso no truena: devuelve vacio y lo dice. El tablero
tiene que poder mostrar prensa sin comentarios, igual que muestra volumen de
menciones sin postura.
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import VERSION
from .normalizar import fold
from .sentimiento import A_SENTIMIENTO

API = "https://www.googleapis.com/youtube/v3/"
AGENTE = "PulsoN33/{}".format(VERSION)

CUOTA_DIARIA = 10000
# Margen para no dejar el proyecto en cero: si otra cosa comparte la llave,
# no queremos ser quienes la agotan.
RESERVA = 1500

# Tope de retencion de las Politicas para Desarrolladores III.E.4.d.
RETENCION_DIAS = 30

# Todo a 1 unidad de la cubeta general. search.list usa el contador separado
# COSTO_BUSQUEDA y nunca se carga a este presupuesto.
COSTO = {
    "channels": 1,
    "playlistItems": 1,
    "videos": 1,
    "commentThreads": 1,
    "comments": 1,
}
SEARCH_TOPE_DIARIO = 100
COSTO_BUSQUEDA = {"search": 1}
BUSQUEDAS_POR_CORRIDA = 3

MAX_PLAYLIST_ITEMS = 50     # tope duro de playlistItems.list
MAX_COMMENT_THREADS = 100   # tope duro de commentThreads.list


class SinLlave(Exception):
    """No hay YOUTUBE_API_KEY en el entorno."""


class CuotaAgotada(Exception):
    """La cuota del dia se acabo, por reporte de la API o por el contador
    local. En los dos casos hay que parar, no reintentar: nada se libera
    antes de medianoche del Pacifico."""


class Presupuesto:
    """Contador local de unidades. Evita descubrir el limite a golpes."""

    def __init__(self, tope=CUOTA_DIARIA - RESERVA, *, costos=None,
                 cuota_diaria=CUOTA_DIARIA, reserva=RESERVA):
        self.tope = tope
        self.gastado = 0
        self.llamadas = {}
        self.costos = costos or COSTO
        self.cuota_diaria = cuota_diaria
        self.reserva = reserva

    def cobrar(self, recurso):
        costo = self.costos[recurso]
        if self.gastado + costo > self.tope:
            raise CuotaAgotada(
                "presupuesto local agotado: {}/{} unidades".format(self.gastado, self.tope))
        self.gastado += costo
        self.llamadas[recurso] = self.llamadas.get(recurso, 0) + 1

    def resumen(self):
        return {
            "tope": self.tope,
            "gastado": self.gastado,
            "cuota_diaria": self.cuota_diaria,
            "reserva": self.reserva,
            "llamadas": dict(sorted(self.llamadas.items())),
        }


def llave(entorno=None):
    k = (entorno or os.environ).get("YOUTUBE_API_KEY", "").strip()
    if not k:
        raise SinLlave(
            "falta YOUTUBE_API_KEY. Se saca en console.cloud.google.com: "
            "habilitar 'YouTube Data API v3' y crear una llave de API.")
    return k


def _pedir(recurso, params, api_key, presupuesto, timeout=20):
    presupuesto.cobrar(recurso)
    q = dict(params)
    q["key"] = api_key
    req = Request(API + recurso + "?" + urlencode(q),
                  headers={"User-Agent": AGENTE, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        cuerpo = ""
        try:
            cuerpo = e.read().decode("utf-8", "replace")[:600]
        except Exception:
            pass
        # Todo llega como 403: hay que ramificar por 'reason', no por codigo.
        # quotaExceeded es fin del dia; rateLimitExceeded se reintenta.
        if e.code in (403, 429):
            if "quotaExceeded" in cuerpo or "dailyLimitExceeded" in cuerpo:
                raise CuotaAgotada("la API reporta cuota agotada: {}".format(cuerpo[:200]))
        raise RuntimeError("{} HTTP {}: {}".format(recurso, e.code, cuerpo[:200]))


def resolver_canal(handle_o_id, api_key, presupuesto):
    """Devuelve (channel_id, uploads_playlist_id, titulo).

    Acepta un id 'UC...' o un handle '@algo'. La playlist de subidas se LEE de
    contentDetails.relatedPlaylists.uploads y no se deduce cambiando UC por
    UU: ese atajo es convencion, no contrato documentado, y falla en silencio.
    channels.list cuesta lo mismo y de paso trae el titulo.
    """
    params = {"part": "snippet,contentDetails"}
    if handle_o_id.startswith("@"):
        params["forHandle"] = handle_o_id
    else:
        params["id"] = handle_o_id
    datos = _pedir("channels", params, api_key, presupuesto)
    items = datos.get("items") or []
    if not items:
        raise RuntimeError("canal no encontrado: {}".format(handle_o_id))
    c = items[0]
    subidas = ((c.get("contentDetails") or {}).get("relatedPlaylists") or {}).get("uploads")
    if not subidas:
        raise RuntimeError("el canal {} no expone playlist de subidas".format(handle_o_id))
    return c["id"], subidas, (c.get("snippet") or {}).get("title", "")


def videos_recientes(playlist, api_key, presupuesto, tope=12):
    """Ultimos videos de la playlist de subidas. 1 unidad por pagina de 50."""
    salida, token = [], None
    while len(salida) < tope:
        params = {"part": "contentDetails,snippet", "playlistId": playlist,
                  "maxResults": min(MAX_PLAYLIST_ITEMS, tope - len(salida))}
        if token:
            params["pageToken"] = token
        datos = _pedir("playlistItems", params, api_key, presupuesto)
        for it in datos.get("items", []):
            cd = it.get("contentDetails") or {}
            sn = it.get("snippet") or {}
            if not cd.get("videoId"):
                continue
            salida.append({
                "video": cd["videoId"],
                "titulo": " ".join((sn.get("title") or "").split()),
                "publicado": cd.get("videoPublishedAt") or sn.get("publishedAt"),
            })
        token = datos.get("nextPageToken")
        if not token:
            break
    return salida[:tope]


def buscar_videos_tema(tema, api_key, presupuesto, ahora, tope=5):
    """Videos recientes para un tema de prensa, con una llamada de search.list."""
    termino = " ".join((tema.get("termino") or "").split())
    if not termino:
        return []
    zonas = [z for z in (tema.get("zonas") or {}) if z not in ("estatal", "nacional")]
    geografia = zonas[0] if zonas else "Baja California"
    desde = (_hoy(ahora) - timedelta(days=7)).isoformat().replace("+00:00", "Z")
    datos = _pedir("search", {
        "part": "snippet",
        "type": "video",
        "maxResults": min(10, max(1, tope)),
        "order": "relevance",
        "regionCode": "MX",
        "relevanceLanguage": "es",
        "safeSearch": "moderate",
        "publishedAfter": desde,
        "q": '"{}" {}'.format(termino[:80], geografia),
    }, api_key, presupuesto)
    salida = []
    for it in datos.get("items") or []:
        video = (it.get("id") or {}).get("videoId")
        sn = it.get("snippet") or {}
        if not video:
            continue
        salida.append({
            "video": video,
            "titulo": " ".join((sn.get("title") or "").split()),
            "publicado": sn.get("publishedAt"),
            "canal": sn.get("channelId"),
        })
    return salida


def con_comentarios(videos, api_key, presupuesto):
    """Filtra a los videos que traen conversacion, leyendo statistics.

    videos.list acepta 50 ids por llamada a 1 unidad, asi que preguntar
    'cuantos comentarios tiene' es casi gratis y evita gastar una llamada de
    commentThreads en videos que no tienen ninguno.
    """
    porid = {v["video"]: v for v in videos}
    ids = list(porid)
    salida = []
    for i in range(0, len(ids), 50):
        lote = ids[i:i + 50]
        datos = _pedir("videos", {"part": "statistics", "id": ",".join(lote)},
                       api_key, presupuesto)
        for it in datos.get("items", []):
            st = it.get("statistics") or {}
            n = st.get("commentCount")
            if n is None:
                continue                     # comentarios deshabilitados
            n = int(n)
            if n <= 0:
                continue
            v = dict(porid[it["id"]])
            v["comentarios_reportados"] = n
            salida.append(v)
    # Mas conversacion primero: si la cuota se acaba, que sea gastada en los
    # videos que si tienen de que hablar.
    salida.sort(key=lambda v: -v["comentarios_reportados"])
    return salida


def comentarios(video_id, api_key, presupuesto, tope=100, orden="relevance"):
    """Comentarios de primer nivel. 1 unidad por pagina de 100.

    Los comentarios deshabilitados devuelven 403 con 'commentsDisabled'. Eso
    no es un fallo de la corrida: es un hecho del video.
    """
    salida, token = [], None
    while len(salida) < tope:
        params = {"part": "snippet", "videoId": video_id, "order": orden,
                  "maxResults": min(MAX_COMMENT_THREADS, tope - len(salida)),
                  "textFormat": "plainText"}
        if token:
            params["pageToken"] = token
        try:
            datos = _pedir("commentThreads", params, api_key, presupuesto)
        except RuntimeError as e:
            for motivo in ("commentsDisabled", "videoNotFound", "forbidden"):
                if motivo in str(e):
                    return salida, motivo
            raise
        for it in datos.get("items", []):
            sn_hilo = it.get("snippet") or {}
            top = sn_hilo.get("topLevelComment") or {}
            sn = top.get("snippet") or {}
            texto = " ".join((sn.get("textOriginal") or "").split())
            if not texto:
                continue
            # No se guarda autor, canal del autor ni foto: no hace falta para
            # medir conversacion y es dato personal de terceros.
            salida.append({
                "id": top.get("id"),
                "texto": texto,
                "likes": int(sn.get("likeCount") or 0),
                "respuestas": int(sn_hilo.get("totalReplyCount") or 0),
                "publicado": sn.get("publishedAt"),
            })
        token = datos.get("nextPageToken")
        if not token:
            break
    return salida[:tope], None


# ------------------------------------------------------- cache con TTL

def _hoy(ahora):
    return datetime.strptime(ahora[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)


def purgar(cache="cache/comentarios", ahora=None, retencion=RETENCION_DIAS):
    """Borra del cache lo que paso de `retencion` dias. Devuelve (vivos, borrados).

    Esto es la obligacion de III.E.4.d hecha codigo. Corre en cada cosecha,
    incluso si la cosecha no trae nada, para que el reloj no dependa de que
    la API responda.
    """
    if not os.path.isdir(cache):
        return 0, 0
    limite = (_hoy(ahora) if ahora else datetime.now(timezone.utc)) - timedelta(days=retencion)
    vivos = borrados = 0
    for nombre in sorted(os.listdir(cache)):
        if not nombre.endswith(".json"):
            continue
        ruta = os.path.join(cache, nombre)
        try:
            dia = datetime.strptime(nombre[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            os.remove(ruta)               # nombre no reconocible: no se conserva
            borrados += 1
            continue
        if dia < limite:
            os.remove(ruta)
            borrados += 1
        else:
            vivos += 1
    return vivos, borrados


def guardar_cache(comentarios_nuevos, ahora, cache="cache/comentarios"):
    """Guarda la cosecha del dia en un archivo fechado, fuera de git."""
    if not comentarios_nuevos:
        return None
    os.makedirs(cache, exist_ok=True)
    ruta = os.path.join(cache, "{}.json".format(ahora[:10]))
    previos = leer_archivo(ruta)
    por_id = {c["id"]: c for c in previos}
    for c in comentarios_nuevos:
        anterior = por_id.get(c["id"])
        if anterior is None:
            por_id[c["id"]] = c
            continue
        temas = sorted(set(anterior.get("temas") or []) | set(c.get("temas") or []))
        combinado = dict(anterior)
        combinado.update(c)
        combinado["temas"] = temas
        # Si el mismo comentario se encontro primero por canal y despues por
        # tema, se conserva la atribucion al canal verificado.
        if anterior.get("origen", "canal") == "canal" and c.get("origen") == "busqueda":
            for campo in ("origen", "canal", "zona_canal"):
                combinado[campo] = anterior.get(campo)
        por_id[c["id"]] = combinado
    _escribir_cache(ruta, por_id.values())
    return ruta


def _escribir_cache(ruta, registros):
    with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(sorted(registros, key=lambda c: c["id"]),
                  fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def _sentimiento_vigente(s, modelo):
    return isinstance(s, dict) and s.get("modelo") == modelo and s.get("etiqueta") in A_SENTIMIENTO


def clasificar_cache(cache="cache/comentarios", analizador=None):
    """Etiqueta el sentimiento de cada comentario y lo guarda EN EL CACHE.

    La etiqueta por comentario es un dato mas del cache: vive los mismos 30
    dias que el texto y nunca sale de ahi. A data/ solo llegan los conteos
    que calcula `derivar()`. Solo se manda al modelo lo que no traiga una
    etiqueta vigente del mismo modelo, asi que volver a correr es barato.
    Devuelve cuantos comentarios se etiquetaron en esta corrida.
    """
    if not os.path.isdir(cache):
        return 0
    if analizador is None:
        from .sentimiento import Analizador
        analizador = Analizador()
    modelo = getattr(analizador, "modelo", None)
    etiquetados = 0
    for nombre in sorted(os.listdir(cache)):
        if not nombre.endswith(".json"):
            continue
        ruta = os.path.join(cache, nombre)
        registros = leer_archivo(ruta)
        pendientes = [c for c in registros if not _sentimiento_vigente(c.get("sentimiento"), modelo)]
        if not pendientes:
            continue
        resultados = analizador.predecir([c.get("texto") or "" for c in pendientes])
        for c, r in zip(pendientes, resultados):
            c["sentimiento"] = {
                "etiqueta": r["etiqueta"],
                "confianza": r["confianza"],
                "modelo": r["modelo"],
            }
        _escribir_cache(ruta, registros)
        etiquetados += len(pendientes)
    return etiquetados


def leer_archivo(ruta):
    try:
        with open(ruta, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return []


def leer_cache(cache="cache/comentarios"):
    """Todo el cache vigente, ya purgado por `purgar()`."""
    if not os.path.isdir(cache):
        return []
    salida = []
    for nombre in sorted(os.listdir(cache)):
        if nombre.endswith(".json"):
            salida.extend(leer_archivo(os.path.join(cache, nombre)))
    return salida


# ------------------------------------------------------------ cosecha

def cosechar(canales, ahora, entorno=None, videos_por_canal=8,
             comentarios_por_video=100, presupuesto=None, pausa=0.1,
             cache="cache/comentarios", temas_busqueda=None,
             temas_por_corrida=BUSQUEDAS_POR_CORRIDA, videos_por_tema=2,
             presupuesto_busqueda=None):
    """Cosecha comentarios y los deja en el cache. Devuelve (n, salud, presupuesto).

    Nunca lanza por falta de llave ni por cuota: los dos casos se reportan en
    la salud para que el tablero pueda decir por que no hay comentarios.
    """
    presupuesto = presupuesto or Presupuesto()
    temas_busqueda = list(temas_busqueda or [])[:max(0, temas_por_corrida)]
    presupuesto_busqueda = presupuesto_busqueda or Presupuesto(
        tope=max(0, temas_por_corrida),
        costos=COSTO_BUSQUEDA,
        cuota_diaria=SEARCH_TOPE_DIARIO,
        reserva=max(0, SEARCH_TOPE_DIARIO - temas_por_corrida),
    )
    activos = [c for c in canales if c.get("activo", True)]
    vivos, borrados = purgar(cache, ahora)

    def salud_de(c, estado, error=None, videos=0, coms=0):
        return {"id": c["id"], "nombre": c["nombre"], "canal": c.get("canal"),
                "zona": c.get("zona"), "estado": estado, "videos": videos,
                "comentarios": coms, "ultima_ok": ahora if estado == "ok" else None,
                "error": error}

    try:
        api_key = llave(entorno)
    except SinLlave as e:
        return 0, [salud_de(c, "sin_llave", str(e)) for c in activos], {
            "presupuesto": presupuesto.resumen(),
            "busqueda": {"presupuesto": presupuesto_busqueda.resumen(), "temas": []},
            "cache": {"archivos_vivos": vivos, "archivos_borrados": borrados,
                      "retencion_dias": RETENCION_DIAS},
        }

    cosecha, salud, corto = [], [], False
    for c in activos:
        if corto:
            salud.append(salud_de(c, "omitido", "cuota agotada antes de llegar a este canal"))
            continue
        try:
            _, subidas, _ = resolver_canal(c["canal"], api_key, presupuesto)
            vids = videos_recientes(subidas, api_key, presupuesto, tope=videos_por_canal)
            vids = con_comentarios(vids, api_key, presupuesto)
            n_com = 0
            for v in vids:
                coms, _motivo = comentarios(v["video"], api_key, presupuesto,
                                            tope=comentarios_por_video)
                for k in coms:
                    cosecha.append({
                        "id": k["id"],
                        "texto": k["texto"],
                        "likes": k["likes"],
                        "respuestas": k["respuestas"],
                        "publicado": k["publicado"],
                        "fecha": (k["publicado"] or "")[:10] or None,
                        "video": v["video"],
                        "video_titulo": v["titulo"],
                        "canal": c["id"],
                        "zona_canal": c.get("zona"),
                        "capturado": ahora,
                        "origen": "canal",
                        "temas": [],
                    })
                n_com += len(coms)
                time.sleep(pausa)
            salud.append(salud_de(c, "ok", None, len(vids), n_com))
        except CuotaAgotada as e:
            corto = True
            salud.append(salud_de(c, "cuota", str(e)))
        except Exception as e:
            salud.append(salud_de(c, "fallo", "{}: {}".format(type(e).__name__, e)[:300]))

    salud_busqueda = []
    for tema in temas_busqueda:
        termino = " ".join((tema.get("termino") or "").split())
        if not termino:
            continue
        try:
            vids = buscar_videos_tema(
                tema, api_key, presupuesto_busqueda, ahora,
                tope=max(5, videos_por_tema),
            )
            vids = con_comentarios(vids, api_key, presupuesto)[:videos_por_tema]
            n_com = 0
            for v in vids:
                coms, _motivo = comentarios(
                    v["video"], api_key, presupuesto, tope=comentarios_por_video
                )
                for k in coms:
                    cosecha.append({
                        "id": k["id"],
                        "texto": k["texto"],
                        "likes": k["likes"],
                        "respuestas": k["respuestas"],
                        "publicado": k["publicado"],
                        "fecha": (k["publicado"] or "")[:10] or None,
                        "video": v["video"],
                        "video_titulo": v["titulo"],
                        "canal": v.get("canal"),
                        "zona_canal": None,
                        "capturado": ahora,
                        "origen": "busqueda",
                        "temas": [termino],
                    })
                n_com += len(coms)
                time.sleep(pausa)
            salud_busqueda.append({
                "tema": termino,
                "estado": "ok",
                "videos": len(vids),
                "comentarios": n_com,
                "error": None,
            })
        except CuotaAgotada as e:
            salud_busqueda.append({
                "tema": termino, "estado": "cuota", "videos": 0,
                "comentarios": 0, "error": str(e)[:300],
            })
            break
        except Exception as e:
            salud_busqueda.append({
                "tema": termino, "estado": "fallo", "videos": 0,
                "comentarios": 0,
                "error": "{}: {}".format(type(e).__name__, e)[:300],
            })

    guardar_cache(cosecha, ahora, cache)
    vivos, _ = purgar(cache, ahora)
    return len(cosecha), salud, {
        "presupuesto": presupuesto.resumen(),
        "busqueda": {
            "presupuesto": presupuesto_busqueda.resumen(),
            "temas": salud_busqueda,
        },
        "cache": {"archivos_vivos": vivos, "archivos_borrados": borrados,
                  "retencion_dias": RETENCION_DIAS},
    }


# ----------------------------------------------------------- derivados

def _sentimiento_de(c):
    """'positivo' | 'negativo' | 'neutral' | None si el comentario no trae etiqueta."""
    s = c.get("sentimiento")
    if not isinstance(s, dict):
        return None
    return A_SENTIMIENTO.get(s.get("etiqueta"))


def _conteo_sentimiento():
    return {"positivo": 0, "negativo": 0, "neutral": 0}


def _es_pregunta(texto):
    t = texto or ""
    return "?" in t or fold(t).startswith(
        ("que ", "como ", "cuando ", "donde ", "por que ", "quien ")
    )


def _interacciones(c):
    return int(c.get("likes") or 0) + int(c.get("respuestas") or 0)


def derivar(comentarios_cache, roster, ahora, salud, cuentas):
    """Lo unico que se commitea: metricas calculadas por nosotros.

    Sin texto literal de comentarios, sin id de comentario y sin identidad de
    quien escribio. Solo conteos, y etiquetas de tema que salen de nuestro
    propio agrupamiento. Ver el encabezado del modulo para el porque.

    El sentimiento tambien sale como CONTEO: cuantos comentarios positivos,
    negativos y neutrales por zona y por tema. La etiqueta de cada comentario
    se queda en el cache con el texto.
    """
    from .temas import temas
    from .zonas import alcance

    hoy = datetime.strptime(ahora[:10], "%Y-%m-%d").date()

    registros, por_zona, por_canal, por_figura = [], {}, {}, {}
    total_sentimiento, sin_clasificar, modelos = _conteo_sentimiento(), 0, {}
    detalle = {}
    for c in comentarios_cache:
        texto = "{} {}".format(c.get("video_titulo") or "", c.get("texto") or "")
        hits = roster.match(texto, hoy)
        _alc, zonas = alcance(texto, c.get("zona_canal"), bool(hits))
        sentimiento = _sentimiento_de(c)
        if sentimiento is None:
            sin_clasificar += 1
        else:
            total_sentimiento[sentimiento] += 1
            m = c["sentimiento"].get("modelo")
            modelos[m] = modelos.get(m, 0) + 1
        for z in (zonas or ["nacional"]):
            por_zona[z] = por_zona.get(z, 0) + 1
            d = detalle.setdefault(z, {
                "comentarios": 0, "interacciones": 0, "preguntas": 0,
                "sentimiento": _conteo_sentimiento(), "_temas": {},
            })
            d["comentarios"] += 1
            d["interacciones"] += _interacciones(c)
            d["preguntas"] += 1 if _es_pregunta(c.get("texto")) else 0
            if sentimiento is not None:
                d["sentimiento"][sentimiento] += 1
            for etiqueta in (c.get("temas") or []):
                dt = d["_temas"].setdefault(etiqueta, {
                    "tema": etiqueta, "comentarios": 0, "sentimiento": _conteo_sentimiento(),
                })
                dt["comentarios"] += 1
                if sentimiento is not None:
                    dt["sentimiento"][sentimiento] += 1
        if c.get("origen", "canal") == "canal" and c.get("canal"):
            por_canal[c["canal"]] = por_canal.get(c["canal"], 0) + 1
        for h in hits:
            por_figura[h.figura_id] = por_figura.get(h.figura_id, 0) + 1
        registros.append({
            "id": c["id"],                 # solo en memoria, para agrupar
            "titulo": c.get("texto") or "",
            "fecha": c.get("fecha"),
            "zonas": zonas,
            "fuente": c["canal"],
        })

    panel = temas(registros, ahora[:10], origen="comentarios")
    # Los ejemplos son texto literal de comentarios: no se publican.
    for t in panel["temas"]:
        t.pop("ejemplos", None)
        t.pop("notas", None)

    por_tema = []
    etiquetas = sorted({t for c in comentarios_cache for t in (c.get("temas") or [])})
    for etiqueta in etiquetas:
        muestra = [c for c in comentarios_cache if etiqueta in (c.get("temas") or [])]
        registros_tema, zonas_tema = [], {}
        for c in muestra:
            texto = "{} {}".format(c.get("video_titulo") or "", c.get("texto") or "")
            _alc, zonas = alcance(texto, c.get("zona_canal"), False)
            for z in (zonas or ["nacional"]):
                zonas_tema[z] = zonas_tema.get(z, 0) + 1
            registros_tema.append({
                "id": c["id"], "titulo": c.get("texto") or "",
                "fecha": c.get("fecha"), "zonas": zonas,
                "fuente": "busqueda",
            })
        subpanel = temas(registros_tema, ahora[:10], origen="comentarios")
        subtemas = []
        for t in subpanel["temas"][:6]:
            subtemas.append({"termino": t["termino"], "n": t["n"]})
        preguntas = sum(1 for c in muestra if _es_pregunta(c.get("texto")))
        sentimiento_tema = _conteo_sentimiento()
        for c in muestra:
            s = _sentimiento_de(c)
            if s is not None:
                sentimiento_tema[s] += 1
        por_tema.append({
            "tema": etiqueta,
            "comentarios": len(muestra),
            "videos": len({c.get("video") for c in muestra if c.get("video")}),
            "interacciones": sum(_interacciones(c) for c in muestra),
            "preguntas": preguntas,
            "zonas": dict(sorted(zonas_tema.items(), key=lambda kv: (-kv[1], kv[0]))),
            "subtemas": subtemas,
            "sentimiento": sentimiento_tema,
        })
    por_tema.sort(key=lambda t: (-t["comentarios"], t["tema"]))

    # Detalle por zona, para la pagina de cada zona. Los temas internos se
    # ordenan por volumen; las zonas, tambien.
    por_zona_detalle = {}
    for z, d in sorted(detalle.items(), key=lambda kv: (-kv[1]["comentarios"], kv[0])):
        temas_zona = sorted(d.pop("_temas").values(), key=lambda t: (-t["comentarios"], t["tema"]))
        d["por_tema"] = temas_zona
        por_zona_detalle[z] = d

    clasificados = sum(total_sentimiento.values())
    modelo = max(modelos.items(), key=lambda kv: (kv[1], kv[0]))[0] if modelos else None
    sentimiento_global = {
        "metodo": "modelo" if clasificados else "ninguno",
        "modelo": modelo,
        **total_sentimiento,
        "sin_clasificar": sin_clasificar,
    }

    return {
        "esquema": 1,
        "generado": ahora,
        "aviso": ("Metricas derivadas. El texto de los comentarios NO se "
                  "almacena aqui ni en el repo: las Politicas para "
                  "Desarrolladores de YouTube (III.E.4.d) lo limitan a 30 "
                  "dias y git no puede borrar. Ver pulso/conversacion.py."),
        "retencion_dias": RETENCION_DIAS,
        "comentarios_vigentes": len(comentarios_cache),
        "por_zona": dict(sorted(por_zona.items(), key=lambda kv: (-kv[1], kv[0]))),
        "por_canal": dict(sorted(por_canal.items(), key=lambda kv: (-kv[1], kv[0]))),
        "por_figura": dict(sorted(por_figura.items(), key=lambda kv: (-kv[1], kv[0]))),
        "por_tema": por_tema,
        "sentimiento": sentimiento_global,
        "por_zona_detalle": por_zona_detalle,
        "temas": panel["temas"],
        "canales": salud,
        "cuentas": cuentas,
    }


def normalizar_texto_comentario(texto, tope=400):
    """Pliega y recorta para deduplicar: el mismo comentario copiado en dos
    videos no son dos opiniones."""
    return fold(texto)[:tope]
