"""Contrato de los selectores Scrapy, sin tocar la red."""

import unittest

from scrapy.http import HtmlResponse, Request

from pulso.spiders.noticias import NoticiasSpider, fecha_es


def extraer(medio, html):
    spider = NoticiasSpider(medios=[medio])
    spider._inicio[medio["id"]] = __import__("time").monotonic()
    request = Request(medio["url"], cb_kwargs={"medio": medio})
    response = HtmlResponse(
        medio["url"], request=request, body=html.encode("utf-8"), encoding="utf-8"
    )
    spider.parse_medio(response, medio)
    return spider.resultados[medio["id"]]


class TestFechas(unittest.TestCase):
    def test_fecha_editorial_en_espanol(self):
        self.assertEqual(
            fecha_es("Mexicali BC - viernes, 4 de septiembre de 2026"),
            "2026-09-04",
        )


class TestSelectores(unittest.TestCase):
    def test_el_vigia_extrae_titular_url_y_fecha(self):
        medio = {
            "id": "elvigia",
            "url": "https://www.elvigia.net/",
            "scrapy": {
                "item": "article",
                "titulo": "h2.titulo a::text",
                "url": "h2.titulo a::attr(href)",
                "fecha_url": r"/(?P<ano>\d{4})/(?P<mes>\d{1,2})/(?P<dia>\d{1,2})/",
            },
        }
        html = """
        <article><h2 class="titulo"><a href="/general/2026/9/4/nota-1.html">
        Agua para Ensenada</a></h2></article>
        """
        self.assertEqual(extraer(medio, html), [{
            "titulo": "Agua para Ensenada",
            "url": "https://www.elvigia.net/general/2026/9/4/nota-1.html",
            "fecha_cruda": "2026-09-04",
        }])

    def test_afn_lee_fecha_del_mismo_bloque(self):
        medio = {
            "id": "afn",
            "url": "https://afntijuana.info/lo-ultimo.php",
            "scrapy": {
                "item": ".card",
                "titulo": "h5.card-title a::text",
                "url": "h5.card-title a::attr(href)",
                "fecha": "h6.card-subtitle::text",
            },
        }
        html = """
        <div class="card"><h5 class="card-title"><a href="/informacion_general/1_nota">
        Abren garita</a></h5><h6 class="card-subtitle">Tijuana BC - viernes,
        4 de septiembre de 2026</h6></div>
        """
        self.assertEqual(extraer(medio, html)[0]["fecha_cruda"], "2026-09-04")

    def test_baja_news_deduplica_dos_enlaces_de_la_misma_nota(self):
        medio = {
            "id": "bajanews",
            "url": "https://bajanews.mx/feed",
            "scrapy": {
                "item": "a[href^='/Cali-Baja/']",
                "titulo": "::text",
                "url": "::attr(href)",
            },
        }
        html = """
        <a href="/Cali-Baja/9/nota">Nota regional</a>
        <a href="/Cali-Baja/9/nota"><img alt="Nota regional"></a>
        """
        items = extraer(medio, html)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["titulo"], "Nota regional")


if __name__ == "__main__":
    unittest.main()
