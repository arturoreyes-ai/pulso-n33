"""El servicio de tono como funcion de Python en Vercel.

Todo lo que importa vive en pulso/tono.py; esto solo lo monta. La copia de
pulso/{tono,sentimiento,normalizar}.py en `_pulso/` la hace
servicio-tono/empaquetar.mjs en cada build, y el modelo en `_modelo/` cuando
TONO_EMPAQUETAR=1: una correccion al pipeline llega aqui sola, y el modelo que
etiqueta en vivo es el mismo archivo que etiqueta la cosecha.

Es un proyecto de Vercel APARTE del tablero (Root Directory = servicio-tono).
Dentro de web/, cada despliegue del sitio instalaria torch para esta funcion,
y un paquete de mas de 250 MB rompe ese build.

Vercel no toma como funcion lo que empieza con `_`, asi que las dos carpetas
viajan con esta y no se publican solas.
"""

import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "_pulso"))
# El modelo va dentro del paquete y se lee sin red: una funcion en frio que
# bajara 430 MB de Hugging Face en cada arranque tardaria minutos y dependeria
# de un tercero que limita peticiones anonimas.
os.environ.setdefault("HF_HUB_CACHE", os.path.join(AQUI, "_modelo", "hub"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
# El paquete de la funcion es de solo lectura; lo unico que se puede escribir
# es /tmp. Todo lo que las librerias quieran escribir —el token y los
# candados de huggingface_hub, el cache de `datasets`, el de spacy— va ahi, y
# el modelo se sigue leyendo del paquete.
os.environ.setdefault("HF_HOME", "/tmp/hf")
os.environ.setdefault("HF_DATASETS_CACHE", "/tmp/hf/datasets")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp/cache")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")

from pulso.tono import Manejador  # noqa: E402


class handler(Manejador):  # noqa: N801 (Vercel busca este nombre)
    pass
