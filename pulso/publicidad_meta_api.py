"""Lee la Biblioteca de Anuncios de Meta por su API oficial (`ads_archive`).

El caso que lo motivo: el 21 y el 22 de septiembre de 2026 el sondeo del
adaptador de navegador devolvio `bloqueado (robots)` para las DOS paginas
verificadas del catalogo --business.facebook.com rechaza al agente del
proyecto-- y nueve de las diez figuras se quedaron en `sin_dato` sin que nada
estuviera roto. Apagar `respetar_robots` no es la salida: es la frontera que
AGENTS.md fija y que `validar_publicidad_meta_config` obliga a documentar.
Alquilar un raspador tampoco, por el mismo motivo que no se alquila para
entrar con sesion: delegar el navegador no delega la responsabilidad.

`ads_archive` es el producto de transparencia de Meta, no una pagina raspada.
Se pide por HTTPS con un token, no hay sesion de nadie, no hay navegador y
robots.txt no gobierna una API. La referencia de Meta dice que devuelve los
anuncios "about social issues, elections or politics" entregados en cualquier
pais, y MX esta en `ad_reached_countries`, asi que el catalogo cabe entero.

Lo que cuesta es una verificacion de identidad de Meta --identificacion
oficial y domicilio-- hecha por una persona con nombre, igual que el token de
Apify fue un paso humano. Sin token este modulo NO escribe: levanta
RuntimeError, como el adaptador de navegador sin Playwright. La razon esta en
la seccion siguiente.

## Por que faltar no se publica como `sin_dato`

Seria el error de siempre --rellenar un hueco-- y ademas rompe el documento.
`combinar_seccion` conserva los datos anteriores cuando los nuevos son `None`,
asi que una seccion `sin_dato` con datos heredados llega al validador como
"ausencia con datos". Faltar el token es un problema de operacion, no un
hallazgo sobre el anunciante, y se dice en la salida del comando.

## Que NO trae esta fuente, y por eso se omite

La API da anuncios; no da el bloque de transparencia de la pagina ni el gasto
de 7/30/90 dias, que en el piloto salieron de una transcripcion manual. La
captura omite `informacion` y `audiencia` a proposito: `armar` conserva la
seccion anterior cuando la nueva no viene (docs/publicidad-meta.md), asi que
correr esto NO borra lo que Julieta ya tiene. Emitirlas vacias si lo borraria.

Tampoco trae el formato del creativo ni el "N ads use this creative", de modo
que `formato` sale `desconocido` y `grupo` sale `None`. Inventar "imagen"
porque no dijo "video" seria una afirmacion que la fuente no hace.

## Descubrir no es verificar

`descubrir()` busca por nombre y ENSENA candidatos; no escribe en la config.
La regla del catalogo --"no se atribuyen paginas por semejanza de nombres"--
no se relaja porque la respuesta venga de Meta: que la API devuelva una pagina
llamada como la persona sigue siendo semejanza de nombres. Lo que agrega es
`bylines`, la declaracion legal de quien pago el anuncio, que es evidencia de
otra clase. La decision, sus `fuentes` y su `razon` las escribe una persona en
config/publicidad-meta.json.
"""

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import entorno
from .publicidad_meta import DESDE, seccion, url_biblioteca

# La version va fijada, no flotante: una API que cambia sola debajo produce el
# fallo que este repositorio mas detesta, el que no avisa. Meta retira cada
# version unos dos anos despues de publicarla, asi que la fecha de caducidad se
# escribe aqui para que se pueda subir a tiempo en vez de descubrirlo por un
# 400. v25.0 salio el 18 de febrero de 2026 y caduca el 29 de julio de 2028;
# la mas nueva al escribir esto es v26.0 (29 de julio de 2026).
VERSION = "v25.0"
CADUCA = "2028-07-29"
BASE_API = "https://graph.facebook.com/" + VERSION + "/ads_archive"
AGENTE = "PulsoN33/1.0"
TIEMPO = 30
# Meta pagina de 25 por omision; 100 es su tope comodo por pagina.
POR_PAGINA = 100

# El token circula con varios nombres segun de donde se copie, igual que el de
# Apify (ver entorno.py). Se aceptan todos en vez de imponer uno.
NOMBRES_TOKEN = ("META_ADS_TOKEN", "META_API_TOKEN", "META_TOKEN",
                 "FACEBOOK_ADS_TOKEN")

CAMPOS = ("id", "page_id", "page_name", "ad_delivery_start_time",
          "ad_delivery_stop_time", "ad_creative_bodies", "bylines", "currency",
          "spend", "impressions", "estimated_audience_size",
          "publisher_platforms", "delivery_by_region",
          "demographic_distribution")

# Meta escribe las plataformas en mayusculas; el documento las publica con el
# nombre de producto que el validador acepta.
PLATAFORMAS = {"FACEBOOK": "Facebook", "INSTAGRAM": "Instagram",
               "MESSENGER": "Messenger", "AUDIENCE_NETWORK": "Audience Network",
               "THREADS": "Threads", "WHATSAPP": "WhatsApp"}


def token(entorno_base=None):
    """El token de la API, o '' si no esta configurado en ningun nombre."""
    return entorno.primero(*NOMBRES_TOKEN, entorno=entorno_base)


def _fecha(valor):
    """`2026-09-07T00:00:00+0000` -> `2026-09-07`. Ausente sigue ausente."""
    if not valor:
        return None
    return str(valor)[:10]


def _numero(valor):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _rango(valor):
    """`{lower_bound, upper_bound}` de Meta -> `{minimo, maximo}` del documento.

    Meta manda los limites como cadenas y a veces omite el superior (el tramo
    abierto de arriba). Un rango sin ningun limite no es un rango: es ausencia.
    """
    if not isinstance(valor, dict):
        return None
    minimo = _numero(valor.get("lower_bound"))
    maximo = _numero(valor.get("upper_bound"))
    if minimo is None and maximo is None:
        return None
    if minimo is not None and maximo is not None and minimo > maximo:
        return None
    return {"minimo": minimo, "maximo": maximo}


def _porcentaje(valor):
    """El desglose se publica como texto: el validador exige par de cadenas."""
    numero = _numero(valor)
    return None if numero is None else "{:.4f}".format(numero).rstrip("0").rstrip(".") or "0"


def _entrega(filas):
    """Demografia de entrega, ordenada para que dos corridas no difieran."""
    pares = []
    for fila in filas or []:
        etiqueta = " ".join(str(fila.get(k)) for k in ("age", "gender") if fila.get(k))
        valor = _porcentaje(fila.get("percentage"))
        if etiqueta and valor:
            pares.append({"etiqueta": etiqueta, "valor": valor})
    return sorted(pares, key=lambda p: p["etiqueta"])


def _regiones(filas):
    nombres = {str(f.get("region")).strip() for f in filas or [] if f.get("region")}
    return sorted(nombres)


def _estado(hasta, hoy):
    """Meta no publica un booleano de actividad; lo dice la fecha de fin.

    Sin fecha de fin el anuncio sigue entregandose. Con fecha pasada, termino.
    No hay tercer caso que la fuente distinga, asi que no se inventa uno.
    """
    if hasta is None:
        return "activo"
    return "inactivo" if hasta < hoy else "activo"


def anuncio_de_api(fila, pagina_id, hoy):
    """Una fila de `ads_archive` -> el contrato de anuncio del documento."""
    ident = str(fila.get("id") or "")
    if not ident.isdigit():
        return None
    if str(fila.get("page_id") or "") != str(pagina_id):
        raise ValueError("La API devolvio un anuncio de otra pagina")
    cuerpos = [c for c in (fila.get("ad_creative_bodies") or []) if str(c).strip()]
    desde = _fecha(fila.get("ad_delivery_start_time"))
    hasta = _fecha(fila.get("ad_delivery_stop_time"))
    moneda = str(fila.get("currency") or "").strip().upper() or None
    plataformas = [PLATAFORMAS[p] for p in (fila.get("publisher_platforms") or [])
                   if p in PLATAFORMAS]
    return {"id": ident, "pagina_id": str(pagina_id),
            # La URL se construye, no se copia de `ad_snapshot_url`: esa lleva
            # el token de acceso pegado y el validador la rechaza con razon.
            "url": "https://www.facebook.com/ads/library/?id=" + ident,
            "estado": _estado(hasta, hoy),
            "desde": desde, "hasta": hasta,
            "texto": cuerpos[0].strip() if cuerpos else None,
            "pagador": (fila.get("bylines") or "").strip() or None,
            "moneda": moneda if moneda and len(moneda) == 3 and moneda.isalpha() else None,
            "gasto": _rango(fila.get("spend")),
            "impresiones": _rango(fila.get("impressions")),
            "tamano_audiencia": _rango(fila.get("estimated_audience_size")),
            "plataformas": sorted(set(plataformas)),
            "formato": "desconocido",
            "regiones": _regiones(fila.get("delivery_by_region")),
            "entrega": _entrega(fila.get("demographic_distribution")),
            "grupo": None}


def _pedir(url, abrir=None):
    """GET de JSON con stdlib. `abrir` se inyecta en las pruebas."""
    abrir = abrir or urlopen
    peticion = Request(url, headers={"User-Agent": AGENTE, "Accept": "application/json"})
    try:
        with abrir(peticion, timeout=TIEMPO) as respuesta:
            return json.loads(respuesta.read().decode("utf-8"))
    except HTTPError as exc:
        detalle = ""
        try:
            cuerpo = json.loads(exc.read().decode("utf-8"))
            detalle = cuerpo.get("error", {}).get("message", "")
        except (ValueError, OSError, AttributeError):
            detalle = ""
        raise RuntimeError("La API respondio {}{}".format(
            exc.code, ": " + detalle if detalle else "")) from exc
    except URLError as exc:
        raise RuntimeError("No se pudo consultar la API: {}".format(exc.reason)) from exc


def _consulta(llave, parametros):
    base = {"ad_reached_countries": json.dumps(["MX"]),
            "ad_type": "POLITICAL_AND_ISSUE_ADS",
            "ad_active_status": "ALL",
            "ad_delivery_date_min": DESDE,
            "fields": ",".join(CAMPOS),
            "limit": POR_PAGINA,
            "access_token": llave}
    base.update(parametros)
    return BASE_API + "?" + urlencode(base)


def _filas(url, limite, abrir=None):
    """Sigue el cursor de Meta. Devuelve (filas, completo).

    `completo` es falso cuando se agoto `limite` con cursor pendiente: eso es
    una lectura parcial y el documento tiene que decirlo, no aparentar censo.
    """
    filas, vistas = [], 0
    while url and vistas < limite:
        cuerpo = _pedir(url, abrir)
        filas.extend(cuerpo.get("data") or [])
        vistas += 1
        url = ((cuerpo.get("paging") or {}).get("next") or "") or None
    return filas, url is None


def cosechar(config, ahora, llave=None, persona_id=None, limite=100, abrir=None):
    """Anuncios de cada figura con pagina verificada.

    Misma forma de retorno que `publicidad_meta_navegador.cosechar`:
    `(capturas, sondeos)`, para que el comando despache a cualquiera de las
    dos sin saber cual corre.
    """
    if limite < 1 or limite > 1000:
        raise ValueError("max-paginas debe estar entre 1 y 1000")
    llave = llave or token()
    if not llave:
        raise RuntimeError(
            "Falta el token de la API de la Biblioteca de Anuncios. Define "
            + NOMBRES_TOKEN[0] + " en .env tras verificar identidad en Meta "
            "(developers.facebook.com, identificacion oficial y domicilio).")
    hoy = _fecha(ahora)
    personas = [p for p in config["personas"]
                if p["pagina"] and (persona_id is None or p["id"] == persona_id)]
    capturas, sondeos = {"perfiles": {}, "reporte": {}}, []
    for persona in personas:
        pagina_id = persona["pagina"]["id"]
        fuente = url_biblioteca(pagina_id)
        try:
            filas, completo = _filas(
                _consulta(llave, {"search_page_ids": json.dumps([pagina_id])}),
                limite, abrir)
        except RuntimeError as exc:
            capturas["perfiles"][persona["id"]] = {
                "pagina_id": pagina_id,
                "anuncios": seccion(fuente, estado="fallo", consultado=ahora,
                                    motivo="api_no_disponible")}
            sondeos.append({"id": persona["id"], "estado": "fallo",
                            "motivo": str(exc)})
            continue
        anuncios = [a for a in (anuncio_de_api(f, pagina_id, hoy) for f in filas) if a]
        capturas["perfiles"][persona["id"]] = {
            "pagina_id": pagina_id,
            "anuncios": seccion(fuente, periodo={"desde": DESDE, "hasta": hoy},
                                estado="ok" if completo else "parcial",
                                datos=anuncios, consultado=ahora,
                                completo=completo)}
        sondeos.append({"id": persona["id"], "estado": "ok",
                        "anuncios": len(anuncios), "completo": completo})
    return capturas, sondeos


def descubrir(config, llave=None, persona_id=None, limite=5, abrir=None):
    """Candidatos de pagina para las figuras SIN pagina verificada.

    No escribe nada. Devuelve, por persona, las paginas que aparecen en los
    anuncios politicos que nombran a la persona, con su id, su nombre de
    pagina, quien declaro pagarlos (`bylines`) y cuantos anuncios sostienen la
    coincidencia. Eso es material para decidir, no la decision.
    """
    llave = llave or token()
    if not llave:
        raise RuntimeError(
            "Falta el token de la API de la Biblioteca de Anuncios. Define "
            + NOMBRES_TOKEN[0] + " en .env tras verificar identidad en Meta.")
    salida = []
    for persona in config["personas"]:
        if persona["pagina"] or (persona_id is not None and persona["id"] != persona_id):
            continue
        filas, _ = _filas(_consulta(llave, {"search_terms": persona["nombre"]}),
                          limite, abrir)
        paginas = {}
        for fila in filas:
            pid = str(fila.get("page_id") or "")
            if not pid.isdigit():
                continue
            entrada = paginas.setdefault(pid, {
                "pagina_id": pid, "nombre": str(fila.get("page_name") or "").strip(),
                "pagadores": set(), "anuncios": 0})
            entrada["anuncios"] += 1
            if (fila.get("bylines") or "").strip():
                entrada["pagadores"].add(fila["bylines"].strip())
        candidatos = sorted(
            ({"pagina_id": v["pagina_id"], "nombre": v["nombre"],
              "pagadores": sorted(v["pagadores"]), "anuncios": v["anuncios"],
              "url": url_biblioteca(v["pagina_id"])} for v in paginas.values()),
            key=lambda c: (-c["anuncios"], c["pagina_id"]))
        salida.append({"id": persona["id"], "nombre": persona["nombre"],
                       "candidatos": candidatos})
    return salida
