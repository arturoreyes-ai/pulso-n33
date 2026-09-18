"""Actores de Apify: raspado de plataformas sociales sin iniciar sesion.

Apify es una plataforma de actores rentados: se le paga por corrida y ella
opera el navegador. Eso NO cambia el analisis legal de docs/PLAN.md seccion 3,
y conviene decirlo aqui porque es la confusion natural: delegar el navegador
no delega la responsabilidad. En Meta v. Bright Data (N.D. Cal., enero 2024) la
defensa que prospero dependio de NO ser 'usuario' de la plataforma, o sea de
no haber iniciado sesion. Un actor que se loguea destruye esa defensa igual de
bien si el login lo hace un tercero por contrato, y encima agrega la cuenta
del proveedor al expediente. Meta v. Voyager Labs es ese patron de hechos.

De ahi las tres reglas que este modulo vuelve ejecutables en vez de dejarlas
como comentario:

1. **Ningun actor con sesion.** `revisar_entrada()` rechaza una entrada que
   traiga cookies, credenciales o tokens de sesion (LLAVES_DE_SESION). Es un
   error de configuracion, no un aviso: un actor logueado no se degrada, se
   prohibe. La lista deja fuera `username` y `user` a proposito, porque en
   casi todos los actores son el perfil OBJETIVO y no una credencial.

2. **El texto crudo no entra a git.** Misma disciplina que pulso/conversacion.py,
   pero mas estricta: YouTube al menos concede 30 dias por politica escrita
   (III.E.4.d) y Meta, TikTok y X no conceden nada. Lo que ata aqui son los
   terminos de cada plataforma mas la LFPDPPP mexicana y la CPRA californiana,
   porque un comentario con nombre propio es dato personal en las dos. El
   crudo vive en cache/ (ignorado por git, TTL de 30 dias) y a data/ solo
   llegan conteos derivados.

3. **El presupuesto es un tope duro, no una sugerencia.** Apify cobra por
   resultado y por unidad de computo. El cron corre cuatro veces al dia: un
   `maxItems` sin vigilar no produce una corrida lenta, produce una factura.
   El presupuesto se REPARTE entre los actores activos en vez de gastarse en
   orden de archivo -- es la misma leccion que pulso/busquedas.py aprendio
   cuando las dos primeras consultas se llevaron las 40 peticiones y las otras
   cuatro quedaron en cero.

## El tope de 300 segundos

`run-sync-get-dataset-items` corta a los 300 segundos con HTTP 408. No se
sube: es limite de la plataforma. Un raspado grande de Instagram lo pasa sin
esfuerzo, asi que el tope de resultados por actor esta puesto para caber
adentro. Si un actor empieza a devolver 408, la respuesta correcta es bajar su
cuota en config/apify.json, no subir el timeout ni pasar al modo asincrono
callado: una corrida que tarda mas de lo que el cron tolera es una corrida que
gasta dinero y no commitea nada.

## Idioma, y por que cada actor lo declara

El modelo de tono es espanol (RoBERTuito, tweets de TASS). El lado San Diego
publica en ingles. Un modelo de sentimiento al que se le da texto en otro
idioma no devuelve un error, devuelve una etiqueta plausible, y asi estuvo
roto meses del lado de la prensa. Cada actor declara `idioma` en la
configuracion y nunca se adivina del texto.

## Zona

Un actor no lleva `zona`, por la misma razon que una busqueda no la lleva
(ver pulso/busquedas.py): una cuenta o un hashtag le acreditarian esa zona a
todo resultado que no nombre lugar alguno, que es el bug de El Imparcial y
Hermosillo con otro disfraz. Las fuentes sinteticas son `estatal`.

## Degradacion

Sin `APIFY_TOKEN` el paso no truena: devuelve vacio y lo dice, igual que
YouTube sin llave. El tablero tiene que poder mostrar prensa sin redes.
"""

import json
import os
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import VERSION
from .entorno import cargar, primero

API = "https://api.apify.com/v2/"
AGENTE = "PulsoN33/{}".format(VERSION)

# Tope de la plataforma para run-sync-get-dataset-items. No es configurable.
TOPE_SINCRONO = 300

# Claves de entrada que significan 'esto corre logueado'. Una entrada que
# traiga cualquiera de estas es un error de configuracion, no un aviso.
# NO se listan 'username' ni 'user': en la mayoria de los actores son el
# perfil objetivo y prohibirlas dejaria sin usar todo el catalogo publico.
LLAVES_DE_SESION = frozenset({
    "accesstoken", "authtoken", "bearertoken", "c_user", "cookie", "cookies",
    "csrftoken", "li_at", "login", "logincredentials", "logins", "password",
    "sessionid", "sessionids", "sessioncookie", "sessioncookies", "sessionpool",
    "sessiontoken", "xf_session",
})


class SinToken(Exception):
    """Falta APIFY_TOKEN. Se degrada a vacio, no se revienta la corrida."""


class ActorProhibido(Exception):
    """La entrada del actor pide sesion. Ver la regla 1 del encabezado."""


class PresupuestoAgotado(Exception):
    """Se acabaron los resultados pagados de esta corrida."""


def token(entorno=None):
    """Lee el token del entorno o de un .env. Nunca se imprime ni va a data/.

    Acepta los dos nombres que circulan: Apify documenta `APIFY_TOKEN` pero su
    consola lo ofrece como `APIFY_API_TOKEN`. Ver pulso/entorno.py.
    """
    # Un `entorno` explicito ES el entorno completo y no se le suma ningun
    # .env: si no, una prueba que pasa {} para probar la degradacion acabaria
    # leyendo el token real del disco y no probaria nada.
    t = primero("APIFY_TOKEN", "APIFY_API_TOKEN",
                entorno=cargar() if entorno is None else dict(entorno))
    if not t:
        raise SinToken(
            "falta APIFY_TOKEN (o APIFY_API_TOKEN). Se saca en "
            "console.apify.com > Settings > API & Integrations, y se lee del "
            "entorno o de un .env. Es un token personal: no lo pegues en el "
            "repo ni en un archivo de configuracion.")
    return t


def revisar_entrada(entrada, actor=""):
    """Rechaza una entrada que traiga credenciales o cookies de sesion.

    Compara en minusculas porque los actores no se ponen de acuerdo entre
    `sessionCookie`, `sessioncookie` y `SessionCookies`.
    """
    encontradas = sorted(
        k for k in (entrada or {}) if str(k).strip().lower() in LLAVES_DE_SESION)
    if encontradas:
        raise ActorProhibido(
            "el actor {} recibe {}, o sea que correria con sesion iniciada. "
            "docs/PLAN.md seccion 3 lo refusa: iniciar sesion convierte al "
            "operador en 'usuario' y lo somete a los terminos de la "
            "plataforma, que es justo la defensa que en Meta v. Bright Data "
            "dependio de NO estar logueado.".format(
                actor or "?", ", ".join(encontradas)))


class Presupuesto:
    """Tope duro de resultados por corrida, repartido entre actores activos.

    Apify cobra por resultado. Sin esto, un actor mal configurado no produce
    una corrida lenta sino un cargo, y el cron corre cuatro veces al dia.
    """

    def __init__(self, resultados=300):
        self.resultados = int(resultados)
        self.gastado = 0
        self.por_concepto = {}

    def reparto(self, cuantos_actores):
        """Cuantos resultados le tocan a cada actor. Reparte, no rifa."""
        if cuantos_actores <= 0:
            return 0
        return max(1, self.resultados // cuantos_actores)

    def cobrar(self, concepto, n):
        if self.gastado + n > self.resultados:
            raise PresupuestoAgotado(
                "el presupuesto de {} resultados se agoto en {}".format(
                    self.resultados, concepto))
        self.gastado += n
        self.por_concepto[concepto] = self.por_concepto.get(concepto, 0) + n

    def resumen(self):
        return {
            "resultados": self.resultados,
            "gastado": self.gastado,
            "por_concepto": dict(sorted(self.por_concepto.items())),
        }


def _pedir(metodo, ruta, tok, cuerpo=None, params=None, timeout=30):
    url = API + ruta
    if params:
        url += "?" + urlencode(params)
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = Request(url, data=datos, method=metodo, headers={
        "Authorization": "Bearer " + tok,
        "User-Agent": AGENTE,
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    try:
        with urlopen(req, timeout=timeout) as r:
            crudo = r.read().decode("utf-8")
        return json.loads(crudo) if crudo.strip() else []
    except HTTPError as e:
        detalle = ""
        try:
            detalle = e.read().decode("utf-8", "replace")[:400]
        except Exception:
            pass
        # 401 es token invalido o revocado; 402 es credito agotado; 408 es el
        # tope sincrono de 300 s. Los tres se distinguen porque piden acciones
        # distintas y el mensaje generico manda a depurar lo que no es.
        if e.code == 401:
            raise SinToken("Apify rechazo el token (401). Revisa que siga "
                           "vigente en console.apify.com.")
        if e.code == 402:
            raise PresupuestoAgotado(
                "Apify reporta credito agotado (402): {}".format(detalle[:200]))
        if e.code == 408:
            raise RuntimeError(
                "el actor paso los {} s del endpoint sincrono. Baja su cuota "
                "en config/apify.json en vez de subir el timeout.".format(
                    TOPE_SINCRONO))
        raise RuntimeError("{} HTTP {}: {}".format(ruta, e.code, detalle[:200]))


def verificar(tok=None, timeout=20):
    """Confirma que el token sirve y devuelve el plan. Nunca devuelve el token.

    Se usa desde `python -m pulso apify --verificar`, que es lo primero que
    hay que correr despues de exportar la variable: un token mal pegado falla
    con 401 en medio del cron, seis horas despues y sin nadie mirando.
    """
    d = _pedir("GET", "users/me", tok or token(), timeout=timeout).get("data", {})
    plan = d.get("plan") or {}
    return {
        "usuario": d.get("username", ""),
        "plan": plan.get("id") or plan.get("name") or "desconocido",
        "de_paga": bool(d.get("isPaying")),
        # El credito mensual es lo unico que dice si el cron va a poder correr
        # los 30 dias del mes. Viene en dolares en el plan.
        "credito_mensual_usd": plan.get("monthlyUsageCreditsUsd"),
    }


def correr_actor(actor, entrada, tok, limite, timeout=None):
    """Corre un actor y devuelve los items del dataset.

    `limite` va en el query y ADEMAS en la entrada cuando el actor la
    respeta: `limit` recorta lo que se descarga, pero el cargo ya se hizo por
    lo que el actor produjo. Cortar solo del lado del cliente es pagar de mas.
    """
    revisar_entrada(entrada, actor)
    segundos = min(int(timeout or TOPE_SINCRONO), TOPE_SINCRONO)
    ruta = "actors/{}/run-sync-get-dataset-items".format(actor.replace("/", "~"))
    items = _pedir("POST", ruta, tok, cuerpo=entrada,
                   params={"timeout": segundos, "limit": limite, "format": "json"},
                   timeout=segundos + 15)
    return items if isinstance(items, list) else []


def leer_catalogo(ruta):
    """Lee config/apify.json y devuelve (activos, errores).

    Un actor apagado se queda en el archivo con su `razon` escrita, como
    sanquintin en config/medios.json: es registro deliberado de un hueco.
    """
    with open(ruta, encoding="utf-8") as f:
        doc = json.load(f)

    errores = []
    activos = []
    for a in doc.get("actores", []):
        nombre = a.get("id", "?")
        if not a.get("activo"):
            continue
        if not a.get("razon"):
            errores.append("{}: activo sin 'razon' escrita".format(nombre))
        if a.get("idioma") not in ("es", "en"):
            errores.append(
                "{}: idioma '{}' no es 'es' ni 'en'. El modelo de tono es "
                "espanol y a texto en otro idioma no devuelve error, devuelve "
                "una etiqueta plausible.".format(nombre, a.get("idioma")))
        try:
            revisar_entrada(a.get("entrada") or {}, nombre)
        except ActorProhibido as e:
            errores.append(str(e))
        activos.append(a)

    return activos, errores
