"""Tono en vivo: el MISMO modelo del pipeline, detras de una peticion HTTP.

El 23 de septiembre de 2026 el cliente pidio que la busqueda en vivo de Redes
dijera cuantos titulares, publicaciones y comentarios suenan positivos y
cuantos negativos, como la ficha de un termino en seguimiento. El modelo corre
en el pipeline, en local, y el sitio no tiene Python. Las salidas faciles eran
otro modelo: un Claude que etiquetara, o un ONNX con el preprocesado de
pysentimiento reescrito en TypeScript. Las dos pondrian dos instrumentos bajo
la misma palabra «positivo», que es la regla 3 de PRODUCT.md por la puerta de
atras: una ficha en seguimiento y una en vivo dirian lo mismo midiendo
distinto, y nada en la pantalla lo delataria.

Asi que esto NO reimplementa nada: envuelve `sentimiento.Analizador` y traduce
con los mismos `A_TONO` y `A_SENTIMIENTO`. Corre en dos sitios con el mismo
codigo:

  - en local, `python -m pulso tono --servir`, con el modelo del cache de
    siempre (~/.cache/huggingface);
  - en Vercel, como funcion de Python de su propio proyecto
    (servicio-tono/api/tono.py), con una copia de este archivo,
    sentimiento.py y normalizar.py que hace servicio-tono/empaquetar.mjs en
    cada build. Copia generada, nunca editada: una correccion aqui llega alla
    sola.

Lo que la peticion NO hace, y es la mitad del diseno:

  - No guarda nada ni escribe un log con texto: el comentario vive lo que
    dura la peticion, como el cuerpo de una nota en Analizar.
  - No adivina el idioma: lo declara quien llama. Un texto en un idioma que el
    modelo cargado no habla vuelve `null`, que el sitio cuenta como
    `sin_modelo_idioma` (la leccion de San Diego, pulso/sentimiento.py).
  - No atiende a nadie sin `TONO_SECRETO`: la ruta es un modelo gratis para
    quien la encuentre, y sin secreto configurado no atiende a nadie, en vez
    de atender a todos.
"""

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler

from .sentimiento import A_SENTIMIENTO, A_TONO, IDIOMAS

# Las dos traducciones del producto; el titular y el comentario no comparten
# etiquetas (docs/PLAN.md seccion 6).
VOCABULARIOS = {"prensa": A_TONO, "comentarios": A_SENTIMIENTO}

# Una busqueda en vivo manda a lo sumo ~40 titulares, ~60 pies y 3 x 10 x 10
# comentarios. Mas que esto no es una busqueda: es alguien usando la ruta.
TOPE_TEXTOS = 600
TOPE_BYTES = 512 * 1024

CABECERA_SECRETO = "X-Tono-Secreto"


class PeticionInvalida(ValueError):
    """Lo que llego no es una peticion de tono."""


def leer_peticion(cuerpo):
    """Valida el JSON: {"textos": [str], "vocabulario": "prensa"|"comentarios",
    "idioma": "es"|"en"}. Devuelve (textos, vocabulario, idioma)."""
    try:
        datos = json.loads(cuerpo)
    except (TypeError, ValueError) as e:
        raise PeticionInvalida("el cuerpo no es JSON") from e
    if not isinstance(datos, dict):
        raise PeticionInvalida("se esperaba un objeto")
    textos = datos.get("textos")
    if not isinstance(textos, list) or not all(isinstance(t, str) for t in textos):
        raise PeticionInvalida("`textos` tiene que ser una lista de cadenas")
    if len(textos) > TOPE_TEXTOS:
        raise PeticionInvalida("mas de {} textos".format(TOPE_TEXTOS))
    vocabulario = datos.get("vocabulario")
    if vocabulario not in VOCABULARIOS:
        raise PeticionInvalida("`vocabulario` es prensa o comentarios")
    idioma = datos.get("idioma")
    if idioma not in IDIOMAS:
        raise PeticionInvalida("`idioma` es {}".format(" o ".join(IDIOMAS)))
    return textos, vocabulario, idioma


def etiquetar(textos, vocabulario, idioma, analizador):
    """Una etiqueta del vocabulario por texto, en el mismo orden, o `None`
    para todos si el analizador no habla `idioma`.

    Exactamente `predecir` y la traduccion, sin un caso propio: un texto vacio
    sale «neutral» porque asi lo cuenta el pipeline (`Analizador.predecir` lo
    manda NEU sin pasar por el modelo). Tratarlo distinto aqui haria que la
    misma publicacion contara distinto en una ficha en seguimiento y en una en
    vivo, que es justo lo que este modulo existe para impedir.
    """
    if getattr(analizador, "idioma", None) != idioma:
        return {"etiquetas": [None] * len(textos), "modelo": None}
    if not textos:
        return {"etiquetas": [], "modelo": None}
    traduccion = VOCABULARIOS[vocabulario]
    # Una frase a la vez: el camino por lote de pysentimiento pasa por
    # `datasets`, que en Vercel no se deja usar (Analizador.predecir lo cuenta).
    resultados = analizador.predecir(list(textos), uno_a_uno=True)
    modelo = next((r.get("modelo") for r in resultados if r.get("modelo")), None)
    return {"etiquetas": [traduccion[r["etiqueta"]] for r in resultados], "modelo": modelo}


def secreto_valido(recibido, esperado):
    """Sin secreto configurado no pasa nadie."""
    return bool(esperado) and bool(recibido) and hmac.compare_digest(
        recibido.encode("utf-8"), esperado.encode("utf-8"))


def salud():
    """Versiones y que se deja importar, sin cargar el modelo: `?salud=1`.

    Existe por el tercer despliegue en Vercel (23 de septiembre de 2026), que
    decia «cannot import name 'Trainer' from 'transformers'»: transformers
    esconde detras de eso el error real de torch, y sin mirar torch a mano no
    habia forma de saber cual era.
    """
    import sys
    from importlib import metadata

    def version(paquete):
        try:
            return metadata.version(paquete)
        except Exception as e:  # noqa: BLE001
            return "sin metadatos: {}".format(type(e).__name__)

    estado = {"python": sys.version.split()[0],
              "versiones": {p: version(p) for p in ("torch", "transformers", "pysentimiento", "accelerate", "numpy")}}
    for modulo in ("torch", "accelerate", "transformers.trainer", "pysentimiento"):
        try:
            __import__(modulo)
            estado[modulo] = "ok"
        except Exception as e:  # noqa: BLE001
            estado[modulo] = "{}: {}".format(type(e).__name__, str(e)[:400])
    return estado


_ANALIZADORES = {}


def analizador_para(idioma):
    """Uno por proceso: cargar el modelo tarda segundos y pesa ~430 MB."""
    if idioma not in _ANALIZADORES:
        from .sentimiento import Analizador
        _ANALIZADORES[idioma] = Analizador(idioma=idioma)
    return _ANALIZADORES[idioma]


class Manejador(BaseHTTPRequestHandler):
    """POST con el JSON de `leer_peticion` y la cabecera del secreto.

    `analizador` y `secreto` se resuelven por peticion para que la prueba los
    sustituya sin tocar el entorno. GET contesta si el servicio esta vivo y
    carga el modelo: es lo que el sitio llama al empezar una busqueda pagada,
    para que el arranque en frio pase mientras las redes tardan.
    """

    idiomas_cargados = ("es",)
    protocol_version = "HTTP/1.1"

    def secreto(self):
        return os.environ.get("TONO_SECRETO", "")

    def analizador(self, idioma):
        return analizador_para(idioma)

    def _responder(self, estado, cuerpo):
        datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(datos)

    def _autorizado(self):
        return secreto_valido(self.headers.get(CABECERA_SECRETO, ""), self.secreto())

    def _fallo(self, e):
        """Una excepcion como 500 con su TIPO y su mensaje, y la traza al log.

        El caso: el primer despliegue en Vercel (23 de septiembre de 2026)
        moria al cargar el modelo con FUNCTION_INVOCATION_FAILED y ningun
        rastro, porque una excepcion dentro de un BaseHTTPRequestHandler cierra
        la conexion sin respuesta. Lo que viaja es de la carga del modelo o de
        la libreria, nunca el texto pedido: una traza de Python no lleva los
        valores de las variables, y solo la ve quien trae el secreto.
        """
        import traceback
        traceback.print_exc()
        cuerpo = {"error": type(e).__name__, "detalle": str(e)[:500]}
        # La causa encadenada es la que importa: `SinModelo` envuelve el
        # ImportError de verdad (el segundo despliegue decia «pysentimiento no
        # esta instalado» con pysentimiento instalado).
        causa = e.__cause__ or e.__context__
        if causa is not None:
            cuerpo["causa"] = "{}: {}".format(type(causa).__name__, str(causa)[:500])
        self._responder(500, cuerpo)

    def do_GET(self):  # noqa: N802 (nombre de BaseHTTPRequestHandler)
        if not self._autorizado():
            self._responder(401, {"error": "secreto"})
            return
        if "salud" in self.path.partition("?")[2]:
            self._responder(200, salud())
            return
        try:
            for idioma in self.idiomas_cargados:
                cargar = getattr(self.analizador(idioma), "_cargar", None)
                if cargar is not None:
                    cargar()
        except Exception as e:  # noqa: BLE001 (se reporta, no se traga)
            self._fallo(e)
            return
        self._responder(200, {"listo": True, "idiomas": list(self.idiomas_cargados)})

    def do_POST(self):  # noqa: N802
        if not self._autorizado():
            self._responder(401, {"error": "secreto"})
            return
        try:
            self._etiquetar_peticion()
        except Exception as e:  # noqa: BLE001
            self._fallo(e)

    def _etiquetar_peticion(self):
        try:
            largo = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            largo = 0
        if largo <= 0 or largo > TOPE_BYTES:
            self._responder(413 if largo > TOPE_BYTES else 400, {"error": "cuerpo"})
            return
        try:
            textos, vocabulario, idioma = leer_peticion(self.rfile.read(largo).decode("utf-8"))
        except PeticionInvalida as e:
            self._responder(400, {"error": str(e)})
            return
        if idioma not in self.idiomas_cargados:
            self._responder(200, {"etiquetas": [None] * len(textos), "modelo": None})
            return
        self._responder(200, etiquetar(textos, vocabulario, idioma, self.analizador(idioma)))

    def log_message(self, formato, *args):
        # El registro por omision imprime la linea de la peticion, que no trae
        # texto; aun asi se calla: aqui no se deja rastro de quien pidio que.
        return


def servir(puerto=8765, host="127.0.0.1"):
    """El servicio en local, para `next dev` (TONO_URL=http://127.0.0.1:8765)."""
    from http.server import ThreadingHTTPServer
    servidor = ThreadingHTTPServer((host, puerto), Manejador)
    try:
        servidor.serve_forever()
    finally:
        servidor.server_close()
