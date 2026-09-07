import unittest
from unittest.mock import patch

from pulso import descubrimiento
from pulso.normalizar import id_nota
from pulso.validador import validar_notas


class DescubrimientoTest(unittest.TestCase):
    def test_rechaza_urls_peligrosas(self):
        resolver = lambda host, *_args, **_kwargs: [(None, None, None, None, (host, 0))]
        self.assertFalse(descubrimiento.url_segura("file:///etc/passwd", resolver))
        self.assertFalse(descubrimiento.url_segura("https://user:pass@example.com/a", resolver))
        self.assertFalse(descubrimiento.url_segura("http://127.0.0.1/a", resolver))
        self.assertFalse(descubrimiento.url_segura("https://example.com:8443/a", resolver))

    def test_publica_solo_titulo_del_publisher_y_delegacion_directa(self):
        def gdelt(_query):
            return ["https://example.com/a?utm_source=gdelt", "https://example.com/a"]

        def publisher(url):
            return {"titulo": "Colonia Camino Verde recibe obra", "url": url,
                    "fecha": "2026-09-04", "publicado": "2026-09-04T10:00:00+00:00"}

        with patch.object(descubrimiento, "url_segura", return_value=True):
            items, salud = descubrimiento.descubrir(
                ahora="2026-09-04T12:00:00+00:00", consultas=("una",), gdelt=gdelt,
                publisher=publisher, robots=lambda _url: (True, None), limite=4)
        self.assertEqual(len(items), 1)
        self.assertEqual(salud["detalle"]["candidatos"], 2)
        self.assertEqual(salud["detalle"]["aceptadas"], 1)
        self.assertNotIn("snippet", items[0])
        self.assertEqual(items[0]["origen"], "descubrimiento_web")
        self.assertEqual(items[0]["descubierta_por"], "gdelt")
        self.assertTrue(items[0]["medio"]["id"].startswith("web-"))

    def test_provider_failure_is_health_not_exception(self):
        def broken(_query):
            raise RuntimeError("rate limit")
        items, salud = descubrimiento.descubrir(
            ahora="2026-09-04T12:00:00+00:00", consultas=("una",), gdelt=broken,
            publisher=lambda _url: {}, robots=lambda _url: (True, None))
        self.assertEqual(items, [])
        self.assertEqual(salud["estado"], "fallo")
        self.assertIn("rate limit", salud["error"])

    def test_contrato_de_nota_descubierta_es_autocontenido(self):
        fuente = "web-" + "a" * 12
        titulo = "Colonia Camino Verde recibe obra"
        nota = {
            "id": id_nota(fuente, titulo), "titulo": titulo,
            "url": "https://example.com/a", "dominio": "example.com",
            "fuente": fuente, "zona_medio": "estatal", "zonas": ["Tijuana"],
            "delegaciones": ["Sánchez Taboada"], "alcance": "zona",
            "fecha": "2026-09-04", "publicado": "2026-09-04T10:00:00+00:00",
            "capturado": "2026-09-04T12:00:00+00:00", "figuras": [], "postura": None,
            "origen": "descubrimiento_web", "descubierta_por": "gdelt",
        }
        errores, _ = validar_notas({"esquema": 1, "total": 1, "notas": [nota]}, medios=[])
        self.assertEqual(errores, [])
