import unittest

from pulso.normalizar import dedup, dominio, fecha_iso, fold, id_nota, url_canonica


class TestFold(unittest.TestCase):
    def test_quita_acentos_y_baja_caja(self):
        self.assertEqual(fold("Gutiérrez"), "gutierrez")
        self.assertEqual(fold("Burgueño"), "burgueno")

    def test_mayusculas_y_espacios(self):
        # Los medios publican titulares en mayusculas: corpus 5 es real.
        self.assertEqual(
            fold("ASUME PRESIDENCIA  MUNICIPAL   DE TIJUANA"),
            "asume presidencia municipal de tijuana",
        )

    def test_vacio(self):
        self.assertEqual(fold(None), "")
        self.assertEqual(fold("   "), "")


class TestFechaIso(unittest.TestCase):
    def test_rfc_2822_con_offset(self):
        self.assertEqual(
            fecha_iso("Sat, 21 Jun 2026 09:12:00 -0700"),
            ("2026-06-21", "2026-06-21T09:12:00-07:00"),
        )

    def test_iso_simple(self):
        self.assertEqual(fecha_iso("2026-08-14"), ("2026-08-14", "2026-08-14T00:00:00"))

    def test_zulu(self):
        fecha, _ = fecha_iso("2026-08-14T12:00:00Z")
        self.assertEqual(fecha, "2026-08-14")

    def test_basura_no_lanza(self):
        self.assertEqual(fecha_iso("ayer por la tarde"), (None, None))
        self.assertEqual(fecha_iso(""), (None, None))
        self.assertEqual(fecha_iso(None), (None, None))


class TestUrl(unittest.TestCase):
    def test_quita_rastreo_y_fragmento(self):
        self.assertEqual(
            url_canonica("https://zetatijuana.com/nota?utm_source=rss&id=7&fbclid=x#top"),
            "https://zetatijuana.com/nota?id=7",
        )

    def test_conserva_query_util(self):
        self.assertEqual(
            url_canonica("https://afntijuana.info/n?p=12&page=2"),
            "https://afntijuana.info/n?p=12&page=2",
        )

    def test_dominio_sin_www_ni_puerto(self):
        self.assertEqual(dominio("https://www.uniradioinforma.com/n/1"), "uniradioinforma.com")
        self.assertEqual(dominio("http://bajanews.mx:8080/x"), "bajanews.mx")
        self.assertEqual(dominio(""), "")


class TestIdNota(unittest.TestCase):
    def test_forma(self):
        i = id_nota("zeta", "Titular de prueba")
        self.assertEqual(len(i), 16)
        self.assertTrue(all(c in "0123456789abcdef" for c in i))

    def test_indiferente_a_acento_y_caja(self):
        # El mismo titular republicado en mayusculas no es una nota nueva.
        self.assertEqual(
            id_nota("zeta", "Abdiel Gutiérrez asume"),
            id_nota("zeta", "ABDIEL GUTIERREZ  ASUME"),
        )

    def test_distinto_por_medio(self):
        # Dos medios que publican el mismo titular son dos notas: la dedup
        # entre medios necesita shingles y es de la Fase 1.
        self.assertNotEqual(id_nota("zeta", "Mismo titular"), id_nota("afn", "Mismo titular"))


class TestDedup(unittest.TestCase):
    def test_deja_la_primera_y_preserva_orden(self):
        notas = [{"id": "a", "n": 1}, {"id": "b", "n": 2}, {"id": "a", "n": 3}]
        self.assertEqual([n["n"] for n in dedup(notas)], [1, 2])


if __name__ == "__main__":
    unittest.main()
