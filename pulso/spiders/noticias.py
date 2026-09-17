"""Spider configurable de titulares.

Solo lee la portada o pagina de ultimas noticias declarada en medios.json. No
sigue articulos ni copia su cuerpo: el producto publica titular, fuente y liga.
"""

import json
import re
import time
from datetime import date

import scrapy

from pulso.fetch import IMAGEN_LARGO_MAXIMO
from pulso.normalizar import fold, imagen_del_medio


_MESES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}
_FECHA_ES = re.compile(
    r"\b(?P<dia>\d{1,2})\s+(?:de\s+)?(?P<mes>[a-z]+)\s+(?:de\s+)?(?P<ano>\d{4})\b"
)


def fecha_es(texto):
    """Convierte una fecha editorial en espanol a YYYY-MM-DD, si aparece."""
    m = _FECHA_ES.search(fold(texto or ""))
    if not m:
        return ""
    mes = _MESES.get(m.group("mes"))
    if mes is None:
        return ""
    # Tecate publica '8 Septiembre 2026'; una fecha imposible no es un dato.
    try:
        return date(int(m.group("ano")), mes, int(m.group("dia"))).isoformat()
    except ValueError:
        return ""


def fecha_en_url(url, patron):
    """Extrae ano/mes/dia desde una URL usando grupos nombrados."""
    if not patron:
        return ""
    m = re.search(patron, url or "")
    if not m:
        return ""
    try:
        return "{:04d}-{:02d}-{:02d}".format(
            int(m.group("ano")), int(m.group("mes")), int(m.group("dia"))
        )
    except (IndexError, TypeError, ValueError):
        return ""


def _texto(selector, regla):
    if not regla:
        return ""
    partes = selector.css(regla).getall()
    return " ".join(" ".join(partes).split()).strip(" \t\r\n\"“”")


def _imagen(bloque, response, medio):
    """La miniatura del bloque, si el medio la publica y es suya.

    El caso: esta ruta nacio sin imagen, asi que AFN, El Vigia y Baja News
    salian SIEMPRE sin miniatura -- 239 notas recientes, cero imagenes -- y no
    porque no la publiquen, sino porque nadie la leia. Se veia como un medio
    que no trae foto y era un extractor que no existia.

    El selector es opcional y puede ser una lista: varias portadas sirven la
    foto en 'data-src' y dejan en 'src' un pixel de relleno, asi que se prueban
    en orden y gana la primera aceptable.

    Mismo filtro de forma que fetch.py::_aceptable y la MISMA regla de host que
    todo lo que entra a data/: imagen_del_medio. La excepcion de og:image que
    vive en web/ (cualquier host) no aplica aqui, porque esto SI se guarda.
    """
    reglas = medio.get("scrapy", {}).get("imagen")
    if not reglas:
        return ""
    if isinstance(reglas, str):
        reglas = [reglas]
    for regla in reglas:
        for crudo in bloque.css(regla).getall():
            url = response.urljoin((crudo or "").strip())
            if (url.startswith("https://")
                    and not any(c.isspace() for c in url)
                    and len(url) <= IMAGEN_LARGO_MAXIMO
                    and imagen_del_medio(url, medio)):
                return url
    return ""


class NoticiasSpider(scrapy.Spider):
    name = "noticias"

    def __init__(self, medios=None, config=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if medios is None and config:
            with open(config, encoding="utf-8") as fh:
                medios = [
                    m for m in json.load(fh)["medios"]
                    if m.get("activo") and m.get("tipo") == "scrapy"
                ]
        elif isinstance(medios, str):
            medios = json.loads(medios)
        self.medios = list(medios or [])
        self.resultados = {}
        self.errores = {}
        self.ms = {}
        self._inicio = {}

    async def start(self):
        for medio in self.medios:
            self._inicio[medio["id"]] = time.monotonic()
            yield scrapy.Request(
                medio["url"],
                callback=self.parse_medio,
                errback=self.error_medio,
                cb_kwargs={"medio": medio},
                dont_filter=True,
            )

    def parse_medio(self, response, medio):
        mid = medio["id"]
        cfg = medio["scrapy"]
        bloques = response.css(cfg["item"])
        por_url = {}
        for bloque in bloques:
            titulo = _texto(bloque, cfg["titulo"])
            enlace = bloque.css(cfg["url"]).get()
            if not titulo or not enlace:
                continue
            url = response.urljoin(enlace.strip())
            fecha = _texto(bloque, cfg.get("fecha"))
            fecha = fecha_es(fecha) or fecha_en_url(url, cfg.get("fecha_url"))
            por_url[url] = {
                "titulo": titulo,
                "url": url,
                "fecha_cruda": fecha,
            }
            # Condicional, como en fetch.py: ausente significa 'no la publica'.
            imagen = _imagen(bloque, response, medio)
            if imagen:
                por_url[url]["imagen"] = imagen

        self.resultados[mid] = list(por_url.values())
        self.ms[mid] = int((time.monotonic() - self._inicio[mid]) * 1000)
        if not por_url:
            self.errores[mid] = (
                "la pagina respondio, pero los selectores Scrapy no extrajeron titulares"
            )

    def error_medio(self, failure):
        medio = failure.request.cb_kwargs["medio"]
        mid = medio["id"]
        self.resultados[mid] = []
        self.ms[mid] = int((time.monotonic() - self._inicio[mid]) * 1000)
        self.errores[mid] = failure.getErrorMessage()[:300]

    def closed(self, reason):
        for medio in self.medios:
            mid = medio["id"]
            if mid not in self.resultados:
                self.resultados[mid] = []
                self.ms[mid] = int((time.monotonic() - self._inicio[mid]) * 1000)
                self.errores[mid] = "spider cerrado antes de recibir la portada ({})".format(reason)
