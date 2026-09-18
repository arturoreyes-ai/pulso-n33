"""Validacion de config/ y data/. Es el esquema ejecutable.

No hay carpeta esquema/ con JSON Schema por dos razones: la stdlib no trae
validador, asi que serian archivos sin fuerza que se desfasan; y las reglas
que de verdad importan aqui son de campos cruzados -- traslape de ventanas
de vigencia, integridad del hash de identidad, referencias entre archivos --
y JSON Schema no expresa ninguna de las tres.

docs/datos.md documenta los contratos; este archivo manda.

Convencion: cada validar_* devuelve (errores, avisos), ambos listas de texto.
Un error rompe la corrida; un aviso solo se imprime.
"""

import json
import os
import re
from datetime import date, datetime, timedelta

from . import DELEGACIONES_TIJUANA, VERSION, ZONAS
from .clasificar import ETIQUETAS, METODOS
from .normalizar import dominio, fold, id_nota, imagen_del_medio
from .sentimiento import IDIOMA_OMISION, IDIOMAS

RE_ID = re.compile(r"^[a-z0-9_]{2,12}$")
RE_WEB_SOURCE = re.compile(r"^web-[a-f0-9]{12}$")
RE_GN_SOURCE = re.compile(r"^gn-[a-f0-9]{12}$")
# Los ids de busqueda NO comparten RE_ID con medios y roster, por dos razones.
# Doce caracteres alcanzan para 'zeta' o 'soltij', no para nombrar una consulta
# ('bq_sanquintin' son 13), y el id se lee en el 'descubierta_por' de cada nota
# que trajo. Y las dos cosas escriben en el mismo espacio de nombres --
# data/fuentes[].id -- asi que el prefijo hace imposible por construccion que
# una busqueda colisione con un medio.
RE_BUSQUEDA = re.compile(r"^bq_[a-z0-9_]{2,20}$")
VIAS = ("nominal", "cargo")
ALCANCES = ("zona", "estatal", "nacional", "fuera")
ESQUEMA = 1


# ------------------------------------------------------------------ ayudas

def _fecha(s):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _es_iso(s):
    try:
        datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return True
    except (TypeError, ValueError):
        return False


def _texto(v):
    return isinstance(v, str) and bool(v.strip())


def _entero_no_negativo(v):
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def _proporcion(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 1


def _monto(v, permite_nulo=False):
    return ((permite_nulo and v is None) or
            (isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0))


def _cuadra(a, b, tolerancia=0.02):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a - b) <= tolerancia


def _numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _claves_prohibidas(datos, prohibidas, ruta="", encontradas=None):
    """Rutas de todas las claves prohibidas, a cualquier profundidad."""
    encontradas = [] if encontradas is None else encontradas
    if isinstance(datos, dict):
        for k, val in datos.items():
            aqui = "{}.{}".format(ruta, k) if ruta else str(k)
            if k in prohibidas:
                encontradas.append(aqui)
            _claves_prohibidas(val, prohibidas, aqui, encontradas)
    elif isinstance(datos, list):
        for i, val in enumerate(datos):
            _claves_prohibidas(val, prohibidas, "{}[{}]".format(ruta, i), encontradas)
    return encontradas


def _leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


# ----------------------------------------------------------------- roster

def validar_roster(datos, hoy=None):
    hoy = hoy or date.today()
    errores, avisos = [], []

    figuras = datos.get("figuras")
    if not isinstance(figuras, list) or not figuras:
        return ["roster: 'figuras' debe ser una lista no vacia"], avisos
    if not _fecha(datos.get("verificado")):
        avisos.append("roster: falta 'verificado' (fecha de la ultima revision)")

    ids = set()
    cargos = []      # (id, clave_plegada, desde, hasta)
    nominales = {}   # clave_plegada -> id
    ambitos = {}     # ambito -> hay figura vigente hoy

    for i, f in enumerate(figuras):
        fid = f.get("id")
        if not isinstance(fid, str) or not RE_ID.match(fid):
            errores.append(
                "roster[{}]: 'id' invalido ({!r}); se espera ^[a-z0-9_]{{2,12}}$".format(i, fid)
            )
            continue
        et = "roster[{}]".format(fid)
        if fid in ids:
            errores.append("{}: 'id' duplicado".format(et))
        ids.add(fid)

        for campo in ("nombre", "cargo", "partido", "ambito"):
            if not _texto(f.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        if f.get("ambito") is not None and f.get("ambito") not in ZONAS:
            errores.append(
                "{}: 'ambito' desconocido ({!r}); validos: {}".format(
                    et, f.get("ambito"), ", ".join(ZONAS)
                )
            )

        desde = _fecha(f.get("desde"))
        if desde is None:
            errores.append("{}: 'desde' invalido ({!r}); se espera YYYY-MM-DD".format(et, f.get("desde")))
        hasta = None
        if f.get("hasta") is not None:
            hasta = _fecha(f.get("hasta"))
            if hasta is None:
                errores.append(
                    "{}: 'hasta' invalido ({!r}); usa null si sigue en funciones".format(et, f.get("hasta"))
                )
            elif desde is not None and hasta <= desde:
                errores.append(
                    "{}: 'hasta' ({}) debe ser posterior a 'desde' ({})".format(et, f["hasta"], f["desde"])
                )
        if desde is None:
            continue

        for campo in ("alias", "alias_cargo"):
            v = f.get(campo, [])
            if not isinstance(v, list) or any(not _texto(a) for a in v):
                errores.append("{}: '{}' debe ser lista de textos no vacios".format(et, campo))
                f[campo] = []

        # Un nombre propio no puede pertenecer a dos figuras: la fecha no
        # desempata porque el alias nominal no depende de ella.
        for a in [f.get("nombre", "")] + list(f.get("alias") or []):
            k = fold(a)
            if not k:
                continue
            if k in nominales and nominales[k] != fid:
                errores.append(
                    "{}: alias nominal '{}' ya es de '{}'; el nombre propio no se "
                    "desempata por fecha".format(et, k, nominales[k])
                )
            nominales[k] = fid

        for a in (f.get("alias_cargo") or []):
            cargos.append((fid, fold(a), desde, hasta or date.max))

        amb = f.get("ambito")
        vigente = desde <= hoy < (hasta or date.max)
        ambitos[amb] = ambitos.get(amb, False) or vigente

    # La regla Burgueno/Gutierrez: dos figuras no pueden compartir un alias de
    # cargo con ventanas que se traslapen, o el titular es ambiguo.
    for i in range(len(cargos)):
        for j in range(i + 1, len(cargos)):
            a_id, a_k, a_d, a_h = cargos[i]
            b_id, b_k, b_d, b_h = cargos[j]
            if a_id == b_id or a_k != b_k:
                continue
            if a_d < b_h and b_d < a_h:
                errores.append(
                    "roster: '{}' y '{}' comparten el alias de cargo '{}' con "
                    "vigencias traslapadas ([{}, {}) y [{}, {})); la ventana es "
                    "semiabierta, 'hasta' es exclusivo".format(
                        a_id, b_id, a_k, a_d, a_h, b_d, b_h
                    )
                )

    for amb, vigente in sorted(ambitos.items()):
        if not vigente:
            avisos.append(
                "roster: '{}' no tiene figura vigente al {}; el roster puede estar "
                "vencido".format(amb, hoy)
            )
    return errores, avisos


# ----------------------------------------------------------------- medios

RE_HOST = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")

# Las miniaturas se guardan tal como vienen, y el sondeo no vio ninguna de mas
# de 300 caracteres (las de KPBS son las mas largas). El doble es margen, no
# permiso para un cuerpo disfrazado de URL.
IMAGEN_LARGO_MAXIMO = 500

# Desde cuando una nota puede traer 'imagen'. Antes de esta fecha su ausencia
# es la edad del corte, no un extractor roto.
IMAGEN_DESDE = "2026-09-14"

# Cuantas notas recientes de medios con CDN hacen falta antes de concluir que
# el extractor esta roto. Una no es evidencia de nada: el caso que lo motivo
# es que esta funcion corre TAMBIEN sobre cada mes del archivo, y ahi
# 'capturado' es la hora de la cosecha y no la de publicacion, asi que una
# nota publicada en junio y cosechada hoy cae en el archivo de junio con
# fecha de captura reciente. Un solo AFN asi bastaba para acusar al
# extractor, y la corrida offline --el chequeo por omision del repo-- salia
# con el aviso puesto. Es el mismo instinto que la regla 2 del producto:
# bajo cierta muestra no se concluye, se cuenta.
IMAGEN_MINIMO_AVISO = 5


def validar_medios(datos):
    errores, avisos = [], []
    medios = datos.get("medios")
    if not isinstance(medios, list) or not medios:
        return ["medios: 'medios' debe ser una lista no vacia"], avisos

    ids = set()
    for i, m in enumerate(medios):
        mid = m.get("id")
        if not isinstance(mid, str) or not RE_ID.match(mid):
            errores.append("medios[{}]: 'id' invalido ({!r})".format(i, mid))
            continue
        et = "medios[{}]".format(mid)
        if mid in ids:
            errores.append("{}: 'id' duplicado".format(et))
        ids.add(mid)

        if not _texto(m.get("nombre")):
            errores.append("{}: falta 'nombre'".format(et))
        if not (isinstance(m.get("url"), str) and m["url"].startswith(("http://", "https://"))):
            errores.append("{}: 'url' debe empezar con http:// o https://".format(et))
        if m.get("zona") not in ZONAS:
            errores.append("{}: 'zona' desconocida ({!r})".format(et, m.get("zona")))
        if not isinstance(m.get("activo"), bool):
            errores.append("{}: 'activo' debe ser booleano".format(et))
        # El idioma decide con que modelo se etiqueta el tono. Omitirlo
        # significa espanol, que es lo que eran los 16 medios mexicanos antes
        # de que el campo existiera.
        if m.get("idioma", IDIOMA_OMISION) not in IDIOMAS:
            errores.append("{}: 'idioma' debe ser uno de {} ({!r})".format(
                et, ", ".join(IDIOMAS), m.get("idioma")))
        tipo = m.get("tipo", "rss")
        if tipo not in ("rss", "scrapy"):
            errores.append("{}: 'tipo' debe ser 'rss' o 'scrapy' ({!r})".format(et, tipo))
        if tipo == "scrapy":
            cfg = m.get("scrapy")
            if not isinstance(cfg, dict):
                errores.append("{}: tipo 'scrapy' exige objeto 'scrapy'".format(et))
            else:
                for campo in ("item", "titulo", "url"):
                    if not _texto(cfg.get(campo)):
                        errores.append("{}: scrapy.{} debe ser texto no vacio".format(et, campo))
        # Los CDN desde los que el medio sirve sus miniaturas (Photon en los
        # medios de San Diego). Hosts pelados: la regla compara hosts.
        cdn = m.get("imagenes_de")
        if cdn is not None:
            if not isinstance(cdn, list) or not all(
                    isinstance(h, str) and RE_HOST.match(h) for h in cdn):
                errores.append("{}: 'imagenes_de' debe ser una lista de hosts sin esquema ni ruta ({!r})".format(et, cdn))

    if not any(m.get("activo") for m in medios if isinstance(m.get("id"), str)):
        avisos.append("medios: ningun medio activo; la ingesta no traeria nada")

    # Dos medios en el mismo host no se pueden distinguir al resolver el
    # <source> de una busqueda, y todas sus notas de Google caerian en el que
    # aparezca primero en el archivo. Aviso y no error: un grupo puede servir
    # legitimamente dos feeds desde un solo host.
    por_dominio = {}
    for m in medios:
        dom = _dominio_de(m.get("url"))
        if not dom or not isinstance(m.get("id"), str):
            continue
        if dom in por_dominio:
            avisos.append(
                "medios: '{}' y '{}' comparten el dominio '{}'; una busqueda no "
                "puede distinguirlos y les atribuiria las notas al primero".format(
                    por_dominio[dom], m["id"], dom))
        else:
            por_dominio[dom] = m["id"]
    return errores, avisos


# -------------------------------------------------------------- busquedas

# Las llena pulso/busquedas.py, en este orden. Se declaran aqui tambien para
# que el validador revise exactamente la misma lista.
CLAVES_DETALLE_BUSQUEDA = (
    "items", "sin_publicador", "sin_fecha", "fuera_de_ventana", "sin_sufijo",
    "resueltas", "sinteticas", "recortadas", "notas", "sin_zona",
)

RE_VENTANA = re.compile(r"^when:\d+[hdmy]$")


def _dominio_de(url):
    if not isinstance(url, str):
        return ""
    resto = url.split("://", 1)[-1].split("/", 1)[0].split("@")[-1].split(":")[0].lower()
    return resto[4:] if resto.startswith("www.") else resto


def validar_busquedas(datos, medios=None):
    """config/busquedas.json. Ausente no es error; vacio o mal formado si."""
    errores, avisos = [], []
    busquedas = datos.get("busquedas")
    if not isinstance(busquedas, list):
        return ["busquedas: 'busquedas' debe ser una lista"], avisos

    ids_medios = {m["id"] for m in (medios or []) if isinstance(m.get("id"), str)}
    ids = set()
    for i, b in enumerate(busquedas):
        bid = b.get("id")
        if not isinstance(bid, str) or not RE_BUSQUEDA.match(bid):
            errores.append("busquedas[{}]: 'id' invalido ({!r}); se espera "
                           "^bq_[a-z0-9_]{{2,20}}$".format(i, bid))
            continue
        et = "busquedas[{}]".format(bid)
        if bid in ids:
            errores.append("{}: 'id' duplicado".format(et))
        ids.add(bid)
        if bid in ids_medios:
            # Medios y busquedas escriben en data/fuentes[].id: un id repetido
            # haria que una pisara el registro de salud de la otra.
            errores.append("{}: 'id' choca con un medio del catalogo".format(et))

        for campo in ("nombre", "q", "nota"):
            if not _texto(b.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        if b.get("idioma", IDIOMA_OMISION) not in IDIOMAS:
            errores.append("{}: 'idioma' debe ser uno de {} ({!r})".format(
                et, ", ".join(IDIOMAS), b.get("idioma")))
        if not isinstance(b.get("activo"), bool):
            errores.append("{}: 'activo' debe ser booleano".format(et))
        if "zona" in b:
            # Ver la nota de config/busquedas.json: una zona declarada que
            # llegue a 'zona_medio' le acredita esa zona a todo titular que no
            # nombre ningun lugar.
            errores.append("{}: una busqueda no lleva 'zona'; sus notas son "
                           "'estatal' y la zona sale del titular".format(et))
        if _texto(b.get("q")) and "when:" in b["q"]:
            errores.append("{}: 'when:' no va en 'q'; la ventana la pone "
                           "pulso/busquedas.py desde la cadencia del cron".format(et))
        if b.get("ventana") is not None and not (
                isinstance(b["ventana"], str) and RE_VENTANA.match(b["ventana"])):
            errores.append("{}: 'ventana' invalida ({!r}); se espera when:<n><h|d|m|y>"
                           .format(et, b.get("ventana")))

    publicadores = datos.get("publicadores")
    if publicadores is None:
        avisos.append(
            "busquedas: sin 'publicadores'; Google rotula a los diarios de grupo con "
            "el dominio del grupo y sus notas saldrian duplicadas como fuente sintetica")
    elif not isinstance(publicadores, dict):
        errores.append("busquedas: 'publicadores' debe ser un objeto")
    else:
        for clave, mid in sorted(publicadores.items()):
            if ids_medios and mid not in ids_medios:
                errores.append("busquedas.publicadores[{!r}]: {!r} no es un medio "
                               "del catalogo".format(clave, mid))

    if not _texto(datos.get("nota")):
        avisos.append("busquedas: falta 'nota' con el contrato del archivo")
    if not any(b.get("activo") for b in busquedas if isinstance(b.get("id"), str)):
        avisos.append("busquedas: ninguna busqueda activa; no se cosecharia nada")
    return errores, avisos


# ------------------------------------------------------------------ notas

def validar_notas(datos, roster=None, medios=None, busquedas=None):
    errores, avisos = [], []
    if datos.get("esquema") != ESQUEMA:
        errores.append("notas: 'esquema' debe ser {}".format(ESQUEMA))
    notas = datos.get("notas")
    if not isinstance(notas, list):
        return errores + ["notas: 'notas' debe ser una lista"], avisos
    if datos.get("total") != len(notas):
        errores.append(
            "notas: 'total' ({!r}) no coincide con {} notas".format(datos.get("total"), len(notas))
        )

    ids_medios = {m["id"] for m in (medios or []) if isinstance(m.get("id"), str)}
    medios_por_id = {m["id"]: m for m in (medios or []) if isinstance(m.get("id"), str)}
    con_imagen = 0
    zonas_medios = {m["id"]: m.get("zona") for m in (medios or [])}
    ids_busquedas = {b["id"] for b in (busquedas or []) if isinstance(b.get("id"), str)}
    ids_roster = {f["id"] for f in (roster.figuras if roster else [])}

    vistos = set()
    por_url = {}
    sin_delegaciones = 0
    for i, n in enumerate(notas):
        et = "notas[{}]".format(n.get("id", i))
        nid, fuente, titulo = n.get("id"), n.get("fuente"), n.get("titulo")

        # Dos notas con la misma URL y distinto id significan que el titular
        # con el que se calculo la identidad cambio.
        #
        # Es AVISO y no error porque pasa de forma legitima: en modo corpus
        # las notas heredan la URL del feed, y un medio puede republicar con
        # el titular editado. Importa vigilarlo por la extraccion de paginas
        # de listado, donde una tarjeta puede exponer el titular o la
        # entradilla segun su plantilla; tomar el texto equivocado readmite la
        # misma nota como nueva y ahi si es un defecto.
        if isinstance(n.get("url"), str) and n["url"] and _texto(nid):
            otro = por_url.get(n["url"])
            if otro is not None and otro != nid:
                avisos.append(
                    "{}: la URL ya esta con otro id ({}); el titular con el que "
                    "se calculo la identidad cambio".format(et, otro))
            por_url[n["url"]] = nid

        if not _texto(titulo):
            errores.append("{}: falta 'titulo'".format(et))
        if not (isinstance(n.get("url"), str) and n["url"].startswith(("http://", "https://"))):
            errores.append("{}: 'url' debe empezar con http:// o https://".format(et))
        if not _texto(nid):
            errores.append("{}: falta 'id'".format(et))
        else:
            if nid in vistos:
                errores.append("{}: 'id' duplicado".format(et))
            vistos.add(nid)
            # Recalcular el hash detecta ediciones a mano y cambios de la
            # funcion de identidad.
            if _texto(fuente) and _texto(titulo):
                esperado = id_nota(fuente, titulo)
                if nid != esperado:
                    errores.append(
                        "{}: 'id' no corresponde al hash de (fuente, titulo); "
                        "esperado {}".format(et, esperado)
                    )
        es_descubrimiento = n.get("origen") == "descubrimiento_web"
        es_busqueda = n.get("origen") == "busqueda_web"
        fuente_web = isinstance(fuente, str) and bool(RE_WEB_SOURCE.match(fuente))
        fuente_gn = isinstance(fuente, str) and bool(RE_GN_SOURCE.match(fuente))
        conocida = isinstance(fuente, str) and fuente in ids_medios
        if es_busqueda:
            # Una nota de busqueda puede venir de un medio del catalogo --
            # Google la encontro antes que su propio feed -- o de un publicador
            # que no esta. El primer caso tiene que respetar el catalogo
            # ENTERO, zona incluida; el segundo es el unico que puede traer una
            # fuente sintetica. Por eso la zona se revisa en las dos ramas y no
            # se cae por la de abajo.
            if ids_medios and not (conocida or fuente_gn):
                errores.append("{}: fuente de busqueda debe ser un medio del "
                               "catalogo o gn-<hash> ({!r})".format(et, fuente))
            bid = n.get("descubierta_por")
            if not (isinstance(bid, str) and RE_BUSQUEDA.match(bid)):
                errores.append("{}: 'descubierta_por' debe ser el id de una "
                               "busqueda ({!r})".format(et, bid))
            elif ids_busquedas and bid not in ids_busquedas:
                # Borrar un renglon de config/busquedas.json invalida el
                # historico que trajo y ademas le quita el idioma a sus fuentes
                # sinteticas. Se apaga con 'activo': false, no se borra.
                errores.append("{}: 'descubierta_por' ({!r}) no esta en "
                               "config/busquedas.json".format(et, bid))
            if not conocida:
                if n.get("zona_medio") != "estatal":
                    errores.append("{}: busqueda sin medio del catalogo debe "
                                   "tener zona_medio 'estatal'".format(et))
            elif zonas_medios and n.get("zona_medio") != zonas_medios.get(fuente):
                errores.append(
                    "{}: 'zona_medio' ({!r}) no coincide con la del medio ({!r})".format(
                        et, n.get("zona_medio"), zonas_medios.get(fuente)
                    )
                )
        elif ids_medios and fuente not in ids_medios and not (es_descubrimiento and fuente_web):
            errores.append("{}: 'fuente' ({!r}) no esta en config/medios.json".format(et, fuente))
        elif es_descubrimiento:
            if not fuente_web:
                errores.append("{}: fuente de descubrimiento debe ser web-<hash>".format(et))
            if n.get("descubierta_por") != "gdelt":
                errores.append("{}: 'descubierta_por' debe ser 'gdelt'".format(et))
            if n.get("zona_medio") != "estatal":
                errores.append("{}: descubrimiento debe tener zona_medio 'estatal'".format(et))
        elif zonas_medios and n.get("zona_medio") != zonas_medios.get(fuente):
            errores.append(
                "{}: 'zona_medio' ({!r}) no coincide con la del medio ({!r})".format(
                    et, n.get("zona_medio"), zonas_medios.get(fuente)
                )
            )

        if n.get("alcance") not in ALCANCES:
            errores.append("{}: 'alcance' invalido ({!r})".format(et, n.get("alcance")))
        zonas = n.get("zonas")
        if not isinstance(zonas, list):
            errores.append("{}: 'zonas' debe ser una lista".format(et))
        else:
            for z in zonas:
                if z not in ZONAS:
                    errores.append("{}: zona desconocida ({!r})".format(et, z))
            # Coherencia entre alcance y zonas: 'fuera' y 'nacional' no
            # asignan zona, 'zona' y 'estatal' siempre asignan al menos una.
            if n.get("alcance") in ("fuera", "nacional") and zonas:
                errores.append(
                    "{}: alcance {!r} no deberia traer zonas ({})".format(
                        et, n.get("alcance"), ", ".join(zonas))
                )
            if n.get("alcance") in ("zona", "estatal") and not zonas:
                errores.append("{}: alcance {!r} exige al menos una zona".format(et, n.get("alcance")))

        # Delegaciones: solo Tijuana las tiene y solo el titular las da. La
        # clave ausente es AVISO y no error porque el campo llego despues del
        # primer corte publicado y el bot lo rellena en su siguiente corrida.
        dele = n.get("delegaciones")
        if dele is None:
            sin_delegaciones += 1
        elif not isinstance(dele, list):
            errores.append("{}: 'delegaciones' debe ser una lista".format(et))
        else:
            for d in dele:
                if d not in DELEGACIONES_TIJUANA:
                    errores.append("{}: delegacion desconocida ({!r})".format(et, d))
            if len(set(dele)) != len(dele):
                errores.append("{}: 'delegaciones' repetida".format(et))
            if dele and not (isinstance(zonas, list) and "Tijuana" in zonas):
                errores.append("{}: 'delegaciones' exige 'Tijuana' en zonas".format(et))
        if n.get("fecha") is not None and _fecha(n.get("fecha")) is None:
            errores.append("{}: 'fecha' invalida ({!r})".format(et, n.get("fecha")))
        for campo in ("publicado", "capturado"):
            if n.get(campo) is not None and not _es_iso(n.get(campo)):
                errores.append("{}: '{}' no es ISO-8601 ({!r})".format(et, campo, n.get(campo)))
        if not _texto(n.get("dominio")):
            errores.append("{}: falta 'dominio'".format(et))

        # La miniatura es opcional y condicional: ausente es "el medio no la
        # publica". Presente, tiene que ser https, del propio medio y de una
        # nota que llego por el feed del medio: el RSS de Google no trae
        # imagen, y GDELT tampoco, asi que una imagen ahi es un error de
        # ingesta, no un dato.
        img = n.get("imagen")
        if img is not None:
            medio_n = medios_por_id.get(fuente) if isinstance(fuente, str) else None
            if not (isinstance(img, str) and img.startswith("https://")
                    and len(img) <= IMAGEN_LARGO_MAXIMO and not any(c.isspace() for c in img)):
                errores.append("{}: 'imagen' debe ser una URL https sin espacios de hasta {} caracteres".format(
                    et, IMAGEN_LARGO_MAXIMO))
            elif n.get("origen"):
                errores.append("{}: 'imagen' solo viene del feed del propio medio; una nota de {} no la tiene".format(
                    et, n["origen"]))
            elif medio_n is not None and not imagen_del_medio(img, medio_n):
                errores.append("{}: 'imagen' no es del medio ({})".format(et, dominio(img)))
            else:
                con_imagen += 1

        figuras = n.get("figuras")
        if not isinstance(figuras, list):
            errores.append("{}: 'figuras' debe ser una lista".format(et))
        else:
            for h in figuras:
                if ids_roster and h.get("id") not in ids_roster:
                    errores.append(
                        "{}: figura {!r} no esta en config/roster.json".format(et, h.get("id"))
                    )
                if h.get("via") not in VIAS:
                    errores.append("{}: 'via' invalida ({!r})".format(et, h.get("via")))
                if not _texto(h.get("clave")):
                    errores.append("{}: figura sin 'clave'".format(et))

        p = n.get("postura")
        if p is not None:
            if not isinstance(p, dict):
                errores.append("{}: 'postura' debe ser null u objeto".format(et))
            else:
                if p.get("etiqueta") not in ETIQUETAS:
                    errores.append("{}: postura.etiqueta invalida ({!r})".format(et, p.get("etiqueta")))
                metodo_p = p.get("metodo")
                if metodo_p not in METODOS or metodo_p == "ninguno":
                    errores.append("{}: postura.metodo invalido ({!r})".format(et, metodo_p))
                elif metodo_p == "modelo":
                    # El modelo da una probabilidad, no un puntaje entero, y
                    # tiene que decir que modelo fue: sin eso no se puede
                    # saber si la etiqueta sigue vigente.
                    if not _proporcion(p.get("confianza")):
                        errores.append("{}: postura.confianza debe ser un numero entre 0 y 1".format(et))
                    if not _texto(p.get("modelo")):
                        errores.append("{}: postura.modelo faltante".format(et))
                elif not isinstance(p.get("puntaje"), int):
                    errores.append("{}: postura.puntaje debe ser entero".format(et))
                if not _texto(p.get("version")):
                    errores.append("{}: postura.version faltante".format(et))
    if sin_delegaciones:
        avisos.append(
            "notas: {} sin 'delegaciones'; corte anterior al campo, se llena en la "
            "proxima corrida".format(sin_delegaciones)
        )
    # Un extractor roto no da error: da cero imagenes con la misma cara que un
    # feed sin imagenes. Si algun medio activo declara un CDN es que se espera
    # alguna; cero entonces merece una linea. Solo si hay notas de esos medios
    # capturadas desde que el campo existe: los meses del archivo anteriores
    # al 14 de septiembre de 2026 no traen imagen y no es un fallo.
    con_cdn = {m["id"] for m in (medios or [])
               if m.get("imagenes_de") and m.get("activo", True) and isinstance(m.get("id"), str)}
    recientes = sum(1 for n in notas if isinstance(n, dict)
                    and n.get("fuente") in con_cdn
                    and str(n.get("capturado") or "") >= IMAGEN_DESDE)
    if recientes >= IMAGEN_MINIMO_AVISO and con_imagen == 0:
        avisos.append("notas: ninguna trae 'imagen' aunque hay medios con 'imagenes_de'; "
                      "revisa el extractor o los feeds")
    return errores, avisos


# ---------------------------------------------------------------- archivo

def validar_archivo(dir_datos, ventana, roster=None, medios=None, hoy=None,
                    busquedas=None):
    """Coherencia entre la ventana, los meses archivados y el indice.

    Tres formas de perder datos que estas reglas atrapan: una nota que queda
    en los dos lados y se cuenta doble, un mes en el indice que no esta en el
    disco (o al reves), y una nota vieja que se queda en la ventana y la
    infla sin limite, que es justo el problema que el archivo resuelve.
    """
    from .archivo import (
        GRACIA_DIAS,
        edad_de,
        meses_en_disco,
        ruta_indice,
        ruta_mes,
    )

    errores, avisos = [], []
    hoy = hoy or date.today()
    ventana_dias = ventana.get("ventana_dias")

    en_disco = meses_en_disco(dir_datos)
    ruta_i = ruta_indice(dir_datos)

    if not en_disco and not os.path.exists(ruta_i):
        return errores, avisos                 # sin archivo todavia, es valido

    if not os.path.exists(ruta_i):
        return ["archivo: hay {} meses en disco pero falta {}".format(
            len(en_disco), ruta_i)], avisos
    try:
        indice = _leer(ruta_i)
    except (ValueError, OSError) as e:
        return ["archivo: no se pudo leer {} ({})".format(ruta_i, e)], avisos

    meses_indice = [m.get("mes") for m in (indice.get("meses") or [])]
    faltan_disco = set(meses_indice) - set(en_disco)
    faltan_indice = set(en_disco) - set(meses_indice)
    if faltan_disco:
        errores.append("archivo: el indice lista meses que no estan en disco: {}".format(
            ", ".join(sorted(faltan_disco))))
    if faltan_indice:
        errores.append("archivo: hay meses en disco que el indice no lista: {}".format(
            ", ".join(sorted(faltan_indice))))

    # Los ids no se pueden repetir entre la ventana y el archivo.
    vistos = {}
    for n in ventana.get("notas") or []:
        if n.get("id"):
            vistos[n["id"]] = "ventana"

    total_indice = 0
    for mes in en_disco:
        ruta = ruta_mes(dir_datos, mes)
        try:
            datos = _leer(ruta)
        except (ValueError, OSError) as e:
            errores.append("archivo[{}]: no se pudo leer ({})".format(mes, e))
            continue

        e_notas, a_notas = validar_notas(datos, roster, medios)
        errores += ["archivo[{}] {}".format(mes, x) for x in e_notas]
        avisos += a_notas

        if datos.get("mes") != mes:
            errores.append("archivo[{}]: el campo 'mes' dice {!r}".format(mes, datos.get("mes")))

        cuenta = 0
        for n in datos.get("notas") or []:
            cuenta += 1
            nid = n.get("id")
            if nid in vistos:
                errores.append("archivo[{}]: la nota {} tambien esta en {}".format(
                    mes, nid, vistos[nid]))
            elif nid:
                vistos[nid] = "archivo[{}]".format(mes)
            # Las notas sin 'fecha' envejecen por 'capturado', asi que el mes
            # se compara contra la misma funcion que las reparte.
            f = edad_de(n)
            if f is None:
                errores.append("archivo[{}]: la nota {} no tiene ni 'fecha' ni "
                               "'capturado' usables, asi que no se puede fechar".format(mes, nid))
            elif f.strftime("%Y-%m") != mes:
                errores.append("archivo[{}]: la nota {} es de {}".format(
                    mes, nid, f.strftime("%Y-%m")))
        total_indice += cuenta

        del_indice = next((m for m in (indice.get("meses") or []) if m.get("mes") == mes), None)
        if del_indice and del_indice.get("notas") != cuenta:
            errores.append("archivo[{}]: el indice dice {} notas y el archivo trae {}".format(
                mes, del_indice.get("notas"), cuenta))

    if indice.get("total") != total_indice:
        errores.append("archivo: 'total' del indice ({!r}) no suma los {} de los meses".format(
            indice.get("total"), total_indice))

    # Nada mas viejo que la retencion deberia quedar en la ventana.
    if isinstance(ventana_dias, int) and ventana_dias > 0:
        limite = hoy - timedelta(days=ventana_dias + GRACIA_DIAS)
        viejas = [n.get("id") for n in (ventana.get("notas") or [])
                  if (edad_de(n) or hoy) < limite]
        if viejas:
            errores.append(
                "ventana: {} nota(s) mas viejas que {} dias siguen en la ventana "
                "(por ejemplo {}); deberian estar archivadas".format(
                    len(viejas), ventana_dias, viejas[0]))
    return errores, avisos


# ---------------------------------------------------------------- fuentes

def validar_fuentes(datos, medios=None, busquedas=None):
    errores, avisos = [], []
    if datos.get("esquema") != ESQUEMA:
        errores.append("fuentes: 'esquema' debe ser {}".format(ESQUEMA))
    if not _es_iso(datos.get("generado")):
        errores.append("fuentes: 'generado' no es ISO-8601 ({!r})".format(datos.get("generado")))

    fuentes = datos.get("fuentes")
    if not isinstance(fuentes, list):
        return errores + ["fuentes: 'fuentes' debe ser una lista"], avisos

    vistos = set()
    for i, s in enumerate(fuentes):
        et = "fuentes[{}]".format(s.get("id", i))
        if not _texto(s.get("id")):
            errores.append("{}: falta 'id'".format(et))
        else:
            if s["id"] in vistos:
                errores.append("{}: 'id' duplicado".format(et))
            vistos.add(s["id"])
        if s.get("estado") not in ("ok", "fallo"):
            errores.append("{}: 'estado' debe ser 'ok' o 'fallo' ({!r})".format(et, s.get("estado")))
        if s.get("estado") == "fallo" and not _texto(s.get("error")):
            errores.append("{}: estado 'fallo' exige 'error' con el motivo".format(et))
        if s.get("estado") == "ok" and s.get("error") is not None:
            errores.append("{}: estado 'ok' no debe traer 'error'".format(et))
        if s.get("metodo", "rss") not in ("rss", "scrapy", "descubrimiento", "busqueda"):
            errores.append("{}: 'metodo' debe ser 'rss', 'scrapy', 'descubrimiento' "
                           "o 'busqueda'".format(et))
        if s.get("metodo") == "busqueda":
            detalle = s.get("detalle")
            if detalle is not None and (not isinstance(detalle, dict)
                                         or any(not _entero_no_negativo(detalle.get(k, 0))
                                                for k in CLAVES_DETALLE_BUSQUEDA)):
                errores.append("{}: 'detalle' de busqueda tiene conteos invalidos".format(et))
        if s.get("metodo") == "descubrimiento":
            detalle = s.get("detalle")
            if detalle is not None and (not isinstance(detalle, dict)
                                         or any(not _entero_no_negativo(detalle.get(k, 0))
                                                for k in ("candidatos", "publisher_pages", "aceptadas",
                                                          "rechazadas", "robots_exclusiones", "fallos"))):
                errores.append("{}: 'detalle' de descubrimiento tiene conteos invalidos".format(et))
        if s.get("zona") is not None and s.get("zona") not in ZONAS:
            errores.append("{}: 'zona' desconocida ({!r})".format(et, s.get("zona")))
        for campo in ("obtenidas", "nuevas", "ms"):
            if not isinstance(s.get(campo), int) or s[campo] < 0:
                errores.append("{}: '{}' debe ser entero no negativo".format(et, campo))
        if s.get("ultima_ok") is not None and not _es_iso(s.get("ultima_ok")):
            errores.append("{}: 'ultima_ok' no es ISO-8601 ({!r})".format(et, s.get("ultima_ok")))

    # Toda fuente encendida tiene que dejar rastro, sea medio o busqueda. Una
    # busqueda que se saltara en silencio -- por una excepcion tragada, por
    # ejemplo -- no aparecería en ningun lado sin esta regla.
    activos = {m["id"] for m in (medios or []) if m.get("activo")}
    activos |= {b["id"] for b in (busquedas or [])
                if isinstance(b.get("id"), str) and b.get("activo", True)}
    faltan = activos - vistos
    if faltan:
        errores.append(
            "fuentes: falta el registro de salud de: {}".format(", ".join(sorted(faltan)))
        )
    return errores, avisos


# ------------------------------------------------------------------ temas

ORIGENES_TEMAS = ("prensa", "comentarios")
ZONAS_DE_CONTEO = tuple(ZONAS) + ("nacional",)


def _validar_lista_temas(temas, minimo, et, errores, con_notas=True):
    if not isinstance(temas, list):
        errores.append("{}: 'temas' debe ser una lista".format(et))
        return
    vistos = set()
    for i, t in enumerate(temas):
        ett = "{}.temas[{}]".format(et, t.get("termino", i) if isinstance(t, dict) else i)
        if not isinstance(t, dict):
            errores.append("{}: debe ser objeto".format(ett))
            continue
        if not _texto(t.get("termino")):
            errores.append("{}: falta 'termino'".format(ett))
        elif t["termino"] in vistos:
            errores.append("{}: 'termino' duplicado".format(ett))
        else:
            vistos.add(t["termino"])
        if not _entero_no_negativo(t.get("n")) or (isinstance(minimo, int) and t.get("n", 0) < minimo):
            errores.append("{}: 'n' debe ser entero y no menor que el minimo {}".format(ett, minimo))
        for campo in ("n_previo", "momento"):
            if not isinstance(t.get(campo), int) or isinstance(t.get(campo), bool):
                errores.append("{}: '{}' debe ser entero".format(ett, campo))
        zonas = t.get("zonas")
        if not isinstance(zonas, dict) or not all(
            z in ZONAS_DE_CONTEO and _entero_no_negativo(n) for z, n in zonas.items()
        ):
            errores.append("{}: 'zonas' debe ser {{zona: conteo}} con zonas conocidas".format(ett))
        if not isinstance(t.get("fuentes"), dict):
            errores.append("{}: 'fuentes' debe ser {{fuente: conteo}}".format(ett))
        if not isinstance(t.get("un_solo_medio"), bool):
            errores.append("{}: 'un_solo_medio' debe ser booleano".format(ett))
        if con_notas:
            if not isinstance(t.get("notas"), list) or not all(_texto(x) for x in t["notas"]):
                errores.append("{}: 'notas' debe ser lista de ids".format(ett))
            if not isinstance(t.get("ejemplos"), list) or not all(_texto(x) for x in t["ejemplos"]):
                errores.append("{}: 'ejemplos' debe ser lista de titulares".format(ett))


def validar_temas(datos):
    """temas.json: los temas de prensa, globales y por zona."""
    errores, avisos = [], []
    if datos.get("origen") not in ORIGENES_TEMAS:
        errores.append("temas: 'origen' invalido ({!r})".format(datos.get("origen")))
    if _fecha(datos.get("generado")) is None:
        errores.append("temas: 'generado' debe ser fecha YYYY-MM-DD ({!r})".format(datos.get("generado")))
    for campo in ("ventana_dias", "minimo"):
        if not isinstance(datos.get(campo), int) or datos.get(campo, 0) < 1:
            errores.append("temas: '{}' debe ser entero positivo".format(campo))
    for campo in ("notas_ventana", "notas_previas"):
        if not _entero_no_negativo(datos.get(campo)):
            errores.append("temas: '{}' debe ser entero no negativo".format(campo))
    con_notas = datos.get("origen") == "prensa"
    _validar_lista_temas(datos.get("temas"), datos.get("minimo"), "temas", errores, con_notas)

    por_zona = datos.get("por_zona")
    if por_zona is not None:
        if not isinstance(por_zona, dict):
            errores.append("temas: 'por_zona' debe ser objeto")
        else:
            for zona, bloque in por_zona.items():
                et = "temas.por_zona[{}]".format(zona)
                if zona not in ZONAS or zona == "estatal":
                    errores.append("{}: zona desconocida".format(et))
                if not isinstance(bloque, dict):
                    errores.append("{}: debe ser objeto".format(et))
                    continue
                if not isinstance(bloque.get("notas_ventana"), int) or bloque.get("notas_ventana", 0) < 1:
                    errores.append("{}: 'notas_ventana' debe ser entero positivo (sin notas, la zona no aparece)".format(et))
                if not isinstance(bloque.get("minimo"), int) or bloque.get("minimo", 0) < 1:
                    errores.append("{}: 'minimo' debe ser entero positivo".format(et))
                _validar_lista_temas(bloque.get("temas"), bloque.get("minimo"), et, errores, con_notas)
    return errores, avisos


# ----------------------------------------------------------- conversacion

METODOS_SENTIMIENTO = ("ninguno", "modelo")
SENTIMIENTOS = ("positivo", "negativo", "neutral")
# Nada de esto puede entrar a data/: es texto literal o identidad
# (Politicas para Desarrolladores de YouTube III.E.4.d).
CLAVES_PROHIBIDAS_CONVERSACION = frozenset(
    {"texto", "ejemplos", "notas", "autor", "author", "video_titulo"}
)

# Ademas de las de arriba, para data/redes.json. Son los campos de identidad
# que devuelve el actor de Instagram: en ese modulo se tiran al INGERIR, asi
# que si alguno aparece en data/ el filtro se rompio antes del cache y no
# despues. Ver pulso/instagram.py::_limpiar.
CLAVES_PROHIBIDAS_REDES = frozenset(
    {"ownerUsername", "ownerProfilePicUrl", "ownerId", "owner", "username",
     "handle", "post", "postUrl", "comentario"}
)


def _validar_conteo_sentimiento(s, et, errores):
    if not isinstance(s, dict):
        errores.append("{}: 'sentimiento' debe ser objeto".format(et))
        return
    for campo in SENTIMIENTOS:
        if not _entero_no_negativo(s.get(campo)):
            errores.append("{}: sentimiento.{} debe ser entero no negativo".format(et, campo))


def validar_conversacion(datos):
    """conversacion.json: solo metricas derivadas, nunca texto ni identidad."""
    errores, avisos = [], []
    if datos.get("esquema") != ESQUEMA:
        errores.append("conversacion: 'esquema' debe ser {}".format(ESQUEMA))
    if not _es_iso(datos.get("generado")):
        errores.append("conversacion: 'generado' no es ISO-8601 ({!r})".format(datos.get("generado")))
    if datos.get("retencion_dias") != 30:
        errores.append("conversacion: 'retencion_dias' debe ser 30 (III.E.4.d)")
    if not _entero_no_negativo(datos.get("comentarios_vigentes")):
        errores.append("conversacion: 'comentarios_vigentes' debe ser entero no negativo")

    for ruta in _claves_prohibidas(datos, CLAVES_PROHIBIDAS_CONVERSACION):
        errores.append("conversacion: clave prohibida (texto literal o identidad): {}".format(ruta))

    for campo in ("por_zona", "por_canal", "por_figura"):
        mapa = datos.get(campo)
        if not isinstance(mapa, dict) or not all(_entero_no_negativo(n) for n in mapa.values()):
            errores.append("conversacion: '{}' debe ser {{clave: conteo}}".format(campo))
    if isinstance(datos.get("por_zona"), dict):
        for z in datos["por_zona"]:
            if z not in ZONAS_DE_CONTEO:
                errores.append("conversacion: por_zona con zona desconocida ({!r})".format(z))

    if not isinstance(datos.get("temas"), list):
        errores.append("conversacion: 'temas' debe ser una lista")
    if not isinstance(datos.get("por_tema"), list):
        errores.append("conversacion: 'por_tema' debe ser una lista")
    else:
        for t in datos["por_tema"]:
            et = "conversacion.por_tema[{}]".format(t.get("tema") if isinstance(t, dict) else "?")
            if not isinstance(t, dict) or not _texto(t.get("tema")):
                errores.append("{}: falta 'tema'".format(et))
                continue
            for campo in ("comentarios", "videos", "interacciones", "preguntas"):
                if not _entero_no_negativo(t.get(campo)):
                    errores.append("{}: '{}' debe ser entero no negativo".format(et, campo))
            if "sentimiento" in t:
                _validar_conteo_sentimiento(t["sentimiento"], et, errores)

    sentimiento = datos.get("sentimiento")
    if sentimiento is not None:
        et = "conversacion.sentimiento"
        if not isinstance(sentimiento, dict):
            errores.append("{}: debe ser objeto".format(et))
        else:
            if sentimiento.get("metodo") not in METODOS_SENTIMIENTO:
                errores.append("{}: 'metodo' invalido ({!r})".format(et, sentimiento.get("metodo")))
            if sentimiento.get("metodo") == "modelo" and not _texto(sentimiento.get("modelo")):
                errores.append("{}: 'modelo' faltante".format(et))
            _validar_conteo_sentimiento(sentimiento, et, errores)
            if not _entero_no_negativo(sentimiento.get("sin_clasificar")):
                errores.append("{}: 'sin_clasificar' debe ser entero no negativo".format(et))
            elif all(_entero_no_negativo(sentimiento.get(c)) for c in SENTIMIENTOS)                     and _entero_no_negativo(datos.get("comentarios_vigentes")):
                suma = sum(sentimiento[c] for c in SENTIMIENTOS) + sentimiento["sin_clasificar"]
                if suma != datos["comentarios_vigentes"]:
                    errores.append(
                        "{}: los conteos suman {} y hay {} comentarios vigentes".format(
                            et, suma, datos["comentarios_vigentes"]))

    detalle = datos.get("por_zona_detalle")
    if detalle is not None:
        if not isinstance(detalle, dict):
            errores.append("conversacion: 'por_zona_detalle' debe ser objeto")
        else:
            for zona, d in detalle.items():
                et = "conversacion.por_zona_detalle[{}]".format(zona)
                if zona not in ZONAS_DE_CONTEO:
                    errores.append("{}: zona desconocida".format(et))
                if not isinstance(d, dict):
                    errores.append("{}: debe ser objeto".format(et))
                    continue
                for campo in ("comentarios", "interacciones", "preguntas"):
                    if not _entero_no_negativo(d.get(campo)):
                        errores.append("{}: '{}' debe ser entero no negativo".format(et, campo))
                _validar_conteo_sentimiento(d.get("sentimiento"), et, errores)
                if not isinstance(d.get("por_tema"), list):
                    errores.append("{}: 'por_tema' debe ser lista".format(et))
                else:
                    for t in d["por_tema"]:
                        if not isinstance(t, dict) or not _texto(t.get("tema"))                                 or not _entero_no_negativo(t.get("comentarios")):
                            errores.append("{}: por_tema con forma invalida".format(et))
                            continue
                        _validar_conteo_sentimiento(t.get("sentimiento"), et + ".por_tema", errores)
                if isinstance(datos.get("por_zona"), dict) and isinstance(d.get("comentarios"), int)                         and datos["por_zona"].get(zona) != d["comentarios"]:
                    errores.append("{}: 'comentarios' ({}) no coincide con por_zona ({})".format(
                        et, d["comentarios"], datos["por_zona"].get(zona)))
    return errores, avisos


# ----------------------------------------------------------- indicadores

FAMILIAS = ("vivienda", "suelo", "crimen", "percepcion", "renta")


def _validar_serie(serie, clave_orden, campos, esperados, et, errores, avisos):
    """Una serie historica: lista de puntos, en orden y sin huecos de campo.

    El orden importa mas de lo que parece. La serie se escribe en cada
    corrida del cron y el guarda es `git diff --cached --quiet`: si el orden
    variara entre corridas, cada corrida ensuciaria el diff con los mismos
    datos reacomodados.

    Que falte es aviso y no error: los cortes escritos antes de que existiera
    el campo no la traen y se llena en la proxima corrida de indicadores.
    Que este pero mal formada si es error.
    """
    if serie is None:
        avisos.append("{}: sin 'serie'; corte anterior al campo, se llena con "
                      "`python -m pulso indicadores --forzar`".format(et))
        return
    if not isinstance(serie, list):
        errores.append("{}: 'serie' debe ser una lista".format(et))
        return
    if not serie:
        errores.append("{}: 'serie' vino vacia".format(et))
        return
    for i, punto in enumerate(serie):
        if not isinstance(punto, dict):
            errores.append("{}.serie[{}]: debe ser objeto".format(et, i))
            continue
        for campo in campos:
            if not isinstance(punto.get(campo), (int, float)) or isinstance(punto.get(campo), bool):
                errores.append("{}.serie[{}]: '{}' debe ser numero".format(et, i, campo))
    llaves = [p.get(clave_orden) for p in serie if isinstance(p, dict)]
    if any(k is None for k in llaves):
        errores.append("{}: hay puntos sin '{}'".format(et, clave_orden))
        return
    if len(set(llaves)) != len(llaves):
        errores.append("{}: '{}' repetido en la serie".format(et, clave_orden))
    try:
        if llaves != sorted(llaves):
            errores.append(
                "{}: la serie no esta ordenada por '{}'; el cron commitearia "
                "el mismo dato reacomodado".format(et, clave_orden))
    except TypeError:
        errores.append("{}: '{}' mezcla tipos y no se puede ordenar".format(et, clave_orden))
    if esperados is not None and len(serie) != esperados:
        errores.append("{}: la serie trae {} puntos y el conteo dice {}".format(
            et, len(serie), esperados))


TIPOS_POST = ("imagen", "video", "carrusel", "otro")
ETIQUETAS_COMENTARIO = ("positivo", "negativo", "neutral")
# Una @mencion dentro del texto publicado es la identidad de un tercero. El
# pipeline la sustituye por "@…"; aqui se exige que no quede ninguna.
RE_MENCION_PUBLICADA = re.compile(r"@[A-Za-z0-9_.]{2,}")

# Lo que si puede llevar redes-comentarios.json: exactamente estas
# cuatro claves por comentario. Cualquier otra es sospechosa, y las de
# identidad son error con nombre propio (abajo).
CLAVES_COMENTARIO_PUBLICADO = frozenset({"texto", "likes", "fecha", "sentimiento"})
CLAVES_PROHIBIDAS_COMENTARIO_PUBLICADO = (
    (CLAVES_PROHIBIDAS_REDES - {"post", "postUrl", "comentario"})
    | frozenset({"id", "commentUrl", "autor", "author", "respuestas"}))

# Campos de identidad que devuelven los actores de TikTok (clockworks). Se
# tiran al ingerir en pulso/tiktok.py; si uno aparece en cualquier archivo de
# data/, el filtro se rompio antes del cache.
CLAVES_PROHIBIDAS_TIKTOK = frozenset(
    {"uniqueId", "uid", "avatarThumbnail", "authorMeta", "nickName", "avatar", "cid",
     "profileUrl"})

# El @handle del CREADOR del video si se publica en TikTok (decision del
# cliente del 8 de septiembre de 2026: es quien publico, y la URL ya lo trae).
# Es la unica identidad que cruza a data/, y solo en esa plataforma.
RE_CREADOR = re.compile(r"^@[A-Za-z0-9_.]{2,24}$")

# Veredicto crudo del gacetero sobre el pie del video. Se publica AL LADO de la
# zona, no en su lugar, desde que existen los ambitos (15 de septiembre de
# 2026): en una busqueda nacional un video de Guadalajara queda
# `zona: nacional` igual que uno que no nombro lugar alguno, y sin el alcance
# las dos filas serian la misma. El panel rotula "fuera del corredor" para una
# y "sin lugar" para la otra. Es la regla de `sin dato` contra `0` aplicada a
# zonas: dos estados distintos no se colapsan en uno.
ALCANCES_REDES = ("zona", "estatal", "fuera", "nacional")
# Las ocho del producto, sin `estatal`: lo que puede significar alcance "zona".
ZONAS_MUNICIPALES = tuple(z for z in ZONAS if z != "estatal")
# `internacional` solo existe en TikTok, y solo como residuo de la edicion del
# mundo. NO entra a ZONAS_DE_CONTEO, que la usan temas, conversacion y el
# propio Instagram: ahi no significa nada y ampliarla la dejaria pasar.
ZONAS_REDES_AMBITO = ZONAS_DE_CONTEO + ("internacional",)
AMBITOS_REDES = ("regional", "nacional", "internacional")

# Todas las cifras que alguna plataforma publica en un destacado. Existe para
# que la comprobacion inversa -- "esta presente y no es de esta plataforma" --
# sea un bucle y no una lista a mano que se queda corta al agregar la cuarta.
CIFRAS_REDES = ("likes", "comentarios", "compartidos", "guardados",
                "reproducciones", "valoraciones")

# Lo que cambia entre plataformas en redes.json y su archivo de texto. Todo
# lo demas -- conteos, orden, sentimiento, prohibiciones de texto -- es igual.
PLATAFORMAS_REDES = {
    "instagram": {
        "prefijo": "https://www.instagram.com/",
        # Ventana en horas sobre `publicado` desde el 10 de septiembre de 2026,
        # cuando el cliente pidio "lo ultimo de las 24 horas". Hasta entonces
        # fue de dias sobre `fecha`, y un corte con esa forma sigue siendo
        # valido (aviso): data/ lo escribe el bot y no se edita a mano.
        "ventana": "ventana_horas",
        "ventana_legado": "ventana_dias",
        "creador": False,
        "prohibidas": frozenset(),
        # Las cifras OBLIGATORIAS de esta plataforma. Instagram no publica
        # compartidos ni guardados: su ausencia es "sin dato", y por eso no
        # estan aqui ni en `cifras_opcionales`.
        "cifras": ("likes", "comentarios"),
        "cifras_opcionales": ("reproducciones",),
        "orden": ("likes", "comentarios"),
        "formatos": (),
        "estados": ("ok", "fallo", "sin_token"),
        # La zona de una cuenta es su sede declarada, no el veredicto de un
        # gacetero: aqui no hay alcance que publicar, y `internacional` no existe.
        "alcance": False,
        # El actor de Instagram no publica la duracion del video.
        "duracion": False,
        "zonas": ZONAS_DE_CONTEO,
        "modulo": "pulso/instagram.py:_limpiar",
    },
    "tiktok": {
        "prefijo": "https://www.tiktok.com/",
        # Ventana en horas sobre `publicado`: una busqueda de "ultimas 24 horas".
        "ventana": "ventana_horas",
        "ventana_legado": None,
        "creador": True,
        "prohibidas": CLAVES_PROHIBIDAS_TIKTOK,
        # TikTok si publica compartidos y guardados: un 0 es cero medido, y
        # faltar es error.
        "cifras": ("likes", "comentarios", "compartidos", "guardados"),
        "cifras_opcionales": ("reproducciones",),
        "orden": ("likes", "comentarios"),
        "formatos": (),
        "estados": ("ok", "fallo", "sin_token"),
        "alcance": True,
        # Segundos del video, desde el 17 de septiembre de 2026. Opcional: un
        # corte anterior no lo trae y sigue siendo valido, igual que `alcance`.
        "duracion": True,
        "zonas": ZONAS_REDES_AMBITO,
        "modulo": "pulso/tiktok.py:_limpiar_comentario",
    },
    "youtube": {
        # Dos prefijos porque son dos formatos con URL distinta. Ojo: este es
        # el modulo del FEED PUBLICO (pulso/youtube.py), no el de la API de
        # datos (pulso/conversacion.py, que escribe conversacion.json). Sus
        # datos no se suman en un mismo agregado: solo uno de los dos cae bajo
        # las Politicas para Desarrolladores.
        "prefijo": ("https://www.youtube.com/shorts/", "https://www.youtube.com/watch?v="),
        "ventana": "ventana_horas",
        "ventana_legado": None,
        # El publicador ES la cuenta, una fila del config con nombre impreso.
        # Un `creador` seria el mismo hecho dos veces y la segunda copia es
        # una clave de identidad.
        "creador": False,
        "prohibidas": frozenset(),
        # El feed publico no trae likes ni conteo de comentarios. Ordena por
        # vistas, con las valoraciones de desempate. `valoraciones` es
        # media:starRating@count y NO es "likes": ver pulso/youtube.py.
        "cifras": ("reproducciones", "valoraciones"),
        "cifras_opcionales": (),
        "orden": ("reproducciones", "valoraciones"),
        # Shorts y videos largos se cortan por separado porque sus vistas no
        # miden lo mismo: desde el 31 de marzo de 2025 una vista de Short es
        # cualquier arranque o repeticion sin tiempo minimo. Medido el 18 de
        # septiembre de 2026: mediana de 447 contra 7.
        "formatos": ("short", "video"),
        # `sin_lista` es el 404 de una lista automatica que el canal no tiene.
        # No es `fallo` (nada se rompio) ni `ok` con posts en cero (eso se lee
        # "hoy no publico"): es "sin dato" contra "0" en la banda de salud.
        "estados": ("ok", "fallo", "sin_lista"),
        # La zona sale del titulo y la descripcion con el gacetero, como en
        # TikTok. El caso esta medido en el encabezado de pulso/youtube.py.
        "alcance": True,
        "duracion": False,
        "zonas": ZONAS_REDES_AMBITO,
        "modulo": "pulso/youtube.py:_limpiar_pieza",
    },
}

RE_BUSQUEDA_TIKTOK = re.compile(r"^tk_[a-z0-9_]{2,20}$")
# Los dos enums salen de la validacion de entrada del actor (HTTP 400 con la
# lista completa), no de su ficha: la primera version copio "YESTERDAY" de la
# interfaz de TikTok y el actor lo rechazo.
FILTROS_FECHA_TIKTOK = ("ALL_TIME", "PAST_24_HOURS", "PAST_WEEK", "PAST_MONTH",
                        "LAST_3_MONTHS", "LAST_6_MONTHS")
ORDENES_TIKTOK = ("MOST_RELEVANT", "MOST_LIKED", "LATEST")


def validar_tiktok_config(datos):
    """config/tiktok.json: busquedas, no cuentas. Una busqueda no lleva zona."""
    errores, avisos = [], []
    if not _texto(datos.get("nota")):
        avisos.append("tiktok: falta la 'nota' que explica el archivo")
    cosecha = datos.get("cosecha")
    if not isinstance(cosecha, dict):
        errores.append("tiktok: falta 'cosecha'")
    else:
        vh = cosecha.get("ventana_horas")
        if not isinstance(vh, int) or isinstance(vh, bool) or not 1 <= vh <= 720:
            errores.append("tiktok.cosecha: 'ventana_horas' debe ser entero entre 1 y 720")
        if cosecha.get("filtro_fecha") not in FILTROS_FECHA_TIKTOK:
            errores.append("tiktok.cosecha: 'filtro_fecha' {!r} no es un valor del actor; "
                           "se espera {}".format(cosecha.get("filtro_fecha"),
                                                 "|".join(FILTROS_FECHA_TIKTOK)))
        for campo in ("videos_por_busqueda", "comentarios_por_video", "dias_entre_cosechas",
                      "presupuesto_resultados"):
            v = cosecha.get(campo)
            if not isinstance(v, int) or isinstance(v, bool) or v < 1:
                errores.append("tiktok.cosecha: '{}' debe ser entero positivo".format(campo))
        if cosecha.get("orden", "MOST_RELEVANT") not in ORDENES_TIKTOK:
            errores.append("tiktok.cosecha: 'orden' {!r} no es un valor del actor; se espera {}"
                           .format(cosecha.get("orden"), "|".join(ORDENES_TIKTOK)))
    busquedas = datos.get("busquedas")
    if not isinstance(busquedas, list) or not busquedas:
        errores.append("tiktok: 'busquedas' debe ser una lista no vacia")
        return errores, avisos
    ids = set()
    for i, b in enumerate(busquedas):
        et = "tiktok.busquedas[{}]".format(b.get("id", i) if isinstance(b, dict) else i)
        if not isinstance(b, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        bid = b.get("id")
        if not isinstance(bid, str) or not RE_BUSQUEDA_TIKTOK.match(bid):
            errores.append("{}: 'id' invalido ({!r}); se espera ^tk_[a-z0-9_]{{2,20}}$".format(
                et, bid))
        elif bid in ids:
            errores.append("{}: id repetido".format(et))
        ids.add(bid)
        for campo in ("nombre", "consulta", "nota"):
            if not _texto(b.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        if b.get("idioma") not in IDIOMAS:
            errores.append("{}: idioma {!r} desconocido".format(et, b.get("idioma")))
        if not isinstance(b.get("activo"), bool):
            errores.append("{}: 'activo' debe ser booleano".format(et))
        if "ambito" in b and b.get("ambito") not in AMBITOS_REDES:
            errores.append("{}: 'ambito' {!r} desconocido; se espera {}".format(
                et, b.get("ambito"), "|".join(AMBITOS_REDES)))
        if "zona" in b:
            # Misma regla que config/busquedas.json: una consulta le acreditaria
            # su zona a todo video que no nombre lugar alguno. La zona sale del
            # pie del video, con el gacetero. `ambito` NO es la puerta de atras
            # a esto: no acredita lugar a nadie, solo decide que hacer con el
            # residuo -- el video que no nombra lugar, o que nombra uno de fuera.
            errores.append("{}: una busqueda no lleva 'zona'; la zona de cada video sale "
                           "de lo que nombra su pie (pulso/zonas.py). 'ambito' tampoco es "
                           "una zona: solo decide el residuo".format(et))
    if not any(isinstance(b, dict) and b.get("activo") for b in busquedas):
        avisos.append("tiktok: ninguna busqueda activa; el panel va a salir vacio")
    return errores, avisos


RE_CANAL_YOUTUBE = re.compile(r"^yt_[a-z0-9_]{2,20}$")
FORMATOS_YOUTUBE = ("short", "video")


def validar_youtube_config(datos):
    """config/youtube.json: canales leidos por feed publico. Una fila no lleva zona.

    Es el catalogo del modulo del FEED (pulso/youtube.py), no el de la API
    (config/canales.json, que lee pulso/conversacion.py). Los dos listan
    canales de YouTube y ahi se acaba el parecido: alla `zona` es obligatoria
    y aqui es un error, porque la zona de cada pieza sale de lo que nombra su
    titulo y su descripcion.
    """
    errores, avisos = [], []
    if not _texto(datos.get("nota")):
        avisos.append("youtube: falta la 'nota' que explica el archivo")
    cosecha = datos.get("cosecha")
    if not isinstance(cosecha, dict):
        errores.append("youtube: falta 'cosecha'")
    else:
        vh = cosecha.get("ventana_horas")
        if not isinstance(vh, int) or isinstance(vh, bool) or not 1 <= vh <= 720:
            errores.append("youtube.cosecha: 'ventana_horas' debe ser entero entre 1 y 720")
        for campo in ("shorts_por_canal", "videos_por_canal"):
            v = cosecha.get(campo)
            if not isinstance(v, int) or isinstance(v, bool) or v < 1:
                errores.append("youtube.cosecha: '{}' debe ser entero positivo".format(campo))
    canales = datos.get("canales")
    if not isinstance(canales, list) or not canales:
        errores.append("youtube: 'canales' debe ser una lista no vacia")
        return errores, avisos
    ids = set()
    for i, c in enumerate(canales):
        et = "youtube.canales[{}]".format(c.get("id", i) if isinstance(c, dict) else i)
        if not isinstance(c, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        cid = c.get("id")
        if not isinstance(cid, str) or not RE_CANAL_YOUTUBE.match(cid):
            errores.append("{}: 'id' invalido ({!r}); se espera ^yt_[a-z0-9_]{{2,20}}$".format(
                et, cid))
        elif cid in ids:
            errores.append("{}: id repetido".format(et))
        ids.add(cid)
        for campo in ("nombre", "nota"):
            if not _texto(c.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        canal = c.get("canal")
        if not isinstance(canal, str) or not canal.startswith("UC") or len(canal) != 24:
            errores.append("{}: 'canal' debe ser un id UC... de 24 caracteres ({!r}); de ahi "
                           "salen las listas UUSH y UULF reemplazando el UC".format(et, canal))
        if c.get("idioma") not in IDIOMAS:
            errores.append("{}: idioma {!r} desconocido".format(et, c.get("idioma")))
        if not isinstance(c.get("activo"), bool):
            errores.append("{}: 'activo' debe ser booleano".format(et))
        formatos = c.get("formatos")
        if (not isinstance(formatos, list) or not formatos
                or any(f not in FORMATOS_YOUTUBE for f in formatos)):
            errores.append("{}: 'formatos' debe ser una lista no vacia de {}".format(
                et, "|".join(FORMATOS_YOUTUBE)))
        if "ambito" in c and c.get("ambito") not in AMBITOS_REDES:
            errores.append("{}: 'ambito' {!r} desconocido; se espera {}".format(
                et, c.get("ambito"), "|".join(AMBITOS_REDES)))
        if "zona" in c:
            # El caso, medido el 18 de septiembre de 2026: la fila de El Vigia
            # dice Ensenada y nueve de sus quince Shorts son nacionales --
            # Trump, Milei, Morelos. Su pieza mas vista del corredor, con 3,985
            # vistas, es sobre Trump y la UE. Estamparle esta zona la pondria
            # al frente del muro de Ensenada. `ambito` tampoco es la puerta de
            # atras: no acredita lugar a nadie, solo decide el residuo.
            errores.append("{}: un canal no lleva 'zona'; la zona de cada pieza sale de lo "
                           "que nombran su titulo y su descripcion (pulso/zonas.py). El feed "
                           "de YouTube de un medio es su canal nacional y viral, no su "
                           "cobertura municipal".format(et))
    if not any(isinstance(c, dict) and c.get("activo") for c in canales):
        avisos.append("youtube: ningun canal activo; el panel va a salir vacio")
    return errores, avisos


def _validar_destacados(datos, errores, avisos, plataforma="instagram",
                        cosecha_comentarios=True):
    """El bloque de posts destacados de redes.json. Ausente es aviso.

    Un corte anterior al campo sigue siendo valido -- el patron de
    _validar_serie -- pero si el bloque esta, se exige entero: ventana, tope,
    catalogo de cuentas y cada destacado con sus conteos cuadrados. Un corte
    con la ventana anterior de la plataforma (`ventana_legado`) se valida con
    la regla que regia cuando se escribio, y se avisa.
    """
    if "destacados" not in datos:
        avisos.append("redes: corte anterior al campo 'destacados'; el panel de "
                      "posts saldra vacio")
        return
    et = "redes.destacados"
    esp = PLATAFORMAS_REDES[plataforma]
    # Exactamente UNA ventana por archivo. Emitir las dos obligaria a un
    # `ventana_dias: 1` que miente: un video de hace 23 horas es de ayer.
    clave_ventana = esp["ventana"]
    # Un corte anterior al cambio de ventana se valida con la regla que regia
    # cuando se escribio, y se avisa. Es el caso del data/redes.json commiteado
    # antes del 10 de septiembre de 2026: el bot lo regenera; a mano no se toca.
    legado = esp.get("ventana_legado")
    if clave_ventana not in datos and legado and legado in datos:
        avisos.append("redes: corte anterior a '{}' (hasta el 10 de septiembre de 2026 "
                      "{} midio la ventana en dias); se valida con '{}'".format(
                          clave_ventana, plataforma, legado))
        clave_ventana = legado
    otra = "ventana_horas" if clave_ventana == "ventana_dias" else "ventana_dias"
    if otra in datos:
        errores.append("redes: '{}' no aplica a {}; la ventana es '{}'".format(
            otra, plataforma, clave_ventana))
    tope = 30 if clave_ventana == "ventana_dias" else 720
    ventana = datos.get(clave_ventana)
    if not isinstance(ventana, int) or isinstance(ventana, bool) or not 1 <= ventana <= tope:
        errores.append("redes: '{}' debe ser entero entre 1 y {}".format(clave_ventana, tope))
        ventana = None
    maximo = datos.get("destacados_maximo")
    if not isinstance(maximo, int) or isinstance(maximo, bool) or maximo < 1:
        errores.append("redes: 'destacados_maximo' debe ser entero positivo")
        maximo = None

    cuentas = datos.get("cuentas")
    conocidas = set()
    if not isinstance(cuentas, list):
        errores.append("redes: 'cuentas' debe ser una lista (catalogo sin handle)")
    else:
        for c in cuentas:
            if not isinstance(c, dict) or not _texto(c.get("cuenta")):
                errores.append("redes.cuentas: cada registro necesita 'cuenta'")
                continue
            conocidas.add(c["cuenta"])
            if not _texto(c.get("nombre")):
                errores.append("redes.cuentas[{}]: falta 'nombre'".format(c["cuenta"]))
            if c.get("zona") not in esp["zonas"]:
                errores.append("redes.cuentas[{}]: zona desconocida ({!r})".format(
                    c["cuenta"], c.get("zona")))
            if not isinstance(c.get("activa"), bool):
                errores.append("redes.cuentas[{}]: 'activa' debe ser booleano".format(
                    c["cuenta"]))
        ids = [c.get("cuenta") for c in cuentas if isinstance(c, dict)]
        if ids != sorted(ids):
            errores.append("redes: 'cuentas' no esta ordenado por cuenta")

    lista = datos.get("destacados")
    if not isinstance(lista, list):
        errores.append("redes: 'destacados' debe ser una lista")
        return

    generado = str(datos.get("generado") or "")[:10]
    desde = None
    if clave_ventana == "ventana_dias" and _fecha(generado) and ventana:
        desde = (_fecha(generado) - timedelta(days=ventana)).isoformat()
    generado_dt = desde_dt = None
    if clave_ventana == "ventana_horas" and _es_iso(datos.get("generado")) and ventana:
        generado_dt = datetime.fromisoformat(str(datos["generado"]).replace("Z", "+00:00"))
        desde_dt = generado_dt - timedelta(hours=ventana)

    urls, por_zona = [], {}
    sin_alcance = sin_duracion = 0
    for i, d in enumerate(lista):
        eti = "{}[{}]".format(et, i)
        if not isinstance(d, dict):
            errores.append("{}: debe ser objeto".format(eti))
            continue
        url = d.get("url")
        prefijos = esp["prefijo"] if isinstance(esp["prefijo"], tuple) else (esp["prefijo"],)
        if not _texto(url) or not url.startswith(prefijos):
            errores.append("{}: 'url' debe empezar con {} ({!r})".format(
                eti, " o ".join(prefijos), url))
        else:
            urls.append(url)
        # El creador solo cruza a data/ en TikTok, y ahi es obligatorio y
        # tiene que ser el mismo de la URL: una guardia cruzada barata contra
        # un handle que no corresponde al video.
        creador = d.get("creador")
        if esp["creador"]:
            if not isinstance(creador, str) or not RE_CREADOR.match(creador):
                errores.append("{}: 'creador' debe ser un @handle ({!r})".format(eti, creador))
            elif _texto(url) and not url.startswith(prefijos[0] + creador + "/video/"):
                errores.append("{}: 'creador' {} no es el de la url {}".format(eti, creador, url))
        elif "creador" in d:
            errores.append("{}: 'creador' no se publica en {}; la fuente es la cuenta".format(
                eti, plataforma))
        # `alcance` es el veredicto del gacetero y `zona` es donde cae despues de
        # aplicar el ambito de la busqueda. Los dos se emiten y tienen que cuadrar:
        # un cruce mal hecho aqui es exactamente la acreditacion por consulta que
        # todo el modulo existe para impedir, y no da error en ninguna otra parte.
        alc = d.get("alcance")
        if esp["alcance"]:
            # Un corte anterior al campo sigue siendo valido, con aviso y una sola
            # vez al final: es el mismo trato que `ventana_legado`, y por la misma
            # razon -- data/ lo escribe el bot y no se edita a mano para callar un
            # aviso. El cron lo regenera y el campo aparece solo.
            if "alcance" not in d:
                sin_alcance += 1
            elif alc not in ALCANCES_REDES:
                errores.append("{}: 'alcance' debe ser {} ({!r})".format(
                    eti, "|".join(ALCANCES_REDES), alc))
            else:
                z = d.get("zona")
                if alc == "zona" and z not in ZONAS_MUNICIPALES:
                    errores.append("{}: alcance 'zona' con zona {!r}; el pie nombro un "
                                   "lugar del producto y la zona tiene que serlo".format(eti, z))
                elif alc == "estatal" and z != "estatal":
                    errores.append("{}: alcance 'estatal' con zona {!r}".format(eti, z))
                elif alc == "fuera" and z != "nacional":
                    errores.append("{}: alcance 'fuera' con zona {!r}; un lugar de fuera solo "
                                   "sobrevive como 'nacional', y solo si la busqueda no es "
                                   "regional".format(eti, z))
                elif alc == "nacional" and z not in ("nacional", "internacional"):
                    errores.append("{}: alcance 'nacional' con zona {!r}; el gacetero no nombro "
                                   "lugar, asi que ninguna zona se le puede acreditar".format(
                                       eti, z))
        elif "alcance" in d:
            errores.append("{}: 'alcance' no aplica a {}; la zona es la sede declarada de la "
                           "cuenta y no el veredicto de un gacetero".format(eti, plataforma))
        if conocidas and d.get("cuenta") not in conocidas:
            errores.append("{}: cuenta {!r} no esta en 'cuentas'".format(eti, d.get("cuenta")))
        if d.get("zona") not in esp["zonas"]:
            errores.append("{}: zona desconocida ({!r})".format(eti, d.get("zona")))
        else:
            # El tope se cuenta como se hizo el corte. Donde hay formatos el
            # corte fue por (zona, formato), asi que contar solo por zona daria
            # el doble y fallaria sobre un archivo correcto.
            clave = (d["zona"], d.get("formato")) if esp.get("formatos") else d["zona"]
            por_zona[clave] = por_zona.get(clave, 0) + 1
        fecha = d.get("fecha")
        if not _fecha(fecha):
            errores.append("{}: 'fecha' invalida ({!r})".format(eti, fecha))
        elif clave_ventana == "ventana_dias":
            # La ventana se mide contra 'generado', nunca contra el reloj de
            # quien valida: el archivo tiene que ser valido hoy y en un ano.
            if fecha > generado:
                errores.append("{}: fecha {} posterior a generado {}; reloj roto".format(
                    eti, fecha, generado))
            elif desde and fecha < desde:
                errores.append("{}: fecha {} fuera de la ventana de {} dias".format(
                    eti, fecha, ventana))
        if clave_ventana == "ventana_horas":
            # En horas la ventana se mide sobre `publicado`, con hora y zona;
            # `fecha` es su dia y solo sirve para agrupar en el tablero.
            publicado = d.get("publicado")
            if not _es_iso(publicado):
                errores.append("{}: 'publicado' debe ser fecha-hora ISO ({!r})".format(
                    eti, publicado))
            else:
                pub_dt = datetime.fromisoformat(str(publicado).replace("Z", "+00:00"))
                if _fecha(fecha) and str(publicado)[:10] != fecha:
                    errores.append("{}: 'fecha' {} no es el dia de 'publicado' {}".format(
                        eti, fecha, publicado))
                if generado_dt is not None:
                    if pub_dt > generado_dt:
                        errores.append("{}: publicado {} posterior a generado; reloj roto".format(
                            eti, publicado))
                    elif pub_dt < desde_dt:
                        errores.append("{}: publicado {} fuera de la ventana de {} horas".format(
                            eti, publicado, ventana))
        elif "publicado" in d:
            errores.append("{}: 'publicado' no aplica a {}".format(eti, plataforma))
        titulo = d.get("titulo")
        if not isinstance(titulo, str):
            errores.append("{}: 'titulo' debe ser texto".format(eti))
        elif len(titulo) > 160:
            errores.append("{}: 'titulo' de {} caracteres; es el titular del pie, no "
                           "el pie completo (maximo 160)".format(eti, len(titulo)))
        elif not titulo.strip():
            avisos.append("{}: post sin pie; la fila saldra solo con la liga".format(eti))
        if esp.get("formatos"):
            if d.get("formato") not in esp["formatos"]:
                errores.append("{}: 'formato' debe ser {} ({!r})".format(
                    eti, "|".join(esp["formatos"]), d.get("formato")))
        elif "formato" in d:
            errores.append("{}: 'formato' no aplica a {}; solo lo lleva una plataforma "
                           "cuyos formatos no se pueden comparar entre si".format(
                               eti, plataforma))
        if d.get("tipo") not in TIPOS_POST:
            errores.append("{}: tipo {!r} desconocido; se espera {}".format(
                eti, d.get("tipo"), "|".join(TIPOS_POST)))
        for campo in ("cosechados", "opinion") + tuple(esp["cifras"]):
            if not _entero_no_negativo(d.get(campo)):
                errores.append("{}: '{}' debe ser entero no negativo".format(eti, campo))
        # Lo contrario y por la misma razon: una cifra que esta plataforma no
        # publica no puede aparecer ni en cero. En YouTube `likes` y
        # `comentarios` no existen -- el feed publico no los trae -- y un cero
        # se leeria como "nadie comento" en vez de "no lo medimos".
        permitidas = frozenset(esp["cifras"]) | frozenset(esp.get("cifras_opcionales", ()))
        for campo in CIFRAS_REDES:
            if campo in d and campo not in permitidas:
                errores.append("{}: '{}' no existe en {}; ausente es 'sin dato', nunca 0".format(
                    eti, campo, plataforma))
        if ("reproducciones" in esp.get("cifras_opcionales", ())
                and "reproducciones" in d
                and not (_entero_no_negativo(d["reproducciones"])
                         and d["reproducciones"] > 0)):
            errores.append("{}: 'reproducciones' solo se emite si es mayor que 0; un cero "
                           "se leeria como 'nadie lo vio' y no como 'no es video'".format(eti))
        # `duracion` son segundos de video y existe por una razon de costo: todo
        # lo que Apify cobra sobre el video se factura POR SEGUNDO empezado
        # (`aiVideoSummary`, `aiVideoDescription`) o por minuto empezado
        # (`transcription-minute`). Sin ella no se puede presupuestar ninguno de
        # los tres, que es justo lo que hubo que estimar a ciegas el 17 de
        # septiembre de 2026. Solo TikTok la publica; un cero seria "video de
        # duracion cero" y no "no la trae", asi que se omite en vez de emitirla.
        if esp["duracion"]:
            if "duracion" not in d:
                sin_duracion += 1
            elif not (_entero_no_negativo(d["duracion"]) and d["duracion"] > 0):
                errores.append("{}: 'duracion' son segundos y solo se emite si es mayor "
                               "que 0 ({!r})".format(eti, d.get("duracion")))
        elif "duracion" in d:
            errores.append("{}: 'duracion' no aplica a {}; su actor no la publica".format(
                eti, plataforma))
        if _entero_no_negativo(d.get("cosechados")):
            # Si la plataforma no cosecha comentarios, este aviso saldria en
            # TODAS las filas de cada corrida y dejaria de ser una senal.
            if d["cosechados"] == 0 and cosecha_comentarios:
                avisos.append("{}: post destacado sin comentarios cosechados".format(eti))
            elif _entero_no_negativo(d.get("comentarios")) and d["cosechados"] > d["comentarios"]:
                avisos.append("{}: cosechados {} > comentarios {} que reporta el actor".format(
                    eti, d["cosechados"], d["comentarios"]))
        sen = d.get("sentimiento")
        _validar_conteo_sentimiento(sen, eti, errores)
        if isinstance(sen, dict) and isinstance(d.get("opinion"), int):
            suma = sum(sen.get(k) or 0
                       for k in SENTIMIENTOS + ("sin_clasificar", "sin_modelo_idioma"))
            if suma != d["opinion"]:
                errores.append("{}: sentimiento suma {} y 'opinion' es {}".format(
                    eti, suma, d["opinion"]))
        temas = d.get("temas")
        if not isinstance(temas, list) or len(temas) > 3:
            errores.append("{}: 'temas' debe ser lista de hasta 3".format(eti))
        else:
            for t in temas:
                if not isinstance(t, dict) or not _texto(t.get("tema")) \
                        or not _entero_no_negativo(t.get("comentarios")):
                    errores.append("{}: cada tema necesita 'tema' y 'comentarios'".format(eti))
                    break
            claves = [(-t.get("comentarios", 0), t.get("tema", ""))
                      for t in temas if isinstance(t, dict)]
            if claves != sorted(claves):
                errores.append("{}: 'temas' no esta ordenado".format(eti))

    if sin_alcance:
        avisos.append("redes: {} destacado(s) anteriores al campo 'alcance' (15 de septiembre "
                      "de 2026); el panel los rotula por 'zona' hasta que el cron los "
                      "regenere".format(sin_alcance))
    if sin_duracion:
        avisos.append("redes: {} destacado(s) anteriores al campo 'duracion' (17 de septiembre "
                      "de 2026); hasta que el cron los regenere no se puede presupuestar lo "
                      "que Apify cobra por segundo de video".format(sin_duracion))
    if len(set(urls)) != len(urls):
        errores.append("redes: 'destacados' repite una url")
    orden = tuple(esp["orden"])
    claves = [tuple(-int(d.get(k) or 0) for k in orden) + (d.get("url", ""),)
              for d in lista if isinstance(d, dict)]
    if claves != sorted(claves):
        errores.append("redes: 'destacados' no esta ordenado por ({}, url); "
                       "un orden distinto ensucia el diff de cada corrida detras de "
                       "`git diff --cached --quiet`".format(
                           ", ".join("-" + k for k in orden)))
    if maximo:
        for clave, n in sorted(por_zona.items()):
            if n > maximo:
                donde = clave if isinstance(clave, str) else "{} en {}".format(clave[1], clave[0])
                errores.append("redes: {} destacados de {} y el maximo es {}".format(
                    n, donde, maximo))


def validar_redes_comentarios(datos, redes=None, plataforma="instagram"):
    """redes-comentarios.json: el texto publicado, sin identidad.

    Este archivo NO va a git (ver .gitignore) y se regenera en cada corrida.
    Lo que se valida es lo que lo acota: solo posts destacados, la regla del
    "ver mas" (del sexto en adelante, solo con likes), ni una clave de
    identidad ni el id del comentario, y el recorte del texto.
    """
    errores, avisos = [], []
    et = "redes-comentarios"
    esp = PLATAFORMAS_REDES[plataforma]
    if datos.get("esquema") != ESQUEMA:
        errores.append("{}: 'esquema' debe ser {}".format(et, ESQUEMA))
    if not _es_iso(datos.get("generado")):
        errores.append("{}: 'generado' no es ISO-8601".format(et))
    if datos.get("plataforma") != plataforma:
        errores.append("{}: 'plataforma' debe ser {!r} ({!r})".format(
            et, plataforma, datos.get("plataforma")))
    if datos.get("retencion_dias") != 30:
        errores.append("{}: 'retencion_dias' debe ser 30".format(et))
    visibles, maximo = datos.get("visibles"), datos.get("maximo")
    if not (_entero_no_negativo(visibles) and visibles >= 1):
        errores.append("{}: 'visibles' debe ser entero positivo".format(et))
        visibles = None
    if not (_entero_no_negativo(maximo) and maximo >= (visibles or 1)):
        errores.append("{}: 'maximo' debe ser entero >= visibles".format(et))
        maximo = None

    for ruta in _claves_prohibidas(datos,
                                   CLAVES_PROHIBIDAS_COMENTARIO_PUBLICADO | esp["prohibidas"]):
        errores.append(
            "{}: clave prohibida (identidad o id) en {}. La identidad se tira al "
            "ingerir y el id de Instagram nunca se publica.".format(et, ruta))
    for ruta in _claves_prohibidas(datos, frozenset({"porcentaje", "pct"})):
        errores.append("{}: porcentaje prohibido en {}".format(et, ruta))

    por_post = datos.get("por_post")
    if not isinstance(por_post, dict):
        errores.append("{}: 'por_post' debe ser {{url: [comentarios]}}".format(et))
        return errores, avisos
    if list(por_post) != sorted(por_post):
        errores.append("{}: 'por_post' no esta ordenado por url".format(et))

    destacadas = None
    if isinstance(redes, dict) and isinstance(redes.get("destacados"), list):
        destacadas = {d.get("url") for d in redes["destacados"] if isinstance(d, dict)}

    for url, lista in por_post.items():
        eti = "{}[{}]".format(et, url)
        if destacadas is not None and url not in destacadas:
            errores.append("{}: post que no esta en redes.destacados".format(eti))
        if not isinstance(lista, list):
            errores.append("{}: debe ser lista".format(eti))
            continue
        if maximo and len(lista) > maximo:
            errores.append("{}: {} comentarios y el maximo es {}".format(eti, len(lista), maximo))
        likes_previos = None
        for i, c in enumerate(lista):
            if not isinstance(c, dict):
                errores.append("{}[{}]: debe ser objeto".format(eti, i))
                continue
            sobrantes = set(c) - CLAVES_COMENTARIO_PUBLICADO
            faltantes = CLAVES_COMENTARIO_PUBLICADO - set(c)
            if sobrantes or faltantes:
                errores.append("{}[{}]: claves exactas {}; sobran {} faltan {}".format(
                    eti, i, sorted(CLAVES_COMENTARIO_PUBLICADO), sorted(sobrantes),
                    sorted(faltantes)))
                continue
            if not _texto(c["texto"]):
                errores.append("{}[{}]: 'texto' vacio".format(eti, i))
            elif len(c["texto"]) > 300:
                errores.append("{}[{}]: 'texto' de {} caracteres; el recorte es 300".format(
                    eti, i, len(c["texto"])))
            elif RE_MENCION_PUBLICADA.search(c["texto"]):
                # La identidad de un tercero es identidad: pulso/instagram.py
                # la enmascara al publicar, asi que si llego aqui se rompio.
                errores.append("{}[{}]: 'texto' trae una mencion @usuario sin enmascarar".format(
                    eti, i))
            if not _entero_no_negativo(c["likes"]):
                errores.append("{}[{}]: 'likes' debe ser entero no negativo".format(eti, i))
            else:
                if likes_previos is not None and c["likes"] > likes_previos:
                    errores.append("{}[{}]: no esta ordenado por likes".format(eti, i))
                likes_previos = c["likes"]
                # La regla del "ver mas": lo que no se ve de entrada solo
                # entra si alguien lo voto.
                if visibles and i >= visibles and c["likes"] == 0:
                    errores.append("{}[{}]: comentario sin likes despues de los {} visibles".format(
                        eti, i, visibles))
            if c["fecha"] != "" and not _fecha(c["fecha"]):
                errores.append("{}[{}]: 'fecha' invalida ({!r})".format(eti, i, c["fecha"]))
            if c["sentimiento"] is not None and c["sentimiento"] not in ETIQUETAS_COMENTARIO:
                errores.append("{}[{}]: sentimiento {!r} desconocido".format(
                    eti, i, c["sentimiento"]))
    return errores, avisos


def validar_redes(datos, plataforma="instagram"):
    """redes.json: comentarios de Instagram, solo conteos.

    Es mas estricto que validar_conversacion en dos puntos, y los dos tienen
    razon escrita en pulso/instagram.py:

    - `ownerUsername` y compania son claves prohibidas ademas de las de
      conversacion, porque en Instagram la identidad se tira al INGERIR y no
      al derivar. Si una de esas claves aparece aqui, el filtro de ingesta se
      rompio en algun punto y el dato ya paso por el cache.
    - No se admite ninguna clave que termine en '_pct' ni un 'porcentaje'. Los
      planes gratuitos de Apify dan ~15 comentarios por post, o sea debajo del
      minimo de 30 que fija PRODUCT.md para emitir porcentajes.
    """
    errores, avisos = [], []
    if datos.get("esquema") != ESQUEMA:
        errores.append("redes: 'esquema' debe ser {}".format(ESQUEMA))
    if not _es_iso(datos.get("generado")):
        errores.append("redes: 'generado' no es ISO-8601 ({!r})".format(datos.get("generado")))
    esp = PLATAFORMAS_REDES[plataforma]
    if datos.get("plataforma") != plataforma:
        errores.append("redes: 'plataforma' debe ser {!r} ({!r})".format(
            plataforma, datos.get("plataforma")))
    if datos.get("retencion_dias") != 30:
        errores.append(
            "redes: 'retencion_dias' debe ser 30. Meta no concede plazo alguno; "
            "se aplica el mas corto ya implementado (LFPDPPP y CPRA).")

    for campo in ("comentarios_vigentes", "posts_vigentes", "opinion",
                  "repetidos", "reacciones"):
        if not _entero_no_negativo(datos.get(campo)):
            errores.append("redes: '{}' debe ser entero no negativo".format(campo))

    # `cosecha_comentarios: false` dice que esta plataforma no cosecha
    # comentarios, asi que sus ceros no son una medicion. Sin el campo, un
    # panel sin cosecha y uno donde nadie comento serian el mismo archivo. Se
    # asume true cuando falta, para que un corte anterior siga siendo valido.
    cosecha = datos.get("cosecha_comentarios", True)
    if not isinstance(cosecha, bool):
        errores.append("redes: 'cosecha_comentarios' debe ser booleano ({!r})".format(cosecha))
    elif not cosecha:
        for campo in ("comentarios_vigentes", "opinion", "repetidos", "reacciones"):
            if datos.get(campo):
                errores.append(
                    "redes: 'cosecha_comentarios' es false y '{}' vale {}; o se cosecho "
                    "o no se cosecho".format(campo, datos.get(campo)))
        if datos.get("por_tema"):
            errores.append("redes: 'cosecha_comentarios' es false y hay 'por_tema'; los temas "
                           "se cuentan sobre comentarios y no hay")

    prohibidas = CLAVES_PROHIBIDAS_CONVERSACION | CLAVES_PROHIBIDAS_REDES | esp["prohibidas"]
    for ruta in _claves_prohibidas(datos, prohibidas):
        errores.append(
            "redes: clave prohibida (texto literal o identidad): {}. La identidad "
            "se tira al ingerir, asi que si llego hasta aqui el filtro de "
            "{} se rompio.".format(ruta, esp["modulo"]))

    for ruta in _claves_prohibidas(datos, frozenset({"porcentaje", "pct"})):
        errores.append("redes: porcentaje prohibido en {} (regla de los 30)".format(ruta))

    for campo in ("por_zona", "por_cuenta", "por_idioma"):
        mapa = datos.get(campo)
        if not isinstance(mapa, dict) or not all(_entero_no_negativo(n) for n in mapa.values()):
            errores.append("redes: '{}' debe ser {{clave: conteo}}".format(campo))
            continue
        # Determinismo: el cron commitea data/ detras de `git diff --cached
        # --quiet`, y un mapa desordenado ensucia el diff en cada corrida.
        if list(mapa) != sorted(mapa):
            errores.append("redes: '{}' no esta ordenado por clave".format(campo))
    if isinstance(datos.get("por_zona"), dict):
        for z in datos["por_zona"]:
            if z not in esp["zonas"]:
                errores.append("redes: por_zona con zona desconocida ({!r})".format(z))
    if isinstance(datos.get("por_idioma"), dict):
        for i in datos["por_idioma"]:
            if i not in ("es", "en"):
                errores.append(
                    "redes: idioma {!r} desconocido. El modelo de tono es espanol y "
                    "a texto en otro idioma no devuelve error, devuelve una "
                    "etiqueta plausible.".format(i))

    if not isinstance(datos.get("por_tema"), list):
        errores.append("redes: 'por_tema' debe ser una lista")
    else:
        for t in datos["por_tema"]:
            et = "redes.por_tema[{}]".format(t.get("tema") if isinstance(t, dict) else "?")
            if not isinstance(t, dict) or not _texto(t.get("tema")):
                errores.append("{}: falta 'tema'".format(et))
                continue
            for campo in ("comentarios", "posts"):
                if not _entero_no_negativo(t.get(campo)):
                    errores.append("{}: '{}' debe ser entero no negativo".format(et, campo))
            # Un tema sostenido por un solo post no es conversacion de la
            # ciudad: es un post. Aviso y no error, porque el dato es real.
            if t.get("posts") == 1 and (t.get("comentarios") or 0) >= 5:
                avisos.append(
                    "redes.por_tema[{}]: {} comentarios en UN solo post; no es un "
                    "tema de la ciudad".format(t.get("tema"), t.get("comentarios")))

    sen = datos.get("sentimiento")
    if not isinstance(sen, dict):
        errores.append("redes: 'sentimiento' debe ser objeto")
    else:
        _validar_conteo_sentimiento(sen, "redes.sentimiento", errores)
        if sen.get("metodo") not in ("modelo", "ninguno"):
            errores.append("redes.sentimiento: 'metodo' debe ser 'modelo' o 'ninguno'")
        # El tono se cuenta sobre `opinion`, no sobre el total: los aplausos
        # y lo repetido quedan fuera. Si los conteos no cuadran con opinion,
        # alguien sumo por otro lado y el panel esta mintiendo.
        # Las CINCO cubetas, no las tres etiquetadas: cada comentario de
        # opinion cae en exactamente una, y las dos que faltan
        # (sin_clasificar, sin_modelo_idioma) son justo las que esconden un
        # modelo que no corrio o que no habla el idioma.
        suma = sum(sen.get(k) or 0
                   for k in SENTIMIENTOS + ("sin_clasificar", "sin_modelo_idioma"))
        if isinstance(datos.get("opinion"), int) and suma != datos["opinion"]:
            errores.append(
                "redes.sentimiento: los conteos suman {} y 'opinion' es {}; el tono "
                "se cuenta sobre opinion, sin reacciones ni repetidos".format(
                    suma, datos["opinion"]))
        if not _entero_no_negativo(sen.get("sin_modelo_idioma")):
            errores.append("redes.sentimiento: 'sin_modelo_idioma' debe ser entero")

    salud = datos.get("salud")
    if not isinstance(salud, list):
        errores.append("redes: 'salud' debe ser una lista")
    else:
        for s in salud:
            if not isinstance(s, dict) or not _texto(s.get("cuenta")):
                errores.append("redes.salud: cada registro necesita 'cuenta'")
                continue
            # 'crudos' es lo facturado y 'comentarios' lo ingerido. Un
            # crudos alto con comentarios en cero es una cuenta que se cobra
            # y no aporta: relleno de posts sin comentarios.
            if s.get("crudos") is not None and not _entero_no_negativo(s["crudos"]):
                errores.append("redes.salud[{}]: 'crudos' debe ser entero no negativo".format(
                    s.get("cuenta")))
            if s.get("estado") not in esp.get("estados", ("ok", "fallo", "sin_token")):
                errores.append("redes.salud[{}]: estado {!r} desconocido".format(
                    s["cuenta"], s.get("estado")))
        if [s.get("cuenta") for s in salud if isinstance(s, dict)] != sorted(
                s.get("cuenta") for s in salud if isinstance(s, dict)):
            errores.append("redes: 'salud' no esta ordenada por cuenta")

    _validar_destacados(datos, errores, avisos, plataforma,
                        cosecha_comentarios=bool(cosecha))

    # Un panel sin cuentas verificadas no es un error, pero tiene que doler a
    # la vista: un handle derivado del nombre del medio da una cuenta ajena o
    # vacia, y las dos se cobran igual. Ver config/instagram.json.
    if isinstance(salud, list) and not salud:
        avisos.append("redes: ninguna cuenta verificada; el panel va a salir vacio")

    return errores, avisos


# ------------------------------------------------------------ tendencias

AMBITOS_TENDENCIAS = ("zona", "nacional", "mundial")
ESTADOS_TENDENCIAS = ("ok", "fallo", "sin_token", "sin_dato", "sin_lista")
# Las zonas que pueden tener lista de tendencias: todas menos `estatal`, que
# no es un lugar. Cada una tiene exactamente una fila, activa o hueco escrito.
ZONAS_CON_LISTA = tuple(z for z in ZONAS if z != "estatal")
# Campos crudos del actor de tendencias. pulso/tendencias.py::_limpiar es
# lista blanca y los tira; si uno aparece en data/, la lista blanca se rompio.
CLAVES_PROHIBIDAS_TENDENCIAS = frozenset(
    {"tweetVolume", "tweetVolumeAvailable", "isPromoted", "isHashtag", "twitterSearchUrl",
     "query", "locationsTrendingIn", "bestRank", "scrapedAt", "locationCount",
     "locationName", "countryCode", "countryName", "locationType", "tweet", "tweets"})
CLAVES_TENDENCIA = frozenset({"puesto", "nombre", "url", "volumen"})
# El actor sella `corte` al momento de raspar, o sea SIEMPRE unos segundos
# despues de que `generado` se tomo (la primera corrida real, 12 de septiembre
# de 2026, dio entre 5 y 11 segundos en las cinco ubicaciones). Eso no es
# reloj roto y no puede avisar en cada corrida; mas de quince minutos si.
TOLERANCIA_CORTE_TENDENCIAS = timedelta(minutes=15)
RE_ACTOR_APIFY = re.compile(r"^[a-z0-9-]+~[a-z0-9-]+$")
PREFIJO_BUSQUEDA_X = "https://x.com/search?q="


def _validar_ubicacion_tendencias(u, et, errores, zonas_vistas, activa):
    """Lo comun a config y data: id, nombre, woeid, zona y ambito coherentes."""
    if not isinstance(u.get("id"), str) or not RE_ID.match(u["id"]):
        errores.append("{}: 'id' invalido ({!r}); se espera {}".format(et, u.get("id"), RE_ID.pattern))
    if not _texto(u.get("nombre")):
        errores.append("{}: falta 'nombre'".format(et))
    woeid = u.get("woeid")
    if activa:
        if not isinstance(woeid, int) or isinstance(woeid, bool) or woeid < 1:
            errores.append("{}: 'woeid' debe ser entero positivo en una ubicacion activa "
                           "({!r}); se confirma con `pulso tendencias --ubicaciones`".format(
                               et, woeid))
    elif woeid is not None:
        errores.append("{}: una ubicacion apagada no lleva 'woeid': es el registro de un "
                       "hueco, no una ubicacion".format(et))
    ambito, zona = u.get("ambito"), u.get("zona")
    if ambito not in AMBITOS_TENDENCIAS:
        errores.append("{}: 'ambito' {!r} desconocido; se espera {}".format(
            et, ambito, "|".join(AMBITOS_TENDENCIAS)))
    elif ambito == "zona":
        if zona not in ZONAS_CON_LISTA:
            errores.append("{}: zona y ambito no cuadran: 'zona' {!r} desconocida o sin "
                           "lugar (estatal no tiene lista)".format(et, zona))
        else:
            zonas_vistas[zona] = zonas_vistas.get(zona, 0) + 1
    elif zona is not None:
        errores.append("{}: zona y ambito no cuadran: una ubicacion {} no lleva zona; una "
                       "lista de pais o del mundo no se le acredita a ninguna ciudad".format(
                           et, ambito))


def _validar_zonas_con_lista(zonas_vistas, et, errores):
    for z in ZONAS_CON_LISTA:
        n = zonas_vistas.get(z, 0)
        if n != 1:
            errores.append("{}: la zona {} debe tener exactamente una ubicacion (activa o "
                           "hueco registrado) y tiene {}; sin fila, el tablero no puede "
                           "rotular el hueco".format(et, z, n))


def validar_tendencias(datos):
    """tendencias.json: lo que X marca como tendencia, por ubicacion.

    Es el ranking de X, no una medida de la ciudad, y el archivo lleva solo el
    nombre de cada tendencia, su puesto y la liga a su busqueda: ni tuits ni
    quien los escribio. Un volumen ausente es "sin dato" (X lo retiro para
    casi todas en enero de 2026), nunca un cero. Ver pulso/tendencias.py.
    """
    errores, avisos = [], []
    if not isinstance(datos, dict):
        return ["tendencias: se esperaba un objeto"], avisos
    if datos.get("esquema") != ESQUEMA:
        errores.append("tendencias: 'esquema' debe ser {}".format(ESQUEMA))
    if not _es_iso(datos.get("generado")):
        errores.append("tendencias: 'generado' no es ISO-8601 ({!r})".format(datos.get("generado")))
    if datos.get("plataforma") != "x":
        errores.append("tendencias: 'plataforma' debe ser 'x'")
    if datos.get("acceso") != "sin_sesion":
        errores.append("tendencias: 'acceso' debe ser 'sin_sesion'; X entra solo sin iniciar "
                       "sesion (docs/PLAN.md seccion 3), y un actor con cookies no llega aqui")
    maximo = datos.get("maximo_por_ubicacion")
    if not isinstance(maximo, int) or isinstance(maximo, bool) or not 1 <= maximo <= 50:
        errores.append("tendencias: 'maximo_por_ubicacion' debe ser entero entre 1 y 50")
        maximo = None

    prohibidas = CLAVES_PROHIBIDAS_CONVERSACION | CLAVES_PROHIBIDAS_REDES | CLAVES_PROHIBIDAS_TENDENCIAS
    for ruta in _claves_prohibidas(datos, prohibidas):
        errores.append("tendencias: clave prohibida (campo crudo del actor, texto o identidad): "
                       "{}. La lista blanca de pulso/tendencias.py::_limpiar se rompio.".format(ruta))
    for ruta in _claves_prohibidas(datos, frozenset({"porcentaje", "pct"})):
        errores.append("tendencias: porcentaje prohibido en {} (regla de los 30)".format(ruta))

    generado_dt = None
    if _es_iso(datos.get("generado")):
        generado_dt = datetime.fromisoformat(str(datos["generado"]).replace("Z", "+00:00"))

    ubicaciones = datos.get("ubicaciones")
    if not isinstance(ubicaciones, list):
        errores.append("tendencias: 'ubicaciones' debe ser una lista")
        ubicaciones = []
    ids = [u.get("id") for u in ubicaciones if isinstance(u, dict)]
    if ids != sorted(ids, key=str):
        errores.append("tendencias: 'ubicaciones' no esta ordenada por id; un orden distinto "
                       "ensucia el diff de cada corrida detras de `git diff --cached --quiet`")
    if len(set(ids)) != len(ids):
        errores.append("tendencias: id de ubicacion repetido")
    zonas_vistas, estados = {}, {}
    for i, u in enumerate(ubicaciones):
        et = "tendencias.ubicaciones[{}]".format(u.get("id", i) if isinstance(u, dict) else i)
        if not isinstance(u, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        activa = u.get("activa")
        if not isinstance(activa, bool):
            errores.append("{}: 'activa' debe ser booleano".format(et))
            activa = bool(activa)
        _validar_ubicacion_tendencias(u, et, errores, zonas_vistas, activa)
        estado = u.get("estado")
        if estado not in ESTADOS_TENDENCIAS:
            errores.append("{}: estado {!r} desconocido; se espera {}".format(
                et, estado, "|".join(ESTADOS_TENDENCIAS)))
        elif (estado == "sin_lista") != (not activa):
            errores.append("{}: 'sin_lista' es el estado de una ubicacion apagada, y solo de "
                           "esa; una activa sin datos es 'sin_dato'".format(et))
        corte = u.get("corte")
        if corte is not None:
            if not _es_iso(corte):
                errores.append("{}: 'corte' debe ser fecha-hora ISO o null ({!r})".format(et, corte))
            elif generado_dt is not None and datetime.fromisoformat(
                    str(corte).replace("Z", "+00:00")) > generado_dt + TOLERANCIA_CORTE_TENDENCIAS:
                # `generado` se toma ANTES de la llamada y el actor sella el
                # corte al raspar, asi que unos segundos de diferencia son lo
                # normal. Mas de la tolerancia es otro reloj o un archivo
                # editado: aviso, porque tampoco puede tumbar el commit de
                # todo data/.
                avisos.append("{}: corte {} mas de {} minutos posterior a generado {} (reloj); "
                              "no es error".format(et, corte,
                                                   TOLERANCIA_CORTE_TENDENCIAS.seconds // 60,
                                                   datos.get("generado")))
        tendencias = u.get("tendencias")
        if not isinstance(tendencias, list):
            errores.append("{}: 'tendencias' debe ser una lista".format(et))
            continue
        if maximo and len(tendencias) > maximo:
            errores.append("{}: {} tendencias, mas de maximo_por_ubicacion ({})".format(
                et, len(tendencias), maximo))
        if not activa and tendencias:
            errores.append("{}: una ubicacion apagada no lleva tendencias".format(et))
        if estado in ESTADOS_TENDENCIAS and (estado == "ok") != bool(tendencias) and activa:
            errores.append("{}: estado {!r} con {} tendencias; 'ok' es exactamente tener "
                           "lista, y sin lista es 'sin_dato', 'fallo' o 'sin_token'".format(
                               et, estado, len(tendencias)))
        anterior = 0
        for j, t in enumerate(tendencias):
            ett = "{}.tendencias[{}]".format(et, j)
            if not isinstance(t, dict):
                errores.append("{}: debe ser objeto".format(ett))
                continue
            extra = sorted(set(t) - CLAVES_TENDENCIA)
            if extra:
                errores.append("{}: claves inesperadas {}; solo puesto, nombre, url y "
                               "volumen".format(ett, extra))
            puesto = t.get("puesto")
            if isinstance(puesto, bool) or not isinstance(puesto, int) or puesto < 1:
                errores.append("{}: 'puesto' debe ser entero positivo".format(ett))
            elif puesto <= anterior:
                errores.append("{}: 'puesto' debe crecer ({} despues de {}): X ordena y aqui "
                               "no se reordena ni se renumera".format(ett, puesto, anterior))
            else:
                anterior = puesto
            nombre = t.get("nombre")
            if not _texto(nombre):
                errores.append("{}: falta 'nombre'".format(ett))
            elif len(nombre) > 100:
                errores.append("{}: 'nombre' de {} caracteres (maximo 100)".format(ett, len(nombre)))
            elif nombre.strip().startswith("@"):
                errores.append("{}: 'nombre' es un @usuario: identidad, no tendencia; se "
                               "descarta al ingerir".format(ett))
            url = t.get("url")
            if not isinstance(url, str) or not url.startswith(PREFIJO_BUSQUEDA_X):
                errores.append("{}: url ajena a la busqueda de X ({!r}); se construye aqui "
                               "con {}".format(ett, url, PREFIJO_BUSQUEDA_X))
            if "volumen" in t:
                v = t["volumen"]
                if isinstance(v, bool) or not isinstance(v, int) or v <= 0:
                    errores.append("{}: 'volumen' solo se emite si es mayor que 0 ({!r}); "
                                   "ausente es sin dato, nunca 0".format(ett, v))
        estados[u.get("id")] = (estado, len(tendencias), activa)
    _validar_zonas_con_lista(zonas_vistas, "tendencias", errores)

    salud = datos.get("salud")
    if not isinstance(salud, list):
        errores.append("tendencias: 'salud' debe ser una lista")
    else:
        ids_salud = [s.get("ubicacion") for s in salud if isinstance(s, dict)]
        if ids_salud != sorted(ids_salud, key=str):
            errores.append("tendencias: 'salud' no esta ordenada por ubicacion")
        activas = sorted(i for i, (_, _, a) in estados.items() if a and isinstance(i, str))
        if sorted(ids_salud, key=str) != activas:
            errores.append("tendencias: salud no cuadra con ubicaciones: una fila por ubicacion "
                           "activa, ni mas ni menos")
        for s in salud:
            if not isinstance(s, dict) or not _texto(s.get("ubicacion")):
                errores.append("tendencias.salud: cada registro necesita 'ubicacion'")
                continue
            ets = "tendencias.salud[{}]".format(s["ubicacion"])
            if s.get("estado") not in ESTADOS_TENDENCIAS or s.get("estado") == "sin_lista":
                errores.append("{}: estado {!r} desconocido".format(ets, s.get("estado")))
            for campo in ("tendencias", "promocionadas"):
                if not _entero_no_negativo(s.get(campo)):
                    errores.append("{}: '{}' debe ser entero no negativo".format(ets, campo))
            for campo in ("error", "nota"):
                if campo in s and not _texto(s[campo]):
                    errores.append("{}: '{}' debe ser texto".format(ets, campo))
            e = estados.get(s["ubicacion"])
            if e and (e[0] != s.get("estado") or e[1] != s.get("tendencias")):
                errores.append("{}: salud no cuadra con ubicaciones (estado {!r} vs {!r}, "
                               "tendencias {} vs {})".format(ets, s.get("estado"), e[0],
                                                              s.get("tendencias"), e[1]))

    gasto = datos.get("gasto")
    if not isinstance(gasto, dict):
        errores.append("tendencias: 'gasto' debe ser objeto")
    else:
        for campo in ("resultados", "gastado"):
            if not _entero_no_negativo(gasto.get(campo)):
                errores.append("tendencias.gasto: '{}' debe ser entero no negativo".format(campo))
        pc = gasto.get("por_concepto")
        if not isinstance(pc, dict) or list(pc) != sorted(pc) or not all(
                _entero_no_negativo(v) for v in pc.values()):
            errores.append("tendencias.gasto: 'por_concepto' debe ser {concepto: conteo} ordenado")
    return errores, avisos


def validar_tendencias_config(datos):
    """config/tendencias.json: ubicaciones de X, una por zona, y el presupuesto
    que cubre la llamada. Un WOEID que falta o un presupuesto corto fallan
    aqui y no a media cosecha."""
    errores, avisos = [], []
    if not isinstance(datos, dict):
        return ["tendencias: se esperaba un objeto"], avisos
    if not _texto(datos.get("nota")):
        avisos.append("tendencias: falta la 'nota' que explica el archivo")
    if datos.get("plataforma") != "x":
        errores.append("tendencias: 'plataforma' debe ser 'x'")
    actor = datos.get("actor")
    if not isinstance(actor, str) or not RE_ACTOR_APIFY.match(actor):
        errores.append("tendencias: 'actor' debe ser un id de Apify usuario~actor ({!r})".format(actor))
    cosecha = datos.get("cosecha")
    maximo = presupuesto = None
    if not isinstance(cosecha, dict):
        errores.append("tendencias: falta 'cosecha'")
    else:
        maximo = cosecha.get("maximo_por_ubicacion")
        if not isinstance(maximo, int) or isinstance(maximo, bool) or not 1 <= maximo <= 50:
            errores.append("tendencias.cosecha: 'maximo_por_ubicacion' debe ser entero entre 1 "
                           "y 50 (el tope de X)")
            maximo = None
        presupuesto = cosecha.get("presupuesto_resultados")
        if not isinstance(presupuesto, int) or isinstance(presupuesto, bool) or presupuesto < 1:
            errores.append("tendencias.cosecha: 'presupuesto_resultados' debe ser entero positivo")
            presupuesto = None
    ubicaciones = datos.get("ubicaciones")
    if not isinstance(ubicaciones, list) or not ubicaciones:
        errores.append("tendencias: 'ubicaciones' debe ser una lista no vacia")
        return errores, avisos
    ids, zonas_vistas, activas = set(), {}, 0
    for i, u in enumerate(ubicaciones):
        et = "tendencias.ubicaciones[{}]".format(u.get("id", i) if isinstance(u, dict) else i)
        if not isinstance(u, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        if u.get("id") in ids:
            errores.append("{}: id repetido".format(et))
        ids.add(u.get("id"))
        if not isinstance(u.get("activo"), bool):
            errores.append("{}: 'activo' debe ser booleano".format(et))
        if not _texto(u.get("razon")):
            errores.append("{}: falta 'razon': una ubicacion se enciende con el WOEID "
                           "confirmado con --ubicaciones y se apaga con el hueco escrito".format(et))
        _validar_ubicacion_tendencias(u, et, errores, zonas_vistas, bool(u.get("activo")))
        if u.get("activo"):
            activas += 1
    _validar_zonas_con_lista(zonas_vistas, "tendencias", errores)
    if maximo and presupuesto is not None and activas and presupuesto < maximo * activas:
        errores.append("tendencias.cosecha: presupuesto_resultados {} no cubre {} ubicaciones x {} "
                       "tendencias = {}; el actor recortaria en silencio".format(
                           presupuesto, activas, maximo, maximo * activas))
    if not activas:
        avisos.append("tendencias: ninguna ubicacion activa; el panel va a salir vacio")
    # La guardia de sesion, aunque la entrada la construye pulso/tendencias.py
    # y no puede traer cookies: si algun dia la construye otro, falla aqui.
    from .apify import ActorProhibido, revisar_entrada
    from .tendencias import _entrada
    try:
        revisar_entrada(_entrada(ubicaciones, maximo or 20), actor or "?")
    except ActorProhibido as e:
        errores.append(str(e))
    return errores, avisos


def validar_indicadores(datos):
    """indicadores.json: cifras oficiales leidas, no calculadas aqui.

    La regla que de verdad manda: cada fuente tiene que traer 'aviso'. Todo
    el producto depende de que cada cifra venga rotulada con lo que NO dice
    -- el SHF es un indice rebaseado, el predial es recaudacion y no
    valuacion, el SESNSP son delitos reportados. Un indicador sin aviso es
    una cifra que se va a leer como lo que no es.
    """
    errores, avisos = [], []
    if datos.get("esquema") != ESQUEMA:
        errores.append("indicadores: 'esquema' debe ser {}".format(ESQUEMA))
    if not _es_iso(datos.get("generado")):
        errores.append("indicadores: 'generado' no es ISO-8601 ({!r})".format(datos.get("generado")))

    fuentes = datos.get("indicadores")
    if not isinstance(fuentes, dict):
        errores.append("indicadores: 'indicadores' debe ser objeto")
        return errores, avisos

    for clave, ind in sorted(fuentes.items()):
        et = "indicadores[{}]".format(clave)
        if not isinstance(ind, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        if not _texto(ind.get("fuente")):
            errores.append("{}: falta 'fuente'".format(et))
        if not _texto(ind.get("url")):
            errores.append("{}: falta 'url'".format(et))
        if not _texto(ind.get("cadencia")):
            errores.append("{}: falta 'cadencia'".format(et))
        if ind.get("familia") not in FAMILIAS:
            errores.append("{}: 'familia' invalida ({!r}); las validas son {}".format(
                et, ind.get("familia"), ", ".join(FAMILIAS)))
        if not _texto(ind.get("aviso")):
            errores.append("{}: falta 'aviso'; una cifra sin rotulo se lee "
                           "como lo que no es".format(et))
        if "obtenido" in ind and not _es_iso(ind.get("obtenido")):
            errores.append("{}: 'obtenido' no es ISO-8601 ({!r})".format(et, ind.get("obtenido")))

        if clave == "shf":
            series = ind.get("series")
            if not isinstance(series, dict) or not series:
                errores.append("{}: 'series' debe ser objeto no vacio".format(et))
            else:
                for nombre, s in sorted(series.items()):
                    ets = "{}.series[{}]".format(et, nombre)
                    if not isinstance(s, dict):
                        errores.append("{}: debe ser objeto".format(ets))
                        continue
                    if s.get("ambito") not in ("municipio", "estado", "global"):
                        errores.append("{}: 'ambito' invalido ({!r})".format(ets, s.get("ambito")))
                    if not _texto(s.get("periodo")):
                        errores.append("{}: falta 'periodo'".format(ets))
                    _validar_serie(s.get("serie"), "periodo", ("indice",),
                                   s.get("trimestres"), ets, errores, avisos)
                    if isinstance(s.get("serie"), list) and s["serie"]                             and _texto(s.get("periodo"))                             and s["serie"][-1].get("periodo") != s["periodo"]:
                        errores.append("{}: el ultimo punto de la serie ({!r}) no es "
                                       "'periodo' ({!r})".format(
                                           ets, s["serie"][-1].get("periodo"), s["periodo"]))

        elif clave == "predial":
            municipios = ind.get("municipios")
            if not isinstance(municipios, dict) or not municipios:
                errores.append("{}: 'municipios' debe ser objeto no vacio".format(et))
            else:
                for mun, m in sorted(municipios.items()):
                    etm = "{}.municipios[{}]".format(et, mun)
                    if not isinstance(m, dict):
                        errores.append("{}: debe ser objeto".format(etm))
                        continue
                    if not isinstance(m.get("ciclo"), int):
                        errores.append("{}: 'ciclo' debe ser entero".format(etm))
                    _validar_serie(m.get("serie"), "ciclo",
                                   ("por_cuenta_mxn", "cuentas_pagadas"),
                                   m.get("ciclos"), etm, errores, avisos)

        elif clave == "acs":
            zips = ind.get("zips")
            if not isinstance(zips, dict) or not zips:
                errores.append("{}: 'zips' debe ser objeto no vacio".format(et))
            else:
                for z, v in sorted(zips.items()):
                    etz = "{}.zips[{}]".format(et, z)
                    if not re.match(r"^\d{5}$", str(z)):
                        errores.append("{}: no es un ZIP de 5 digitos".format(etz))
                    if not isinstance(v, dict):
                        errores.append("{}: debe ser objeto".format(etz))
                        continue
                    if not _texto(v.get("nombre")):
                        errores.append("{}: falta 'nombre'".format(etz))
                    if not _entero_no_negativo(v.get("renta_mediana_usd")):
                        errores.append("{}: 'renta_mediana_usd' debe ser entero".format(etz))
                    _validar_serie(v.get("serie"), "anio", ("renta_mediana_usd",),
                                   v.get("anios"), etz, errores, avisos)

        elif clave == "san_diego":
            zips = ind.get("zips")
            if not isinstance(zips, dict) or not zips:
                errores.append("{}: 'zips' debe ser objeto no vacio".format(et))
            else:
                for z, v in sorted(zips.items()):
                    if not re.match(r"^\d{5}$", str(z)):
                        errores.append("{}.zips: {!r} no es un ZIP de 5 digitos".format(et, z))
                    if not isinstance(v, dict) or not _entero_no_negativo(v.get("mediana_usd"))                             or not _entero_no_negativo(v.get("parcelas")):
                        errores.append("{}.zips[{}]: falta 'mediana_usd' o 'parcelas'".format(et, z))

    return errores, avisos


# ------------------------------------------------------- gasto electoral

CATEGORIAS_GASTO = frozenset({
    "financieros", "operativos", "radio_tv", "propaganda", "impresos",
    "via_publica", "cine", "utilitaria", "internet",
})
RE_PROCESO_ELECTORAL = re.compile(r"^[a-z0-9-]{3,30}$")
AVISO_FINANCIAMIENTO = (
    "Financiamiento público asignado; no equivale a gasto ejercido ni a gasto de campaña.")


def validar_gasto_electoral_config(datos):
    """Las fuentes finales se declaran; el nombre nunca funciona como llave."""
    errores, avisos = [], []
    if not isinstance(datos, dict):
        return ["gasto-electoral: se esperaba un objeto"], avisos
    if not _texto(datos.get("nota")):
        errores.append("gasto-electoral: falta 'nota' con el limite de la cifra")
    actual = datos.get("proceso_actual")
    if not isinstance(actual, dict):
        errores.append("gasto-electoral: falta 'proceso_actual'")
    else:
        for campo in ("id", "nombre", "estado", "fuente"):
            if not _texto(actual.get(campo)):
                errores.append("gasto-electoral.proceso_actual: falta '{}'".format(campo))
        for campo in ("inicio_federal", "inicio_local", "precampana_desde",
                      "campana_desde", "campana_hasta", "eleccion"):
            if not _fecha(actual.get(campo)):
                errores.append("gasto-electoral.proceso_actual: '{}' no es fecha".format(campo))
        fechas = [_fecha(actual.get(c)) for c in
                  ("precampana_desde", "campana_desde", "campana_hasta", "eleccion")]
        if all(fechas) and fechas != sorted(fechas):
            errores.append("gasto-electoral.proceso_actual: el calendario no esta ordenado")

    procesos = datos.get("procesos")
    if not isinstance(procesos, list) or not procesos:
        errores.append("gasto-electoral: 'procesos' debe ser lista no vacia")
        procesos = []
    ids = set()
    esperadas = 0
    for i, p in enumerate(procesos):
        et = "gasto-electoral.procesos[{}]".format(i)
        if not isinstance(p, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        pid = p.get("id")
        if not isinstance(pid, str) or not RE_PROCESO_ELECTORAL.match(pid):
            errores.append("{}: id invalido ({!r})".format(et, pid))
        elif pid in ids:
            errores.append("{}: id repetido".format(et))
        ids.add(pid)
        if p.get("ambito") not in ("local", "federal"):
            errores.append("{}: ambito debe ser local o federal".format(et))
        if p.get("estado") != "auditado":
            errores.append("{}: solo se publican procesos con estado 'auditado'".format(et))
        for campo in ("nombre", "dictamen", "patron_zip", "patron_anexo"):
            if not _texto(p.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        for campo in ("dictamen_url", "reporte_candidaturas", "reporte_desglose",
                      "indice_anexos"):
            if not (isinstance(p.get(campo), str) and p[campo].startswith("https://")):
                errores.append("{}: '{}' debe ser URL https oficial".format(et, campo))
        for campo in ("eleccion", "corte"):
            if not _fecha(p.get(campo)):
                errores.append("{}: '{}' no es fecha".format(et, campo))
        n = p.get("filas_esperadas")
        if not isinstance(n, int) or isinstance(n, bool) or n < 1:
            errores.append("{}: 'filas_esperadas' debe ser entero positivo".format(et))
        else:
            esperadas += n
    if procesos and esperadas != 247:
        errores.append("gasto-electoral: se esperan 247 filas oficiales de Baja California, no {}"
                       .format(esperadas))

    f = datos.get("financiamiento")
    if not isinstance(f, dict):
        errores.append("gasto-electoral: falta 'financiamiento'")
    else:
        if not isinstance(f.get("ejercicio"), int) or f["ejercicio"] < 2024:
            errores.append("gasto-electoral.financiamiento: ejercicio invalido")
        if not _fecha(f.get("corte")):
            errores.append("gasto-electoral.financiamiento: corte invalido")
        for campo in ("ordinarias_url", "especificas_url"):
            if not (isinstance(f.get(campo), str) and f[campo].startswith("https://ieebc.mx/")):
                errores.append("gasto-electoral.financiamiento: '{}' debe ser URL del IEEBC"
                               .format(campo))
        ajuste = f.get("ajuste_pesbc")
        if not isinstance(ajuste, dict):
            errores.append("gasto-electoral.financiamiento: falta ajuste_pesbc")
        else:
            for campo in ("presupuesto_ordinario_vigente", "ministrado_enero_mayo",
                          "excedente_ministrado"):
                if not _monto(ajuste.get(campo)):
                    errores.append("gasto-electoral.ajuste_pesbc: monto '{}' invalido"
                                   .format(campo))
            if all(_monto(ajuste.get(c)) for c in
                   ("presupuesto_ordinario_vigente", "ministrado_enero_mayo",
                    "excedente_ministrado")) and not _cuadra(
                        ajuste["ministrado_enero_mayo"] -
                        ajuste["presupuesto_ordinario_vigente"],
                        ajuste["excedente_ministrado"]):
                errores.append("gasto-electoral.ajuste_pesbc: el excedente no concilia")
    return errores, avisos


def validar_gasto_electoral(datos):
    """TOTAL DE GASTOS del Anexo II es la cifra principal, nunca el CSV."""
    errores, avisos = [], []
    if not isinstance(datos, dict):
        return ["gasto-electoral: se esperaba un objeto"], avisos
    if datos.get("esquema") != ESQUEMA:
        errores.append("gasto-electoral: 'esquema' debe ser {}".format(ESQUEMA))
    if datos.get("moneda") != "MXN":
        errores.append("gasto-electoral: 'moneda' debe ser MXN")
    procesos = datos.get("procesos")
    if not isinstance(procesos, list) or not procesos:
        errores.append("gasto-electoral: 'procesos' debe ser lista no vacia")
        procesos = []
    ids_proceso = {p.get("id") for p in procesos if isinstance(p, dict)}
    for p in procesos:
        if isinstance(p, dict) and p.get("estado") != "auditado":
            errores.append("gasto-electoral.procesos[{}]: no es final auditado".format(p.get("id")))

    candidaturas = datos.get("candidaturas")
    if not isinstance(candidaturas, list):
        errores.append("gasto-electoral: 'candidaturas' debe ser lista")
        candidaturas = []
    ids = set()
    orden = []
    por_proceso = {}
    for i, c in enumerate(candidaturas):
        et = "gasto-electoral.candidaturas[{}]".format(i)
        if not isinstance(c, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        cid, pid, cuenta = c.get("id"), c.get("proceso"), c.get("id_contabilidad")
        if pid not in ids_proceso:
            errores.append("{}: proceso desconocido ({!r})".format(et, pid))
        if not isinstance(cuenta, str) or not cuenta.isdigit():
            errores.append("{}: id_contabilidad invalido".format(et))
        if cid != "{}-{}".format(pid, cuenta):
            errores.append("{}: id no deriva de proceso e id_contabilidad".format(et))
        if cid in ids:
            errores.append("{}: id repetido".format(et))
        ids.add(cid)
        por_proceso[pid] = por_proceso.get(pid, 0) + 1
        for campo in ("nombre", "cargo", "contienda_id", "contienda", "partido",
                      "sujeto_obligado", "tipo_asociacion"):
            if not _texto(c.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        if c.get("ambito") not in ("local", "federal"):
            errores.append("{}: ambito invalido".format(et))
        orden.append((fold(c.get("nombre", "")), str(cid)))
        desglose = c.get("desglose_reportado")
        if not isinstance(desglose, dict) or set(desglose) != CATEGORIAS_GASTO:
            errores.append("{}: desglose_reportado debe traer las nueve categorias".format(et))
            desglose = {}
        for nombre, monto in desglose.items():
            if not _monto(monto, permite_nulo=True):
                errores.append("{}.desglose_reportado[{}]: monto invalido".format(et, nombre))
        for campo in ("gasto_reportado", "gasto_auditado"):
            if not _monto(c.get(campo)):
                errores.append("{}: '{}' debe ser monto no negativo".format(et, campo))
        if not _monto(c.get("tope"), permite_nulo=True):
            errores.append("{}: 'tope' debe ser monto o null".format(et))
        if c.get("tope") == 0:
            errores.append("{}: un tope ausente es null, nunca cero".format(et))
        auditoria = c.get("auditoria")
        if not isinstance(auditoria, dict):
            errores.append("{}: falta auditoria".format(et))
            auditoria = {}
        for campo in ("no_reportado", "quejas"):
            if not _monto(auditoria.get(campo), permite_nulo=True):
                errores.append("{}.auditoria: '{}' debe ser monto o null".format(et, campo))
        if auditoria.get("ajustes_reclasificaciones") is not None \
                and not _numero(auditoria.get("ajustes_reclasificaciones")):
            errores.append("{}.auditoria: 'ajustes_reclasificaciones' debe ser numero o null"
                           .format(et))
        if not _numero(auditoria.get("determinado")):
            errores.append("{}.auditoria: 'determinado' debe ser numero".format(et))
        componentes = [auditoria.get(campo) for campo in
                       ("no_reportado", "ajustes_reclasificaciones", "quejas")]
        # El PT federal publica gasto no reportado pero deja en blanco las
        # otras dos columnas y determina cero. Solo una fila completa puede
        # sostener la suma; el puente final se exige siempre debajo.
        if all(monto is not None for monto in componentes) and not _cuadra(
                sum(componentes), auditoria["determinado"]):
            errores.append("{}: hallazgos y ajustes no concilian con 'determinado'".format(et))
        if _monto(c.get("gasto_reportado")) and _numero(auditoria.get("determinado")) \
                and _monto(c.get("gasto_auditado")) and not _cuadra(
                    c["gasto_reportado"] + auditoria["determinado"], c["gasto_auditado"]):
            errores.append("{}: reportado + determinado no coincide con gasto_auditado".format(et))
        conocidos = [m for m in desglose.values() if _monto(m)]
        diferencia = c.get("diferencia_prorrateo")
        if not _monto(diferencia, permite_nulo=True):
            errores.append("{}: diferencia_prorrateo debe ser monto o null".format(et))
        if len(conocidos) == len(CATEGORIAS_GASTO) and _monto(c.get("gasto_reportado")):
            if not _cuadra(sum(conocidos) + (diferencia or 0), c["gasto_reportado"], 0.05):
                errores.append("{}: categorias + prorrateo no concilian con gasto_reportado"
                               .format(et))
    if orden != sorted(orden):
        errores.append("gasto-electoral: candidaturas no estan ordenadas por nombre e id")

    incidencias = datos.get("incidencias")
    if not isinstance(incidencias, list):
        errores.append("gasto-electoral: 'incidencias' debe ser lista")
        incidencias = []
    llaves_incidencia = set()
    orden_inc = []
    for i, x in enumerate(incidencias):
        et = "gasto-electoral.incidencias[{}]".format(i)
        if not isinstance(x, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        if x.get("proceso") not in ids_proceso or not _texto(x.get("id_contabilidad")) \
                or not _texto(x.get("razon")):
            errores.append("{}: proceso, id_contabilidad y razon son obligatorios".format(et))
        llave = (x.get("proceso"), x.get("id_contabilidad"))
        if llave in llaves_incidencia:
            errores.append("{}: candidatura repetida en incidencias".format(et))
        llaves_incidencia.add(llave)
        if "{}-{}".format(*llave) in ids:
            errores.append("{}: una candidatura conciliada no puede ser incidencia".format(et))
        try:
            numero = int(x.get("id_contabilidad", ""))
        except (TypeError, ValueError):
            numero = -1
        orden_inc.append((str(x.get("proceso")), numero, str(x.get("razon"))))
    if orden_inc != sorted(orden_inc):
        errores.append("gasto-electoral: incidencias no estan ordenadas")

    resumen = datos.get("resumen")
    if not isinstance(resumen, dict):
        errores.append("gasto-electoral: falta resumen")
    else:
        if resumen.get("candidaturas") != len(candidaturas) \
                or resumen.get("incidencias") != len(incidencias):
            errores.append("gasto-electoral: resumen no coincide con las listas")
        if resumen.get("sin_conciliar") != resumen.get("filas_origen", 0) - len(candidaturas):
            errores.append("gasto-electoral: toda fila debe conciliar o traer incidencia")
        if isinstance(resumen.get("sin_conciliar"), int) \
                and resumen["sin_conciliar"] > len(incidencias):
            errores.append("gasto-electoral: hay filas sin conciliar y sin incidencia")
        if resumen.get("filas_origen") != 247:
            errores.append("gasto-electoral: filas_origen debe ser 247")
    fuentes = datos.get("fuentes")
    if not isinstance(fuentes, list) or not fuentes:
        errores.append("gasto-electoral: fuentes debe ser lista no vacia")
    elif fuentes != sorted(fuentes, key=lambda x: (
            x.get("tipo", ""), x.get("ambito", ""), x.get("url", ""), x.get("archivo", ""))):
        errores.append("gasto-electoral: fuentes no estan en orden determinista")
    return errores, avisos


def validar_financiamiento_partidos(datos):
    """Una asignacion a un partido no es gasto ejercido ni gasto personal."""
    errores, avisos = [], []
    if not isinstance(datos, dict):
        return ["financiamiento-partidos: se esperaba un objeto"], avisos
    if datos.get("esquema") != ESQUEMA or datos.get("moneda") != "MXN":
        errores.append("financiamiento-partidos: esquema o moneda invalidos")
    if not isinstance(datos.get("ejercicio"), int) or not _fecha(datos.get("corte")):
        errores.append("financiamiento-partidos: ejercicio o corte invalidos")
    if datos.get("aviso") != AVISO_FINANCIAMIENTO:
        errores.append("financiamiento-partidos: el aviso no puede suavizarse")
    partidos = datos.get("partidos")
    if not isinstance(partidos, list) or not partidos:
        errores.append("financiamiento-partidos: 'partidos' debe ser lista no vacia")
        partidos = []
    ids = []
    for i, p in enumerate(partidos):
        et = "financiamiento-partidos.partidos[{}]".format(i)
        if not isinstance(p, dict):
            errores.append("{}: debe ser objeto".format(et))
            continue
        ids.append(p.get("id"))
        for campo in ("id", "nombre"):
            if not _texto(p.get(campo)):
                errores.append("{}: falta '{}'".format(et, campo))
        for campo in ("ordinario_original", "ordinario_vigente", "especifico", "total_asignado"):
            if not _monto(p.get(campo)):
                errores.append("{}: monto '{}' invalido".format(et, campo))
        if _monto(p.get("ordinario_vigente")) and _monto(p.get("especifico")) \
                and not _cuadra(p["ordinario_vigente"] + p["especifico"],
                                p.get("total_asignado")):
            errores.append("{}: total_asignado no concilia".format(et))
        if "ministrado_enero_mayo" in p:
            for campo in ("ministrado_enero_mayo", "excedente_ministrado"):
                if not _monto(p.get(campo)):
                    errores.append("{}: monto '{}' invalido".format(et, campo))
            if _monto(p.get("ministrado_enero_mayo")) and _monto(p.get("ordinario_vigente")) \
                    and not _cuadra(p["ministrado_enero_mayo"] - p["ordinario_vigente"],
                                    p.get("excedente_ministrado")):
                errores.append("{}: excedente ministrado no concilia".format(et))
    if ids != sorted(ids, key=str) or len(ids) != len(set(ids)):
        errores.append("financiamiento-partidos: ids repetidos o fuera de orden")
    totales = datos.get("totales")
    if not isinstance(totales, dict):
        errores.append("financiamiento-partidos: falta totales")
    else:
        esperados = {
            "ordinario_vigente": sum(p.get("ordinario_vigente", 0) for p in partidos
                                      if isinstance(p, dict)),
            "especifico": sum(p.get("especifico", 0) for p in partidos if isinstance(p, dict)),
            "asignado": sum(p.get("total_asignado", 0) for p in partidos if isinstance(p, dict)),
        }
        for campo, esperado in esperados.items():
            if not _cuadra(totales.get(campo), esperado):
                errores.append("financiamiento-partidos.totales: '{}' no concilia".format(campo))
    acuerdos = datos.get("acuerdos")
    if not isinstance(acuerdos, list) or not acuerdos:
        errores.append("financiamiento-partidos: acuerdos debe ser lista no vacia")
    fuentes = datos.get("fuentes")
    if not isinstance(fuentes, list) or fuentes != sorted(set(fuentes)):
        errores.append("financiamiento-partidos: fuentes debe ser lista unica y ordenada")
    return errores, avisos


# ----------------------------------------------------------------- estado

def validar_estado(datos):
    errores, avisos = [], []
    if datos.get("esquema") != ESQUEMA:
        errores.append("estado: 'esquema' debe ser {}".format(ESQUEMA))
    if datos.get("pulso_version") != VERSION:
        errores.append(
            "estado: 'pulso_version' ({!r}) no coincide con el paquete ({}); "
            "vuelve a correr el pipeline".format(datos.get("pulso_version"), VERSION)
        )
    if not _es_iso(datos.get("generado")):
        errores.append("estado: 'generado' no es ISO-8601 ({!r})".format(datos.get("generado")))
    if datos.get("modo") not in ("red", "corpus"):
        errores.append("estado: 'modo' debe ser 'red' o 'corpus' ({!r})".format(datos.get("modo")))
    if datos.get("metodo_postura") not in METODOS:
        errores.append("estado: 'metodo_postura' invalido ({!r})".format(datos.get("metodo_postura")))
    for campo in ("fuentes_ok", "fuentes_fallo", "notas_total", "notas_nuevas",
                  "roster_figuras", "roster_vigentes"):
        if not isinstance(datos.get(campo), int) or datos[campo] < 0:
            errores.append("estado: '{}' debe ser entero no negativo".format(campo))
    if datos.get("modo") == "corpus" and datos.get("fuentes_ok"):
        avisos.append("estado: modo 'corpus' con fuentes_ok > 0; revisa el pipeline")
    return errores, avisos


# ------------------------------------------------------------------- todo

# La linea que mantiene el texto de los comentarios fuera de git. Se compara
# como cadena exacta contra .gitignore: no se interpreta el archivo ni se
# invoca a git, porque esto tiene que correr igual sin repositorio (CI valida
# una salida en $RUNNER_TEMP) y porque una regla mas floja aceptaria un patron
# que no cubre lo que dice cubrir.
REGLA_GITIGNORE = "data/*-comentarios.json"


def _regla_gitignore(dir_datos):
    """Error si hay texto de comentarios y .gitignore no lo excluye.

    POR QUE ES ERROR Y NO AVISO: el cron hace `git add data/` cada seis horas.
    Si esa linea falta, el texto entra a git y ya no se puede sacar -- vive en
    cada clon y en cada commit anterior, que es justo lo que la retencion de 30
    dias (YouTube III.E.4.d, LFPDPPP, CPRA) prohibe. Un aviso se lee despues
    del commit; esto tiene que fallar antes.

    Mientras el texto vivio en efimero/ (hasta el 17 de septiembre de 2026) la
    carpeta entera estaba ignorada y esta comprobacion no hacia falta. Al pasar
    a data/, lo unico que lo separa de git es una linea de .gitignore, asi que
    la linea se verifica en vez de confiarse.
    """
    raiz = os.path.dirname(os.path.normpath(dir_datos)) or "."
    ruta = os.path.join(raiz, ".gitignore")
    if not os.path.exists(ruta):
        # Sin repositorio no hay nada que proteger: es el caso de CI validando
        # una salida en un temporal.
        return []
    try:
        with open(ruta, encoding="utf-8") as fh:
            lineas = [l.strip() for l in fh]
    except OSError as ex:
        return ["gitignore: no se pudo leer {} ({})".format(ruta, ex)]
    if REGLA_GITIGNORE in lineas:
        return []
    return ["gitignore: hay texto de comentarios en {} y {} no trae la linea '{}'; "
            "sin ella el próximo `git add data/` lo mete a git para siempre".format(
                dir_datos, ruta, REGLA_GITIGNORE)]


def validar_todo(dir_config="config", dir_datos="data", hoy=None):
    """Valida todo lo que exista. data/ ausente es aviso, no error.

    El texto de comentarios publicado vive en data/ como el resto de la
    corrida, pero fuera de git: se valida si esta, contra el redes.json del
    mismo corte. Hasta el 17 de septiembre de 2026 vivia en efimero/, y ese
    directorio hermano habia que derivarlo de dir_datos para que
    `validar --datos $RUNNER_TEMP/data` no emparejara el ./efimero del repo
    contra un data/ ajeno. Al estar los dos archivos dentro de dir_datos, esa
    clase de error deja de existir.
    """
    errores, avisos = [], []

    ruta_roster = os.path.join(dir_config, "roster.json")
    ruta_medios = os.path.join(dir_config, "medios.json")
    roster_datos = medios_datos = None

    for ruta, nombre in ((ruta_roster, "roster"), (ruta_medios, "medios")):
        if not os.path.exists(ruta):
            errores.append("{}: no existe {}".format(nombre, ruta))
    if errores:
        return errores, avisos

    try:
        roster_datos = _leer(ruta_roster)
    except (ValueError, OSError) as e:
        errores.append("roster: no se pudo leer {} ({})".format(ruta_roster, e))
    try:
        medios_datos = _leer(ruta_medios)
    except (ValueError, OSError) as e:
        errores.append("medios: no se pudo leer {} ({})".format(ruta_medios, e))
    if errores:
        return errores, avisos

    e, a = validar_roster(roster_datos, hoy=hoy)
    errores += e
    avisos += a
    e, a = validar_medios(medios_datos)
    errores += e
    avisos += a
    if errores:
        return errores, avisos

    from .roster import Roster
    roster = Roster(roster_datos["figuras"], roster_datos.get("verificado"))
    medios = medios_datos["medios"]

    # config/busquedas.json es opcional: un checkout sin el archivo valida
    # igual que antes de que existiera.
    ruta_busquedas = os.path.join(dir_config, "busquedas.json")
    busquedas = []
    if os.path.exists(ruta_busquedas):
        try:
            busquedas_datos = _leer(ruta_busquedas)
        except (ValueError, OSError) as e:
            errores.append("busquedas: no se pudo leer {} ({})".format(ruta_busquedas, e))
            return errores, avisos
        e, a = validar_busquedas(busquedas_datos, medios)
        errores += e
        avisos += a
        if errores:
            return errores, avisos
        busquedas = busquedas_datos.get("busquedas") or []

    # config/tiktok.json es opcional (la seccion se puede no encender), pero si
    # esta, se valida como los demas configs: una busqueda con zona o un
    # filtro de fecha inventado fallan aqui y no a media cosecha.
    ruta_tiktok = os.path.join(dir_config, "tiktok.json")
    if os.path.exists(ruta_tiktok):
        try:
            e, a = validar_tiktok_config(_leer(ruta_tiktok))
            errores += e
            avisos += a
        except (ValueError, OSError) as e:
            errores.append("tiktok: no se pudo leer {} ({})".format(ruta_tiktok, e))
        if errores:
            return errores, avisos

    # config/youtube.json es opcional igual que el de TikTok, y se valida por
    # las mismas razones: una fila con zona o un canal sin id UC fallan aqui y
    # no a media cosecha.
    ruta_youtube = os.path.join(dir_config, "youtube.json")
    if os.path.exists(ruta_youtube):
        try:
            e, a = validar_youtube_config(_leer(ruta_youtube))
            errores += e
            avisos += a
        except (ValueError, OSError) as e:
            errores.append("youtube: no se pudo leer {} ({})".format(ruta_youtube, e))
        if errores:
            return errores, avisos

    # config/tendencias.json es opcional, como el de TikTok. Si esta, se valida
    # aqui: una zona sin fila, un WOEID que falta o un presupuesto que no cubre
    # la llamada fallan antes de gastar.
    ruta_tendencias = os.path.join(dir_config, "tendencias.json")
    if os.path.exists(ruta_tendencias):
        try:
            e, a = validar_tendencias_config(_leer(ruta_tendencias))
            errores += e
            avisos += a
        except (ValueError, OSError) as e:
            errores.append("tendencias: no se pudo leer {} ({})".format(ruta_tendencias, e))
        if errores:
            return errores, avisos

    # El contrato electoral se valida aunque sus archivos historicos todavia
    # no se hayan materializado. Asi una URL provisional o un proceso no
    # auditado fallan antes de que el cron publique una cifra.
    ruta_gasto = os.path.join(dir_config, "gasto-electoral.json")
    if os.path.exists(ruta_gasto):
        try:
            e, a = validar_gasto_electoral_config(_leer(ruta_gasto))
            errores += e
            avisos += a
        except (ValueError, OSError) as e:
            errores.append("gasto-electoral: no se pudo leer {} ({})".format(ruta_gasto, e))
        if errores:
            return errores, avisos

    ruta_comunicados = os.path.join(dir_config, "comunicados.json")
    if os.path.exists(ruta_comunicados):
        from .comunicados import leer_fuente
        try:
            leer_fuente(ruta_comunicados)
        except (ValueError, OSError, KeyError, TypeError) as exc:
            errores.append("comunicados: configuracion invalida ({})".format(exc))

    archivos = {
        "notas": (os.path.join(dir_datos, "notas.json"),
                  lambda d: validar_notas(d, roster, medios, busquedas)),
        "fuentes": (os.path.join(dir_datos, "fuentes.json"),
                    lambda d: validar_fuentes(d, medios, busquedas)),
        "temas": (os.path.join(dir_datos, "temas.json"), validar_temas),
        "estado": (os.path.join(dir_datos, "estado.json"), validar_estado),
    }
    # conversacion.json e indicadores.json los escriben otros comandos y no
    # siempre estan: conversacion pide llave de YouTube, indicadores se salta
    # solo si lo que hay tiene menos de una semana. Se validan si estan, y no
    # es error que falten.
    opcionales = {
        "comunicados": (os.path.join(dir_datos, "comunicados.json"), validar_comunicados),
        "conversacion": (os.path.join(dir_datos, "conversacion.json"), validar_conversacion),
        "indicadores": (os.path.join(dir_datos, "indicadores.json"), validar_indicadores),
        # redes.json lo escribe `pulso redes` y pide APIFY_TOKEN mas al menos
        # una cuenta verificada en config/instagram.json. Igual que
        # conversacion, no es error que falte.
        "redes": (os.path.join(dir_datos, "redes.json"), validar_redes),
        # tiktok.json lo escribe `pulso tiktok`; mismo contrato que redes.json
        # con la ventana en horas y el creador visible. Tampoco es error que falte.
        "tiktok": (os.path.join(dir_datos, "tiktok.json"),
                   lambda d: validar_redes(d, plataforma="tiktok")),
        # youtube.json lo escribe `pulso youtube`: Shorts y videos largos de
        # los canales de config/youtube.json, leidos por feed publico. Mismo
        # contrato que redes.json pero sin comentarios, y por eso sale con
        # `cosecha_comentarios: false`. Tampoco es error que falte.
        "youtube": (os.path.join(dir_datos, "youtube.json"),
                    lambda d: validar_redes(d, plataforma="youtube")),
        # tendencias.json lo escribe `pulso tendencias`: el ranking de X por
        # ubicacion, sin tuits ni identidad. Tampoco es error que falte.
        "tendencias": (os.path.join(dir_datos, "tendencias.json"), validar_tendencias),
        # Los dictamenes 2024 no cambian y la asignacion 2026 solo se revisa
        # semanalmente. Ausentes no significan cero y por eso son opcionales.
        "gasto-electoral": (os.path.join(dir_datos, "gasto-electoral.json"),
                            validar_gasto_electoral),
        "financiamiento-partidos": (
            os.path.join(dir_datos, "financiamiento-partidos.json"),
            validar_financiamiento_partidos),
    }
    presentes = [n for n, (ruta, _) in archivos.items() if os.path.exists(ruta)]
    if not presentes:
        avisos.append(
            "datos: {} esta vacio; corre `python -m pulso correr --sin-red`".format(dir_datos)
        )
    ventana = None
    for nombre, (ruta, fn) in archivos.items():
        if nombre not in presentes:
            if presentes:
                errores.append("{}: no existe {} pero si los demas de data/".format(nombre, ruta))
            continue
        try:
            datos = _leer(ruta)
        except (ValueError, OSError) as ex:
            errores.append("{}: no se pudo leer {} ({})".format(nombre, ruta, ex))
            continue
        if nombre == "notas":
            ventana = datos
        e, a = fn(datos)
        errores += e
        avisos += a

    leidos = {}
    for nombre, (ruta, fn) in opcionales.items():
        if not os.path.exists(ruta):
            continue
        try:
            datos = _leer(ruta)
        except (ValueError, OSError) as ex:
            errores.append("{}: no se pudo leer {} ({})".format(nombre, ruta, ex))
            continue
        leidos[nombre] = datos
        e, a = fn(datos)
        errores += e
        avisos += a

    # El texto publicado vive en data/ pero fuera de git. Si esta, tiene que
    # corresponder al archivo de conteos de este corte; solo, es huerfano. Y
    # que no este en git no puede quedar en un comentario: ver _regla_gitignore.
    hay_texto = False
    for archivo_texto, nombre, plataforma in (
            ("redes-comentarios.json", "redes", "instagram"),
            ("tiktok-comentarios.json", "tiktok", "tiktok")):
        ruta_texto = os.path.join(dir_datos, archivo_texto)
        if not os.path.exists(ruta_texto):
            continue
        hay_texto = True
        if nombre not in leidos:
            errores.append("{}: existe {} sin {}.json en {}".format(
                archivo_texto[:-5], ruta_texto, nombre, dir_datos))
            continue
        try:
            e, a = validar_redes_comentarios(_leer(ruta_texto), leidos[nombre], plataforma)
            errores += e
            avisos += a
        except (ValueError, OSError) as ex:
            errores.append("{}: no se pudo leer {} ({})".format(
                archivo_texto[:-5], ruta_texto, ex))

    if hay_texto:
        errores += _regla_gitignore(dir_datos)

    if ventana is not None:
        e, a = validar_archivo(dir_datos, ventana, roster, medios, hoy=hoy,
                               busquedas=busquedas)
        errores += e
        avisos += a
    return errores, avisos


def validar_comunicados(datos):
    """Tecate publica boletines oficiales: no son notas de prensa ni opinion."""
    errores = []
    if not isinstance(datos, dict):
        return ["comunicados: se esperaba un objeto"], []
    claves = {"esquema", "fuente", "zona", "modo", "consultado", "ultimo_exito", "estado", "error", "comunicados"}
    if set(datos) != claves:
        errores.append("comunicados: claves inesperadas o incompletas")
    if datos.get("esquema") != 1 or datos.get("zona") != "Tecate":
        errores.append("comunicados: esquema o zona invalidos")
    if datos.get("fuente") != {"id": "gobtecate", "nombre": "Gobierno de Tecate", "url": "https://tecate.gob.mx/"}:
        errores.append("comunicados: fuente oficial invalida")
    if datos.get("modo") not in ("red", "sin_red") or datos.get("estado") not in ("ok", "fallo"):
        errores.append("comunicados: modo o estado invalido")
    if not _es_iso(datos.get("consultado")):
        errores.append("comunicados: consultado invalido")
    ultimo = datos.get("ultimo_exito")
    if ultimo is not None and not _es_iso(ultimo):
        errores.append("comunicados: ultimo_exito invalido")
    if datos.get("estado") == "ok" and (ultimo != datos.get("consultado") or datos.get("error") is not None):
        errores.append("comunicados: exito sin fecha o con error")
    if datos.get("estado") == "fallo" and not _texto(datos.get("error")):
        errores.append("comunicados: fallo sin motivo")
    filas = datos.get("comunicados")
    if not isinstance(filas, list):
        return errores + ["comunicados: listado invalido"], []
    if datos.get("estado") == "ok" and not filas:
        errores.append("comunicados: exito sin titulares")
    if filas and ultimo is None:
        errores.append("comunicados: titulares sin ultimo_exito")
    vistos = set()
    orden = []
    for fila in filas:
        if not isinstance(fila, dict) or set(fila) != {"id", "titulo", "url", "fecha"}:
            errores.append("comunicados: solo id, titulo, url y fecha por titular")
            continue
        url, titulo, fecha = fila["url"], fila["titulo"], fila["fecha"]
        if not isinstance(url, str) or not re.fullmatch(r"https://tecate\.gob\.mx/noticias/[0-9]+", url):
            errores.append("comunicados: enlace ajeno a noticias municipales")
            continue
        if not _texto(titulo) or fila["id"] != id_nota("gobtecate", titulo):
            errores.append("comunicados: titulo o identidad invalida")
        if url in vistos:
            errores.append("comunicados: URL duplicada")
        vistos.add(url)
        if fecha is not None and _fecha(fecha) is None:
            errores.append("comunicados: fecha invalida")
        else:
            orden.append((-_fecha(fecha).toordinal() if fecha else 0, url))
    if orden != sorted(orden):
        errores.append("comunicados: fechas descendentes y URL ascendente requeridas")
    return errores, []


def resumen(dir_config="config", dir_datos="data"):
    """Linea de conteos para el final de una validacion exitosa."""
    partes = []
    try:
        r = _leer(os.path.join(dir_config, "roster.json"))
        from .roster import Roster
        ros = Roster(r["figuras"], r.get("verificado"))
        partes.append("roster {} figuras ({} vigentes)".format(
            len(ros.figuras), len(ros.vigentes(date.today()))
        ))
    except Exception:
        pass
    try:
        m = _leer(os.path.join(dir_config, "medios.json"))
        activos = sum(1 for x in m["medios"] if x.get("activo"))
        partes.append("medios {} ({} activos)".format(len(m["medios"]), activos))
    except Exception:
        pass
    try:
        n = _leer(os.path.join(dir_datos, "notas.json"))
        con_figura = sum(1 for x in n["notas"] if x.get("figuras"))
        partes.append("ventana {} notas de {} dias ({} con figura)".format(
            n["total"], n.get("ventana_dias", "?"), con_figura))
    except Exception:
        pass
    try:
        from .archivo import ruta_indice
        i = _leer(ruta_indice(dir_datos))
        partes.append("archivo {} notas en {} meses".format(i["total"], len(i["meses"])))
    except Exception:
        pass
    return " · ".join(partes)
