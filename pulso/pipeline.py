"""Orquestacion: fetch -> normalizar -> fusionar -> resolver -> clasificar -> escribir.

Sin servidor y sin base de datos: la salida son tres archivos JSON que el
bot commitea al repo, lo que ademas da historial gratis (docs/PLAN.md
seccion 5).

Dos propiedades que las pruebas fijan y conviene no romper:

  Determinismo   'ahora' se inyecta, el orden de las notas es estable y el
                 JSON se escribe con las mismas opciones siempre. Dos
                 corridas con la misma entrada dan bytes identicos.
  Idempotencia   Las notas se fusionan por id conservando el 'capturado'
                 original, asi que volver a correr no reescribe la historia
                 ni infla los conteos.
"""

import json
import os
from datetime import date, datetime, timezone

from . import VERSION, ZONAS
from .archivo import (
    RETENCION_DIAS,
    escribir_archivos,
    leer_todo,
    para_temas,
    particionar,
)
from .busquedas import activas as busquedas_activas, cosechar, salud_sin_red
from .clasificar import clasificar_lote, sin_idioma
from .delegaciones import delegaciones_en
from .descubrimiento import descubrir
from .fetch import fetch_medios
from .normalizar import dedup, dominio, fecha_iso, fold, id_nota, url_canonica
from .sentimiento import IDIOMA_OMISION
from .tema_nota import idioma_de_nota, rubros_de_categorias, rubros_de_nota
from .temas import temas
from .validador import ESQUEMA
from .zonas import alcance

ARCHIVOS = ("notas.json", "fuentes.json", "temas.json", "estado.json")
SUBCARPETA_ARCHIVO = "archivo"

# Temas por zona. El minimo baja a 2 en zonas con poca prensa (Tecate, San
# Felipe...): con 14 notas a la semana nada llega a 3 y el bloque saldria
# vacio, que se lee como 'aqui no pasa nada'. El minimo usado se publica en
# cada bloque para que el tablero lo diga.
MINIMO_TEMAS = 3
MINIMO_TEMAS_ZONA_CHICA = 2
NOTAS_PARA_MINIMO_PLENO = 100


def ahora_utc():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _leer(ruta, omision):
    try:
        with open(ruta, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return omision


def _serializar(datos):
    return json.dumps(datos, ensure_ascii=False, indent=1, sort_keys=False) + "\n"


def _escribir(ruta, datos):
    """UTF-8 con acentos literales, LF y salto final: diffs legibles y estables."""
    os.makedirs(os.path.dirname(ruta) or ".", exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(_serializar(datos))


def _escribir_si_cambio(ruta, datos):
    """Escribe solo si los bytes cambian. Devuelve True si escribio.

    Cada corrida reresuelve todo el historico, asi que sin esto se
    reescribirian todos los meses del archivo cada vez y el repo se llenaria
    de commits sin cambio real.
    """
    nuevo = _serializar(datos)
    try:
        with open(ruta, encoding="utf-8") as fh:
            if fh.read() == nuevo:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(ruta) or ".", exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(nuevo)
    return True


def _entorno_ci():
    """(commit, url de la corrida) si estamos en GitHub Actions."""
    sha = os.environ.get("GITHUB_SHA")
    servidor = os.environ.get("GITHUB_SERVER_URL")
    repo = os.environ.get("GITHUB_REPOSITORY")
    corrida_id = os.environ.get("GITHUB_RUN_ID")
    corrida = None
    if servidor and repo and corrida_id:
        corrida = "{}/{}/actions/runs/{}".format(servidor, repo, corrida_id)
    return (sha[:7] if sha else None), corrida


def _nota(medio, item, capturado):
    """Item crudo de feed -> nota normalizada, sin figuras ni postura."""
    titulo = " ".join((item.get("titulo") or "").split())
    fecha, publicado = fecha_iso(item.get("fecha_cruda"))
    url = url_canonica(item.get("url"))
    nota = {
        "id": id_nota(medio["id"], titulo),
        "titulo": titulo,
        "url": url,
        # El cosechador puede mandar el dominio ya resuelto. Hace falta para
        # las busquedas: su enlace es el redirector de Google, asi que
        # dominio(url) daria 'news.google.com' en TODAS y el muro rotularia
        # ahi cada nota en vez de en el medio que la publico.
        "dominio": item.get("dominio") or dominio(url) or dominio(medio["url"]),
        "fuente": medio["id"],
        "zona_medio": medio.get("zona"),
        # Se llenan al resolver: dependen del roster y del gazetero.
        "zonas": [],
        "delegaciones": [],
        "alcance": None,
        "fecha": fecha,
        "publicado": publicado,
        "capturado": capturado,
        "figuras": [],
        "postura": None,
    }
    if item.get("origen"):
        nota["origen"] = item["origen"]
    if item.get("descubierta_por"):
        nota["descubierta_por"] = item["descubierta_por"]
    # Condicional, como 'origen': ausente significa que el medio no publica
    # miniatura en su feed. No es un hueco que rellenar ni un null que decir.
    if item.get("imagen"):
        nota["imagen"] = item["imagen"]
    # Lo que dijeron las <category> del feed, pasado por el mapa del medio.
    # Se guarda porque es lo unico que no se puede recalcular despues: el
    # feed no vuelve a mandar el item cuando sale de el (pulso/tema_nota.py).
    categoria = rubros_de_categorias(medio, item.get("categorias"))
    if categoria:
        nota["rubros_categoria"] = categoria
    return nota


def _desde_corpus(corpus, medios, capturado):
    """Modo sin red: el corpus de titulares reales hace de feed.

    El corpus trae el nombre del medio en texto ('Zeta Tijuana'), no su id.
    Los titulares de medios que no estan en config/medios.json se omiten: no
    se inventa un id ni una URL de feed para ellos. Por eso la corrida
    offline ingesta menos notas que las que trae el corpus, y la resolucion
    de figuras sobre los 15 titulares se prueba aparte, directo contra
    Roster (tests/test_roster.py).
    """
    por_nombre = {m["nombre"].lower(): m for m in medios}
    notas = []
    for c in corpus:
        nombre = (c.get("fuente") or "").strip()
        medio = por_nombre.get(nombre.lower())
        if medio is None:
            continue
        item = {"titulo": c.get("titulo"), "url": c.get("url") or medio["url"],
                "fecha_cruda": c.get("fecha"), "imagen": c.get("imagen")}
        n = _nota(medio, item, capturado)
        if n["fecha"] is None:
            n["fecha"] = c.get("fecha")
        notas.append(n)
    return notas


def correr(*, medios, roster, salida="data", sin_red=False, corpus=None,
           ahora=None, metodo="ninguno", retener_dias=RETENCION_DIAS,
           analizador=None, descubrimiento_web=False, busquedas=None):
    """Corre el pipeline completo y escribe la ventana, el archivo y los paneles.

    `analizador` es el clasificador de tono para metodo='modelo'; None carga
    pysentimiento. Las pruebas pasan un AnalizadorFalso.

    `busquedas` es el documento entero de config/busquedas.json. None significa
    no cosechar: asi una corrida sin ese archivo se comporta igual que antes de
    que existiera.
    """
    ahora = ahora or ahora_utc()
    # 'hoy' sale de 'ahora', no de date.today(). Antes daba igual porque solo
    # se usaba para resolver el roster de notas sin fecha; ahora decide que
    # se archiva, y con date.today() la misma entrada daria particiones
    # distintas segun el dia en que se corriera, o sea adios determinismo.
    hoy = datetime.strptime(ahora[:10], "%Y-%m-%d").date()

    # Ventana MAS archivo: si solo se leyera la ventana, una nota archivada
    # que sigue en el feed volveria a entrar como nueva cada corrida.
    previas = leer_todo(salida, _leer)
    salud_previa = {s["id"]: s for s in _leer(os.path.join(salida, "fuentes.json"), {}).get("fuentes", [])}

    activos = [m for m in medios if m.get("activo", True)]

    discovery_health = None
    discovery_items = []
    medios_runtime = list(medios)
    activas_bq = busquedas_activas(busquedas)

    # De que RENGLON DE SALUD salio cada nota, que no siempre es su 'fuente'.
    # Una nota que Google encontro de un medio del catalogo tiene fuente 'zeta'
    # pero la cosecho la busqueda 'bq_...', y contar su 'nueva' contra 'zeta'
    # inflaria las nuevas de un feed por encima de sus propias obtenidas.
    # setdefault y no asignacion: gana el primero que la vio, igual que dedup.
    cosechado_por = {}
    if sin_red:
        modo = "corpus"
        # Contra el catalogo COMPLETO, no solo los activos: 'activo' decide si
        # se consulta la red, y aqui no hay red que consultar. Ademas ejercita
        # un caso real de produccion, el de notas viejas de un medio que ya se
        # apago: se conservan en el historico aunque su fuente ya no se
        # consulte ni reporte salud.
        frescas = _desde_corpus(corpus or [], medios, ahora)
        # En modo corpus no se toca la red: la salud queda en 'fallo' con el
        # motivo explicito, para no fingir que las fuentes respondieron.
        salud = [{
            "id": m["id"], "nombre": m["nombre"], "url": m["url"],
            "metodo": m.get("tipo", "rss"),
            "zona": m.get("zona"),
            "estado": "fallo", "obtenidas": 0, "nuevas": 0, "ms": 0,
            "ultima_ok": (salud_previa.get(m["id"]) or {}).get("ultima_ok"),
            "error": "sin red: corrida en modo corpus",
        } for m in activos]
        por_fuente = {}
        for n in frescas:
            por_fuente.setdefault(n["fuente"], []).append(n)
            cosechado_por.setdefault(n["id"], n["fuente"])
        for s in salud:
            s["obtenidas"] = len(por_fuente.get(s["id"], []))
        salud += salud_sin_red(activas_bq, ahora, salud_previa)
    else:
        modo = "red"
        resultados, salud = fetch_medios(activos, ahora)
        frescas = []
        for medio, items in resultados:
            for item in items:
                n = _nota(medio, item, ahora)
                frescas.append(n)
                cosechado_por.setdefault(n["id"], medio["id"])

        if descubrimiento_web:
            discovery_items, discovery_health = descubrir(ahora=ahora)
            for descubrimiento in discovery_items:
                medio = descubrimiento["medio"]
                medios_runtime.append(medio)
                item = dict(descubrimiento["item"])
                item["origen"] = descubrimiento["origen"]
                item["descubierta_por"] = descubrimiento["descubierta_por"]
                n = _nota(medio, item, ahora)
                frescas.append(n)
                cosechado_por.setdefault(n["id"], "descubrimiento-web")

        if activas_bq:
            items_bq, salud_bq = cosechar(
                activas_bq, medios, ahora=ahora,
                alias=(busquedas or {}).get("publicadores"))
            for hallazgo in items_bq:
                # A diferencia del descubrimiento, el medio sintetico NO entra
                # a medios_runtime. Si entrara, la corrida que lo descubre
                # resolveria su zona e idioma desde el catalogo en memoria y la
                # SIGUIENTE no, porque ya no estaria: mismo dato, dos
                # comportamientos. El idioma se recupera mas abajo por la
                # busqueda que lo trajo, que si es persistente.
                item = dict(hallazgo["item"])
                item["origen"] = hallazgo["origen"]
                item["descubierta_por"] = hallazgo["descubierta_por"]
                n = _nota(hallazgo["medio"], item, ahora)
                frescas.append(n)
                cosechado_por.setdefault(n["id"], hallazgo["descubierta_por"])
            salud += salud_bq

    # Una copia curada gana a una traida de fuera. GDELT devuelve el mismo
    # articulo con parametros distintos o el titulo ligeramente editado;
    # Google Noticias lo devuelve SIEMPRE con otra URL, porque su <link> es un
    # redirector propio, asi que para las busquedas el cruce por URL no empata
    # nunca y el unico posible es por titular.
    #
    # El corte va por 'origen' y no por posicion: con dos fuentes anexadas, el
    # rebanado por longitud dejaba de senalar donde empiezan las traidas.
    curadas = [n for n in frescas if not n.get("origen")]
    traidas = [n for n in frescas if n.get("origen")]
    if traidas:
        urls = {url_canonica(n.get("url")) for n in curadas}
        pares = {(fold(n.get("titulo")), n.get("dominio")) for n in curadas}
        # Solo para busqueda, y por titular a secas. Es la unica defensa contra
        # los diarios de grupo: Google rotula a El Sol de Tijuana como
        # 'oem.com.mx', que no es su dominio, asi que el par (titular, dominio)
        # no empata y la nota saldria dos veces. Se mira tambien lo ya
        # guardado, para cerrar el caso entre corridas: Google encuentra el
        # titular antes de que el feed del propio medio lo publique.
        # Cuesta tirar el titular identico de OTRO medio -- pasa con los cables
        # de OEM -- y se acepta: la copia de Google es peor que cualquier copia
        # curada, con enlace redirigido y sin la zona del catalogo.
        solo_titulo = {fold(n.get("titulo")) for n in curadas}
        solo_titulo |= {fold(n.get("titulo")) for n in previas.values()
                        if n.get("origen") != "busqueda_web"}
        frescas = curadas + [
            n for n in traidas
            if url_canonica(n.get("url")) not in urls
            and (fold(n.get("titulo")), n.get("dominio")) not in pares
            and not (n.get("origen") == "busqueda_web"
                     and fold(n.get("titulo")) in solo_titulo)]

    frescas = dedup(frescas)

    if discovery_health is not None:
        previa = salud_previa.get("descubrimiento-web") or {}
        if discovery_health["estado"] == "fallo":
            discovery_health["ultima_ok"] = previa.get("ultima_ok")
        salud.append(discovery_health)

    # Fusion por id: el 'capturado' original manda, asi que una nota no
    # cambia de fecha de captura por seguir apareciendo en el feed.
    fusionadas, nuevas_por_salud = dict(previas), {}
    for n in frescas:
        vieja = fusionadas.get(n["id"])
        if vieja is None:
            fusionadas[n["id"]] = n
            clave = cosechado_por.get(n["id"], n["fuente"])
            nuevas_por_salud[clave] = nuevas_por_salud.get(clave, 0) + 1
        elif n.get("origen") == "busqueda_web" and not vieja.get("origen"):
            # Ya esta la copia del feed del propio medio. La de Google solo
            # aporta el enlace redirigido, y su token puede rotar: dejarla
            # ganar cambiaria 'url' en corridas sin novedad, y notas.json
            # existe justo para no cambiar cuando el contenido no cambia.
            continue
        else:
            n["capturado"] = vieja.get("capturado") or n["capturado"]
            # La postura tambien se arrastra: clasificar_lote decide si la
            # etiqueta sigue vigente, y asi el modelo no repite las ~200
            # notas que siguen en el feed en cada corrida.
            n["postura"] = vieja.get("postura")
            # La miniatura tambien: manda la primera vista, como 'capturado'.
            # Un feed que cambia el tamano de su imagen o la quita no debe
            # ensuciar data/ en una corrida sin novedad.
            imagen = vieja.get("imagen") or n.get("imagen")
            if imagen:
                n["imagen"] = imagen
            else:
                n.pop("imagen", None)
            # La seccion va al reves que la miniatura: manda el feed cuando
            # habla, porque es el medio reclasificando su nota. Cuando calla
            # -- el item llego sin <category>, o por Scrapy -- se conserva lo
            # que dijo antes, que no se puede volver a preguntar.
            categoria = n.get("rubros_categoria") or vieja.get("rubros_categoria")
            if categoria:
                n["rubros_categoria"] = categoria
            fusionadas[n["id"]] = n

    # Zona, delegacion, figuras, alcance y postura se recalculan en cada
    # corrida: editar el catalogo, el roster, los gazeteros o el clasificador
    # se propaga a todo el historico sin migracion.
    zona_por_fuente = {m["id"]: m.get("zona") for m in medios_runtime}
    for n in fusionadas.values():
        n["zona_medio"] = zona_por_fuente.get(n["fuente"], n.get("zona_medio"))
        cuando = None
        if n.get("fecha"):
            try:
                cuando = datetime.strptime(n["fecha"], "%Y-%m-%d").date()
            except ValueError:
                cuando = None
        hits = roster.match(n["titulo"], cuando or hoy)
        n["figuras"] = [{"id": h.figura_id, "via": h.via, "clave": h.clave} for h in hits]
        alc, zonas = alcance(n["titulo"], n.get("zona_medio"), bool(hits))
        n["alcance"] = alc
        n["zonas"] = zonas
        # Delegacion solo si la nota ya es de Tijuana: el gazetero de
        # delegaciones trae terminos genericos ('zona centro') que existen en
        # otros municipios y no debe re-zonificar nada.
        n["delegaciones"] = delegaciones_en(n["titulo"]) if "Tijuana" in zonas else []

    # La postura va en lote, no nota por nota: el modelo local rinde por
    # bloques y solo reclasifica lo que no traiga etiqueta vigente.
    #
    # El idioma sale del catalogo, no del texto. Sin este reparto los cuatro
    # medios de San Diego -- 98 de 888 notas -- recibian tono de un modelo
    # entrenado con tuits en espanol.
    idioma_por_fuente = {m["id"]: m.get("idioma", IDIOMA_OMISION)
                         for m in medios_runtime}
    # Las fuentes sinteticas de busqueda no estan en el catalogo, asi que su
    # idioma se recupera de la busqueda que las trajo: eso si vive en
    # config/busquedas.json y la nota lo guarda en 'descubierta_por'. Sin esto
    # falla la corrida SIGUIENTE a la que las descubrio, no la primera: el
    # medio sintetico ya no esta en memoria, el idioma cae a la omision y el
    # modelo espanol etiqueta texto en ingles. Es la falla de los medios de San
    # Diego otra vez, y otra vez del tipo que no truena: un modelo de
    # sentimiento con texto en otro idioma devuelve una etiqueta plausible, no
    # un error.
    #
    # El recorrido va ordenado por id: si dos busquedas de distinto idioma
    # encuentran al mismo publicador, gana siempre la misma y no el orden en
    # que se hayan fusionado.
    idioma_por_busqueda = {b["id"]: b.get("idioma", IDIOMA_OMISION)
                           for b in (busquedas or {}).get("busquedas", [])}
    for n in sorted(fusionadas.values(), key=lambda x: x["id"]):
        if n.get("origen") != "busqueda_web" or n["fuente"] in idioma_por_fuente:
            continue
        idi = idioma_por_busqueda.get(n.get("descubierta_por"))
        if idi:
            idioma_por_fuente[n["fuente"]] = idi

    # Rubros: seccion del medio (la guardada y la de la ruta) mas el titular
    # en su idioma. Se recalculan sobre todo el historico, como la zona, asi
    # que editar un mapa `rutas` o una lista de terminos se propaga sin
    # migracion. Las dos claves van siempre al final de la nota: una nota
    # vieja que vuelve a salir en el feed no cambia de bytes por el orden.
    medio_por_id = {m["id"]: m for m in medios_runtime}
    for n in fusionadas.values():
        categoria = n.pop("rubros_categoria", None)
        n.pop("rubros", None)
        if categoria:
            n["rubros_categoria"] = categoria
        idioma = idioma_de_nota(n, medio_por_id, idioma_por_busqueda)
        n["rubros"] = rubros_de_nota(n, medio_por_id.get(n["fuente"]), idioma)

    clasificar_lote(fusionadas.values(), metodo, analizador,
                    idiomas=idioma_por_fuente)
    if metodo == "ninguno":
        # Nada quedo sin etiqueta POR IDIOMA: quedo sin etiqueta porque el
        # paso esta apagado, que es otra cosa.
        sin_modelo_idioma = 0
    else:
        sin_modelo_idioma = sin_idioma(
            fusionadas.values(),
            getattr(analizador, "idioma", IDIOMA_OMISION),
            idioma_por_fuente)

    # Cuanto de cada busqueda llega de verdad al muro. web/src/lib/muro/
    # indexar.ts descarta las notas con zonas == []; medido sobre la ventana
    # del 7 de septiembre de 2026, los medios de zona 'estatal' se quedan sin
    # zona en 441 de 525 notas, y una fuente sintetica de busqueda es
    # 'estatal' por definicion. Se publica en la banda de salud en vez de
    # dejar que el operador lo deduzca de un archivo que crece.
    notas_bq, sin_zona_bq = {}, {}
    for n in fusionadas.values():
        if n.get("origen") != "busqueda_web":
            continue
        b = n.get("descubierta_por")
        notas_bq[b] = notas_bq.get(b, 0) + 1
        if not n.get("zonas"):
            sin_zona_bq[b] = sin_zona_bq.get(b, 0) + 1

    for s in salud:
        s["nuevas"] = nuevas_por_salud.get(s["id"], 0)
        if s.get("metodo") == "busqueda" and isinstance(s.get("detalle"), dict):
            s["detalle"]["notas"] = notas_bq.get(s["id"], 0)
            s["detalle"]["sin_zona"] = sin_zona_bq.get(s["id"], 0)
        if s["estado"] == "fallo" and s.get("ultima_ok") is None:
            # Arrastrar el ultimo exito: es lo que lee la alarma de feed
            # muerto por 24 h (docs/PLAN.md seccion 8).
            s["ultima_ok"] = (salud_previa.get(s["id"]) or {}).get("ultima_ok")

    # Ventana reciente y archivo mensual. La ventana es lo que se baja el
    # tablero; el archivo es el historico que solo se pide a demanda.
    ventana, por_mes = particionar(fusionadas.values(), hoy, retener_dias)

    # Temas: solo sobre lo que es de la region. Las notas 'fuera' vienen de
    # cables de grupo (El Imparcial trae Hermosillo y Ciudad Obregon) y sin
    # este filtro 'sonora' y 'hermosillo' salen como temas principales de un
    # tablero de Baja California. Paso verificado contra una corrida real.
    #
    # Se calculan con la ventana MAS el mes reciente si hace falta: el momento
    # se mide contra el periodo anterior, asi que necesita el doble del
    # periodo que reporta. El navegador nunca baja ese historico, porque los
    # temas llegan ya calculados.
    base_temas = para_temas(ventana, por_mes, hoy)
    de_region = [n for n in base_temas if n.get("alcance") != "fuera"]
    panel_temas = temas(de_region, ahora[:10], origen="prensa",
                        minimo=MINIMO_TEMAS)

    # Temas POR ZONA, para la pagina de cada zona. Una nota de la garita
    # cuenta en Tijuana y en San Diego, igual que en por_zona. Las zonas sin
    # notas en la ventana no aparecen: clave ausente, no lista vacia.
    panel_temas["por_zona"] = {}
    for zona in ZONAS:
        if zona == "estatal":
            continue
        de_zona = [n for n in de_region if zona in (n.get("zonas") or [])]
        if not de_zona:
            continue
        minimo = (MINIMO_TEMAS if len(de_zona) >= NOTAS_PARA_MINIMO_PLENO
                  else MINIMO_TEMAS_ZONA_CHICA)
        bloque = temas(de_zona, ahora[:10], origen="prensa", minimo=minimo)
        if bloque["notas_ventana"] == 0:
            continue
        panel_temas["por_zona"][zona] = {
            "notas_ventana": bloque["notas_ventana"],
            "minimo": minimo,
            "temas": bloque["temas"],
        }

    commit, corrida = _entorno_ci()
    fuentes_ok = sum(1 for s in salud if s["estado"] == "ok")

    # Los conteos del tablero son de la VENTANA, que es lo que muestra. El
    # total de todo va aparte, en notas_archivadas.
    por_zona, por_alcance = {}, {}
    for n in ventana:
        por_alcance[n["alcance"]] = por_alcance.get(n["alcance"], 0) + 1
        for z in n.get("zonas") or []:
            por_zona[z] = por_zona.get(z, 0) + 1

    # notas.json no lleva marca de tiempo de corrida a proposito: asi solo
    # cambia cuando cambia el contenido, y el guarda `git diff --quiet` sirve.
    _escribir(os.path.join(salida, "notas.json"),
              {"esquema": ESQUEMA, "ventana_dias": retener_dias,
               "total": len(ventana), "notas": ventana})
    indice, _escritos = escribir_archivos(salida, por_mes, _escribir_si_cambio, ESQUEMA)
    _escribir(os.path.join(salida, "fuentes.json"),
              {"esquema": ESQUEMA, "generado": ahora, "fuentes": salud})
    _escribir(os.path.join(salida, "temas.json"), panel_temas)
    estado = {
        "esquema": ESQUEMA,
        "pulso_version": VERSION,
        "generado": ahora,
        "modo": modo,
        "metodo_postura": metodo,
        "commit": commit,
        "corrida": corrida,
        "fuentes_ok": fuentes_ok,
        "fuentes_fallo": len(salud) - fuentes_ok,
        # notas_total es TODO lo que existe; notas_ventana es lo que se
        # muestra y lo que el tablero se baja. El tablero necesita las dos
        # para poder decir "500 de 12,000, ultimos 30 dias".
        "notas_total": len(fusionadas),
        "notas_ventana": len(ventana),
        "notas_archivadas": indice["total"],
        "ventana_dias": retener_dias,
        "archivos": len(indice["meses"]),
        "notas_nuevas": sum(nuevas_por_salud.values()),
        "notas_region": len(de_region),
        # Notas sin postura por no haber modelo de su idioma. Si uno de
        # cada nueve titulares no se puede etiquetar, se dice.
        "notas_sin_modelo_idioma": sin_modelo_idioma,
        "por_zona": dict(sorted(por_zona.items(), key=lambda kv: (-kv[1], kv[0]))),
        "por_alcance": dict(sorted(por_alcance.items(), key=lambda kv: (-kv[1], kv[0]))),
        "roster_figuras": len(roster.figuras),
        "roster_vigentes": len(roster.vigentes(hoy)),
    }
    if discovery_health is not None:
        estado["descubrimiento"] = discovery_health.get("detalle", {}) | {
            "estado": discovery_health.get("estado"),
            "ultima_ok": discovery_health.get("ultima_ok"),
        }
    _escribir(os.path.join(salida, "estado.json"), estado)
    return estado
