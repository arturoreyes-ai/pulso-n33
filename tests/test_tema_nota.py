"""El rubro de una nota de prensa (pulso/tema_nota.py), siempre sin red.

Tres cosas que importan mas que los conteos:

  paridad     la regla de titular es la de la portada (rubros.ts::nombraRubro),
              fijada por el fixture que escribe el sitio. Si divergen, una nota
              del archivo y una fila en vivo del mismo capitulo dirian dos
              cosas distintas de un mismo titular.
  seccion     lo que dijo el <category> del feed se guarda, porque no se
              puede volver a preguntar; manda el feed cuando habla.
  bytes       rubros y rubros_categoria van siempre al final de la nota y en el
              orden de RUBROS, asi que dos corridas dan los mismos bytes.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch
from xml.etree import ElementTree

from pulso import fetch
from pulso.pipeline import correr
from pulso.roster import Roster
from pulso.rubros import TERMINOS as TERMINOS_REDES
from pulso.tema_nota import (
    SIN_TOPE,
    TERMINOS_TITULAR,
    idioma_de_nota,
    ordenar,
    rubros_de_categorias,
    rubros_de_nota,
    rubros_de_ruta,
    rubros_de_titular,
    rubros_de_titular_nota,
)
from pulso.validador import validar_medios, validar_notas

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(RAIZ, "web", "scripts", "fixtures", "rubros", "esperado.json")
AHORA = "2026-09-03T18:00:00+00:00"
DESPUES = "2026-09-04T18:00:00+00:00"


def leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


class TestParidadTitular(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.esperado = leer(FIXTURE)["titulares"]

    def test_las_listas_son_las_del_sitio(self):
        copia = {r: {i: list(t) for i, t in listas.items()} for r, listas in TERMINOS_TITULAR.items()}
        self.assertEqual(copia, self.esperado["terminos"])

    def test_cada_titular_nombra_los_mismos_rubros(self):
        self.assertTrue(self.esperado["casos"], "el fixture no trae casos")
        for caso in self.esperado["casos"]:
            with self.subTest(titulo=caso["titulo"]):
                self.assertEqual(rubros_de_titular(caso["titulo"], caso["idioma"]), caso["rubros"])

    def test_cada_termino_se_nombra_a_si_mismo(self):
        """Un escape roto deja un termino que no empareja nada, en silencio."""
        for r, listas in TERMINOS_TITULAR.items():
            for idioma, terminos in listas.items():
                for t in terminos:
                    with self.subTest(rubro=r, termino=t):
                        self.assertIn(r, rubros_de_titular(t, idioma))

    def test_el_idioma_decide_mayor_y_padres(self):
        """Los dos errores medidos el 25 de septiembre de 2026 con la regla de
        redes, que junta los idiomas."""
        self.assertEqual(rubros_de_titular("Mujer mayor de 65 años perdió su pensión", "es"), [])
        self.assertEqual(rubros_de_titular("Protestan padres de familia en Mexicali", "es"), [])
        self.assertEqual(rubros_de_titular("Mayor signs budget", "en"), ["politica"])

    def test_un_idioma_sin_lista_no_nombra_nada(self):
        self.assertEqual(rubros_de_titular("Detienen al alcalde", "pt"), [])
        self.assertEqual(rubros_de_titular_nota("Detienen al alcalde", "pt"), [])

    def test_sin_tope_no_inventa_terminos(self):
        """Cada termino extra de la nota esta en la lista de redes del sitio:
        salio del titular por el tope de Google, no se escribio aqui."""
        for r, listas in SIN_TOPE.items():
            for idioma, terminos in listas.items():
                for t in terminos:
                    with self.subTest(rubro=r, termino=t):
                        self.assertIn(t, TERMINOS_REDES[r])
                        self.assertIn(r, rubros_de_titular_nota(t, idioma))

    def test_sin_tope_devuelve_los_sismos_de_san_felipe(self):
        titulo = "Registran sismo de magnitud 3.5 al suroeste de San Felipe, Baja California"
        self.assertEqual(rubros_de_titular(titulo, "es"), [])
        self.assertEqual(rubros_de_titular_nota(titulo, "es"), ["clima"])
        self.assertEqual(rubros_de_titular_nota("Camión se impacta contra vivienda", "es"), [])


class TestSeccion(unittest.TestCase):
    MEDIO = {"id": "x", "secciones": {"Deportes": "deportes", "Policiaca": "seguridad",
                                      "Espectáculoz": "espectaculos"},
             "rutas": {"/deporte/": "deportes", "/tij/policiaca/": "seguridad"}}

    def test_categorias_plegadas_y_en_orden(self):
        self.assertEqual(rubros_de_categorias(self.MEDIO, ["DEPORTES", "policiaca"]),
                         ["seguridad", "deportes"])
        self.assertEqual(rubros_de_categorias(self.MEDIO, ["Espectaculoz"]), ["espectaculos"])

    def test_una_etiqueta_fuera_del_mapa_no_dice_nada(self):
        self.assertEqual(rubros_de_categorias(self.MEDIO, ["Omar García Harfuch", "Local"]), [])
        self.assertEqual(rubros_de_categorias({"id": "y"}, ["Deportes"]), [])

    def test_ruta_por_prefijo_con_diagonales(self):
        self.assertEqual(rubros_de_ruta(self.MEDIO, "https://m.example/deporte/2026/09/25/x"),
                         ["deportes"])
        self.assertEqual(rubros_de_ruta(self.MEDIO, "https://m.example/TIJ/Policiaca/nota"),
                         ["seguridad"])
        self.assertEqual(rubros_de_ruta(self.MEDIO, "https://m.example/deportes-extremos/x"), [])
        self.assertEqual(rubros_de_ruta(self.MEDIO, "https://m.example/deporte"), ["deportes"])

    def test_el_redirector_de_google_no_es_del_medio(self):
        url = "https://news.google.com/rss/articles/CBMiX?oc=5"
        self.assertEqual(rubros_de_ruta(self.MEDIO, url), [])

    def test_la_union_va_en_el_orden_de_rubros(self):
        nota = {"titulo": "Detienen a dos en Tijuana", "rubros_categoria": ["deportes"],
                "url": "https://m.example/tij/policiaca/x"}
        self.assertEqual(rubros_de_nota(nota, self.MEDIO, "es"), ["seguridad", "deportes"])
        self.assertEqual(ordenar(["ia", "politica", "ia"]), ["politica", "ia"])

    def test_el_catalogo_real_solo_mapea_a_rubros(self):
        errores, _ = validar_medios(leer("config/medios.json"))
        self.assertEqual(errores, [])
        malo = {"medios": [{"id": "zz", "nombre": "Z", "url": "https://z.example/feed",
                            "zona": "Tijuana", "activo": True,
                            "secciones": {"Deportes": "futbol"}, "rutas": {"/x": "clima"}}]}
        errores, _ = validar_medios(malo)
        self.assertTrue(any("secciones" in e and "futbol" in e for e in errores), errores)
        self.assertTrue(any("rutas" in e and "'/'" in e for e in errores), errores)


class TestIdioma(unittest.TestCase):
    def test_catalogo_luego_busqueda_luego_omision(self):
        medios = {"kpbs": {"id": "kpbs", "idioma": "en"}, "zeta": {"id": "zeta"}}
        self.assertEqual(idioma_de_nota({"fuente": "kpbs"}, medios), "en")
        self.assertEqual(idioma_de_nota({"fuente": "zeta"}, medios), "es")
        sintetica = {"fuente": "gn-abcdefabcdef", "descubierta_por": "bq_frontera_en"}
        self.assertEqual(idioma_de_nota(sintetica, medios, {"bq_frontera_en": "en"}), "en")
        self.assertEqual(idioma_de_nota(sintetica, medios), "es")


class TestFetchCategorias(unittest.TestCase):
    def test_rss_y_atom(self):
        rss = ElementTree.fromstring(
            "<item><title>t</title><category>Deportes</category>"
            "<category><![CDATA[ Policiaca ]]></category><category>Deportes</category>"
            "<category></category></item>")
        self.assertEqual(fetch._categorias(rss), ["Deportes", "Policiaca"])
        atom = ElementTree.fromstring(
            '<entry xmlns="http://www.w3.org/2005/Atom"><category term="Sports"/></entry>')
        self.assertEqual(fetch._categorias(atom), ["Sports"])


class TestPipelineRubros(unittest.TestCase):
    """Corrida en modo red con fetch_medios sustituido: nunca sale a la red."""

    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")
        cls.medios = leer("config/medios.json")["medios"]
        cls.por_id = {m["id"]: m for m in cls.medios}

    def item(self, titulo, url, categorias=()):
        return {"titulo": titulo, "url": url, "fecha_cruda": "Wed, 02 Sep 2026 14:00:00 GMT",
                "categorias": list(categorias)}

    def correr(self, destino, por_medio, ahora=AHORA):
        resultados = [(self.por_id[mid], items) for mid, items in por_medio.items()]
        salud = [{"id": mid, "nombre": self.por_id[mid]["nombre"], "url": self.por_id[mid]["url"],
                  "metodo": "rss", "zona": self.por_id[mid]["zona"], "estado": "ok",
                  "obtenidas": len(items), "nuevas": 0, "ms": 1, "ultima_ok": ahora, "error": None}
                 for mid, items in por_medio.items()]
        with patch("pulso.pipeline.fetch_medios", return_value=(resultados, salud)):
            correr(medios=self.medios, roster=self.roster, salida=destino, sin_red=False,
                   ahora=ahora, retener_dias=400)
        return {n["titulo"]: n for n in leer(os.path.join(destino, "notas.json"))["notas"]}

    ZETA = "https://zetatijuana.com/2026/09/02/nota-de-toros/"
    UNI = "https://www.uniradioinforma.com/policiaca/abc123-choque-en-la-5-y-10/"

    def test_seccion_ruta_y_titular(self):
        d = tempfile.mkdtemp()
        notas = self.correr(d, {
            "zeta": [self.item("Toros gana la serie en casa", self.ZETA,
                               ["Deportez", "Omar García Harfuch", "Noticias del día"])],
            "uniradio": [self.item("Choque en la 5 y 10 deja dos heridos", self.UNI)],
            "kpbs": [self.item("San Diego mayor signs budget", "https://www.kpbs.org/news/x")],
        })
        toros = notas["Toros gana la serie en casa"]
        self.assertEqual(toros["rubros_categoria"], ["deportes"])
        self.assertEqual(toros["rubros"], ["deportes"])
        self.assertNotIn("Omar", json.dumps(toros, ensure_ascii=False),
                         "las etiquetas libres no llegan a la nota")
        self.assertEqual(list(toros)[-2:], ["rubros_categoria", "rubros"])
        choque = notas["Choque en la 5 y 10 deja dos heridos"]
        self.assertNotIn("rubros_categoria", choque)
        self.assertEqual(choque["rubros"], ["seguridad"])
        self.assertEqual(notas["San Diego mayor signs budget"]["rubros"], ["politica"])
        datos = leer(os.path.join(d, "notas.json"))
        errores, _ = validar_notas(datos, self.roster, self.medios)
        self.assertEqual(errores, [])

    def test_manda_el_feed_cuando_habla_y_se_conserva_cuando_calla(self):
        d = tempfile.mkdtemp()
        titulo = "Toros gana la serie en casa"
        self.correr(d, {"zeta": [self.item(titulo, self.ZETA, ["Deportez"])]})
        calla = self.correr(d, {"zeta": [self.item(titulo, self.ZETA)]}, ahora=DESPUES)
        self.assertEqual(calla[titulo]["rubros_categoria"], ["deportes"])
        habla = self.correr(d, {"zeta": [self.item(titulo, self.ZETA, ["Negocioz"])]},
                            ahora=DESPUES)
        self.assertEqual(habla[titulo]["rubros_categoria"], ["economia"])
        # La nota sale del feed: lo ultimo que dijo se queda.
        fuera = self.correr(d, {"zeta": []}, ahora=DESPUES)
        self.assertEqual(fuera[titulo]["rubros_categoria"], ["economia"])

    def test_dos_corridas_dan_bytes_identicos(self):
        entrada = {"zeta": [self.item("Toros gana la serie en casa", self.ZETA,
                                      ["Noticias del día", "Deportez", "Negocioz"])]}
        a, b = tempfile.mkdtemp(), tempfile.mkdtemp()
        self.correr(a, entrada)
        self.correr(b, {"zeta": [dict(entrada["zeta"][0],
                                      categorias=["Negocioz", "Deportez"])]})
        with open(os.path.join(a, "notas.json"), "rb") as fa, \
                open(os.path.join(b, "notas.json"), "rb") as fb:
            self.assertEqual(fa.read(), fb.read(), "el orden de <category> no cambia los bytes")

    def test_validador_atrapa_un_rubro_editado_a_mano(self):
        d = tempfile.mkdtemp()
        self.correr(d, {"uniradio": [self.item("Choque en la 5 y 10 deja dos heridos", self.UNI)]})
        datos = leer(os.path.join(d, "notas.json"))
        nota = next(n for n in datos["notas"] if n["fuente"] == "uniradio")
        nota["rubros"] = ["politica", "seguridad"]
        errores, _ = validar_notas(datos, self.roster, self.medios)
        self.assertTrue(any("no es lo que dicen la seccion" in e for e in errores), errores)
        nota["rubros"] = ["seguridad", "politica"]
        errores, _ = validar_notas(datos, self.roster, self.medios)
        self.assertTrue(any("en ese orden" in e for e in errores), errores)

    def test_rubros_categoria_no_viene_de_una_busqueda(self):
        d = tempfile.mkdtemp()
        self.correr(d, {"zeta": [self.item("Toros gana la serie en casa", self.ZETA, ["Deportez"])]})
        datos = leer(os.path.join(d, "notas.json"))
        datos["notas"][0]["origen"] = "busqueda_web"
        errores, _ = validar_notas(datos, self.roster, self.medios)
        self.assertTrue(any("solo viene del feed" in e for e in errores), errores)


if __name__ == "__main__":
    unittest.main()
