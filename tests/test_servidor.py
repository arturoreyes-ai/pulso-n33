"""Pruebas del servidor de desarrollo.

Lo que importa es el mapeo de rutas: sitio/ en la raiz y /data/ y /config/
apuntando a las carpetas reales del repo, sin paso de armado en medio. Y que
no se pueda salir de esas tres carpetas.
"""

import os
import tempfile
import unittest

from pulso.sitio import Manejador, servir


class RutasFalsas(Manejador):
    """Solo la traduccion de rutas, sin socket ni peticion HTTP."""

    def __init__(self, raices):
        self.raices = raices


class TestTraduccionDeRutas(unittest.TestCase):
    def setUp(self):
        self.raices = {"sitio": os.path.abspath("sitio"),
                       "data": os.path.abspath("data"),
                       "config": os.path.abspath("config")}
        self.m = RutasFalsas(self.raices)

    def test_raiz_sirve_el_index_del_sitio(self):
        self.assertEqual(self.m.translate_path("/"),
                         os.path.join(self.raices["sitio"], "index.html"))

    def test_archivo_del_sitio(self):
        self.assertEqual(self.m.translate_path("/app.js"),
                         os.path.join(self.raices["sitio"], "app.js"))

    def test_data_va_a_la_carpeta_real(self):
        # Esto es el punto del servidor: no una copia en _site/, sino el
        # archivo que el pipeline acaba de escribir.
        self.assertEqual(self.m.translate_path("/data/notas.json"),
                         os.path.join(self.raices["data"], "notas.json"))

    def test_config_va_a_la_carpeta_real(self):
        self.assertEqual(self.m.translate_path("/config/roster.json"),
                         os.path.join(self.raices["config"], "roster.json"))

    def test_ignora_query_y_fragmento(self):
        # app.js pide con cache: 'no-store', pero un ?v= no debe romper.
        self.assertEqual(self.m.translate_path("/data/notas.json?v=2"),
                         os.path.join(self.raices["data"], "notas.json"))
        self.assertEqual(self.m.translate_path("/app.js#top"),
                         os.path.join(self.raices["sitio"], "app.js"))

    def test_no_se_puede_salir_de_las_carpetas(self):
        # '..' se descarta, no se resuelve: si no, /../../ leeria el disco.
        for ruta in ("/../pulso/youtube.py",
                     "/data/../../pulso/roster.py",
                     "/....//pulso"):
            traducida = self.m.translate_path(ruta)
            self.assertTrue(
                any(traducida.startswith(r) for r in self.raices.values()),
                "{} escapo a {}".format(ruta, traducida))

    def test_el_cache_del_repo_no_es_alcanzable(self):
        # cache/ tiene texto crudo de comentarios de YouTube, con retencion
        # de 30 dias: no debe servirse nunca. Solo hay tres raices mapeadas,
        # asi que /cache/ cae dentro de sitio/, donde no existe, y da 404.
        traducida = self.m.translate_path("/cache/comentarios/2026-09-03.json")
        real = os.path.abspath(os.path.join("cache", "comentarios", "2026-09-03.json"))
        self.assertTrue(traducida.startswith(self.raices["sitio"]))
        self.assertNotEqual(traducida, real)

    def test_una_carpeta_que_se_llama_data_dentro_del_sitio_no_confunde(self):
        # Solo el primer segmento decide la raiz.
        self.assertEqual(self.m.translate_path("/img/data/x.png"),
                         os.path.join(self.raices["sitio"], "img", "data", "x.png"))


class TestArranque(unittest.TestCase):
    def test_falla_claro_si_falta_una_carpeta(self):
        vacio = tempfile.mkdtemp()
        with self.assertRaises(FileNotFoundError) as ctx:
            servir(puerto=0, origen=os.path.join(vacio, "no_existe"))
        self.assertIn("sitio", str(ctx.exception))

    def test_levanta_y_cierra(self):
        servidor, raices = servir(puerto=0)      # puerto 0 = uno libre
        try:
            self.assertTrue(servidor.server_address[1] > 0)
            # efimero/ es la unica raiz opcional: el texto de comentarios de
            # Instagram vive fuera de git y puede no existir en este clon.
            self.assertEqual(sorted(set(raices) - {"efimero"}), ["config", "data", "sitio"])
            self.assertEqual("efimero" in raices, os.path.isdir("efimero"))
        finally:
            servidor.server_close()

    def test_efimero_se_sirve_bajo_data_solo_si_existe(self):
        # Un archivo que solo esta en efimero/ se sirve como /data/…; uno que
        # esta en data/ gana aunque exista en los dos.
        from pulso.sitio import Manejador
        raiz = tempfile.mkdtemp()
        for carpeta in ("sitio", "data", "config", "efimero"):
            os.makedirs(os.path.join(raiz, carpeta))
        with open(os.path.join(raiz, "efimero", "redes-comentarios.json"), "w") as fh:
            fh.write("{}")
        with open(os.path.join(raiz, "data", "notas.json"), "w") as fh:
            fh.write("{}")
        m = Manejador.__new__(Manejador)
        m.raices = {c: os.path.join(raiz, c) for c in ("sitio", "data", "config", "efimero")}
        self.assertEqual(m.translate_path("/data/redes-comentarios.json"),
                         os.path.join(raiz, "efimero", "redes-comentarios.json"))
        self.assertEqual(m.translate_path("/data/notas.json"),
                         os.path.join(raiz, "data", "notas.json"))


if __name__ == "__main__":
    unittest.main()
