"""Pruebas de resolucion de figuras.

El caso testigo es el relevo de Tijuana del 21 de junio de 2026: Burgueno se
va de licencia, su suplente Gutierrez entra. Un titular que solo dice
'alcalde de Tijuana' tiene que resolver a uno o a otro segun la fecha de la
nota, no segun quien gobierna hoy.
"""

import json
import unittest
from datetime import date

from pulso.roster import Roster

RUTA_ROSTER = "config/roster.json"
RUTA_CORPUS = "tests/fixtures/corpus.json"

# Fixture minima del relevo, para probar la regla sin depender del roster real.
FIGURAS = [
    {
        "id": "agc", "nombre": "Abdiel Gutiérrez Coronado",
        "cargo": "Presidente municipal de Tijuana", "partido": "Morena",
        "ambito": "Tijuana", "desde": "2026-06-21", "hasta": None,
        "alias": ["Abdiel Gutiérrez", "Gutiérrez Coronado"],
        "alias_cargo": ["alcalde de Tijuana", "presidente municipal de Tijuana"],
    },
    {
        "id": "ibr", "nombre": "Ismael Burgueño Ruiz",
        "cargo": "Presidente municipal de Tijuana", "partido": "Morena",
        "ambito": "Tijuana", "desde": "2024-10-01", "hasta": "2026-06-21",
        "alias": ["Ismael Burgueño", "Burgueño Ruiz", "Burgueño"],
        "alias_cargo": ["alcalde de Tijuana", "presidente municipal de Tijuana"],
    },
]


def ids(hits):
    return sorted(h.figura_id for h in hits)


class TestRelevo(unittest.TestCase):
    def setUp(self):
        self.r = Roster(FIGURAS)

    def test_cargo_antes_del_relevo(self):
        h = self.r.match("El alcalde de Tijuana inaugura obra", date(2026, 6, 20))
        self.assertEqual(ids(h), ["ibr"])
        self.assertEqual(h[0].via, "cargo")

    def test_cargo_el_dia_del_relevo_ya_es_del_entrante(self):
        # Ventana semiabierta: 'hasta' es exclusivo, Gutierrez entro a las 00:00.
        h = self.r.match("El alcalde de Tijuana inaugura obra", date(2026, 6, 21))
        self.assertEqual(ids(h), ["agc"])
        self.assertEqual(h[0].via, "cargo")

    def test_cargo_muy_despues_del_relevo(self):
        h = self.r.match("El alcalde de Tijuana viaja", date(2026, 8, 14))
        self.assertEqual(ids(h), ["agc"])

    def test_cargo_antes_de_que_existiera_el_saliente(self):
        h = self.r.match("El alcalde de Tijuana comparece", date(2024, 1, 15))
        self.assertEqual(ids(h), [])

    def test_nombre_propio_no_depende_de_la_fecha(self):
        # Burgueno sigue siendo Burgueno despues de dejar el cargo.
        h = self.r.match("Burgueño se va de licencia", date(2026, 8, 14))
        self.assertEqual(ids(h), ["ibr"])
        self.assertEqual(h[0].via, "nominal")

    def test_nominal_le_gana_a_cargo_para_la_misma_figura(self):
        h = self.r.match("Abdiel Gutiérrez, alcalde de Tijuana, informa", date(2026, 8, 14))
        self.assertEqual(ids(h), ["agc"])
        self.assertEqual(len(h), 1)
        self.assertEqual(h[0].via, "nominal")

    def test_alias_mas_largo_gana(self):
        h = self.r.match("Habla Abdiel Gutiérrez Coronado", date(2026, 8, 14))
        self.assertEqual(h[0].clave, "abdiel gutierrez coronado")

    def test_vigente_es_semiabierto(self):
        ibr = self.r.por_id("ibr")
        self.assertTrue(self.r.vigente(ibr, date(2026, 6, 20)))
        self.assertFalse(self.r.vigente(ibr, date(2026, 6, 21)))
        agc = self.r.por_id("agc")
        self.assertFalse(self.r.vigente(agc, date(2026, 6, 20)))
        self.assertTrue(self.r.vigente(agc, date(2026, 6, 21)))

    def test_hasta_null_es_abierto(self):
        self.assertTrue(self.r.vigente(self.r.por_id("agc"), date(2099, 1, 1)))


class TestRosterReal(unittest.TestCase):
    """Los 15 titulares reales del corpus, contra el roster que se publica."""

    @classmethod
    def setUpClass(cls):
        cls.r = Roster.desde_archivo(RUTA_ROSTER)
        with open(RUTA_CORPUS, encoding="utf-8") as fh:
            cls.corpus = json.load(fh)

    def resolver(self, indice):
        c = self.corpus[indice - 1]
        cuando = date(*[int(x) for x in c["fecha"].split("-")])
        return self.r.match(c["titulo"], cuando)

    def test_titular_por_cargo_va_al_entrante(self):
        # Corpus 1, del 14 de agosto: 'presidente municipal de Tijuana' es
        # Gutierrez. Una lista fija habria dicho Burgueno.
        h = self.resolver(1)
        self.assertEqual(ids(h), ["agc"])
        self.assertEqual(h[0].via, "cargo")

    def test_titular_con_los_dos_nombres(self):
        # Corpus 4: 'Abdiel Gutiérrez toma protesta tras licencia de Burgueño'.
        h = self.resolver(4)
        self.assertEqual(ids(h), ["agc", "ibr"])
        self.assertEqual(len(h), 2)              # una vez cada uno
        self.assertTrue(all(x.via == "nominal" for x in h))

    def test_titular_en_mayusculas(self):
        # Corpus 5, de Multimedios, todo en mayusculas y sin acentos.
        h = self.resolver(5)
        self.assertEqual(ids(h), ["agc"])
        self.assertEqual(h[0].clave, "abdiel gutierrez coronado")

    def test_solo_el_saliente_por_nombre(self):
        h = self.resolver(6)
        self.assertEqual(ids(h), ["ibr"])

    def test_percepcion_de_inseguridad_no_tiene_figura(self):
        # Corpus 8, 9 y 10. Si se agruparan por region en vez de por figura
        # resuelta, estas notas envenenarian la serie de un alcalde
        # (docs/PLAN.md seccion 4).
        for i in (8, 9, 10):
            self.assertEqual(ids(self.resolver(i)), [], "corpus {}".format(i))

    def test_gobernadora_solo_en_el_cuerpo_no_se_resuelve(self):
        # Corpus 7: la concesion de agua menciona a la gobernadora en el
        # cuerpo, no en el titular. Empatar solo titulares la pierde, y eso
        # es un limite conocido, no un error.
        self.assertEqual(ids(self.resolver(7)), [])

    def test_beca_sin_funcionario_nombrado(self):
        # Corpus 12: el diccionario la marca favorable, pero no hay a quien
        # atribuirsela.
        self.assertEqual(ids(self.resolver(12)), [])

    def test_nota_ajena_al_roster(self):
        self.assertEqual(ids(self.resolver(15)), [])

    def test_todas_las_figuras_vigentes_hoy_menos_el_saliente(self):
        vigentes = {f["id"] for f in self.r.vigentes(date(2026, 9, 3))}
        self.assertIn("agc", vigentes)
        self.assertNotIn("ibr", vigentes)


if __name__ == "__main__":
    unittest.main()
