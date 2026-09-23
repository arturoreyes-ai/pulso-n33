"""Publicidad politica: Julieta no tiene 380 campanas ni gasto solo en BC.

El 21-09-2026 la biblioteca mostraba ~380 resultados, algunos agrupaban
varios anuncios; el filtro de entrega BC no recortaba su gasto nacional.
Por eso la identidad es el id de biblioteca, las cifras conservan ambito y
periodo y una lectura interrumpida nunca se convierte en una lista completa.
Sin credenciales, sin modelo y fuera del cron. El reloj lo recibe el CLI.
"""

import copy
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlencode

DESDE = "2024-01-01"
VENTANAS = ("7", "30", "90")
PERIODOS = ("1", "7", "30", "90", "todo")
BASE = "https://business.facebook.com/ads/library/"


def url_biblioteca(pagina_id, region=None):
    parametros = {"active_status": "all", "ad_type": "political_and_issue_ads",
                  "country": "MX", "media_type": "all", "search_type": "page",
                  "view_all_page_id": pagina_id}
    if region:
        parametros["regions[0]"] = region
    return BASE + "?" + urlencode(parametros)


def leer(ruta, defecto=None):
    ruta = Path(ruta)
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else defecto


def escribir(ruta, datos):
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, indent=1) + "\n"
    # No tocar el archivo si el mismo insumo produce exactamente lo mismo.
    if not ruta.exists() or ruta.read_text(encoding="utf-8") != texto:
        temporal = ruta.with_suffix(".tmp")
        temporal.write_text(texto, encoding="utf-8", newline="\n")
        temporal.replace(ruta)


def seccion(fuente, periodo=None, geografia="MX", estado="sin_dato",
            datos=None, consultado=None, completo=False, motivo=None):
    return {"estado": estado, "fuente": fuente, "periodo": periodo,
            "geografia": geografia, "consultado": consultado,
            "ultimo_exito": consultado if datos is not None else None,
            "completo": completo, "motivo": motivo, "datos": datos}


def perfil_vacio(persona):
    pagina_id = persona["pagina"]["id"]
    fuente = url_biblioteca(pagina_id)
    return {"esquema": 1, "persona_id": persona["id"], "pagina_id": pagina_id,
            "anuncios": seccion(fuente), "informacion": seccion(fuente),
            "audiencia": {v: seccion(fuente) for v in VENTANAS}}


def combinar_seccion(anterior, nueva):
    """Un fallo conserva los datos y la fecha reales, nunca renueva su edad."""
    if nueva is None:
        return copy.deepcopy(anterior)
    resultado = copy.deepcopy(nueva)
    if nueva["datos"] is None and anterior and anterior["datos"] is not None:
        for clave in ("datos", "ultimo_exito", "periodo", "geografia", "fuente"):
            resultado[clave] = copy.deepcopy(anterior[clave])
        resultado["completo"] = False
    return resultado


def normalizar_anuncios(anuncios, desde=DESDE):
    """Identidad por biblioteca; un texto repetido puede ser otro anuncio."""
    unicos = {}
    for anuncio in anuncios:
        fin = anuncio.get("hasta")
        if fin and fin < desde:
            continue
        ident = anuncio["id"]
        previo = unicos.get(ident)
        if previo and previo["pagina_id"] != anuncio["pagina_id"]:
            raise ValueError("Un id de anuncio aparece en dos paginas")
        # Conserva la version mas detallada. Empate resuelto por contenido,
        # independiente del orden en que llegaron las paginas.
        def calidad(fila):
            return (not bool(fila.get("grupo")), sum(v is not None for v in fila.values()),
                    json.dumps(fila, sort_keys=True, ensure_ascii=False))
        if previo is None or calidad(anuncio) > calidad(previo):
            unicos[ident] = copy.deepcopy(anuncio)
    return sorted(unicos.values(), key=lambda a: (a.get("desde") or "", a["id"]), reverse=True)


def armar(config, capturas, anteriores=None, reporte_anterior=None):
    """Una importacion es evidencia fechada, no un permiso para cambiar identidades."""
    anteriores = anteriores or {}
    personas = {p["id"]: p for p in config["personas"]}
    for ident, captura in capturas.get("perfiles", {}).items():
        persona = personas.get(ident)
        if not persona or not persona["pagina"]:
            raise ValueError("Captura sin pagina verificada: " + ident)
        if captura.get("pagina_id") != persona["pagina"]["id"]:
            raise ValueError("La captura no corresponde a la pagina verificada: " + ident)
    detalles, perfiles = {}, []
    for persona in sorted(personas.values(), key=lambda p: p["id"]):
        perfil = {k: copy.deepcopy(persona[k]) for k in
                  ("id", "roster_id", "nombre", "cargo", "partido", "ambito", "pagina", "ine")}
        perfil.update(estado="sin_dato", anuncios=None, actualizado=None, totales=[])
        if persona["pagina"]:
            previo = anteriores.get(persona["id"])
            if previo and previo["pagina_id"] != persona["pagina"]["id"]:
                raise ValueError("Cambio de pagina: no se puede heredar su historial")
            detalle = copy.deepcopy(previo or perfil_vacio(persona))
            captura = capturas.get("perfiles", {}).get(persona["id"], {})
            for clave in ("anuncios", "informacion"):
                detalle[clave] = combinar_seccion(detalle[clave], captura.get(clave))
            anuncios = detalle["anuncios"]
            if anuncios["datos"] is not None:
                anuncios["datos"] = normalizar_anuncios(anuncios["datos"])
            for ventana in VENTANAS:
                detalle["audiencia"][ventana] = combinar_seccion(
                    detalle["audiencia"][ventana], captura.get("audiencia", {}).get(ventana))
            secciones = [detalle["anuncios"], detalle["informacion"], *detalle["audiencia"].values()]
            fechas = [s["ultimo_exito"] for s in secciones if s["ultimo_exito"]]
            perfil["actualizado"] = max(fechas) if fechas else None
            perfil["anuncios"] = len(anuncios["datos"]) if anuncios["datos"] is not None else None
            perfil["estado"] = ("ok" if all(s["estado"] == "ok" and s["completo"] for s in secciones)
                                else "parcial" if fechas else "sin_dato")
            info = detalle["informacion"]["datos"]
            if info:
                perfil["totales"] = copy.deepcopy(info["totales"])
            detalles[persona["id"]] = detalle
        perfiles.append(perfil)
    reporte = {}
    for periodo in PERIODOS:
        previo = (reporte_anterior or {}).get(periodo, seccion(BASE + "report/?country=MX"))
        reporte[periodo] = combinar_seccion(previo, capturas.get("reporte", {}).get(periodo))
    fechas = [p["actualizado"] for p in perfiles if p["actualizado"]]
    fechas += [s["ultimo_exito"] for s in reporte.values() if s["ultimo_exito"]]
    indice = {"esquema": 1, "desde": DESDE, "pais": "MX", "tipo": "politica",
              "actualizado": max(fechas) if fechas else None, "perfiles": perfiles, "reporte": reporte}
    return indice, detalles


def publicar(config, capturas, salida):
    """Escribe el indice y un detalle por persona bajo `salida`.

    Los archivos se llaman `pauta-meta`, no `publicidad-meta`, y el nombre no
    es cosmetico: el sitio los pide por HTTP y las listas de filtrado en
    espanol —EasyList Spanish, que uBlock Origin activa sola a quien navega en
    espanol— bloquean cualquier URL que contenga «publicidad». El panel salia
    con «No se pudo cargar Publicidad Meta» y la consola decia
    ERR_BLOCKED_BY_CLIENT mientras el servidor respondia 200: el bloqueo pasa
    en el navegador, antes de salir. En produccion le pasaria igual a cualquier
    visitante con esas listas. `pauta` es el termino de medios y no esta en
    ninguna lista. La config (`config/publicidad-meta.json`) y el cache NO se
    renombran: no se sirven por HTTP y nadie los bloquea.
    """
    from .validador import validar_publicidad_meta, validar_perfil_meta
    salida = Path(salida)
    anterior = leer(salida / "pauta-meta.json", {})
    anteriores = {p["id"]: leer(salida / "pauta-meta" / (p["id"] + ".json"))
                  for p in config["personas"] if p["pagina"]}
    indice, detalles = armar(config, capturas, anteriores, anterior.get("reporte"))
    errores, _ = validar_publicidad_meta(indice, config, detalles)
    for detalle in detalles.values():
        errores += validar_perfil_meta(detalle, config)[0]
    if errores:
        raise ValueError("; ".join(errores))
    for ident, detalle in detalles.items():
        escribir(salida / "pauta-meta" / (ident + ".json"), detalle)
    escribir(salida / "pauta-meta.json", indice)
    return indice


MESES = {m: n for n, m in enumerate(
    ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}


def fecha_meta(texto):
    coincidencia = re.search(r"([A-Z][a-z]{2}) (\d{1,2}), (\d{4})", texto)
    if not coincidencia or coincidencia[1] not in MESES:
        return None
    try:
        return date(int(coincidencia[3]), MESES[coincidencia[1]], int(coincidencia[2])).isoformat()
    except ValueError:
        return None


def numero_meta(texto):
    texto = texto.strip().replace(",", "").replace("MX$", "").replace("$", "")
    coincidencia = re.fullmatch(r"(\d+(?:\.\d+)?)\s*([KM])?", texto)
    if not coincidencia:
        return None
    return float(coincidencia[1]) * {None: 1, "K": 1000, "M": 1000000}[coincidencia[2]]


def rango_meta(texto):
    texto = texto.strip()
    partes = re.split(r"\s*[-–]\s*", texto)
    if len(partes) == 2:
        minimo, maximo = (numero_meta(p) for p in partes)
    elif texto.startswith((">", "<")):
        valor = numero_meta(texto[1:])
        minimo, maximo = (valor, None) if texto[0] == ">" else (None, valor)
    else:
        minimo = maximo = numero_meta(texto)
    if minimo is None and maximo is None:
        return None
    return {"minimo": minimo, "maximo": maximo}


def anuncio_de_texto(texto, pagina_id, regiones=None):
    """Solo texto renderizado de UNA tarjeta; no estado oculto ni GraphQL."""
    ident = re.search(r"Library ID:\s*(\d+)", texto)
    if not ident:
        return None
    fechas = re.findall(r"[A-Z][a-z]{2} \d{1,2}, \d{4}", texto)
    lineas = [l.strip() for l in texto.splitlines() if l.strip()]
    def siguiente(etiqueta):
        for i, linea in enumerate(lineas):
            if etiqueta in linea:
                resto = linea.split(etiqueta, 1)[1].strip()
                return resto or (lineas[i + 1] if i + 1 < len(lineas) else "")
        return ""
    patrocinio = re.search(r"Paid for by\s+([^\n]+)", texto)
    inicio = patrocinio or re.search(r"Sponsored[^\n]*", texto)
    cuerpo = texto.split(inicio[0], 1)[1].strip() if inicio else None
    if cuerpo:
        cuerpo = re.split(r"\n(?:Play video|\d+:\d+\s*/|See ad details|See summary details)", cuerpo)[0].strip()
    grupo = re.search(r"(\d+) ads\s+use this creative and text", texto)
    moneda = re.search(r"Amount spent \(([A-Z]{3})\)", texto)
    return {"id": ident[1], "pagina_id": pagina_id,
            "url": "https://www.facebook.com/ads/library/?id=" + ident[1],
            "estado": "inactivo" if re.search(r"\bInactive\b", texto) else
                      "activo" if re.search(r"\bActive\b", texto) else "desconocido",
            "desde": fecha_meta(fechas[0]) if fechas else None,
            "hasta": fecha_meta(fechas[1]) if len(fechas) > 1 else None,
            "texto": cuerpo, "pagador": patrocinio[1].strip() if patrocinio else None,
            "moneda": moneda[1] if moneda else None,
            "gasto": rango_meta(siguiente("Amount spent (" + moneda[1] + "):")) if moneda else None,
            "impresiones": rango_meta(siguiente("Impressions:")),
            "tamano_audiencia": rango_meta(siguiente("Estimated audience size:")),
            "plataformas": [], "formato": "video" if "Play video" in texto else "desconocido",
            "regiones": regiones or [], "entrega": [],
            "grupo": int(grupo[1]) if grupo else None}
