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



class TestImagenes(unittest.TestCase):
    """La miniatura de la ruta Scrapy.

    El caso: esta ruta nacio sin extractor de imagen, asi que AFN, El Vigia y
    Baja News salian siempre sin miniatura -- 239 notas recientes, cero
    imagenes -- y parecia que no la publicaban. El sondeo del 17 de septiembre
    de 2026 midio lo contrario: las tres portadas traen <img> en cada bloque.
    """

    def test_relativa_se_resuelve_contra_el_medio(self):
        # El Vigia sirve la foto con ruta relativa: al resolverla queda en su
        # propio dominio y pasa la regla de 'es del medio'.
        medio = {
            "id": "elvigia",
            "url": "https://www.elvigia.net/",
            "scrapy": {
                "item": "article",
                "titulo": "h2.titulo a::text",
                "url": "h2.titulo a::attr(href)",
                "imagen": "img::attr(src)",
            },
        }
        html = """
        <article><h2 class="titulo"><a href="/n/1.html">Agua para Ensenada</a></h2>
        <img src="/u/fotografias/m/2026/9/16/f555x315-683557.jpeg"></article>
        """
        self.assertEqual(
            extraer(medio, html)[0]["imagen"],
            "https://www.elvigia.net/u/fotografias/m/2026/9/16/f555x315-683557.jpeg",
        )

    def test_otro_dominio_del_mismo_medio_necesita_declararse(self):
        # AFN sirve sus fotos desde afnbc.com. Sin 'imagenes_de' se tiran; con
        # la fila declarada, pasan. Es la misma regla que timessd con Photon.
        base = {
            "id": "afn",
            "url": "https://afntijuana.info/lo-ultimo.php",
            "scrapy": {
                "item": ".card",
                "titulo": "h5.card-title a::text",
                "url": "h5.card-title a::attr(href)",
                "imagen": "img::attr(src)",
            },
        }
        html = """
        <div class="card"><h5 class="card-title"><a href="/1_nota">Abren garita</a></h5>
        <img src="https://www.afnbc.com/images.php?src=imagenes/a.jpg&w=500"></div>
        """
        self.assertNotIn("imagen", extraer(base, html)[0])
        declarado = dict(base, imagenes_de=["afnbc.com"])
        self.assertEqual(
            extraer(declarado, html)[0]["imagen"],
            "https://www.afnbc.com/images.php?src=imagenes/a.jpg&w=500",
        )

    def test_foto_de_stock_o_de_otro_medio_no_se_acredita(self):
        # La misma razon que normalizar.py::imagen_del_medio: acreditarle al
        # medio una foto que no hizo. Aqui NO rige la excepcion de og:image de
        # web/, porque esto se guarda en data/.
        medio = {
            "id": "x",
            "url": "https://medio.example/",
            "scrapy": {"item": "article", "titulo": "h2::text",
                       "url": "a::attr(href)", "imagen": "img::attr(src)"},
        }
        html = """
        <article><h2>Titular</h2><a href="/n/1"></a>
        <img src="https://images.pexels.com/photos/1/foto.jpeg"></article>
        """
        self.assertNotIn("imagen", extraer(medio, html)[0])

    def test_lista_de_selectores_para_la_carga_diferida(self):
        # Varias portadas dejan un pixel de relleno en 'src' y la foto en
        # 'data-src'. Se prueban en orden y gana la primera aceptable.
        medio = {
            "id": "x",
            "url": "https://medio.example/",
            "scrapy": {
                "item": "article", "titulo": "h2::text", "url": "a::attr(href)",
                "imagen": ["img::attr(data-src)", "img::attr(src)"],
            },
        }
        html = """
        <article><h2>Titular</h2><a href="/n/1"></a>
        <img src="https://medio.example/relleno.gif"
             data-src="https://medio.example/real.jpg"></article>
        """
        self.assertEqual(extraer(medio, html)[0]["imagen"], "https://medio.example/real.jpg")

    def test_sin_selector_no_hay_clave(self):
        # Ausente significa 'no la publica', nunca null ni cadena vacia: es la
        # misma distincion que sostiene la regla 4 en el resto del producto.
        medio = {
            "id": "x",
            "url": "https://medio.example/",
            "scrapy": {"item": "article", "titulo": "h2::text", "url": "a::attr(href)"},
        }
        html = '<article><h2>Titular</h2><a href="/n/1"></a><img src="/f.jpg"></article>'
        self.assertNotIn("imagen", extraer(medio, html)[0])

    def test_http_y_data_no_pasan(self):
        medio = {
            "id": "x",
            "url": "https://medio.example/",
            "scrapy": {"item": "article", "titulo": "h2::text",
                       "url": "a::attr(href)", "imagen": "img::attr(src)"},
        }
        for src in ("http://medio.example/f.jpg", "data:image/png;base64,AAAA"):
            html = '<article><h2>T</h2><a href="/n/1"></a><img src="%s"></article>' % src
            self.assertNotIn("imagen", extraer(medio, html)[0], src)

if __name__ == "__main__":
    unittest.main()
