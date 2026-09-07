"""Pruebas del clasificador de linea base.

Estas pruebas FIJAN el comportamiento del diccionario, no lo aprueban.
Documentan contra que se compara el clasificador real de la Fase 4.
"""

import json
import unittest

from pulso import VERSION
from pulso.clasificar import clasificar, diccionario

RUTA_CORPUS = "tests/fixtures/corpus.json"


class TestApagado(unittest.TestCase):
    def test_ninguno_devuelve_none(self):
        # Por omision el sistema no etiqueta postura: entrega volumen de
        # menciones, que es el producto honesto sin un clasificador decente.
        self.assertIsNone(clasificar("Cualquier titular", "ninguno"))
        self.assertIsNone(clasificar("Cualquier titular"))

    def test_metodo_desconocido_lanza(self):
        with self.assertRaises(ValueError):
            clasificar("x", "vibras")


class TestDiccionario(unittest.TestCase):
    def test_forma_de_la_postura(self):
        p = clasificar("Alcalde inaugura obra y entrega apoyo", "diccionario")
        self.assertEqual(p["metodo"], "diccionario")
        self.assertEqual(p["version"], VERSION)
        self.assertEqual(p["etiqueta"], "favorable")
        self.assertIsInstance(p["puntaje"], int)

    def test_adversa(self):
        r = diccionario("Crece la inseguridad y la violencia en la ciudad")
        self.assertEqual(r["etiqueta"], "adversa")
        self.assertLess(r["puntaje"], 0)

    def test_neutral_sin_disparos(self):
        r = diccionario("Sesion de cabildo del martes")
        self.assertEqual(r["etiqueta"], "neutral")
        self.assertEqual(r["puntaje"], 0)
        self.assertEqual(r["disparos"], [])

    def test_indiferente_al_acento(self):
        self.assertEqual(
            diccionario("Huracán en la costa")["puntaje"],
            diccionario("HURACAN EN LA COSTA")["puntaje"],
        )

    def test_falla_conocida_toma_protesta(self):
        # Corpus 4. 'Toma protesta' es la ceremonia de juramentacion y se
        # repite en cada cambio de administracion en los tres niveles de
        # gobierno; el diccionario lee 'protesta' como manifestacion y marca
        # adversa una nota que no lo es. Ningun lexico generico del espanol
        # resuelve el mexicanismo: de ahi el clasificador de la Fase 4.
        # docs/PLAN.md seccion 4.
        with open(RUTA_CORPUS, encoding="utf-8") as fh:
            titular = json.load(fh)[3]["titulo"]
        self.assertIn("toma protesta", titular.lower())
        r = diccionario(titular)
        self.assertEqual(r["etiqueta"], "adversa")
        self.assertIn("protesta", [d[0] for d in r["disparos"]])

    def test_falla_conocida_beca_como_logro_sin_responsable(self):
        # Corpus 12: puntaje favorable, cero figuras resueltas. Atribuirla a
        # un gobierno seria invencion.
        with open(RUTA_CORPUS, encoding="utf-8") as fh:
            titular = json.load(fh)[11]["titulo"]
        self.assertEqual(diccionario(titular)["etiqueta"], "favorable")

    def test_disparos_ordenados_por_peso(self):
        r = diccionario("Sube la inseguridad")
        pesos = [abs(d[1]) for d in r["disparos"]]
        self.assertEqual(pesos, sorted(pesos, reverse=True))


if __name__ == "__main__":
    unittest.main()
