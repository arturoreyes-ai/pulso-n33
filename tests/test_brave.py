"""Pruebas del sondeo de Brave Search (pulso/brave.py), siempre sin red.

Se sustituye `pedir` (o `pulso.brave.pedir_brave` en la prueba de la CLI), que
es lo unico que sale a la red. Lo que mas importa, en este orden: que la llave
viaje en la cabecera y nunca en la URL; que una publicacion se reconozca con
las mismas reglas que la cosecha; que el sondeo no escriba nada; y que una
llave rechazada detenga las consultas en vez de repetir el mismo 401 doce
veces.
"""

import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from pulso import brave
from pulso.__main__ import main

AHORA = "2026-09-03T18:00:00+00:00"
LLAVE = "llave-de-prueba-123"

CONSULTAS = [
    {"id": "cq_vivelabaja", "termino": "Vive la Baja", "idioma": "es"},
    {"id": "cq_valente_marquez", "termino": "Valente Márquez", "idioma": "es"},
    {"id": "cq_ingles", "termino": "Border Report", "idioma": "en"},
]


def respuesta(*resultados, mas=False):
    return {"query": {"more_results_available": mas}, "web": {"results": list(resultados)}}


def resultado(url, titulo="", extracto="", page_age=None):
    r = {"url": url, "title": titulo, "description": extracto}
    if page_age:
        r["page_age"] = page_age
    return r


class PedirFalso:
    """Registra cada (url, llave) y responde por fuente, deducida de la q."""

    def __init__(self, por_fuente=None, errores=None):
        self.llamadas = []
        self.por_fuente = por_fuente or {}
        self.errores = errores or {}

    def __call__(self, url, llave):
        self.llamadas.append((url, llave))
        n = len(self.llamadas)
        if n in self.errores:
            raise self.errores[n]
        for fuente in ("tiktok", "instagram", "facebook"):
            if "site%3A{}.com".format(fuente) in url and "-site" not in url:
                return self.por_fuente.get(fuente, respuesta())
        return self.por_fuente.get("web", respuesta())


def http(codigo):
    return HTTPError(brave.ENDPOINT, codigo, "x", {}, None)


class TestConsultas(unittest.TestCase):
    def test_cuatro_busquedas_con_la_frase_entre_comillas(self):
        self.assertEqual(brave.busquedas_de("Vive la Baja"), [
            ("tiktok", '"Vive la Baja" site:tiktok.com'),
            ("instagram", '"Vive la Baja" site:instagram.com'),
            ("facebook", '"Vive la Baja" site:facebook.com'),
            ("web", '"Vive la Baja" -site:tiktok.com -site:instagram.com -site:facebook.com'),
        ])

    def test_una_comilla_del_termino_no_rompe_la_frase(self):
        fuente, q = brave.busquedas_de(' El  "Chapo" ')[0]
        self.assertEqual(q, '"El Chapo" site:tiktok.com')

    def test_rango_de_treinta_dias(self):
        self.assertEqual(brave.rango(AHORA), "2026-08-04to2026-09-03")
        self.assertEqual(brave.rango(AHORA, 7), "2026-08-27to2026-09-03")

    def test_url_lleva_ventana_idioma_y_sin_corrector(self):
        url = brave.url_de_busqueda('"Valente Márquez" site:tiktok.com',
                                    "2026-08-04to2026-09-03", "es")
        self.assertTrue(url.startswith(brave.ENDPOINT + "?"))
        for trozo in ("count=20", "freshness=2026-08-04to2026-09-03", "search_lang=es",
                      "spellcheck=0", "country=MX", "text_decorations=0",
                      "q=%22Valente+M%C3%A1rquez%22+site%3Atiktok.com"):
            self.assertIn(trozo, url)

    def test_la_llave_va_en_la_cabecera(self):
        vistos = []

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps(respuesta()).encode("utf-8")

        def urlopen_falso(req, timeout=None):
            vistos.append(req)
            return Resp()

        with patch("pulso.brave.urlopen", urlopen_falso):
            doc = brave.pedir_brave("https://api.search.brave.com/res/v1/web/search?q=x", LLAVE)
        self.assertEqual(doc, respuesta())
        req = vistos[0]
        self.assertEqual(req.get_header("X-subscription-token"), LLAVE)
        self.assertEqual(req.get_header("Accept"), "application/json")
        self.assertNotIn(LLAVE, req.full_url)


class TestClasificar(unittest.TestCase):
    def test_tiktok(self):
        casos = {
            "https://www.tiktok.com/@ViveLaBaja/video/7412345678901234567?lang=es":
                ("publicacion", "https://www.tiktok.com/@vivelabaja/video/7412345678901234567"),
            "https://www.tiktok.com/@vivelabaja": ("perfil", None),
            "https://www.tiktok.com/@vivelabaja/photo/7412345678901234567": ("otro", None),
            "https://www.tiktok.com/tag/vivelabaja": ("otro", None),
            # `site:` que deja pasar otro host
            "https://www.instagram.com/p/ABC123/": ("otro", None),
        }
        for url, (tipo, canonica) in casos.items():
            t, u = brave.clasificar(url, "tiktok")
            self.assertEqual(t, tipo, url)
            if canonica:
                self.assertEqual(u, canonica)

    def test_instagram(self):
        casos = {
            "https://www.instagram.com/reel/C9xYz_1-ab/": ("publicacion", "https://www.instagram.com/p/C9xYz_1-ab/"),
            "https://instagram.com/p/C9xYz/?img_index=2": ("publicacion", "https://www.instagram.com/p/C9xYz/"),
            "https://www.instagram.com/vivelabaja/p/C9xYz/": ("publicacion", "https://www.instagram.com/p/C9xYz/"),
            "https://www.instagram.com/vivelabaja/": ("perfil", None),
            "https://www.instagram.com/explore/tags/vivelabaja/": ("otro", None),
            "https://www.instagram.com/explore/": ("otro", None),
        }
        for url, (tipo, canonica) in casos.items():
            t, u = brave.clasificar(url, "instagram")
            self.assertEqual(t, tipo, url)
            if canonica:
                self.assertEqual(u, canonica)

    def test_facebook_usa_la_regla_de_la_cosecha(self):
        casos = {
            "https://m.facebook.com/vivelabaja/posts/pfbid02abcXYZ?__cft__=1":
                ("publicacion", "https://www.facebook.com/vivelabaja/posts/pfbid02abcXYZ"),
            "https://www.facebook.com/reel/123456789": ("publicacion", "https://www.facebook.com/reel/123456789"),
            "https://www.facebook.com/vivelabaja": ("perfil", None),
            "https://www.facebook.com/profile.php?id=1000123": ("perfil", None),
            "https://www.facebook.com/groups/123/posts/456": ("otro", None),
            "https://www.facebook.com/hashtag/vivelabaja": ("otro", None),
            "https://www.facebook.com/share/p/1AbCdE/": ("otro", None),
        }
        for url, (tipo, canonica) in casos.items():
            t, u = brave.clasificar(url, "facebook")
            self.assertEqual(t, tipo, url)
            if canonica:
                self.assertEqual(u, canonica)

    def test_web(self):
        dominios = ("zetatijuana.com",)
        self.assertEqual(brave.clasificar("https://www.zetatijuana.com/2026/09/x/", "web", dominios)[0], "prensa")
        self.assertEqual(brave.clasificar("https://edicion.zetatijuana.com/x", "web", dominios)[0], "prensa")
        self.assertEqual(brave.clasificar("https://notzetatijuana.com/x", "web", dominios)[0], "web")
        self.assertEqual(brave.clasificar("https://www.youtube.com/watch?v=abc", "web", dominios)[0], "youtube")
        self.assertEqual(brave.clasificar("https://youtu.be/abc", "web", dominios)[0], "youtube")
        self.assertEqual(brave.clasificar("https://www.tiktok.com/@x/video/1", "web", dominios)[0], "otro")

    def test_dominios_del_catalogo_real(self):
        with open(os.path.join("config", "medios.json"), encoding="utf-8") as fh:
            medios = json.load(fh)["medios"]
        dominios = brave.dominios_de(medios)
        self.assertTrue(dominios)
        self.assertFalse(any(d.startswith("www.") for d in dominios))
        self.assertEqual(list(dominios), sorted(set(dominios)))


class TestEnlaces(unittest.TestCase):
    def test_no_repite_el_mismo_video_con_dos_formas(self):
        salida = brave.enlaces([
            resultado("https://www.tiktok.com/@ViveLaBaja/video/1?lang=es", "a"),
            resultado("https://tiktok.com/@vivelabaja/video/1", "b"),
        ], "tiktok", "Vive la Baja")
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]["url"], "https://www.tiktok.com/@vivelabaja/video/1")

    def test_donde_nombra_plegado(self):
        salida = brave.enlaces([
            resultado("https://www.tiktok.com/@a/video/1", "VALENTE MARQUEZ en Tijuana", "otra cosa"),
            resultado("https://www.tiktok.com/@a/video/2", "sin nada", "habla Valente Márquez"),
            resultado("https://www.tiktok.com/@a/video/3", "Valente Márquez", "valente marquez"),
            resultado("https://www.tiktok.com/@a/video/4", "Valente", "Márquez"),
        ], "tiktok", "Valente Márquez")
        self.assertEqual([e["nombra"] for e in salida], ["titulo", "extracto", "ambos", None])

    def test_fecha_y_entidades(self):
        salida = brave.enlaces([
            resultado("https://www.tiktok.com/@a/video/1", "Vive la Baja &amp; m&aacute;s",
                      page_age="2026-09-01T07:14:06"),
            resultado("https://www.tiktok.com/@a/video/2", "x", page_age="hace 2 dias"),
            resultado("", "sin url"),
        ], "tiktok", "Vive la Baja")
        self.assertEqual(len(salida), 2)
        self.assertEqual(salida[0]["fecha"], "2026-09-01")
        self.assertEqual(salida[0]["titulo"], "Vive la Baja & más")
        self.assertIsNone(salida[1]["fecha"])


class TestSondear(unittest.TestCase):
    def test_sin_llave_no_llama_a_nada(self):
        pedir = PedirFalso()
        with self.assertRaises(brave.SinLlave):
            brave.sondear(CONSULTAS, AHORA, "", pedir=pedir, dormir=lambda s: None)
        self.assertEqual(pedir.llamadas, [])

    def test_cuatro_por_termino_con_pausa_y_llave_fuera_de_la_url(self):
        pedir, pausas = PedirFalso(), []
        filas = brave.sondear(CONSULTAS, AHORA, LLAVE, pedir=pedir, dormir=pausas.append)
        self.assertEqual(len(filas), 12)
        self.assertEqual(len(pedir.llamadas), 12)
        self.assertEqual(pausas, [brave.PAUSA_SEGUNDOS] * 11)
        for url, llave in pedir.llamadas:
            self.assertEqual(llave, LLAVE)
            self.assertNotIn(LLAVE, url)
        self.assertEqual([f["fuente"] for f in filas[:4]], ["tiktok", "instagram", "facebook", "web"])

    def test_idioma_declarado_de_la_fila(self):
        pedir = PedirFalso()
        brave.sondear(CONSULTAS, AHORA, LLAVE, pedir=pedir, dormir=lambda s: None,
                      solo={"cq_ingles"})
        self.assertEqual(len(pedir.llamadas), 4)
        self.assertTrue(all("search_lang=en" in u for u, _ in pedir.llamadas))

    def test_un_error_queda_en_su_fila_y_el_sondeo_sigue(self):
        pedir = PedirFalso(errores={2: http(429), 3: URLError("caida")})
        filas = brave.sondear(CONSULTAS[:1], AHORA, LLAVE, pedir=pedir, dormir=lambda s: None)
        self.assertEqual([f["estado"] for f in filas], ["ok", "error", "error", "ok"])
        self.assertEqual(filas[1]["error"], "HTTP 429")
        self.assertEqual(filas[2]["error"], "URLError")

    def test_llave_rechazada_detiene_el_sondeo(self):
        pedir = PedirFalso(errores={1: http(401)})
        with self.assertRaises(brave.LlaveRechazada):
            brave.sondear(CONSULTAS, AHORA, LLAVE, pedir=pedir, dormir=lambda s: None)
        self.assertEqual(len(pedir.llamadas), 1)

    def test_cuenta_publicaciones_y_ventana(self):
        pedir = PedirFalso(por_fuente={"tiktok": respuesta(
            resultado("https://www.tiktok.com/@a/video/1", "Vive la Baja en Rosarito"),
            resultado("https://www.tiktok.com/@a", "perfil"),
            mas=True)})
        filas = brave.sondear(CONSULTAS[:1], AHORA, LLAVE, pedir=pedir, dormir=lambda s: None,
                              ventana_dias=7)
        self.assertIn("freshness=2026-08-27to2026-09-03", pedir.llamadas[0][0])
        tk = filas[0]
        self.assertEqual((tk["resultados"], tk["mas"]), (2, True))
        self.assertEqual([e["tipo"] for e in tk["enlaces"]], ["publicacion", "perfil"])

    def test_todas_las_filas_del_config_real_tienen_idioma(self):
        with open(os.path.join("config", "consultas.json"), encoding="utf-8") as fh:
            consultas = json.load(fh)["consultas"]
        filas = brave.sondear(consultas, AHORA, LLAVE, pedir=PedirFalso(), dormir=lambda s: None)
        self.assertEqual(len(filas), 4 * len(consultas))


class TestCLI(unittest.TestCase):
    def correr(self, argv, llave=LLAVE, pedir=None):
        salida, errores = io.StringIO(), io.StringIO()
        with patch("pulso.entorno.primero", lambda *n, **k: llave), \
                patch("pulso.brave.pedir_brave", pedir or PedirFalso()), \
                patch("pulso.brave.time.sleep", lambda s: None), \
                redirect_stdout(salida), redirect_stderr(errores):
            codigo = main(argv)
        return codigo, salida.getvalue(), errores.getvalue()

    def test_sin_llave_sale_con_1(self):
        pedir = PedirFalso()
        codigo, _, err = self.correr(["consultas", "--sondear-web"], llave="", pedir=pedir)
        self.assertEqual(codigo, 1)
        self.assertIn("BRAVE_API_KEY", err)
        self.assertEqual(pedir.llamadas, [])

    def test_imprime_y_no_escribe(self):
        pedir = PedirFalso(por_fuente={"instagram": respuesta(
            resultado("https://www.instagram.com/p/ABC/", "Vive la Baja on Instagram: Ensenada"),
            resultado("https://www.instagram.com/vivelabaja/", "Vive la Baja (@vivelabaja)"))})
        with tempfile.TemporaryDirectory() as tmp:
            codigo, out, _ = self.correr(["consultas", "--sondear-web", "--consulta",
                                          "cq_vivelabaja", "--salida", tmp], pedir=pedir)
            self.assertEqual(os.listdir(tmp), [])
        self.assertEqual(codigo, 0)
        self.assertEqual(len(pedir.llamadas), 4)
        self.assertIn("https://www.instagram.com/p/ABC/", out)
        # Del perfil sale el conteo, nunca la URL.
        self.assertNotIn("https://www.instagram.com/vivelabaja/", out)
        self.assertIn("instagram  1 (1 nombran)", out)
        self.assertIn("Apify: 0. Nada se escribió.", out)

    def test_llave_rechazada_sale_con_1(self):
        codigo, _, err = self.correr(["consultas", "--sondear-web"],
                                     pedir=PedirFalso(errores={1: http(403)}))
        self.assertEqual(codigo, 1)
        self.assertIn("HTTP 403", err)


if __name__ == "__main__":
    unittest.main()
