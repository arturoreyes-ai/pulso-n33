"""Busquedas permanentes en Google Noticias: la cobertura que el catalogo no ve.

config/medios.json solo entera al pipeline de una nota cuando el medio la
publica en SU feed, y hay municipios donde ese feed no existe. San Quintin es
el caso ya declarado: su renglon del catalogo dice, con todas sus letras,
"registro deliberado de un hueco, no un medio". Medido sobre la ventana del 7
de septiembre de 2026, 1,254 notas: San Quintin aparecia en 2 y San Felipe en
4. No es que no se publique nada de ahi; es que se publica en medios que no
estan en el catalogo.

Google Noticias si los indexa. De su RSS de busqueda se toma lo mismo que de
cualquier otro feed -- titular, fuente y enlace -- y nada mas: su <description>
trae solo un ancla y el nombre del publicador, asi que no hay cuerpo que
guardar aunque se quisiera.

Tres rarezas de ese feed obligan a este modulo en vez de un renglon mas en
config/medios.json:

  El <link> no es del medio, es un redirector opaco de Google
  (news.google.com/rss/articles/CBMi...). Aqui NO se resuelve. Seguirlo es una
  peticion mas por nota, y el token puede rotar entre corridas: la misma nota
  cambiaria de 'url' en una corrida sin novedad y notas.json existe justo para
  no cambiar cuando el contenido no cambia. Se guarda tal cual y el dominio
  sale del <source>.

  El <title> trae el publicador pegado: 'Titular real - Zeta Tijuana'. Sin
  quitarlo, el id de la nota -- sha256(fuente|titulo plegado) -- no empata con
  el de la copia que llega por el feed del propio medio, y la nota sale dos
  veces en el muro. Se quita con el texto EXACTO del <source>, nunca con un
  ' - ' generico: 'Tijuana - San Diego: la garita cierra el domingo' es una
  forma de titular normal en este corredor.

  El <source> rotula a los diarios de grupo con el dominio del GRUPO. El Sol de
  Tijuana llega como 'oem.com.mx', que no es su dominio ni el de La Voz de la
  Frontera, sus dos hermanos del catalogo y los dos feeds mas largos que hay.
  Por eso la resolucion es dominio, luego nombre, luego un mapa a mano.
"""

import hashlib
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode

from .fetch import fetch_rss
from .normalizar import dominio, fecha_iso, fold

URL_BASE = "https://news.google.com/rss/search"

# hl/gl/ceid deciden idioma y edicion. Es el mismo 'idioma' de
# config/medios.json y por la misma razon: decide con que modelo se etiqueta el
# tono. Adivinarlo del texto falla justo en los titulares cortos de puro
# nombre propio, que son la mayoria del muro.
LOCALES = {
    "es": {"hl": "es-419", "gl": "MX", "ceid": "MX:es-419"},
    "en": {"hl": "en-US", "gl": "US", "ceid": "US:en"},
}

# La ventana NO se guarda en la consulta: sale de la cadencia del cron
# (17 */6 * * *). 1d da cuatro corridas de traslape, asi que una corrida
# saltada no pierde el dia. Si estuviera en cada renglon, cambiar la cadencia
# obligaria a editar todos, y el que se olvide queda con otra ventana sin que
# nada lo señale.
VENTANA_OMISION = "when:1d"

# El filtro que de verdad manda es este, no 'when:': Google lo honra de forma
# irregular. Mismo criterio que descubrimiento.py.
DIAS_ATRAS = 7
DIAS_ADELANTE = 1

# Topes. data/notas.json ya pesa 1.1 MB con 1,554 notas (736 B por nota) y el
# navegador se lo baja entero con fetchPriority alto
# (web/src/app/layout.tsx:95). Una consulta de Google devuelve hasta 100 items
# por lectura y el cron corre cuatro veces al dia: sin tope, dos busquedas
# bastan para triplicar el archivo en una ventana de 30 dias.
#
# MAX_POR_CORRIDA es un presupuesto REPARTIDO, no una carrera. La primera
# version lo gastaba por orden de llegada y el resultado fue el que tenia que
# ser: en la corrida del 8 de septiembre de 2026, San Quintin y San Felipe se
# llevaron los 40 y las otras cuatro busquedas trajeron cero, con todo en
# 'recortadas'. Un tope global por orden de archivo no acota el volumen: mata
# a las busquedas de abajo. Se divide entre las activas y punto; el sobrante
# de una consulta corta no se reparte, para que el cupo de cada una no dependa
# de lo que devolvieron las demas.
MAX_POR_BUSQUEDA = 20
MAX_POR_CORRIDA = 48

# Orden fijo de las claves de 'detalle'. Se declara aqui para que el JSON salga
# igual siempre y para que el validador revise exactamente esta lista. 'notas'
# y 'sin_zona' las llena el pipeline, que es quien sabe cuantas sobrevivieron
# a la fusion y cuantas se quedaron sin zona.
CLAVES_DETALLE = (
    "items",
    "sin_publicador",
    "sin_fecha",
    "fuera_de_ventana",
    "sin_sufijo",
    "resueltas",
    "sinteticas",
    "recortadas",
    "notas",
    "sin_zona",
)


def url_de(busqueda):
    """Consulta + locale -> URL del RSS de busqueda. Pura: no toca la red."""
    ventana = busqueda.get("ventana") or VENTANA_OMISION
    q = "{} {}".format(busqueda.get("q", ""), ventana).strip()
    locale = LOCALES.get(busqueda.get("idioma", "es"), LOCALES["es"])
    # urlencode y NUNCA concatenacion: es lo que impide que una consulta con
    # '&hl=' se cuele como parametro y cambie la edicion del feed.
    return "{}?{}".format(URL_BASE, urlencode(
        {"q": q, "hl": locale["hl"], "gl": locale["gl"], "ceid": locale["ceid"]}))


def indice_publicadores(medios, alias=None):
    """Dos mapas hacia ids del catalogo: uno por dominio y otro por nombre.

    Separados a proposito. Si fueran uno solo, el nombre plegado de un medio
    podria satisfacer una busqueda por dominio y atribuir la nota al medio
    equivocado, que es peor que no resolverla.

    'alias' es el mapa a mano de config/busquedas.json y se aplica al final,
    contra las dos claves, porque Google rotula con dominio o con nombre segun
    el publicador.
    """
    por_dominio, por_nombre = {}, {}
    for m in medios:
        dom = dominio(m.get("url") or "")
        if dom:
            por_dominio.setdefault(dom, m["id"])
        nom = fold(m.get("nombre") or "")
        if nom:
            por_nombre.setdefault(nom, m["id"])
    for clave, mid in (alias or {}).items():
        dom = dominio(clave) or fold(clave)
        por_dominio.setdefault(dom, mid)
        por_nombre.setdefault(fold(clave), mid)
    return por_dominio, por_nombre


def limpiar_titulo(titulo, publicador):
    """Quita el ' - Publicador' que Google pega al final del titular.

    Devuelve (titulo, se_recorto). Solo empata el sufijo EXACTO: un titular
    que contiene ' - ' en medio se queda como esta y el llamador lo cuenta en
    'sin_sufijo' en vez de adivinar.
    """
    titulo = " ".join((titulo or "").split())
    pub = " ".join((publicador or "").split())
    if not pub:
        return titulo, False
    for guion in (" - ", " — ", " | "):
        sufijo = guion + pub
        if titulo.endswith(sufijo):
            return titulo[:-len(sufijo)].rstrip(), True
        if titulo.lower().endswith(sufijo.lower()):
            return titulo[:-len(sufijo)].rstrip(), True
    return titulo, False


def _fuente_sintetica(dom):
    """Publicador fuera del catalogo -> id estable. Hermano de web-<hash> de
    descubrimiento.py, con otro prefijo para que se distingan en fuentes.json."""
    return "gn-{}".format(hashlib.sha256(dom.encode("utf-8")).hexdigest()[:12])


def _en_ventana(fecha, ahora_dt):
    if not fecha:
        return False
    try:
        f = datetime.fromisoformat(fecha + "T00:00:00+00:00")
    except ValueError:
        return False
    return (ahora_dt - timedelta(days=DIAS_ATRAS)) <= f <= (ahora_dt + timedelta(days=DIAS_ADELANTE))


def cosechar(busquedas, medios, *, ahora, alias=None, feed=fetch_rss,
             max_por_busqueda=MAX_POR_BUSQUEDA, max_por_corrida=MAX_POR_CORRIDA,
             timeout=15):
    """Corre las busquedas activas. Devuelve (items, salud).

    'items' viene en la MISMA forma que descubrimiento.descubrir, para que el
    pipeline reuse el mismo bucle adaptador. 'salud' es una lista con un
    renglon por busqueda activa, no un renglon agregado: cada consulta falla
    por su cuenta y la banda de salud tiene que poder decir cual.

    'feed' es la frontera de red inyectada; las pruebas la sustituyen. Una
    busqueda caida no tumba la corrida, igual que un medio caido: se vuelve un
    registro 'fallo' con el motivo.
    """
    ahora_dt = datetime.fromisoformat(ahora)
    por_dominio, por_nombre = indice_publicadores(medios, alias)
    por_id = {m["id"]: m for m in medios}

    # El cupo se fija ANTES de consultar y es igual para todas: asi el orden
    # del archivo no decide quien trae notas y quien no.
    cupo = min(max_por_busqueda, max_por_corrida // max(1, len(busquedas)))
    cupo = max(1, cupo)

    items, salud = [], []
    for b in busquedas:
        detalle = dict.fromkeys(CLAVES_DETALLE, 0)
        url = url_de(b)
        t0 = time.monotonic()
        try:
            crudos = feed(url, timeout=timeout)
            estado, error = "ok", None
        except Exception as e:      # red, HTTP, XML mal formado, HTML de consentimiento
            crudos, estado = [], "fallo"
            error = "{}: {}".format(type(e).__name__, e)[:300]

        tomadas = 0
        for c in crudos:
            detalle["items"] += 1
            pub_texto = (c.get("fuente_texto") or "").strip()
            pub_url = (c.get("fuente_url") or "").strip()
            dom_pub = dominio(pub_url) or fold(pub_texto)
            if not dom_pub:
                # Sin <source> no hay forma de saber de que medio es la nota, y
                # atribuirla a news.google.com seria mentir en el muro.
                detalle["sin_publicador"] += 1
                continue

            fecha, _publicado = fecha_iso(c.get("fecha_cruda"))
            if not fecha:
                detalle["sin_fecha"] += 1
                continue
            if not _en_ventana(fecha, ahora_dt):
                detalle["fuera_de_ventana"] += 1
                continue

            # El cupo se cobra aqui, antes de resolver el publicador, para que
            # 'resueltas' y 'sinteticas' sumen lo que de verdad se llevo y no
            # lo que se habria llevado sin tope.
            if tomadas >= cupo:
                detalle["recortadas"] += 1
                continue

            titulo, recortado = limpiar_titulo(c.get("titulo"), pub_texto)
            if not titulo:
                detalle["sin_publicador"] += 1
                continue
            if not recortado:
                detalle["sin_sufijo"] += 1

            mid = (por_dominio.get(dom_pub)
                   or por_nombre.get(fold(pub_texto))
                   or por_dominio.get(fold(pub_texto)))
            if mid and mid in por_id:
                # El medio SI esta en el catalogo: Google lo encontro antes que
                # su propio feed. Se usa su id para que id_nota coincida con el
                # de la copia directa y la nota no salga dos veces, y su
                # dominio para que el muro rotule igual las dos filas.
                medio = por_id[mid]
                dom_nota = dominio(medio.get("url") or "") or dom_pub
                detalle["resueltas"] += 1
            else:
                medio = {"id": _fuente_sintetica(dom_pub),
                         "nombre": pub_texto or dom_pub,
                         "url": pub_url or "https://{}/".format(dom_pub),
                         "zona": "estatal", "tipo": "busqueda"}
                dom_nota = dom_pub
                detalle["sinteticas"] += 1

            items.append({
                "medio": medio,
                "item": {"titulo": titulo, "url": c.get("url"),
                         "dominio": dom_nota, "fecha_cruda": c.get("fecha_cruda")},
                "origen": "busqueda_web", "descubierta_por": b["id"]})
            tomadas += 1

        salud.append({
            "id": b["id"], "nombre": b["nombre"], "url": url,
            "metodo": "busqueda", "zona": "estatal",
            "estado": estado, "obtenidas": tomadas, "nuevas": 0,
            "ms": int((time.monotonic() - t0) * 1000),
            "ultima_ok": ahora if estado == "ok" else None,
            "error": error, "detalle": detalle,
        })
    return items, salud


def salud_sin_red(busquedas, ahora, salud_previa):
    """Renglones de salud para el modo corpus. No toca la red: url_de es puro.

    'ms' va en 0 y no medido: TestDeterminismo corre justo por aqui y un
    cronometro real haria que dos corridas dieran bytes distintos.
    """
    return [{
        "id": b["id"], "nombre": b["nombre"], "url": url_de(b),
        "metodo": "busqueda", "zona": "estatal",
        "estado": "fallo", "obtenidas": 0, "nuevas": 0, "ms": 0,
        "ultima_ok": (salud_previa.get(b["id"]) or {}).get("ultima_ok"),
        "error": "sin red: corrida en modo corpus",
        "detalle": dict.fromkeys(CLAVES_DETALLE, 0),
    } for b in busquedas]


def activas(doc):
    """Las busquedas encendidas del documento de config. None -> lista vacia."""
    return [b for b in (doc or {}).get("busquedas", []) if b.get("activo", True)]
