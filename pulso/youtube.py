"""Shorts y videos de YouTube por feed publico: lo que suben los medios.

El caso: El Vigia publica desde Ensenada y su fila del catalogo lo decia asi.
El sondeo del 18 de septiembre de 2026 sobre sus quince Shorts devolvio NUEVE
'nacional', cinco de Ensenada y uno 'fuera' -- Trump, Milei, las Malvinas,
Morelos, Cuautla -- y su pieza mas vista de la ventana, la primera de toda la
corrida con 3,985 vistas, fue "Trump amenaza cortar comercio con la UE".
Estampar la zona de la fila, que es lo que hace Instagram, pondria eso al
frente del muro de Ensenada. No es un caso aislado: PSN dice Tijuana y sus
seis Shorts salieron 'nacional'; Sintesis dice Tijuana y publico San Diego;
AFN dice Tijuana y publico Ensenada. El feed de YouTube de un medio es su
canal nacional y viral, no su cobertura municipal -- el mismo diario hace nota
de colonia en su portada y Shorts de Trump aqui. Asi que la zona sale del
titulo y la descripcion con el gacetero, como en TikTok, y `config/youtube.json`
ni siquiera tiene campo `zona`: un campo que existe acaba pasandose.

Segundo caso, el que define un estado: `yt_televisamxl` devuelve HTTP 404 en
su lista de Shorts. El canal no tiene ninguno. Eso es un hueco medido y no una
falla, asi que degrada a `sin_lista` y no a `fallo` -- un `ok` con `posts: 0`
se leeria como "hoy no publico".

## De donde salen los datos, y por que no es la API

YouTube genera dos listas de reproduccion automaticas por canal y las sirve
por Atom, sin llave, sin cuota y sin OAuth:

    UUSH<id sin UC>    solo Shorts
    UULF<id sin UC>    solo videos largos

Es un documento de sindicacion publico, del mismo tipo que los quince feeds de
prensa que ya lee pulso/fetch.py. NO es la API de datos, y esa diferencia es
el motivo de que este modulo exista aparte de pulso/conversacion.py: las
Politicas para Desarrolladores (III.E.2.a sobre agregar canales de distintos
duenos, III.E.4.d sobre los 30 dias) atan los datos de la API y no este feed.
Por eso aquel viene apagado detras de YOUTUBE_HABILITADO y este no, y por eso
**sus datos no se suman en un mismo agregado**.

El prefijo no esta documentado por Google, y pulso/conversacion.py ya rechazo
un atajo de esa familia (UC->UU) con el argumento de que "falla en silencio".
Aqui no puede, porque la lista NO es la que clasifica: cada entrada trae su
propio enlace, /shorts/ o /watch, y de ahi sale el formato. La lista es solo
una estrategia de lectura barata. Cuando las dos no coinciden manda el enlace
y la discrepancia se cuenta en `salud[].reclasificados`, asi que el dia que
YouTube deje de honrar el prefijo el contador lo grita en la banda de salud en
vez de callarselo. Eso es lo que compra el derecho a usar un prefijo no
documentado -- y no es hipotetico: ese mismo 18 de septiembre la lista UULF de
Zeta, la de "solo videos largos", traia diez entradas con enlace /shorts/.

## Lo que el feed no trae

No trae conteo de comentarios y no trae duracion. Las dos ausencias se
publican como ausencias: emitir `comentarios: 0` diria "nadie comento" cuando
lo cierto es que la fuente no lo dice. Se ordena por `reproducciones`, con
`valoraciones` de desempate, y las dos son campos de archivo -- la tarjeta no
muestra cifras de plataforma desde el 17 de septiembre de 2026.

`valoraciones` es `media:starRating@count` y NO se llama `likes` a proposito.
De 162 entradas sondeadas el `@average` solo vale "5.00" o "0.00", nunca algo
intermedio, que es lo que se espera desde que no hay dislikes -- o sea que
casi seguro son los likes. Pero Google no lo documenta en ninguna parte y
bautizarlo `likes` seria una mentira tranquila sobre lo que la fuente publica.

## Este modulo NO cosecha comentarios

El feed no los trae. Traerlos costaria un actor de Apify (~24 USD/mes con las
16 filas activas, medido el 18 de septiembre de 2026) y quedo pendiente. La
consecuencia es que todos los conteos de conversacion salen en cero, y para
que un cero no se lea como medicion el documento lleva
`cosecha_comentarios: false` en la raiz. Sin ese campo, un panel sin cosecha y
uno donde nadie comento serian el mismo archivo.
"""

import xml.etree.ElementTree as ET
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from . import redes as _redes
from .redes import (  # noqa: F401  (reexportados a proposito, como en tiktok.py)
    DESTACADOS_MAXIMO, RETENCION_DIAS, TITULO_MAXIMO, _titulo,
    guardar_publicaciones, leer_publicaciones, zona_por_ambito,
)

PLATAFORMA = "youtube"
FEED = "https://www.youtube.com/feeds/videos.xml?playlist_id={}"

# Las dos listas automaticas, y el prefijo de enlace que cada una tiene que
# devolver. El segundo es la comprobacion que vuelve ruidoso un prefijo no
# documentado; ver el encabezado.
LISTAS = {
    "short": ("UUSH", "https://www.youtube.com/shorts/"),
    "video": ("UULF", "https://www.youtube.com/watch?v="),
}
FORMATOS = ("short", "video")

VENTANA_HORAS = 24
PIEZAS_POR_LISTA = 15
AMBITO = "regional"

# Ordena por lo que el feed si publica. Tiene que coincidir con
# PLATAFORMAS_REDES["youtube"] en pulso/validador.py y con publicaciones.ts en
# web/: si divergen, data/ se reescribe en cada corrida y el guardia
# `git diff --cached --quiet` del cron deja de detectar "sin cambios".
ORDEN = ("reproducciones", "valoraciones")
CIFRAS = ("reproducciones", "valoraciones")
CAMPOS_EXTRA = ("alcance", "publicado", "formato", "imagen")

NS = {
    "a": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "m": "http://search.yahoo.com/mrss/",
}


class SinLista(Exception):
    """El canal no tiene esa lista automatica. Hueco medido, no falla."""


def _lista(canal, formato):
    """El id de la lista automatica de ese canal para ese formato.

    El 'UC' se REEMPLAZA, no se antepone. Es la unica afirmacion sobre la que
    descansa toda la fuente, y por eso tiene prueba propia.
    """
    return LISTAS[formato][0] + canal[2:]


def leer_feed(url, timeout=15):
    """El XML crudo de un feed Atom de YouTube. Punto de parcheo de las pruebas.

    No se usa pulso/fetch.py::fetch_rss aunque ya parsea Atom: devuelve solo
    titulo, url y fecha, y tira `media:community`, que es de donde salen las
    vistas -- la clave de ordenamiento de esta plataforma. Unificarlas
    obligaria a que el lector de prensa cargara campos que no usa.
    """
    pedido = Request(url, headers={"User-Agent": "pulso-n33/1.0 (+lector de feeds publicos)",
                                   "Accept": "application/atom+xml, application/xml"})
    try:
        with urlopen(pedido, timeout=timeout) as r:
            return r.read()
    except HTTPError as e:
        if e.code == 404:
            raise SinLista(url)
        raise


def _texto(nodo, ruta):
    el = nodo.find(ruta, NS)
    return (el.text or "") if el is not None and el.text else ""


def _entero(nodo, ruta, attr):
    el = nodo.find(ruta, NS)
    if el is None:
        return 0
    try:
        return max(0, int(el.get(attr) or 0))
    except (TypeError, ValueError):
        return 0


def _formato_del_enlace(url):
    """El formato que declara el enlace que YouTube mismo publica, o None.

    La lista es una estrategia de lectura; el ENLACE es la clasificacion. La
    distincion no es teorica: el 18 de septiembre de 2026 la lista UULF de
    Zeta -- la de "solo videos largos" -- devolvio diez entradas cuyo enlace
    era /shorts/. Descartarlas perderia diez Shorts reales; creerle a la lista
    los publicaria con el formato equivocado y con la proporcion equivocada en
    pantalla. Se le cree al enlace y se cuenta la discrepancia, que es ademas
    el aviso de que el prefijo dejo de significar lo que creemos.
    """
    for formato, (_, prefijo) in LISTAS.items():
        if url.startswith(prefijo):
            return formato
    return None


def _zona(titulo, descripcion, ambito):
    """(zona, alcance). El TITULO manda; la descripcion solo desempata.

    La descripcion vale catorce puntos de resolucion --- sobre 462 piezas, el
    35% resuelve a una zona del producto con el titulo solo y el 49% con las
    dos ---
    y la mayoria de lo que aporta es correcto: "Esto exigieron trabajadores de
    TELNOR a Sheinbaum" no nombra lugar y es de Tijuana, y "Abarrotan la
    Revolucion por Claudia Sheinbaum" nombra una avenida tijuanense que el
    gacetero no conoce.

    Pero una descripcion de YouTube no es el pie de un TikTok: trae fechas de
    gira, listas de ciudades y texto fijo del canal, y cualquiera de esos le
    acredita a una ciudad una pieza que no habla de ella --- con `alcance:
    "zona"`, el veredicto mas fuerte. El caso, medido el 18 de septiembre de
    2026: "Intocable recorre por primera vez las calles del centro de CDMX",
    de N+, salio `zona: Tijuana` y encabezo el muro de Tijuana; el titulo
    nombra la capital y la descripcion nombraba Tijuana de paso.

    Asi que la descripcion se lee SOLO cuando el titulo no nombra lugar
    alguno. Si el titulo nombra uno --- del producto, del estado o de fuera ---
    ese es el veredicto y la descripcion no puede moverlo. Es la misma regla
    que zonas.alcance ya aplica entre `zonas` y `fuera`: nombrar gana sobre no
    nombrar, y lo primero que nombra la pieza es su titular.

    Cuesta poco y sobre todo REDISTRIBUYE. Medido el 21 de septiembre sobre
    462 piezas: el corredor pasa de 228 a 225, y por dentro Tijuana baja de
    140 a 125 mientras Playas de Rosarito sube de 22 a 29, Tecate de 5 a 8 y
    Mexicali de 29 a 31. La ciudad grande es la que mas se nombra de paso, asi
    que era la que mas se llevaba de mas.
    """
    zona, alc = zona_por_ambito(titulo, ambito)
    if alc != "nacional":
        return zona, alc
    return zona_por_ambito(titulo + chr(10) + (descripcion or ""), ambito)


def _limpiar_pieza(entrada, canal, formato_pedido):
    """(registro, motivo). registro None = se descarta, con el motivo contado.

    Lista blanca estricta. La descripcion se lee para zonificar y NO se
    publica: la regla es titular, fuente y liga, y este es el unico punto del
    modulo por donde podria fugarse un cuerpo.
    """
    enlace = entrada.find("a:link", NS)
    url = (enlace.get("href") or "") if enlace is not None else ""
    if not _texto(entrada, "yt:videoId") or not url:
        return None, "sin_enlace"
    formato = _formato_del_enlace(url)
    if formato is None:
        return None, "enlace_desconocido"
    # El canal puede tener un formato apagado a proposito (El Vigia y sus
    # "Resumen diario"), y eso manda sobre la lista en la que aparecio.
    if formato not in (canal.get("formatos") or list(FORMATOS)):
        return None, "formato_apagado"

    publicado = _texto(entrada, "a:published")
    if not publicado:
        return None, "sin_fecha"

    titulo = _titulo(_texto(entrada, "m:group/m:title") or _texto(entrada, "a:title"))
    descripcion = _texto(entrada, "m:group/m:description")
    zona, alc = _zona(titulo, descripcion, canal.get("ambito") or AMBITO)
    if zona is None:
        return None, "fuera"

    miniatura = entrada.find("m:group/m:thumbnail", NS)
    registro = {
        "url": url,
        "cuenta": canal["id"],
        "zona": zona,
        "alcance": alc,
        "formato": formato,
        "tipo": "video",
        "titulo": titulo,
        "publicado": publicado,
        "fecha": publicado[:10],
        "idioma": canal.get("idioma") or "es",
        "reproducciones": _entero(entrada, "m:group/m:community/m:statistics", "views"),
        "valoraciones": _entero(entrada, "m:group/m:community/m:starRating", "count"),
    }
    if miniatura is not None and miniatura.get("url"):
        registro["imagen"] = miniatura.get("url")
    return registro, None


def _fuentes(canales):
    """Los canales con la forma que `redes._catalogo_cuentas` espera.

    `zona: estatal` no es pereza: la fila deliberadamente NO reclama un lugar,
    porque creerle es el error que documenta el encabezado. Es la misma regla
    de fuente sintetica de pulso/busquedas.py y pulso/tiktok.py.
    """
    return [{"id": c["id"], "nombre": c.get("nombre") or c["id"], "zona": "estatal",
             "activo": bool(c.get("activo")), "verificado": True} for c in canales]


# ------------------------------------------------------------------ cosecha

def cosechar(canales, ahora, cache, piezas=PIEZAS_POR_LISTA, timeout=15):
    """Lee las dos listas de cada canal activo. Un solo pase, y gratis.

    Devuelve (publicaciones, salud). No hay presupuesto, ni `vistos.json`, ni
    `pendientes()`: esos existen para frenar una factura y aqui no hay ninguna.
    Lo que si se conserva es el catalogo de publicaciones, y hace falta: el
    feed devuelve ~15 entradas y Milenio publica ~29 piezas al dia, asi que
    una suya puede salirse del feed DENTRO de la ventana de 24 horas y
    desapareceria del corte a media ventana.
    """
    publicaciones = leer_publicaciones(cache)
    salud = []
    for canal in canales:
        if not canal.get("activo"):
            continue
        fila = {"cuenta": canal["id"], "estado": "ok", "entradas": 0, "posts": 0,
                "reclasificados": 0, "descartados": 0, "fuera": 0}
        formatos = canal.get("formatos") or list(FORMATOS)
        faltantes = 0
        for formato in FORMATOS:
            if formato not in formatos:
                continue
            url = FEED.format(_lista(canal["canal"], formato))
            try:
                crudo = leer_feed(url, timeout)
            except SinLista:
                faltantes += 1
                continue
            except Exception as e:  # red, DNS, 5xx: la corrida sigue
                fila["estado"] = "fallo"
                fila["error"] = "{}: {}".format(type(e).__name__, e)[:160]
                continue
            try:
                raiz = ET.fromstring(crudo)
            except ET.ParseError as e:
                fila["estado"] = "fallo"
                fila["error"] = "feed ilegible ({}): {}".format(formato, e)[:160]
                continue
            entradas = raiz.findall("a:entry", NS)[:piezas]
            fila["entradas"] += len(entradas)
            for entrada in entradas:
                limpio, motivo = _limpiar_pieza(entrada, canal, formato)
                if limpio is None:
                    fila["fuera" if motivo == "fuera" else "descartados"] += 1
                    continue
                if limpio["formato"] != formato:
                    fila["reclasificados"] += 1
                publicaciones[limpio["url"]] = limpio
                fila["posts"] += 1
        if faltantes and fila["estado"] == "ok" and fila["entradas"] == 0:
            # Ninguna de las listas que pide existe. Ver el encabezado: es un
            # hueco medido, no una falla, y tampoco "hoy no publico".
            fila["estado"] = "sin_lista"
            fila["nota"] = "el canal no tiene la lista automatica que se pidio"
        elif faltantes:
            fila["nota"] = "{} lista(s) inexistente(s); se leyo el resto".format(faltantes)
        salud.append(fila)
    guardar_publicaciones(publicaciones, ahora, cache)
    return publicaciones, salud


def probar(canales, ahora, piezas=5, timeout=15):
    """Lee unas pocas entradas por canal y no escribe nada.

    Sondear no cuesta, asi que aqui es la forma NORMAL de calificar un canal y
    no un ritual previo al gasto: es lo que hay que correr antes de poner
    `activo: true` en una fila, y de donde salen los numeros que cada `nota`
    del config cita.
    """
    salida = []
    for canal in canales:
        filas, descartes = [], {}
        for formato in (canal.get("formatos") or list(FORMATOS)):
            try:
                crudo = leer_feed(FEED.format(_lista(canal["canal"], formato)), timeout)
            except SinLista:
                descartes["sin_lista_" + formato] = 1
                continue
            except Exception as e:
                descartes["fallo_" + formato] = "{}: {}".format(type(e).__name__, e)[:120]
                continue
            for entrada in ET.fromstring(crudo).findall("a:entry", NS)[:piezas]:
                limpio, motivo = _limpiar_pieza(entrada, canal, formato)
                if limpio:
                    filas.append(limpio)
                else:
                    descartes[motivo] = descartes.get(motivo, 0) + 1
        salida.append({"cuenta": canal["id"], "nombre": canal.get("nombre") or canal["id"],
                       "ambito": canal.get("ambito") or AMBITO,
                       "piezas": filas, "descartes": descartes})
    return salida


def derivar(ahora, salud, publicaciones=None, canales=None, ventana_horas=VENTANA_HORAS):
    """data/youtube.json. Ver pulso/redes.py::derivar.

    Sin comentarios: se pasan listas vacias y `cosecha_comentarios=False`, que
    es lo que impide leer los ceros resultantes como una medicion.
    """
    return _redes.derivar([], ahora, salud, {"resultados": 0, "gastado": 0, "por_concepto": {}},
                          None, publicaciones or {}, _fuentes(canales or []),
                          plataforma=PLATAFORMA, ventana_horas=ventana_horas,
                          campos_extra=CAMPOS_EXTRA, turnos=True,
                          cifras=CIFRAS, orden=ORDEN, formatos=FORMATOS,
                          dedupe_titulo=True, cosecha_comentarios=False)
