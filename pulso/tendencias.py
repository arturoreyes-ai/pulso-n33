"""Tendencias de X por ubicacion, leidas por Apify sin iniciar sesion.

X cerro la lectura anonima en 2023, y desde entonces los raspadores de TUITS
que sirven piden cookies de sesion: es el caso que docs/PLAN.md seccion 3
refusa y por eso `apidojo~tweet-scraper` sigue de senuelo en config/apify.json.
El 11 de septiembre de 2026 el cliente pidio "que es tendencia en X" para la
region, Mexico y el mundo, y las tendencias resultaron ser la excepcion: el
endpoint de tendencias de X sigue contestando a un guest token, la misma
credencial anonima que recibe un navegador sin cuenta. Eso es lo que hace el
actor `automation-lab~twitter-trends-scraper`: su entrada son ubicaciones y un
tope, sin cookies ni contrasena, asi que pasa la guardia de pulso/apify.py.
Nadie inicia sesion. La postura legal es la misma que la del actor de
Instagram -- deslogueado, pendiente de opinion legal, detras de
APIFY_HABILITADO -- y la alternativa limpia queda escrita: la API oficial de
X cobra hoy 0.01 USD por llamada a GET /2/trends/by/woeid (pago por uso).

## Lo que se publica y lo que no

De cada tendencia va el nombre, el puesto que X le dio y la liga a su
busqueda en X. Nada mas. Ni un tuit, ni quien lo escribio: un nombre que
empieza con @ es la identidad de alguien y se descarta. Las tendencias
promocionadas son anuncios y se descartan tambien, contadas en `salud`.

## El ranking es de X, no nuestro

`puesto` es el rank que devuelve X y no se renumera al quitar promocionadas:
un hueco en la numeracion es la huella honesta de un anuncio. El tablero dice
"segun X"; esto no mide de que habla la ciudad, mide que decidio destacar el
algoritmo de X para esa ubicacion.

## Volumen: casi siempre "sin dato"

X retiro el volumen de tuits de la mayoria de las tendencias en enero de
2026. `volumen` va solo cuando X lo da y es mayor que 0; ausente es "sin
dato", nunca 0 (PRODUCT.md, cuarta regla).

## Ubicaciones: las que X publica, y los huecos escritos

X publica listas para 467 ubicaciones. En la region solo Tijuana, Mexicali y
San Diego tienen la suya; Ensenada, Rosarito, Tecate, San Quintin y San Felipe
no, y eso no se rellena con la lista nacional: cada una tiene una fila apagada
en config/tendencias.json (`sin_lista`) para que el tablero rotule el hueco.
Mexico es `nacional` y el mundo es `mundial`; ninguno de los dos lleva zona.

## Una llamada por corrida

El actor acepta varias ubicaciones en una entrada, asi que el cron paga una
sola corrida del actor por cada `pulso tendencias`: ~100 tendencias, unos
centavos. El presupuesto se revisa ANTES de llamar, porque
`Presupuesto.cobrar` avisa despues de gastado.
"""

from datetime import datetime, timezone
from urllib.parse import quote

from .apify import Presupuesto, SinToken, correr_actor, token

ACTOR = "automation-lab~twitter-trends-scraper"
PLATAFORMA = "x"
# Como se accede: sin sesion. Es un valor fijo que el validador exige, para
# que un cambio a un actor que si pida cookies no pase callado a data/.
ACCESO = "sin_sesion"

MAXIMO_POR_UBICACION = 20
# Tope del actor (y de X) por ubicacion.
TOPE_ACTOR = 50
# WOEID de "Worldwide". El actor lo recibe como la palabra, no como el numero.
MUNDIAL_WOEID = 1
NOMBRE_MAXIMO = 100
PREFIJO_BUSQUEDA = "https://x.com/search?q="

AMBITOS = ("zona", "nacional", "mundial")
ESTADOS = ("ok", "fallo", "sin_token", "sin_dato", "sin_lista")

# Campos crudos del actor que NUNCA cruzan a data/. Documental: `_limpiar`
# construye su salida campo por campo y no resta de esta lista.
CAMPOS_CRUDOS = ("tweetVolume", "tweetVolumeAvailable", "isPromoted", "isHashtag",
                 "twitterSearchUrl", "query", "locationsTrendingIn", "bestRank",
                 "scrapedAt", "locationCount", "locationName", "countryCode",
                 "countryName", "locationType")


# ---------------------------------------------------------------- entrada

def _woeid(valor):
    """WOEID como entero positivo, o None si no lo es."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int):
        return valor if valor > 0 else None
    if isinstance(valor, str) and valor.strip().isdigit():
        return int(valor.strip()) or None
    return None


def _activas(ubicaciones):
    """Las ubicaciones que se piden: activas y con WOEID, ordenadas por id."""
    activas = [u for u in (ubicaciones or []) if u.get("activo") and _woeid(u.get("woeid"))]
    return sorted(activas, key=lambda u: u["id"])


def _codigo(woeid):
    """Como el actor nombra una ubicacion: 'worldwide' para el WOEID 1 y el
    numero como texto para las demas. Una sola representacion, la misma que
    imprime --ubicaciones; nunca codigos de pais."""
    return "worldwide" if woeid == MUNDIAL_WOEID else str(woeid)


def _entrada(ubicaciones, maximo):
    """La entrada del actor: ubicaciones y tope. Sin cookies ni credenciales,
    y la guardia de pulso/apify.py lo comprueba igual antes de llamar."""
    return {
        "locations": [_codigo(_woeid(u["woeid"])) for u in _activas(ubicaciones)],
        "maxTrendsPerLocation": min(max(1, int(maximo)), TOPE_ACTOR),
    }


# ---------------------------------------------------------------- limpieza

def _corte(crudo):
    """`asOf` de X en el formato de `ahora`: UTC, con zona, sin microsegundos.

    Mismas tres reglas que instagram._publicado: la Z se cambia por +00:00
    (fromisoformat no la acepta en Python 3.9), una hora sin zona se toma como
    UTC en vez de pasar por astimezone() -- que en un datetime ingenuo usa la
    zona de la maquina y haria que el runner y una laptop en Tijuana
    escribieran bytes distintos -- y los microsegundos se tiran.
    """
    if not isinstance(crudo, str) or not crudo.strip():
        return None
    try:
        dt = datetime.fromisoformat(crudo.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    return dt.replace(microsecond=0).isoformat()


def _url(nombre):
    """La busqueda de esa tendencia en X, construida aqui y no copiada del
    actor: una frase de varias palabras va entre comillas, como la arma X, y
    un hashtag o una palabra sola van tal cual."""
    consulta = nombre if nombre.startswith("#") or " " not in nombre else '"' + nombre + '"'
    return PREFIJO_BUSQUEDA + quote(consulta, safe="")


def _limpiar(item):
    """Lista blanca de un item del actor. Devuelve (registro, motivo).

    El motivo es None cuando hay registro; si no, dice por que se tiro:
    'promocionada' (anuncio), 'identidad' (un @usuario como tendencia),
    'sin_nombre' o 'sin_puesto'. `salud` cuenta las promocionadas.
    """
    if not isinstance(item, dict):
        return None, "sin_nombre"
    nombre = (item.get("name") or "").strip()
    if not nombre:
        return None, "sin_nombre"
    if item.get("isPromoted"):
        return None, "promocionada"
    if nombre.startswith("@"):
        return None, "identidad"
    puesto = item.get("rank")
    if isinstance(puesto, bool) or not isinstance(puesto, int) or puesto < 1:
        return None, "sin_puesto"
    registro = {"puesto": puesto, "nombre": nombre[:NOMBRE_MAXIMO], "url": _url(nombre)}
    # X retiro el volumen de casi todas las tendencias en enero de 2026. Va
    # solo cuando X lo da y es mayor que 0; ausente es "sin dato", nunca 0.
    volumen = item.get("tweetVolume")
    disponible = item.get("tweetVolumeAvailable")
    if disponible is None:
        disponible = volumen is not None
    if disponible and isinstance(volumen, int) and not isinstance(volumen, bool) and volumen > 0:
        registro["volumen"] = volumen
    return registro, None


def limpiar(items):
    """Agrupa los items del actor por WOEID y los pasa por la lista blanca.

    Devuelve {woeid: {"corte", "tendencias", "descartes"}}: las tendencias en
    el orden de X (por puesto, sin renumerar; un puesto repetido se queda con
    la primera) y los descartes contados por motivo. Un item sin WOEID no se
    puede atribuir a ninguna ubicacion y cae en la clave 0.
    """
    grupos = {}
    for it in items or []:
        if not isinstance(it, dict):
            continue
        woeid = _woeid(it.get("locationWoeid")) or 0
        g = grupos.setdefault(woeid, {"corte": None, "tendencias": [], "descartes": {}})
        if g["corte"] is None:
            g["corte"] = _corte(it.get("asOf"))
        registro, motivo = _limpiar(it)
        if registro is None:
            g["descartes"][motivo] = g["descartes"].get(motivo, 0) + 1
        else:
            g["tendencias"].append(registro)
    for g in grupos.values():
        g["tendencias"].sort(key=lambda t: (t["puesto"], t["nombre"]))
        unicas, visto = [], set()
        for t in g["tendencias"]:
            if t["puesto"] not in visto:
                visto.add(t["puesto"])
                unicas.append(t)
        g["tendencias"] = unicas
        g["descartes"] = dict(sorted(g["descartes"].items()))
    return grupos


# ----------------------------------------------------------------- cosecha

def _fila_salud(u, estado, tendencias=0, promocionadas=0, error=None, nota=None):
    fila = {"ubicacion": u["id"], "estado": estado, "tendencias": tendencias,
            "promocionadas": promocionadas}
    if error:
        fila["error"] = str(error)[:200]
    if nota:
        fila["nota"] = nota
    return fila


def cosechar(ubicaciones, ahora, tok=None, presupuesto=None, maximo=MAXIMO_POR_UBICACION,
             entorno=None):
    """Una llamada al actor para todas las ubicaciones activas.

    Devuelve (por_woeid, salud, gasto). Sin token no truena: cada ubicacion
    activa sale con estado `sin_token` y el tablero lo dice. El presupuesto se
    revisa antes de llamar: `Presupuesto.cobrar` avisa cuando el cargo ya se
    hizo, y aqui una sola llamada es todo el gasto de la corrida.
    """
    activas = _activas(ubicaciones)
    presupuesto = presupuesto or Presupuesto()
    maximo = min(max(1, int(maximo)), TOPE_ACTOR)
    try:
        tok = tok or token(entorno)
    except SinToken as e:
        return ({}, [_fila_salud(u, "sin_token", error=str(e)) for u in activas],
                presupuesto.resumen())
    if not activas:
        return {}, [], presupuesto.resumen()

    necesarios = maximo * len(activas)
    if presupuesto.resultados - presupuesto.gastado < necesarios:
        error = ("presupuesto insuficiente: {} ubicaciones x {} tendencias = {} resultados y "
                 "el tope es {}. Sube presupuesto_resultados en config/tendencias.json o "
                 "baja maximo_por_ubicacion; con menos, el actor recortaria en silencio."
                 ).format(len(activas), maximo, necesarios, presupuesto.resultados)
        return {}, [_fila_salud(u, "fallo", error=error) for u in activas], presupuesto.resumen()

    try:
        items = correr_actor(ACTOR, _entrada(activas, maximo), tok, necesarios)
        presupuesto.cobrar(ACTOR, len(items))
    except Exception as e:
        error = "{}: {}".format(type(e).__name__, e)[:200]
        return {}, [_fila_salud(u, "fallo", error=error) for u in activas], presupuesto.resumen()

    por_woeid = limpiar(items)
    salud = []
    for u in activas:
        g = por_woeid.get(_woeid(u["woeid"])) or {"tendencias": [], "descartes": {}}
        promocionadas = g["descartes"].get("promocionada", 0)
        if not g["tendencias"]:
            salud.append(_fila_salud(u, "sin_dato", promocionadas=promocionadas,
                                     nota="el actor no devolvio tendencias para esta ubicacion"))
            continue
        salud.append(_fila_salud(u, "ok", tendencias=len(g["tendencias"][:maximo]),
                                 promocionadas=promocionadas))
    return por_woeid, sorted(salud, key=lambda s: s["ubicacion"]), presupuesto.resumen()


# --------------------------------------------------------------- derivados

def derivar(por_woeid, ahora, salud, gasto, ubicaciones, maximo=MAXIMO_POR_UBICACION):
    """data/tendencias.json: una fila por ubicacion del config, activa o hueco.

    Las filas van ordenadas por id y las tendencias por puesto, para que dos
    corridas sobre la misma respuesta escriban bytes identicos. `salud` se
    normaliza aqui contra lo que de verdad sale en cada fila -- el validador
    exige que cuadren -- y un `sin_token` o `fallo` reportado por la cosecha
    manda sobre cualquier dato suelto.
    """
    maximo = min(max(1, int(maximo)), TOPE_ACTOR)
    previa = {s["ubicacion"]: s for s in (salud or [])}
    filas, salud_final = [], []
    for u in sorted(ubicaciones or [], key=lambda u: u["id"]):
        woeid = _woeid(u.get("woeid"))
        activa = bool(u.get("activo")) and woeid is not None
        zona = u.get("zona")
        fila = {
            "id": u["id"],
            "nombre": u.get("nombre") or u["id"],
            "woeid": woeid if activa else None,
            "zona": zona,
            "ambito": u.get("ambito") or ("zona" if zona else "nacional"),
            "activa": activa,
        }
        if not activa:
            fila.update(estado="sin_lista", corte=None, tendencias=[])
            filas.append(fila)
            continue
        g = (por_woeid or {}).get(woeid) or {"corte": None, "tendencias": [], "descartes": {}}
        tendencias = g["tendencias"][:maximo]
        s = previa.get(u["id"]) or {}
        if s.get("estado") in ("sin_token", "fallo"):
            estado = s["estado"]
        else:
            estado = "ok" if tendencias else "sin_dato"
        fila.update(estado=estado, corte=g["corte"],
                    tendencias=tendencias if estado == "ok" else [])
        filas.append(fila)
        nota = s.get("nota")
        if estado == "sin_dato" and not nota:
            nota = "el actor no devolvio tendencias para esta ubicacion"
        salud_final.append(_fila_salud(
            u, estado, tendencias=len(fila["tendencias"]),
            promocionadas=g["descartes"].get("promocionada", 0),
            error=s.get("error"), nota=nota if estado == "sin_dato" else s.get("nota")))
    return {
        "esquema": 1,
        "generado": ahora,
        "plataforma": PLATAFORMA,
        "acceso": ACCESO,
        "maximo_por_ubicacion": maximo,
        "ubicaciones": filas,
        "salud": sorted(salud_final, key=lambda s: s["ubicacion"]),
        "gasto": gasto,
    }


# ------------------------------------------------------------- exploracion

def probar(ubicaciones, ahora, tok=None, entorno=None, maximo=5):
    """Una llamada con pocas tendencias por ubicacion. No escribe nada.

    Para leer, con ojos humanos, que devuelve el actor y como queda cada
    ubicacion antes de confiar en el cron. Devuelve, por ubicacion activa, las
    tendencias limpias y los descartes por motivo.
    """
    activas = _activas(ubicaciones)
    tok = tok or token(entorno)
    maximo = min(max(1, int(maximo)), TOPE_ACTOR)
    items = correr_actor(ACTOR, _entrada(activas, maximo), tok, maximo * len(activas))
    por_woeid = limpiar(items)
    salida = []
    for u in activas:
        g = por_woeid.get(_woeid(u["woeid"])) or {"corte": None, "tendencias": [], "descartes": {}}
        salida.append({"ubicacion": u["id"], "corte": g["corte"],
                       "tendencias": g["tendencias"][:maximo], "descartes": g["descartes"]})
    return salida


def ubicaciones_disponibles(tok=None, entorno=None, paises=("MX", "US")):
    """Las ubicaciones para las que X publica lista, filtradas a los paises de
    la region y al mundo. Cuesta una corrida del actor (~470 resultados).

    Es el equivalente de `redes --sondear`: un WOEID se enciende en
    config/tendencias.json solo despues de verlo aqui, y la `razon` cita la
    fecha. El modo de descubrimiento del actor exige `locations` aunque no las
    use (HTTP 400 si falta); se le da el mundo.
    """
    tok = tok or token(entorno)
    entrada = {"locations": [_codigo(MUNDIAL_WOEID)], "maxTrendsPerLocation": 1,
               "getAvailableLocations": True}
    items = correr_actor(ACTOR, entrada, tok, 600)
    salida = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        tipo = it.get("placeType") or "?"
        pais = it.get("countryCode") or ""
        if tipo != "Supername" and pais not in paises:
            continue
        woeid = _woeid(it.get("woeid"))
        if woeid is None:
            continue
        salida.append({"woeid": woeid, "nombre": it.get("name") or "?", "pais": pais,
                       "tipo": tipo})
    return sorted(salida, key=lambda s: (s["pais"], s["nombre"]))
