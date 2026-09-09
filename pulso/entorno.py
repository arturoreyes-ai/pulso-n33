"""Lee variables de un archivo .env sin dependencias.

El caso que lo motivo: el token de Apify se guardo en `web/.env`, que es la
convencion de Next.js y donde lo pone cualquiera que trabaje en el tablero.
Pero el pipeline es Python y lee `os.environ`, asi que `python -m pulso redes`
no encontraba nada mientras el sitio si. El sintoma es el peor posible -- una
corrida que "funciona" y devuelve vacio -- porque el modulo de Apify se
degrada a proposito cuando falta el token, igual que el de YouTube sin llave.

No se usa python-dotenv: requirements.txt es de una linea a proposito (ver
AGENTS.md) y esto son treinta lineas de stdlib.

## Dos nombres para la misma cosa

Apify documenta su variable como `APIFY_TOKEN`, pero su consola web la ofrece
copiada como `APIFY_API_TOKEN` y asi quedo escrita en el .env de este repo.
`primero()` acepta los dos en vez de imponer uno: renombrar la variable del
usuario para que cuadre con el codigo es arreglar el sintoma equivocado.

## El entorno real gana

Lo que ya esta en `os.environ` NO se pisa. En GitHub Actions el token llega
como secreto del workflow y no hay archivo .env; en la maquina del
desarrollador pasa al reves. Si algun dia hay las dos cosas, la del CI es la
buena, porque es la que el operador acaba de decidir.
"""

import os

# En orden de preferencia. web/.env va al final: es de Next.js y el pipeline
# solo lo lee de prestado.
RUTAS = (".env", ".env.local", os.path.join("web", ".env"),
         os.path.join("web", ".env.local"))


def leer_archivo(ruta):
    """Parsea un .env. Devuelve {} si no existe: ausente no es error."""
    if not os.path.exists(ruta):
        return {}
    valores = {}
    with open(ruta, encoding="utf-8") as fh:
        for linea in fh:
            linea = linea.strip()
            if not linea or linea.startswith("#"):
                continue
            if linea.startswith("export "):
                linea = linea[7:].lstrip()
            clave, sep, valor = linea.partition("=")
            if not sep:
                continue
            clave = clave.strip()
            valor = valor.strip()
            # Las comillas son del formato, no del valor. Un token con
            # comillas pegadas falla con 401 y el mensaje no dice por que.
            if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in "\"'":
                valor = valor[1:-1]
            if clave:
                valores[clave] = valor
    return valores


def cargar(rutas=RUTAS, base=None):
    """Junta los .env que existan. El entorno real tiene la ultima palabra."""
    valores = {}
    for ruta in rutas:
        for clave, valor in leer_archivo(ruta).items():
            valores.setdefault(clave, valor)
    valores.update({k: v for k, v in (base if base is not None else os.environ).items()})
    return valores


def primero(*nombres, entorno=None):
    """El primer nombre con valor no vacio. Devuelve '' si ninguno.

    Acepta varios nombres porque la misma credencial circula con mas de uno:
    ver el encabezado sobre APIFY_TOKEN y APIFY_API_TOKEN.
    """
    valores = entorno if entorno is not None else cargar()
    for nombre in nombres:
        v = (valores.get(nombre) or "").strip()
        if v:
            return v
    return ""
