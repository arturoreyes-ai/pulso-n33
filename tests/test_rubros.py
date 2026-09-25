"""La copia de la regla de tema (pulso/rubros.py) contra la del sitio.

La regla manda en web/src/lib/busqueda/tema-publicacion.ts; el pipeline la
copia para cortar el top 10 de TikTok por rubro. Si la copia se queda atras,
el pipeline paga comentarios de videos que la pestana no muestra, y nada lo
dice. Las dos leen web/scripts/fixtures/rubros/esperado.json, que escribe el
sitio (`node web/scripts/probar-capitulos.cjs --escribir-rubros`); esta prueba
exige que Python llegue a lo mismo. Si falla despues de un cambio de terminos
en el sitio, lo que dice es exactamente que portar.
"""

import json
import os
import unittest

from pulso import rubros

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(RAIZ, "web", "scripts", "fixtures", "rubros", "esperado.json")


class TestParidadRubros(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as fh:
            cls.esperado = json.load(fh)

    def test_los_rubros_son_los_del_sitio_y_en_su_orden(self):
        self.assertEqual(list(rubros.RUBROS), self.esperado["rubros"])

    def test_los_terminos_son_los_del_sitio(self):
        for r in rubros.RUBROS:
            with self.subTest(rubro=r):
                self.assertEqual(sorted(set(rubros.TERMINOS[r])), self.esperado["terminos"][r])

    def test_cada_titulo_nombra_los_mismos_rubros(self):
        for caso in self.esperado["casos"]:
            with self.subTest(titulo=caso["titulo"]):
                self.assertEqual(rubros.rubros_de(caso["titulo"]), caso["rubros"])

    def test_cada_termino_se_nombra_a_si_mismo(self):
        """Una sigla mal detectada o un escape roto dejan un termino que no
        empareja nada, y en silencio: ningun titulo lo necesita para fallar."""
        for r in rubros.RUBROS:
            for t in rubros.TERMINOS[r]:
                with self.subTest(rubro=r, termino=t):
                    self.assertTrue(rubros.nombra_rubro(t, r))


if __name__ == "__main__":
    unittest.main()
