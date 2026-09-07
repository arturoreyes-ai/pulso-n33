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
from .normalizar import fold, id_nota
from .sentimiento import IDIOMA_OMISION, IDIOMAS

RE_ID = re.compile(r"^[a-z0-9_]{2,12}$")
RE_WEB_SOURCE = re.compile(r"^web-[a-f0-9]{12}$")
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

    if not any(m.get("activo") for m in medios if isinstance(m.get("id"), str)):
        avisos.append("medios: ningun medio activo; la ingesta no traeria nada")
    return errores, avisos


# ------------------------------------------------------------------ notas

def validar_notas(datos, roster=None, medios=None):
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
    zonas_medios = {m["id"]: m.get("zona") for m in (medios or [])}
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
        fuente_web = isinstance(fuente, str) and bool(RE_WEB_SOURCE.match(fuente))
        if ids_medios and fuente not in ids_medios and not (es_descubrimiento and fuente_web):
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
    return errores, avisos


# ---------------------------------------------------------------- archivo

def validar_archivo(dir_datos, ventana, roster=None, medios=None, hoy=None):
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

def validar_fuentes(datos, medios=None):
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
        if s.get("metodo", "rss") not in ("rss", "scrapy", "descubrimiento"):
            errores.append("{}: 'metodo' debe ser 'rss', 'scrapy' o 'descubrimiento'".format(et))
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

    activos = {m["id"] for m in (medios or []) if m.get("activo")}
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

FAMILIAS = ("vivienda", "suelo", "crimen", "percepcion")


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

def validar_todo(dir_config="config", dir_datos="data", hoy=None):
    """Valida todo lo que exista. data/ ausente es aviso, no error."""
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

    archivos = {
        "notas": (os.path.join(dir_datos, "notas.json"), lambda d: validar_notas(d, roster, medios)),
        "fuentes": (os.path.join(dir_datos, "fuentes.json"), lambda d: validar_fuentes(d, medios)),
        "temas": (os.path.join(dir_datos, "temas.json"), validar_temas),
        "estado": (os.path.join(dir_datos, "estado.json"), validar_estado),
    }
    # conversacion.json e indicadores.json los escriben otros comandos y no
    # siempre estan: conversacion pide llave de YouTube, indicadores se salta
    # solo si lo que hay tiene menos de una semana. Se validan si estan, y no
    # es error que falten.
    opcionales = {
        "conversacion": (os.path.join(dir_datos, "conversacion.json"), validar_conversacion),
        "indicadores": (os.path.join(dir_datos, "indicadores.json"), validar_indicadores),
    }
    presentes = [n for n, (ruta, _) in archivos.items() if os.path.exists(ruta)]
    if not presentes:
        avisos.append(
            "datos: {} esta vacio; corre `python -m pulso correr --sin-red`".format(dir_datos)
        )
        return errores, avisos
    ventana = None
    for nombre, (ruta, fn) in archivos.items():
        if nombre not in presentes:
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

    for nombre, (ruta, fn) in opcionales.items():
        if not os.path.exists(ruta):
            continue
        try:
            datos = _leer(ruta)
        except (ValueError, OSError) as ex:
            errores.append("{}: no se pudo leer {} ({})".format(nombre, ruta, ex))
            continue
        e, a = fn(datos)
        errores += e
        avisos += a

    if ventana is not None:
        e, a = validar_archivo(dir_datos, ventana, roster, medios, hoy=hoy)
        errores += e
        avisos += a
    return errores, avisos


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
