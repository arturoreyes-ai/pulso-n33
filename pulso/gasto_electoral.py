"""Gasto electoral: el CSV reportado no es el total que termino auditando el INE.

En la eleccion de 2024, Norma Bustamante reporto 969,680.21 pesos y el Anexo
II determino 1,485,055.76. Publicar solo el CSV abierto habria dejado fuera
515,375.55 pesos encontrados por auditoria. Por eso este modulo une por ID de
contabilidad, nunca por nombre, y la cifra principal sale del dictamen final.

Los anexos viven dentro de ZIP de hasta cientos de megabytes. Bajar cada ZIP
completo en el cron seria pagar testigos y PDF que este producto no usa. El
lector remoto trae el directorio central por HTTP Range y luego solo el XLSX
que corresponde al Anexo II.
"""

import csv
import http.client
import io
import json
import os
import re
import ssl
import struct
import time
import zipfile
import zlib
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

from . import VERSION
from .indicadores import NoEsDato, _xlsx_hoja
from .normalizar import fold


AGENTE = "PulsoN33/{}".format(VERSION)
CERTIFICADO_INTERMEDIO_IEEBC = "https://certificates.godaddy.com/repository/gdig2.crt"
FIRMA_CENTRAL = b"PK\x01\x02"
FIRMA_FINAL = b"PK\x05\x06"
FIRMA_LOCAL = b"PK\x03\x04"
CENTAVO = Decimal("0.01")
_CONTEXTO_IEEBC = None


class Enlaces(HTMLParser):
    """Los href de una pagina oficial, sin depender de clases de WordPress."""

    def __init__(self):
        super().__init__()
        self.enlaces = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.enlaces.append(href)


def _contexto_ieebc(timeout=30):
    global _CONTEXTO_IEEBC
    if _CONTEXTO_IEEBC is None:
        # ieebc.mx entregaba solo el certificado final el 13 de septiembre de
        # 2026. La CA intermedia se obtiene por HTTPS de la URL AIA de GoDaddy
        # y se agrega al almacen normal; nunca se desactiva CERT_REQUIRED.
        with urlopen(Request(CERTIFICADO_INTERMEDIO_IEEBC, headers={
                "Accept": "application/pkix-cert", "User-Agent": AGENTE,
        }), timeout=timeout) as r:
            der = r.read()
        contexto = ssl.create_default_context()
        contexto.load_verify_locations(cadata=ssl.DER_cert_to_PEM_cert(der))
        _CONTEXTO_IEEBC = contexto
    return _CONTEXTO_IEEBC


def _pedir(url, headers=None, timeout=180, intentos=4):
    cab = {"Accept": "*/*", "User-Agent": AGENTE}
    cab.update(headers or {})
    contexto = _contexto_ieebc() if urlsplit(url).hostname == "ieebc.mx" else None
    for intento in range(intentos):
        try:
            with urlopen(Request(url, headers=cab), timeout=timeout,
                         context=contexto) as r:
                crudo = r.read()
                return crudo, dict(r.headers), getattr(r, "status", 200)
        except HTTPError as e:
            # El indice federal del INE devolvio 500 despues de terminar los
            # anexos locales el 13 de septiembre de 2026. Es transitorio, pero
            # sin reintento hacia perder toda la conciliacion ya descargada.
            if e.code not in (429, 500, 502, 503, 504) or intento == intentos - 1:
                raise
            time.sleep(2 ** intento)


def _bajar(url, timeout=180):
    return _pedir(url, timeout=timeout)[0]


def _rango(url, inicio=None, fin=None, sufijo=None, timeout=180):
    if sufijo is not None:
        valor = "bytes=-{}".format(sufijo)
    else:
        valor = "bytes={}-{}".format(inicio, "" if fin is None else fin)
    crudo, cab, estado = _pedir(url, {"Range": valor}, timeout)
    if estado != 206:
        raise NoEsDato("{} ignoro HTTP Range ({})".format(url.split("?")[0], estado))
    contenido = cab.get("Content-Range") or cab.get("content-range") or ""
    m = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", contenido.strip())
    if not m:
        raise NoEsDato("{} no devolvio Content-Range valido ({!r})".format(url, contenido))
    primero, ultimo, total = map(int, m.groups())
    if len(crudo) != ultimo - primero + 1:
        raise NoEsDato("{} corto el rango: {} bytes, se esperaban {}".format(
            url, len(crudo), ultimo - primero + 1))
    return crudo, primero, total


class _LectorRangos:
    """Rangos consecutivos sobre una sola conexion HTTPS."""

    def __init__(self, url, timeout=180):
        partes = urlsplit(url)
        if partes.scheme != "https" or not partes.hostname:
            raise NoEsDato("URL de rango no es HTTPS: {}".format(url))
        self.url = url
        self.ruta = partes.path + (("?" + partes.query) if partes.query else "")
        self.conexion = http.client.HTTPSConnection(
            partes.hostname, partes.port or 443, timeout=timeout)

    def cerrar(self):
        self.conexion.close()

    def rango(self, inicio, fin):
        valor = "bytes={}-{}".format(inicio, fin)
        for intento in range(4):
            try:
                self.conexion.request("GET", self.ruta, headers={
                    "Accept": "*/*", "User-Agent": AGENTE, "Range": valor,
                })
                respuesta = self.conexion.getresponse()
                crudo = respuesta.read()
                estado = respuesta.status
                contenido = respuesta.getheader("Content-Range", "")
            except (OSError, http.client.HTTPException):
                self.conexion.close()
                if intento == 3:
                    raise
                time.sleep(2 ** intento)
                continue
            if estado in (429, 500, 502, 503, 504) and intento < 3:
                time.sleep(2 ** intento)
                continue
            if estado != 206:
                raise NoEsDato("{} ignoro HTTP Range {} ({})".format(
                    self.url, valor, estado))
            m = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", contenido.strip())
            if not m:
                raise NoEsDato("{} no devolvio Content-Range valido ({!r})".format(
                    self.url, contenido))
            primero, ultimo, total = map(int, m.groups())
            if primero != inicio or len(crudo) != ultimo - primero + 1:
                raise NoEsDato("{} corto HTTP Range {}".format(self.url, valor))
            return crudo, primero, total
        raise NoEsDato("{} agoto reintentos para {}".format(self.url, valor))


def _directorio_zip_remoto(url):
    """Lee el directorio central de un ZIP sin bajar el archivo completo."""
    # El repositorio DSpace del INE acepta Range pero interpreta `bytes=-N`
    # como `bytes=0-N`: parece una cola valida y en realidad entrega el
    # principio del archivo. Primero se pregunta el tamano con un byte y luego
    # se pide una cola explicita. La primera version fallo justo con el ZIP de
    # Morena de Baja California por esa respuesta no estandar.
    _, _, total = _rango(url, 0, 0)
    inicio_pedido = max(0, total - 131072)
    cola, inicio_cola, _ = _rango(url, inicio_pedido, total - 1)
    pos = cola.rfind(FIRMA_FINAL)
    if pos < 0 or pos + 22 > len(cola):
        raise NoEsDato("{} no trae final de ZIP en los ultimos 128 KiB".format(url))
    final = struct.unpack_from("<4s4H2LH", cola, pos)
    entradas, tam_central, inicio_central = final[4], final[5], final[6]
    if entradas == 0xFFFF or tam_central == 0xFFFFFFFF or inicio_central == 0xFFFFFFFF:
        raise NoEsDato("{} usa ZIP64; el lector deliberadamente no lo adivina".format(url))
    if inicio_central + tam_central > total:
        raise NoEsDato("{} declara un directorio central fuera del archivo".format(url))
    if inicio_central >= inicio_cola and inicio_central + tam_central <= inicio_cola + len(cola):
        central = cola[inicio_central - inicio_cola:inicio_central - inicio_cola + tam_central]
    else:
        central, primero, _ = _rango(url, inicio_central, inicio_central + tam_central - 1)
        if primero != inicio_central:
            raise NoEsDato("{} devolvio otro inicio para el directorio central".format(url))

    salida = []
    p = 0
    while p < len(central):
        if central[p:p + 4] != FIRMA_CENTRAL or p + 46 > len(central):
            raise NoEsDato("{} tiene un directorio central truncado en {}".format(url, p))
        c = struct.unpack_from("<4s6H3L5H2L", central, p)
        bandera, metodo = c[3], c[4]
        crc, comprimido, abierto = c[7], c[8], c[9]
        n_nombre, n_extra, n_comentario = c[10], c[11], c[12]
        disco, desplazamiento = c[13], c[16]
        if disco != 0:
            raise NoEsDato("{} es un ZIP repartido en discos".format(url))
        crudo_nombre = central[p + 46:p + 46 + n_nombre]
        codificacion = "utf-8" if bandera & 0x800 else "cp437"
        nombre = crudo_nombre.decode(codificacion, "replace")
        salida.append({
            "nombre": nombre,
            "metodo": metodo,
            "crc": crc,
            "comprimido": comprimido,
            "abierto": abierto,
            "desplazamiento": desplazamiento,
        })
        p += 46 + n_nombre + n_extra + n_comentario
    if len(salida) != entradas:
        raise NoEsDato("{} declara {} entradas y se leyeron {}".format(url, entradas, len(salida)))
    return salida


def _miembro_zip_remoto(url, entrada):
    inicio = entrada["desplazamiento"]
    cabeza, primero, _ = _rango(url, inicio, inicio + 29)
    if primero != inicio or len(cabeza) != 30 or cabeza[:4] != FIRMA_LOCAL:
        raise NoEsDato("{} no trae encabezado local en {}".format(url, inicio))
    local = struct.unpack("<4s5H3L2H", cabeza)
    if local[3] != entrada["metodo"]:
        raise NoEsDato("{} cambio el metodo de compresion entre indices".format(url))
    inicio_datos = inicio + 30 + local[9] + local[10]
    fin_datos = inicio_datos + entrada["comprimido"] - 1
    comprimido, primero, _ = _rango(url, inicio_datos, fin_datos)
    if primero != inicio_datos:
        raise NoEsDato("{} devolvio otro inicio para {}".format(url, entrada["nombre"]))
    if entrada["metodo"] == 0:
        crudo = comprimido
    elif entrada["metodo"] == 8:
        crudo = zlib.decompress(comprimido, -15)
    else:
        raise NoEsDato("{} usa compresion ZIP {} no soportada".format(
            entrada["nombre"], entrada["metodo"]))
    if len(crudo) != entrada["abierto"]:
        raise NoEsDato("{} se descomprimio a {} bytes, se esperaban {}".format(
            entrada["nombre"], len(crudo), entrada["abierto"]))
    if zlib.crc32(crudo) & 0xFFFFFFFF != entrada["crc"]:
        raise NoEsDato("{} no paso CRC".format(entrada["nombre"]))
    return crudo


def _es_anexo_suplementario(nombre):
    return bool(re.match(
        r"^Anexo II[ _-]+(?:A|B)(?:[ _-]|$)", os.path.basename(nombre), re.I))


def _buscar_anexo_desde_inicio(url, patron_anexo, patron_entidad, rango=None):
    """Recorre encabezados locales hasta el Anexo II de la entidad.

    XMLUI usa enteros de 32 bits para Range y no puede entregar la cola de
    algunos ZIP federales de 3 GB. Los archivos internos estan ordenados por
    entidad; Baja California aparece al principio y se alcanza leyendo solo
    encabezados locales, sin transferir los expedientes que hay entre ellos.
    """
    lector = None
    if rango is None:
        lector = _LectorRangos(url)
        rango = lector.rango
    try:
        posicion = 0
        for _ in range(100000):
            # Un bloque alcanza encabezado, nombre y campo extra en la practica.
            # La conexion persistente evita una negociacion TLS por entrada.
            bloque, primero, _ = rango(posicion, posicion + 4095)
            if primero != posicion or len(bloque) < 30:
                raise NoEsDato("{} corto encabezado local en {}".format(url, posicion))
            cabeza = bloque[:30]
            if cabeza[:4] in (FIRMA_CENTRAL, FIRMA_FINAL):
                return []
            if cabeza[:4] != FIRMA_LOCAL:
                raise NoEsDato("{} no trae encabezado ZIP en {}".format(url, posicion))
            local = struct.unpack("<4s5H3L2H", cabeza)
            bandera, metodo = local[2], local[3]
            crc, comprimido, abierto = local[6], local[7], local[8]
            n_nombre, n_extra = local[9], local[10]
            fin_metadatos = 30 + n_nombre + n_extra
            if len(bloque) < fin_metadatos:
                bloque, primero, _ = rango(posicion, posicion + fin_metadatos - 1)
                if primero != posicion or len(bloque) < fin_metadatos:
                    raise NoEsDato("{} corto nombre local en {}".format(url, posicion))
            metadatos = bloque[30:fin_metadatos]
            codificacion = "utf-8" if bandera & 0x800 else "cp437"
            nombre = metadatos[:n_nombre].decode(codificacion, "replace")
            if bandera & 0x08 and comprimido == 0:
                raise NoEsDato("{} usa descriptor sin tamano antes de {}".format(url, nombre))
            entrada = {
                "nombre": nombre, "metodo": metodo, "crc": crc,
                "comprimido": comprimido, "abierto": abierto,
                "desplazamiento": posicion,
            }
            base = os.path.basename(nombre)
            if (re.search(patron_anexo, base, re.I)
                    and re.search(patron_entidad, nombre, re.I)
                    and not _es_anexo_suplementario(nombre)):
                return [entrada]
            posicion += 30 + n_nombre + n_extra + comprimido
        raise NoEsDato("{} excedio 100000 entradas sin hallar el Anexo II".format(url))
    finally:
        if lector is not None:
            lector.cerrar()


def anexos_remotos(indice_url, patron_zip, patron_anexo, patron_entidad=None):
    """Devuelve (URL, nombre, bytes) de cada Anexo II del indice oficial."""
    parser = Enlaces()
    parser.feed(_bajar(indice_url).decode("utf-8", "replace"))
    urls = sorted({urljoin(indice_url, h.split("?", 1)[0]) for h in parser.enlaces
                   if re.search(patron_zip, h, re.I)})
    if not urls:
        raise NoEsDato("{} no enlaza ZIP que empaten {!r}".format(indice_url, patron_zip))
    salida = []
    for url in urls:
        try:
            directorio = _directorio_zip_remoto(url)
        except HTTPError as e:
            if e.code != 416:
                raise
            directorio = _buscar_anexo_desde_inicio(
                url, patron_anexo, patron_entidad or r".*")
        entradas = [e for e in directorio
                    if re.search(patron_anexo, os.path.basename(e["nombre"]), re.I)
                    and (not patron_entidad
                         or re.search(patron_entidad, e["nombre"], re.I))]
        # El PAN de Baja California publica juntos `Anexo II_PAN_BC.xlsx` y
        # `Anexo II_B_PAN_BC.xlsx`. El segundo no sustituye al concentrado
        # principal y sumarlo produciria IDs duplicados. Conservamos solo el
        # Anexo II sin letra; si queda mas de uno, el expediente sigue ambiguo.
        principales = [e for e in entradas
                       if not _es_anexo_suplementario(e["nombre"])]
        entradas = principales
        # El ZIP PPL local agrupa PES BC y FXMBC. Son dos Anexos II
        # principales validos; la unicidad se controla despues por ID de
        # contabilidad, no por la cantidad de libros dentro del contenedor.
        for e in sorted(entradas, key=lambda x: x["nombre"]):
            salida.append((url, e["nombre"], _miembro_zip_remoto(url, e)))
    if not salida:
        raise NoEsDato("ningun ZIP de {} trajo un Anexo II".format(indice_url))
    return salida


def _encabezado(v):
    return re.sub(r"[^a-z0-9]+", " ", fold(str(v))).strip()


def _tabla(filas, obligatorio):
    for i, fila in enumerate(filas):
        claves = [_encabezado(v) for v in fila]
        if obligatorio.issubset(claves):
            salida = []
            for datos in filas[i + 1:]:
                if not any(str(v).strip() for v in datos):
                    continue
                salida.append({claves[k]: datos[k] if k < len(datos) else ""
                               for k in range(len(claves)) if claves[k]})
            return salida
    raise NoEsDato("no se encontro encabezado con {}".format(
        ", ".join(sorted(obligatorio))))


def _dinero(v, vacio=None):
    if v is None:
        return vacio
    texto = str(v).strip()
    if texto == "":
        return vacio
    if texto in ("-", "$-"):
        return 0.0
    texto = texto.replace("$", "").replace(",", "").replace(" ", "")
    try:
        return float(Decimal(texto).quantize(CENTAVO, rounding=ROUND_HALF_UP))
    except InvalidOperation as e:
        raise NoEsDato("monto invalido {!r}".format(v)) from e


def _csv_dict(crudo):
    texto = crudo.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(texto, newline="")))


def _clave_fila(fila):
    return {_encabezado(k): v for k, v in fila.items() if k is not None}


def _id_contabilidad(v):
    texto = str(v).strip()
    if not re.fullmatch(r"\d+", texto):
        raise NoEsDato("ID de contabilidad invalido {!r}".format(v))
    return texto


def _campo_prefijo(fila, prefijo):
    coincidencias = [valor for clave, valor in fila.items()
                     if clave == prefijo or clave.startswith(prefijo + " ")]
    if len(coincidencias) > 1:
        raise NoEsDato("mas de una columna empieza con {!r}".format(prefijo))
    return coincidencias[0] if coincidencias else None


def _contienda(ambito, cargo, subnivel, distrito, municipio):
    fcargo = _encabezado(cargo)
    if ambito == "local" and "presidencia municipal" in fcargo:
        lugar = str(municipio or subnivel).strip()
        return "local-ayuntamiento-{}".format(_encabezado(lugar).replace(" ", "-")), lugar.title()
    if ambito == "local" and "diputacion" in fcargo:
        lugares = (str(distrito or "").strip(), str(subnivel or "").strip())
        numero = next((re.search(r"\d+", lugar) for lugar in lugares
                       if re.search(r"\d+", lugar)), None)
        if not numero:
            raise NoEsDato("diputacion local sin distrito: {!r}".format(lugares))
        return "local-diputacion-{}".format(int(numero.group())), "Distrito local {}".format(int(numero.group()))
    if ambito == "federal" and "senaduria" in fcargo:
        return "federal-senaduria-bc", "Senaduría por Baja California"
    if ambito == "federal" and "diputacion" in fcargo:
        lugares = (str(distrito or "").strip(), str(subnivel or "").strip())
        numero = next((re.search(r"\d+", lugar) for lugar in lugares
                       if re.search(r"\d+", lugar)), None)
        if not numero:
            raise NoEsDato("diputacion federal sin distrito: {!r}".format(lugares))
        return "federal-diputacion-{}".format(int(numero.group())), "Distrito federal {}".format(int(numero.group()))
    raise NoEsDato("cargo sin regla de contienda: {} / {}".format(ambito, cargo))


CATEGORIAS = {
    "financieros": "financieros",
    "operativos de la campana": "operativos",
    "produccion de los mensajes para radio y t v": "radio_tv",
    "propaganda": "propaganda",
    "propaganda en diarios revistas y otros medios impresos": "impresos",
    "propaganda en via publica": "via_publica",
    "propaganda exhibida en salas de cine": "cine",
    "propaganda utilitaria": "utilitaria",
    "redes sociales y propaganda exhibida en paginas de internet": "internet",
}


def _indice_unico(filas, etiqueta):
    salida = {}
    for cruda in filas:
        fila = {_encabezado(k): v for k, v in cruda.items()}
        identidad = _id_contabilidad(
            fila.get("id de contabilidad", fila.get("id contabilidad")))
        if identidad in salida:
            raise NoEsDato("{} repite ID de contabilidad {}".format(etiqueta, identidad))
        salida[identidad] = fila
    return salida


def _auditoria_desde_xlsx(crudo):
    obligatorias = {"id contabilidad", "total de gastos reportados", "total de gastos",
                    "tope de gastos", "estado eleccion"}
    with zipfile.ZipFile(io.BytesIO(crudo)) as z:
        hojas = [n for n in z.namelist()
                 if re.match(r"xl/worksheets/sheet\d+\.xml$", n)]
    ultimo_error = None
    for indice in range(len(hojas)):
        try:
            filas = _tabla(_xlsx_hoja(crudo, indice), obligatorias)
            return [f for f in filas
                    if _encabezado(f.get("estado eleccion")) == "baja california"]
        except NoEsDato as e:
            ultimo_error = e
    raise NoEsDato("ninguna de {} hojas trae la tabla de gastos ({})".format(
        len(hojas), ultimo_error or "sin hojas"))


def armar_gasto(config, bajar=_bajar, anexos=anexos_remotos):
    """Arma el documento final. No escribe: tiempo y disco quedan afuera."""
    candidaturas = []
    incidencias = []
    procesos = []
    fuentes = []
    total_origen = 0

    for p in config["procesos"]:
        ambito = p["ambito"]
        oyg = [_clave_fila(f) for f in _csv_dict(bajar(p["reporte_candidaturas"]))]
        oyg = [f for f in oyg if _encabezado(f.get("estado eleccion")) == "baja california"]
        gxr = [_clave_fila(f) for f in _csv_dict(bajar(p["reporte_desglose"]))]
        gxr = [f for f in gxr if _encabezado(f.get("estado eleccion")) == "baja california"]
        por_id = _indice_unico(oyg, "reporte de candidaturas {}".format(ambito))
        desglose = _indice_unico(gxr, "reporte por rubro {}".format(ambito))
        if len(por_id) != p["filas_esperadas"]:
            raise NoEsDato(
                "{} trajo {} candidaturas de Baja California; se esperaban {}".format(
                    p["reporte_candidaturas"], len(por_id), p["filas_esperadas"]))

        filas_auditoria = []
        for url, nombre, crudo in anexos(
                p["indice_anexos"], p["patron_zip"], p["patron_anexo"],
                p.get("patron_entidad")):
            fuentes.append({"tipo": "anexo_auditoria", "ambito": ambito, "url": url,
                            "archivo": os.path.basename(nombre)})
            filas_auditoria.extend(_auditoria_desde_xlsx(crudo))
        auditoria = _indice_unico(filas_auditoria, "Anexo II {}".format(ambito))
        total_origen += len(por_id)

        for identidad, base in por_id.items():
            auditada = auditoria.get(identidad)
            rubros = desglose.get(identidad)
            if auditada is None or rubros is None:
                faltante = "Anexo II" if auditada is None else "reporte por rubro"
                incidencias.append({"proceso": p["id"], "id_contabilidad": identidad,
                                    "nombre": str(base.get("nombre completo", "")).strip(),
                                    "razon": "sin {}".format(faltante)})
                continue
            cargo = str(base.get("cargo", "")).strip()
            subnivel = str(base.get("subnivel entidad", "")).strip()
            contienda_id, contienda = _contienda(
                ambito, cargo, subnivel, auditada.get("distrito eleccion"),
                auditada.get("municipio eleccion"))
            categorias = {nombre: _dinero(rubros.get(clave), None)
                          for clave, nombre in CATEGORIAS.items()}
            reportado = _dinero(auditada.get("total de gastos reportados"), None)
            determinado = _dinero(
                auditada.get("total de gastos determinados por auditoria"), None)
            final = _dinero(auditada.get("total de gastos"), None)
            if reportado is None or determinado is None or final is None:
                incidencias.append({
                    "proceso": p["id"], "id_contabilidad": identidad,
                    "nombre": str(base.get("nombre completo", "")).strip(),
                    "razon": "Anexo II sin totales auditados completos",
                })
                continue
            tope = _dinero(auditada.get("tope de gastos"), None)
            sujeto = str(base.get("sujeto obligado", "")).strip().title()
            partido = str(base.get("siglas", "")).strip() or sujeto
            candidaturas.append({
                "id": "{}-{}".format(p["id"], identidad),
                "proceso": p["id"],
                "id_contabilidad": identidad,
                "nombre": str(base.get("nombre completo", "")).strip().title(),
                "ambito": ambito,
                "cargo": cargo.title(),
                "contienda_id": contienda_id,
                "contienda": contienda,
                "partido": partido,
                "sujeto_obligado": sujeto,
                "tipo_asociacion": str(base.get("tipo asociacion", "")).strip(),
                "gasto_reportado": reportado,
                "desglose_reportado": categorias,
                "diferencia_prorrateo": _dinero(auditada.get("diferencia de prorrateo"), None),
                "auditoria": {
                    "no_reportado": _dinero(_campo_prefijo(
                        auditada, "gasto no reportado anexo ii a"), None),
                    "ajustes_reclasificaciones": _dinero(
                        _campo_prefijo(auditada,
                                       "ajustes o reclasificaciones de auditoria"), None),
                    "quejas": _dinero(auditada.get("quejas"), None),
                    "determinado": determinado,
                },
                "gasto_auditado": final,
                "tope": tope,
            })

        extras = sorted(set(auditoria) - set(por_id))
        for identidad in extras:
            incidencias.append({"proceso": p["id"], "id_contabilidad": identidad,
                                "nombre": str(auditoria[identidad].get("nombre del candidato", "")).strip().title(),
                                "razon": "Anexo II sin fila en reporte de candidaturas"})
        procesos.append({k: p[k] for k in ("id", "nombre", "ambito", "estado", "eleccion",
                                           "dictamen", "dictamen_url", "corte")})
        fuentes.extend([
            {"tipo": "reporte_candidaturas", "ambito": ambito, "url": p["reporte_candidaturas"]},
            {"tipo": "reporte_desglose", "ambito": ambito, "url": p["reporte_desglose"]},
        ])

    candidaturas.sort(key=lambda c: (fold(c["nombre"]), c["id"]))
    incidencias.sort(key=lambda x: (x["proceso"], int(x["id_contabilidad"]), x["razon"]))
    fuentes.sort(key=lambda x: (x["tipo"], x.get("ambito", ""), x["url"], x.get("archivo", "")))
    return {
        "esquema": 1,
        "moneda": "MXN",
        "procesos": procesos,
        "proceso_actual": config["proceso_actual"],
        "resumen": {"filas_origen": total_origen, "candidaturas": len(candidaturas),
                    "sin_conciliar": total_origen - len(candidaturas),
                    "incidencias": len(incidencias)},
        "candidaturas": candidaturas,
        "incidencias": incidencias,
        "fuentes": fuentes,
    }


def armar_financiamiento(config, bajar=_bajar):
    """Financiamiento asignado, separado del gasto y de las personas."""
    f = config["financiamiento"]
    ordinarias = _tabla(_xlsx_hoja(bajar(f["ordinarias_url"])),
                        {"partido politico", "monto anual"})
    especificas = _tabla(_xlsx_hoja(bajar(f["especificas_url"])),
                         {"partido politico", "monto anual"})
    por_nombre = {}
    for fila in ordinarias:
        nombre = str(fila.get("partido politico", "")).strip()
        if nombre:
            por_nombre[_encabezado(nombre)] = {
                "id": _encabezado(nombre).replace(" ", "-"),
                "nombre": nombre.title(),
                "ordinario_original": _dinero(fila.get("monto anual"), None),
                "especifico": None,
            }
    for fila in especificas:
        nombre = str(fila.get("partido politico", "")).strip()
        if nombre:
            clave = _encabezado(nombre)
            if clave not in por_nombre:
                raise NoEsDato("actividades especificas trae partido sin ordinarias: {}".format(nombre))
            por_nombre[clave]["especifico"] = _dinero(fila.get("monto anual"), None)

    incompletos = [p["nombre"] for p in por_nombre.values()
                   if p["ordinario_original"] is None or p["especifico"] is None]
    if incompletos:
        raise NoEsDato("financiamiento sin monto anual para: {}".format(
            ", ".join(sorted(incompletos))))

    ajuste = f["ajuste_pesbc"]
    clave_pes = _encabezado(ajuste["partido"])
    if clave_pes not in por_nombre:
        raise NoEsDato("el ajuste no encuentra {} en el XLSX".format(ajuste["partido"]))
    pes = por_nombre[clave_pes]
    pes["ordinario_vigente"] = ajuste["presupuesto_ordinario_vigente"]
    pes["ministrado_enero_mayo"] = ajuste["ministrado_enero_mayo"]
    pes["excedente_ministrado"] = ajuste["excedente_ministrado"]

    partidos = []
    for clave in sorted(por_nombre):
        p = por_nombre[clave]
        ordinario = p.get("ordinario_vigente", p["ordinario_original"])
        p["ordinario_vigente"] = ordinario
        p["total_asignado"] = round(ordinario + p["especifico"], 2)
        partidos.append(p)
    return {
        "esquema": 1,
        "ejercicio": f["ejercicio"],
        "moneda": "MXN",
        "corte": f["corte"],
        "aviso": "Financiamiento público asignado; no equivale a gasto ejercido ni a gasto de campaña.",
        "acuerdos": f["acuerdos"],
        "partidos": partidos,
        "totales": {
            "ordinario_vigente": round(sum(p["ordinario_vigente"] for p in partidos), 2),
            "especifico": round(sum(p["especifico"] for p in partidos), 2),
            "asignado": round(sum(p["total_asignado"] for p in partidos), 2),
        },
        "fuentes": sorted({f["ordinarias_url"], f["especificas_url"],
                            ajuste["acuerdo_url"]}),
    }


def leer_config(ruta="config/gasto-electoral.json"):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)
