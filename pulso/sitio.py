"""Armado del sitio estatico y servidor de desarrollo.

El dashboard lee JSON con rutas relativas, asi que el mismo _site/ sirve en
http://localhost:8000/ y bajo el subcamino /pulso-n33/ de GitHub Pages.

`armar()` es lo que usa el workflow para publicar. `servir()` es para
trabajar: en vez de copiar todo a _site/ y quedarse con una foto vieja, mapea
las carpetas de verdad, asi que editar sitio/app.js o volver a correr el
pipeline se ve con recargar la pagina.
"""

import os
import shutil
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def armar(destino="_site", origen="sitio", datos="data", config="config",
          efimero="efimero"):
    """Reconstruye el destino desde cero y devuelve la lista de archivos."""
    if os.path.isdir(destino):
        shutil.rmtree(destino)
    os.makedirs(destino, exist_ok=True)

    if not os.path.isdir(origen):
        raise FileNotFoundError("no existe la carpeta del sitio: {}".format(origen))
    shutil.copytree(origen, destino, dirs_exist_ok=True)

    if os.path.isdir(datos):
        shutil.copytree(datos, os.path.join(destino, "data"), dirs_exist_ok=True)

    # El texto de los comentarios de Instagram no esta en git (ver .gitignore)
    # pero si viaja al artefacto publicado: el workflow lo escribe justo antes
    # de armar, desde el cache restaurado. Si no esta, el sitio sale sin el.
    if os.path.isdir(efimero):
        shutil.copytree(efimero, os.path.join(destino, "data"), dirs_exist_ok=True)

    # El roster viaja al sitio para poder mostrar el nombre de la figura, no
    # solo su id, sin duplicarlo en cada nota.
    roster = os.path.join(config, "roster.json")
    if os.path.exists(roster):
        os.makedirs(os.path.join(destino, "config"), exist_ok=True)
        shutil.copy2(roster, os.path.join(destino, "config", "roster.json"))

    salida = []
    for raiz, _, archivos in os.walk(destino):
        for a in sorted(archivos):
            salida.append(os.path.relpath(os.path.join(raiz, a), destino).replace("\\", "/"))
    return sorted(salida)


# ------------------------------------------------------ servidor de dev

class Manejador(SimpleHTTPRequestHandler):
    """Sirve sitio/ en la raiz, con /data/ y /config/ mapeados a las carpetas
    reales del repo.

    Asi no hay paso de armado en medio: se edita sitio/app.js o se vuelve a
    correr el pipeline y con recargar se ve. Sin esto habria que acordarse de
    `python -m pulso sitio` en cada cambio, y lo que se mira acaba siendo una
    foto vieja sin que nada avise.
    """

    def __init__(self, *args, raices=None, **kw):
        self.raices = raices or {}
        super().__init__(*args, **kw)

    def translate_path(self, path):
        limpio = path.split("?", 1)[0].split("#", 1)[0]
        partes = [p for p in limpio.split("/") if p and p not in (".", "..")]
        base = self.raices["sitio"]
        if partes and partes[0] in ("data", "config"):
            base = self.raices[partes[0]]
            partes = partes[1:]
            # /data/ se sirve desde data/, salvo lo que solo existe en
            # efimero/ (el texto de comentarios, fuera de git).
            if (partes and not os.path.exists(os.path.join(base, *partes))
                    and "efimero" in self.raices
                    and os.path.exists(os.path.join(self.raices["efimero"], *partes))):
                base = self.raices["efimero"]
        return os.path.join(base, *partes) if partes else os.path.join(base, "index.html")

    def end_headers(self):
        # Sin cache: un JSON viejo en el navegador es justo lo que este
        # servidor existe para evitar.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, formato, *args):
        # Una linea por peticion, sin la marca de tiempo doble del default.
        codigo = args[1] if len(args) > 1 else ""
        if str(codigo).startswith(("4", "5")):
            print("  {} {}".format(codigo, args[0] if args else ""))


def servir(puerto=8000, host="127.0.0.1", origen="sitio", datos="data", config="config",
           efimero="efimero"):
    """Levanta el servidor de desarrollo. Bloquea hasta Ctrl+C."""
    raices = {
        "sitio": os.path.abspath(origen),
        "data": os.path.abspath(datos),
        "config": os.path.abspath(config),
    }
    for nombre, ruta in raices.items():
        if not os.path.isdir(ruta):
            raise FileNotFoundError("no existe la carpeta {}: {}".format(nombre, ruta))
    # Opcional: es lo unico que puede faltar sin que sea un error.
    if os.path.isdir(efimero):
        raices["efimero"] = os.path.abspath(efimero)

    servidor = ThreadingHTTPServer((host, puerto), partial(Manejador, raices=raices))
    return servidor, raices
