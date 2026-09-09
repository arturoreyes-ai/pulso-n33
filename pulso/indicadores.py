"""Indicadores oficiales: precios de vivienda, suelo, crimen y percepcion.

Todo con la biblioteca estandar. Los XLSX se leen abriendolos como lo que son,
un zip de XML, en vez de meter openpyxl.

Cadencia real de cada fuente, que es lenta a proposito: SHF trimestral, ENSU
trimestral, SESNSP mensual, predial anual. Por eso este paso NO va en el cron
horario de la prensa; se corre aparte y se salta solo si lo que hay todavia
esta fresco.

## Las trampas de cada fuente, verificadas una por una

**Falsos 404 con HTTP 200.** INEGI devuelve una pagina de 'Pagina no
encontrada' en text/html, con codigo 200, para cualquier ruta mala. gob.mx
devuelve un reto de Akamai de ~1.8 KB, tambien con 200. Nunca se confia en el
codigo: se revisa el Content-Type y la firma de los primeros bytes.

**El User-Agent al reves de lo esperado.** La pagina del SESNSP se baja bien
con el urllib de siempre, y un User-Agent de navegador dispara el reto de
Akamai. O sea que disfrazarse rompe en vez de arreglar.

**Encabezados que faltan, no que sobran.** repodatos.atdt.gob.mx responde 403
a urllib pelado, y lo que le falta es `Accept`, no el User-Agent.

**Encoding partido en el mismo dataset.** El SESNSP 2026 es UTF-8 y el
historico 2015-2025 es Windows-1252. Un solo codec para los dos mancha datos
en silencio.

**Nombres de municipio con comas.** Hay municipios como 'Heroica Villa
Tezoatlan de Segura y Luna, Cuna de la Independencia de Oaxaca'. Partir por
coma inventa registros; se usa csv.reader siempre.

**La clave de entidad cambia de forma.** Baja California es '02' en el
archivo 2026 y '2' en el historico.
"""

import csv
import io
import json
import os
import re
import time
import zipfile
from datetime import date, datetime
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from . import VERSION

AGENTE = "PulsoN33/{}".format(VERSION)
NS_SS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Municipios de Baja California en el SESNSP, con su clave INEGI.
BC_MUNICIPIOS = {
    "2001": "Ensenada",
    "2002": "Mexicali",
    "2003": "Tecate",
    "2004": "Tijuana",
    "2005": "Playas de Rosarito",
    "2006": "San Quintín",
    "2007": "San Felipe",
}

# Delitos que le importan al producto. El archivo trae 47 tipos y sumarlos
# todos mezcla homicidio con 'otros delitos del fuero comun'.
DELITOS_CLAVE = (
    "Homicidio",
    "Feminicidio",
    "Robo",
    "Lesiones",
    "Extorsión",
    "Narcomenudeo",
    "Violencia familiar",
    "Secuestro",
)

MESES = ("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")


class NoEsDato(Exception):
    """Respondio 200 pero con una pagina, no con el archivo.

    Es el fallo mas comun de estas fuentes y el que mas caro sale si pasa
    desapercibido: un ZIP que en realidad es HTML revienta mas adelante, lejos
    de la causa.
    """


def _bajar(url, timeout=180, accept="*/*", agente=AGENTE):
    """Baja bytes y verifica que sean datos y no una pagina de error.

    `agente=None` manda el User-Agent de urllib, que es lo que hay que hacer
    con gob.mx: un UA de navegador dispara el reto de Akamai.
    """
    cab = {}
    if accept:
        cab["Accept"] = accept          # repodatos 403 sin esto
    if agente:
        cab["User-Agent"] = agente
    with urlopen(Request(url, headers=cab), timeout=timeout) as r:
        crudo = r.read()
        tipo = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()

    cabeza = crudo[:512].lstrip().lower()
    parece_html = (tipo == "text/html" or cabeza.startswith(b"<!doctype html")
                   or cabeza.startswith(b"<html"))
    if parece_html:
        pista = ""
        if b"challenge" in cabeza or b"akamai" in cabeza:
            pista = " (reto de Akamai)"
        elif b"no encontrada" in crudo[:4000].lower():
            pista = " (pagina de 'no encontrada' servida con 200)"
        elif b"login" in cabeza:
            pista = " (redireccion a inicio de sesion)"
        raise NoEsDato("{} devolvio HTML, no datos{}; {} bytes".format(
            url.split("?")[0], pista, len(crudo)))
    if len(crudo) < 1024:
        raise NoEsDato("{} devolvio solo {} bytes".format(url.split("?")[0], len(crudo)))
    return crudo


def _csv_de_zip(crudo, patron):
    """Saca el primer CSV del zip cuyo nombre empate el patron."""
    z = zipfile.ZipFile(io.BytesIO(crudo))
    for nombre in z.namelist():
        if re.search(patron, os.path.basename(nombre), re.I):
            return z.read(nombre), nombre
    raise NoEsDato("el zip no trae ningun archivo que empate {!r}; trae: {}".format(
        patron, ", ".join(z.namelist()[:8])))


def _filas(crudo, encoding):
    """csv.reader sobre bytes. NUNCA split(','): hay municipios con comas."""
    texto = crudo.decode(encoding, "replace")
    return csv.reader(io.StringIO(texto, newline=""))


def _num(v):
    try:
        return float(str(v).strip() or 0)
    except ValueError:
        return 0.0


# --------------------------------------------------------------- XLSX

def _xlsx_hoja(crudo, indice=0):
    """Filas de una hoja de XLSX, sin openpyxl.

    Un XLSX es un zip de XML: xl/sharedStrings.xml tiene el texto y
    xl/worksheets/sheetN.xml las celdas, que apuntan al texto por indice
    cuando t="s".
    """
    z = zipfile.ZipFile(io.BytesIO(crudo))

    compartidas = []
    if "xl/sharedStrings.xml" in z.namelist():
        raiz = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
        for si in raiz.findall(NS_SS + "si"):
            compartidas.append("".join(t.text or "" for t in si.iter(NS_SS + "t")))

    hojas = sorted(n for n in z.namelist()
                   if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
    if not hojas:
        raise NoEsDato("el xlsx no trae hojas")
    raiz = ElementTree.fromstring(z.read(hojas[indice]))

    salida = []
    for fila in raiz.iter(NS_SS + "row"):
        celdas = []
        for c in fila.findall(NS_SS + "c"):
            # Hay que respetar la referencia de celda ('C5'). Un XLSX OMITE
            # las celdas vacias, asi que leer en orden de documento corre los
            # valores a la izquierda. En el archivo del SHF las columnas
            # Global / Estado / Municipio son mutuamente excluyentes, o sea
            # que casi todas las filas traen huecos: sin esto, el estado
            # aterriza en la columna del agregado global y no empata nada.
            i = _columna(c.get("r"))
            if i is None:
                i = len(celdas)
            while len(celdas) <= i:
                celdas.append("")

            t = c.get("t")
            if t == "s":
                v = c.find(NS_SS + "v")
                idx = int(v.text) if v is not None and v.text else -1
                celdas[i] = compartidas[idx] if 0 <= idx < len(compartidas) else ""
            elif t == "inlineStr":
                celdas[i] = "".join(x.text or "" for x in c.iter(NS_SS + "t"))
            else:
                v = c.find(NS_SS + "v")
                celdas[i] = v.text if v is not None and v.text else ""
        salida.append(celdas)
    return salida


def _columna(ref):
    """'C5' -> 2. Indice de columna base cero desde la referencia de celda."""
    if not ref:
        return None
    letras = re.match(r"([A-Z]+)", ref.upper())
    if not letras:
        return None
    n = 0
    for ch in letras.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


# ---------------------------------------------------- SHF vivienda

SHF_XLSX = ("https://www.gob.mx/cms/uploads/attachment/file/1097035/"
            "Indice_SHF_datos_abiertos_2_trim_2026.xlsx")

# El indice tiene base 2017=100 REBASEADA POR SERIE, asi que los niveles NO
# se comparan entre geografias: solo las tasas de cambio. Decir 'Tijuana
# 248.66 vs Mexicali 235.10, entonces Tijuana es mas caro' es un error.
SHF_AVISO = ("Índice base 2017=100 rebaseado por serie. Los niveles NO son "
             "comparables entre geografías; solo las variaciones. El índice "
             "no da precios en pesos por municipio.")

SHF_UNIVERSO = ("Universo: avalúos de vivienda adquirida con crédito "
                "hipotecario. Quedan fuera las operaciones al contado, el "
                "suelo sin construir y la tierra ejidal, que es buena parte "
                "de la oferta costera de Baja California.")


def shf(url=SHF_XLSX, zonas_bc=("Baja California",)):
    """Índice SHF de precios de la vivienda, series de BC y nacional.

    Devuelve variaciones anuales, que es lo unico comparable entre series.
    """
    filas = _xlsx_hoja(_bajar(url, accept=None, agente=None))
    if not filas:
        raise NoEsDato("la hoja del SHF vino vacia")

    enc = [c.strip() for c in filas[0]]
    col = {n: i for i, n in enumerate(enc)}
    for req in ("Global", "Estado", "Municipio", "Trimestre", "Año", "Indice"):
        if req not in col:
            raise NoEsDato("al SHF le falta la columna {!r}; trae {}".format(req, enc))

    series = {}
    for f in filas[1:]:
        if len(f) < len(enc):
            f = f + [""] * (len(enc) - len(f))
        # 22 municipios traen espacios al final del nombre.
        glob = (f[col["Global"]] or "").strip()
        est = (f[col["Estado"]] or "").strip()
        mun = (f[col["Municipio"]] or "").strip()
        try:
            anio = int(_num(f[col["Año"]]))
            trim = int(_num(f[col["Trimestre"]]))
        except (ValueError, TypeError):
            continue
        indice = _num(f[col["Indice"]])
        if not indice:
            continue

        # Las tres columnas son mutuamente excluyentes: o es un agregado
        # global, o un estado, o un municipio de un estado.
        if mun:
            clave = "{} · {}".format(est, mun)
            ambito = "municipio"
        elif est:
            clave = est
            ambito = "estado"
        elif glob:
            clave = glob
            ambito = "global"
        else:
            continue
        series.setdefault(clave, {"ambito": ambito, "estado": est or None,
                                  "puntos": {}})["puntos"]["{}-{}T".format(anio, trim)] = indice

    interes = [k for k, v in series.items()
               if v["estado"] in zonas_bc or k in zonas_bc or k == "Nacional"
               or k == "ZM Tijuana"]

    salida = {}
    for k in sorted(interes):
        puntos = series[k]["puntos"]
        ordenados = sorted(puntos)
        ultimo = ordenados[-1]
        anio, trim = ultimo.split("-")
        previo = "{}-{}".format(int(anio) - 1, trim)
        var = None
        if previo in puntos and puntos[previo]:
            var = round((puntos[ultimo] / puntos[previo] - 1) * 100, 2)
        salida[k] = {
            "ambito": series[k]["ambito"],
            "periodo": ultimo,
            "indice": round(puntos[ultimo], 2),
            "variacion_anual_pct": var,
            "trimestres": len(puntos),
            # La serie completa, no solo el ultimo punto. Antes se calculaban
            # los 86 trimestres aqui mismo y se tiraban, asi que el tablero
            # solo podia pintar una barra por geografia y la pregunta del
            # encargo ('tendencias a la alza o a la baja') no se podia
            # contestar con lo que quedaba en disco.
            "serie": [{"periodo": p, "indice": round(puntos[p], 2)}
                      for p in ordenados],
        }
    return {
        "fuente": "SHF Índice de Precios de la Vivienda",
        "url": url,
        "cadencia": "trimestral",
        "periodo": max((v["periodo"] for v in salida.values()), default=None),
        "aviso": SHF_AVISO,
        "universo": SHF_UNIVERSO,
        "sin_cobertura": ["Ensenada", "Tecate", "Playas de Rosarito",
                          "San Quintín", "San Felipe"],
        "series": salida,
    }


# ------------------------------------------------ predial (suelo proxy)

PREDIAL_CSV = ("https://repodatos.atdt.gob.mx/api_update/secretaria_hacienda/"
               "impuesto_predial_municipal/mapa_imp_predial.csv")

PREDIAL_AVISO = (
    "Recaudación de predial, NO valuación. El monto por cuenta pagada es un "
    "proxy del valor del suelo y está contaminado por diferencias de tasa y "
    "de eficiencia de cobro entre municipios. Sirve para comparar la "
    "evolución de un municipio consigo mismo, no para rankear municipios."
)


def predial(url=PREDIAL_CSV, entidad="Baja California"):
    """Predial por municipio: lo unico estructurado que cubre las zonas que
    el SHF no ve (Ensenada, Tecate, Rosarito, San Quintin, San Felipe)."""
    crudo = _bajar(url)                     # 403 sin Accept
    filas = list(_filas(crudo, "utf-8"))
    if not filas:
        raise NoEsDato("el csv de predial vino vacio")
    col = {n.strip(): i for i, n in enumerate(filas[0])}
    for req in ("ciclo", "entidad_federativa", "municipio", "cuentas_pagadas", "monto_predial"):
        if req not in col:
            raise NoEsDato("al predial le falta {!r}; trae {}".format(req, list(col)[:12]))

    por_mun = {}
    for f in filas[1:]:
        if len(f) <= max(col.values()):
            continue
        if (f[col["entidad_federativa"]] or "").strip() != entidad:
            continue
        mun = (f[col["municipio"]] or "").strip()
        ciclo = int(_num(f[col["ciclo"]]))
        cuentas = _num(f[col["cuentas_pagadas"]])
        monto = _num(f[col["monto_predial"]])
        if not mun or not ciclo or cuentas <= 0:
            continue
        por_mun.setdefault(mun, {})[ciclo] = {
            "cuentas_pagadas": int(cuentas),
            "monto_predial": monto,
            "por_cuenta": round(monto / cuentas, 2),
        }

    salida = {}
    for mun, ciclos in sorted(por_mun.items()):
        anios = sorted(ciclos)
        ultimo = anios[-1]
        previo = ultimo - 1
        var = None
        if previo in ciclos and ciclos[previo]["por_cuenta"]:
            var = round((ciclos[ultimo]["por_cuenta"] / ciclos[previo]["por_cuenta"] - 1) * 100, 2)
        salida[mun] = {
            "ciclo": ultimo,
            "por_cuenta_mxn": ciclos[ultimo]["por_cuenta"],
            "cuentas_pagadas": ciclos[ultimo]["cuentas_pagadas"],
            "variacion_anual_pct": var,
            "ciclos": len(anios),
            # Igual que en el SHF: los ciclos se calculaban y se tiraban. Aqui
            # el ciclo inicial cambia por municipio (San Felipe y San Quintin
            # son municipios nuevos), asi que el año va explicito en cada
            # punto y no se puede inferir de la posicion.
            "serie": [{"ciclo": a,
                       "por_cuenta_mxn": ciclos[a]["por_cuenta"],
                       "cuentas_pagadas": ciclos[a]["cuentas_pagadas"]}
                      for a in anios],
        }
    return {
        "fuente": "SHCP · Impuesto predial municipal",
        "url": url,
        "cadencia": "anual",
        "periodo": str(max((v["ciclo"] for v in salida.values()), default="")),
        "aviso": PREDIAL_AVISO,
        "municipios": salida,
    }


# -------------------------------------------------------- SESNSP crimen

SESNSP_PAGINA = ("https://www.gob.mx/sesnsp/acciones-y-programas/"
                 "datos-abiertos-de-incidencia-delictiva")
SESNSP_DESCARGA = ("https://sspcgob-my.sharepoint.com/personal/cni_sspc_gob_mx/"
                   "_layouts/15/download.aspx?share={}")
# El share ID cambia CADA MES porque apunta a un nombre de archivo con el mes.
# Este es el de enero-julio 2026, verificado el 3 sep 2026.
SESNSP_SHARE_2026 = "IQCG_K5ZFRu0RobE0TfVmcQ1AXKVGMkVAWKilpe341CUDJs"


def descubrir_share_sesnsp(url=SESNSP_PAGINA):
    """Share IDs de la pagina del SESNSP.

    OJO con el User-Agent: con el de urllib la pagina baja completa, y con uno
    de navegador Akamai contesta un reto de 1.8 KB con codigo 200. Disfrazarse
    rompe. De ahi agente=None.
    """
    crudo = _bajar(url, accept=None, agente=None, timeout=90)
    texto = crudo.decode("utf-8", "replace")
    return re.findall(
        r"sharepoint\.com/:u:/g/personal/cni_sspc_gob_mx/([A-Za-z0-9_\-]+)", texto)


def sesnsp(share=SESNSP_SHARE_2026, url=None):
    """Incidencia delictiva de los 7 municipios de BC, del archivo 2026.

    El archivo 2026 es UTF-8; el historico 2015-2025 es Windows-1252 y son
    series distintas: la metodologia cambio (RNID) y solo 38 de 47 tipos de
    delito coinciden, asi que NO se concatenan sin un crosswalk.
    """
    url = url or SESNSP_DESCARGA.format(share)
    crudo = _bajar(url, timeout=240)
    csv_crudo, nombre = _csv_de_zip(crudo, r"municipal.*\.csv$")
    filas = _filas(csv_crudo, "utf-8")       # 2026 es UTF-8

    enc = [c.strip() for c in next(filas)]
    col = {n: i for i, n in enumerate(enc)}
    for req in ("Año", "Cve. Municipio", "Municipio", "Tipo de delito"):
        if req not in col:
            raise NoEsDato("al SESNSP le falta {!r}; trae {}".format(req, enc[:10]))
    i_meses = [col[m] for m in MESES if m in col]

    por_mun = {}
    for f in filas:
        if len(f) <= max(col.values()):
            continue
        # La clave viene sin ceros a la izquierda y como texto: '2004'.
        cve = (f[col["Cve. Municipio"]] or "").strip()
        if cve not in BC_MUNICIPIOS:
            continue
        tipo = (f[col["Tipo de delito"]] or "").strip()
        meses = [_num(f[i]) for i in i_meses]
        total = sum(meses)
        if not total:
            continue
        d = por_mun.setdefault(cve, {"municipio": BC_MUNICIPIOS[cve], "total": 0.0,
                                     "por_delito": {}, "por_mes": [0.0] * len(i_meses)})
        d["total"] += total
        d["por_delito"][tipo] = d["por_delito"].get(tipo, 0.0) + total
        for k, v in enumerate(meses):
            d["por_mes"][k] += v

    salida = {}
    for cve, d in sorted(por_mun.items()):
        # Ultimo mes con datos: los meses futuros vienen en cero.
        con_datos = [k for k, v in enumerate(d["por_mes"]) if v]
        ultimo = max(con_datos) if con_datos else -1
        clave = {}
        for nombre_d, n in d["por_delito"].items():
            if any(nombre_d.startswith(p) for p in DELITOS_CLAVE):
                clave[nombre_d] = int(n)
        salida[BC_MUNICIPIOS[cve]] = {
            "cve": cve,
            "cvegeo": cve.zfill(5),
            "total": int(d["total"]),
            "ultimo_mes": MESES[ultimo] if ultimo >= 0 else None,
            "por_mes": [int(v) for v in d["por_mes"][:ultimo + 1]],
            "delitos_clave": dict(sorted(clave.items(), key=lambda kv: -kv[1])),
        }
    return {
        "fuente": "SESNSP · Incidencia delictiva municipal (RNID)",
        "url": url,
        "archivo": nombre,
        "cadencia": "mensual",
        "rezago": "~3 semanas: el mes M sale cerca del 20 de M+1",
        "periodo": next((v["ultimo_mes"] for v in salida.values() if v["ultimo_mes"]), None),
        "aviso": ("Delitos REPORTADOS, no delitos ocurridos: la cifra depende "
                  "de que la gente denuncie. Serie RNID 2026, que no se puede "
                  "concatenar con 2015-2025 sin crosswalk porque cambió la "
                  "clasificación de tipos de delito."),
        "municipios": salida,
    }


# ----------------------------------------------------- INEGI ENSU

ENSU_CSV = ("https://www.inegi.org.mx/contenidos/programas/ensu/datosabiertos/"
            "conjunto_de_datos_ensu_2026_2t_csv.zip")

# Las unicas dos ciudades de BC en la muestra. Ensenada nunca se agrego.
ENSU_CIUDADES_BC = ("MEXICALI", "TIJUANA")


def ensu(url=ENSU_CSV):
    """Percepcion de inseguridad por ciudad, reconstruida del microdato.

    Receta verificada: agrupar por NOM_CD y sumar el ponderador FAC_SEL segun
    BP1_1 (1=seguro, 2=inseguro, 9=no sabe, que se EXCLUYE del denominador).
    Sin ponderar, los porcentajes salen mal: no es un conteo de renglones.
    """
    crudo = _bajar(url, timeout=180)
    csv_crudo, nombre = _csv_de_zip(crudo, r"ensu_cb_\d+\.csv$")
    filas = _filas(csv_crudo, "utf-8")       # INEGI es UTF-8, al reves del SESNSP

    enc = [c.strip().upper() for c in next(filas)]
    col = {n: i for i, n in enumerate(enc)}
    for req in ("NOM_CD", "BP1_1", "FAC_SEL"):
        if req not in col:
            raise NoEsDato("a la ENSU le falta {!r}; trae {}".format(req, enc[:12]))

    acc = {}
    nacional = {"seguro": 0.0, "inseguro": 0.0}
    for f in filas:
        if len(f) <= max(col.values()):
            continue
        ciudad = (f[col["NOM_CD"]] or "").strip().upper()
        resp = (f[col["BP1_1"]] or "").strip()
        peso = _num(f[col["FAC_SEL"]])
        if not ciudad or peso <= 0:
            continue
        if resp == "1":
            llave = "seguro"
        elif resp == "2":
            llave = "inseguro"
        else:
            continue                          # 9 = no sabe, fuera del denominador
        acc.setdefault(ciudad, {"seguro": 0.0, "inseguro": 0.0})[llave] += peso
        nacional[llave] += peso

    def pct(d):
        base = d["seguro"] + d["inseguro"]
        return round(d["inseguro"] / base * 100, 1) if base else None

    ciudades = {}
    for ciudad in ENSU_CIUDADES_BC:
        if ciudad in acc:
            d = acc[ciudad]
            ciudades[ciudad.title()] = {
                "pct_inseguro": pct(d),
                "poblacion_18mas": int(d["seguro"] + d["inseguro"]),
            }
    return {
        "fuente": "INEGI · ENSU",
        "url": url,
        "archivo": nombre,
        "cadencia": "trimestral",
        "periodo": re.sub(r".*?(\d{4})_(\d)t.*", r"\1-\2T", url),
        "aviso": ("Única medición de percepción con muestra probabilística. "
                  "Ponderada con FAC_SEL; los 'no sabe' salen del denominador."),
        "cobertura": ("Solo Tijuana y Mexicali en Baja California. Ensenada, "
                      "Tecate, Rosarito, San Quintín y San Felipe NUNCA han "
                      "estado en la muestra, así que para esas zonas no hay "
                      "medición de percepción y no se debe inferir de las otras."),
        "ciudades": ciudades,
        "nacional": {"pct_inseguro": pct(nacional)},
    }


# ------------------------------------------------- San Diego parcelas

SANDAG_QUERY = ("https://geo.sandag.org/server/rest/services/Hosted/Parcels/"
                "FeatureServer/0/query")


def san_diego(url=SANDAG_QUERY, minimo_parcelas=30):
    """Valor catastral mediano por ZIP de San Diego, en UNA sola peticion.

    El servicio soporta percentile_disc y agrupar por SUBSTRING, asi que no
    hace falta bajar el millon de parcelas. No hay precio de venta ni nombre
    del propietario en la version gratuita: el nombre esta retenido por la
    ley AB1785 de California.
    """
    estadisticas = json.dumps([
        {"statisticType": "percentile_disc", "onStatisticField": "asr_total",
         "outStatisticFieldName": "mediana", "statisticParameters": {"value": 0.5}},
        {"statisticType": "count", "onStatisticField": "apn",
         "outStatisticFieldName": "n"},
    ])
    from urllib.parse import urlencode
    q = urlencode({
        "where": "asr_total>10000",
        "groupByFieldsForStatistics": "SUBSTRING(situs_zip,1,5)",
        "outStatistics": estadisticas,
        "f": "json",
    })
    # Sin orderByFields: agregarlo devuelve cero features en silencio.
    datos = json.loads(_bajar(url + "?" + q, timeout=120).decode("utf-8"))
    if "error" in datos:
        raise NoEsDato("SANDAG: {}".format(str(datos["error"])[:200]))

    zips = {}
    for f in datos.get("features", []):
        a = f.get("attributes") or {}
        # El campo agrupado regresa como EXPR_1.
        cp = str(a.get("EXPR_1") or "").strip()
        n = int(a.get("n") or 0)
        mediana = a.get("mediana")
        if not cp.isdigit() or n < minimo_parcelas or not mediana:
            continue
        zips[cp] = {"mediana_usd": int(mediana), "parcelas": n}

    return {
        "fuente": "SANDAG · Parcels (valor catastral)",
        "url": url,
        "cadencia": "mensual",
        "periodo": None,
        "aviso": ("Valor CATASTRAL (assessed), no precio de venta. En "
                  "California la Proposición 13 congela la base gravable "
                  "hasta que la propiedad cambia de dueño, así que el "
                  "catastral queda MUY por debajo del precio de mercado en "
                  "casas que no se han vendido en años. No es comparable con "
                  "el índice SHF del lado mexicano."),
        "faltantes": ("No hay precio de venta ni nombre del propietario en la "
                      "fuente gratuita; el nombre está retenido por la ley "
                      "AB1785 de California."),
        "zips": dict(sorted(zips.items())),
    }


# --------------------------------------------- renta de San Diego (ACS)

ACS_URL = "https://api.census.gov/data/{}/acs/acs5"

# B25064: renta bruta mediana, en dolares por mes. 'Bruta' incluye servicios,
# asi que es el desembolso real del inquilino y no el renglon del contrato.
ACS_VARIABLE = "B25064_001E"
ACS_MARGEN = "B25064_001M"

# El censo suprime estimaciones y lo marca con este centinela, no con null.
# Sumarlo como si fuera un monto da rentas negativas de nueve digitos.
ACS_SUPRIMIDO = -666666666

ACS_ANIO_PRIMERO = 2013
ACS_ANIO_ULTIMO = 2023

# Los ZIP que cuentan la historia, no los 101 del condado: la franja
# fronteriza mas las colonias que aparecen en la conversacion de
# gentrificacion, mas Coronado y Rancho Santa Fe como techo de referencia.
# Los once existen en el panel de SANDAG, asi que renta y catastral se pueden
# poner uno al lado del otro por ZIP.
ACS_ZIPS = {
    "92173": "San Ysidro",
    "92154": "Otay Mesa",
    "91910": "Chula Vista",
    "91911": "Chula Vista sur",
    "91932": "Imperial Beach",
    "92101": "Downtown San Diego",
    "92104": "North Park",
    "92105": "City Heights",
    "92113": "Barrio Logan",
    "92118": "Coronado",
    "92067": "Rancho Santa Fe",
}

ACS_AVISO = (
    "Renta bruta MEDIANA de vivienda en alquiler, en dólares por mes, "
    "incluyendo servicios. Es una muestra probabilística de 5 años, no un "
    "censo del mes: el dato de 2023 promedia 2019-2023, así que suaviza los "
    "brincos y va rezagado. Cada estimación trae su margen de error al 90% y "
    "en un ZIP chico el margen puede ser grande; con el margen encima de la "
    "diferencia, dos ZIP no se distinguen."
)

ACS_UNIVERSO = (
    "Solo vivienda en ALQUILER ocupada. No es precio de venta ni valor "
    "catastral, así que no se compara con el índice SHF ni con el catastral "
    "de SANDAG: son tres cosas distintas."
)


class SinLlave(Exception):
    """La fuente necesita una llave gratuita que no esta en el entorno."""


def acs(anios=None, llave=None, zips=None):
    """Renta mediana por ZIP de San Diego, serie anual del ACS.

    Requiere una llave gratuita del Census (CENSUS_API_KEY). Sin llave la API
    responde **200 con una pagina HTML** que dice 'Missing Key', que es la
    misma trampa que INEGI y gob.mx: por eso se pide la llave antes de salir
    a la red en vez de descubrirlo al parsear.
    """
    llave = llave or os.environ.get("CENSUS_API_KEY")
    if not llave:
        raise SinLlave(
            "falta CENSUS_API_KEY; se saca gratis y al instante en "
            "https://api.census.gov/data/key_signup.html y se guarda con "
            "`gh secret set CENSUS_API_KEY`"
        )
    zips = zips or ACS_ZIPS
    anios = list(anios or range(ACS_ANIO_PRIMERO, ACS_ANIO_ULTIMO + 1))
    from urllib.parse import urlencode

    series = {cp: [] for cp in zips}
    fallos = []
    for anio in anios:
        q = urlencode({
            "get": "{},{}".format(ACS_VARIABLE, ACS_MARGEN),
            "for": "zip code tabulation area:" + ",".join(sorted(zips)),
            "key": llave,
        })
        try:
            filas = json.loads(_bajar("{}?{}".format(ACS_URL.format(anio), q),
                                      timeout=90).decode("utf-8"))
        except (NoEsDato, ValueError, OSError) as e:
            # Un año que falta no tumba la serie: los ZCTA dejaron de anidar
            # en estados en 2020 y los años viejos no siempre responden igual.
            fallos.append({"anio": anio, "error": "{}: {}".format(type(e).__name__, e)[:120]})
            continue
        if not filas or len(filas) < 2:
            fallos.append({"anio": anio, "error": "sin filas"})
            continue
        col = {n: i for i, n in enumerate(filas[0])}
        for f in filas[1:]:
            cp = str(f[col["zip code tabulation area"]]).strip()
            if cp not in series:
                continue
            renta = _num(f[col[ACS_VARIABLE]])
            margen = _num(f[col[ACS_MARGEN]])
            if not renta or renta <= 0 or renta == ACS_SUPRIMIDO:
                continue
            punto = {"anio": anio, "renta_mediana_usd": int(renta)}
            if margen and margen > 0 and margen != ACS_SUPRIMIDO:
                punto["margen_usd"] = int(margen)
            series[cp].append(punto)

    salida = {}
    for cp, puntos in sorted(series.items()):
        if not puntos:
            continue
        puntos.sort(key=lambda p: p["anio"])
        ultimo = puntos[-1]
        var = None
        previo = next((p for p in puntos if p["anio"] == ultimo["anio"] - 1), None)
        if previo and previo["renta_mediana_usd"]:
            var = round((ultimo["renta_mediana_usd"] / previo["renta_mediana_usd"] - 1) * 100, 2)
        salida[cp] = {
            "nombre": zips[cp],
            "anio": ultimo["anio"],
            "renta_mediana_usd": ultimo["renta_mediana_usd"],
            "variacion_anual_pct": var,
            "anios": len(puntos),
            "serie": puntos,
        }
    if not salida:
        raise NoEsDato("el ACS no devolvio renta para ningun ZIP: {}".format(fallos[:3]))

    panel = {
        "fuente": "US Census Bureau · ACS 5-year, B25064 (renta bruta mediana)",
        "url": ACS_URL.format(ACS_ANIO_ULTIMO),
        "cadencia": "anual",
        "periodo": str(max(v["anio"] for v in salida.values())),
        "aviso": ACS_AVISO,
        "universo": ACS_UNIVERSO,
        "zips": salida,
    }
    if fallos:
        panel["anios_sin_dato"] = fallos
    return panel


# ------------------------------------------------------------ runner

FUENTES = (
    ("shf", shf, "vivienda"),
    ("predial", predial, "suelo"),
    ("sesnsp", sesnsp, "crimen"),
    ("ensu", ensu, "percepcion"),
    ("san_diego", san_diego, "vivienda"),
    ("acs", acs, "renta"),
)


def correr(salida="data", ahora=None, max_edad_dias=7, forzar=False, solo=None):
    """Baja los indicadores y escribe salida/indicadores.json.

    Se salta si lo que hay tiene menos de `max_edad_dias`: estas fuentes son
    trimestrales o mensuales y bajar 60 MB cada hora seria una groseria sin
    ningun dato nuevo a cambio.
    """
    from .pipeline import _escribir, ahora_utc
    ahora = ahora or ahora_utc()
    ruta = os.path.join(salida, "indicadores.json")

    previo = {}
    try:
        with open(ruta, encoding="utf-8") as fh:
            previo = json.load(fh)
    except (OSError, ValueError):
        previo = {}

    if previo and not forzar and not solo:
        try:
            edad = (datetime.fromisoformat(ahora.replace("Z", "+00:00"))
                    - datetime.fromisoformat(previo["generado"].replace("Z", "+00:00")))
            if edad.days < max_edad_dias:
                return previo, True          # (panel, se_salto)
        except (KeyError, ValueError):
            pass

    paneles = dict(previo.get("indicadores") or {})
    salud = []
    for nombre, fn, familia in FUENTES:
        if solo and nombre not in solo:
            continue
        t0 = time.monotonic()
        try:
            paneles[nombre] = fn()
            paneles[nombre]["familia"] = familia
            paneles[nombre]["obtenido"] = ahora
            salud.append({"id": nombre, "estado": "ok", "ms": int((time.monotonic() - t0) * 1000),
                          "error": None, "periodo": paneles[nombre].get("periodo")})
        except SinLlave as e:
            # No es un fallo: es una fuente sin configurar. El tablero la
            # rotula distinto de una que se cayo, igual que el panel de
            # YouTube sin YOUTUBE_API_KEY.
            salud.append({"id": nombre, "estado": "sin_llave",
                          "ms": int((time.monotonic() - t0) * 1000),
                          "error": str(e)[:300],
                          "periodo": (paneles.get(nombre) or {}).get("periodo")})
        except Exception as e:
            salud.append({"id": nombre, "estado": "fallo",
                          "ms": int((time.monotonic() - t0) * 1000),
                          "error": "{}: {}".format(type(e).__name__, e)[:300],
                          "periodo": (paneles.get(nombre) or {}).get("periodo")})

    panel = {
        "esquema": 1,
        "generado": ahora,
        "indicadores": paneles,
        "salud": salud,
    }
    _escribir(ruta, panel)
    return panel, False
