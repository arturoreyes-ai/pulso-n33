"""Pruebas del alcance geografico.

El caso que motiva el modulo es real: el feed de El Imparcial trae al grupo
entero y en la primera corrida de 504 notas 'hermosillo' y 'sonora' salieron
como temas principales de un tablero de Baja California.
"""

import unittest

from pulso import DELEGACIONES_TIJUANA
from pulso.zonas import DELEGACIONES, alcance, delegaciones_en, es_estatal, fuera_en, zonas_en


class TestGazetero(unittest.TestCase):
    def test_municipios(self):
        self.assertEqual(zonas_en("Obra en Tijuana avanza"), ["Tijuana"])
        self.assertEqual(zonas_en("Calor en Mexicali"), ["Mexicali"])
        self.assertEqual(zonas_en("Vendimia en el Valle de Guadalupe"), ["Ensenada"])
        self.assertEqual(zonas_en("Feria de Tecate"), ["Tecate"])
        self.assertEqual(zonas_en("Playas de Rosarito recibe turistas"), ["Playas de Rosarito"])
        self.assertEqual(zonas_en("Jornaleros en San Quintín"), ["San Quintín"])

    def test_indiferente_a_acento_y_caja(self):
        self.assertEqual(zonas_en("JORNALEROS EN SAN QUINTIN"), ["San Quintín"])

    def test_nota_transfronteriza_cuenta_en_las_dos(self):
        z = zonas_en("Fila en la garita de San Ysidro entre Tijuana y San Diego")
        self.assertIn("Tijuana", z)
        self.assertIn("San Diego", z)

    def test_colonias_y_localidades(self):
        self.assertEqual(zonas_en("Choque en La Rumorosa"), ["Tecate"])
        self.assertEqual(zonas_en("Obra en Otay"), ["Tijuana"])
        self.assertEqual(zonas_en("Turistas en Puerto Nuevo"), ["Playas de Rosarito"])

    def test_estatal(self):
        self.assertTrue(es_estatal("Sube el precio de la vivienda en Baja California"))
        self.assertFalse(es_estatal("Sube el precio en Jalisco"))

    def test_fuera_de_region(self):
        self.assertTrue(fuera_en("Donación de órganos en HGZ No. 2 de Hermosillo"))
        self.assertTrue(fuera_en("Lluvias en municipios de Sonora"))
        self.assertTrue(fuera_en("Huracán frente a Baja California Sur"))

    def test_bcs_no_se_confunde_con_bc(self):
        # 'baja california sur' contiene 'baja california': el orden de
        # evaluacion importa y esta es la prueba que lo fija.
        titulo = "Huracán Marie se intensifica frente a Baja California Sur"
        self.assertTrue(fuera_en(titulo))
        self.assertEqual(alcance(titulo, "estatal")[0], "fuera")


class TestAlcance(unittest.TestCase):
    def test_nombrar_lugar_gana(self):
        alc, zonas = alcance("Obra en Ensenada", "estatal")
        self.assertEqual((alc, zonas), ("zona", ["Ensenada"]))

    def test_cable_sin_lugar_no_recibe_zona(self):
        # El Imparcial y Uniradio son de grupo: si la nota no nombra el
        # lugar, no se les cree la zona.
        alc, zonas = alcance("Suben las tasas de interés", "estatal")
        self.assertEqual((alc, zonas), ("nacional", []))

    def test_medio_local_sin_lugar_si_recibe_su_zona(self):
        # Tecate Noticias hablando de algo sin nombrar Tecate sigue siendo
        # evidencia de Tecate.
        alc, zonas = alcance("Arranca justicia oral civil y familiar", "Tecate")
        self.assertEqual((alc, zonas), ("zona", ["Tecate"]))

    def test_nota_de_fuera_se_marca_fuera(self):
        alc, zonas = alcance("IMSS concreta donación en Hermosillo", "estatal")
        self.assertEqual((alc, zonas), ("fuera", []))

    def test_lugar_de_la_region_gana_a_lugar_de_fuera(self):
        # Una nota de la garita puede mencionar Sonora de paso.
        alc, zonas = alcance("Cruce Tijuana-San Diego supera a Sonora en aforo", "estatal")
        self.assertEqual(alc, "zona")
        self.assertIn("Tijuana", zonas)

    def test_figura_del_roster_implica_region(self):
        # Si el roster resolvio a alguien, la nota es de la region aunque no
        # nombre el municipio.
        alc, zonas = alcance("La gobernadora anuncia nuevo programa", "estatal", tiene_figura=True)
        self.assertEqual((alc, zonas), ("estatal", ["estatal"]))

    def test_sin_figura_y_sin_lugar_es_nacional(self):
        alc, zonas = alcance("Sheinbaum presenta su informe", "estatal", tiene_figura=False)
        self.assertEqual((alc, zonas), ("nacional", []))


class TestDelegaciones(unittest.TestCase):
    """Solo Tijuana se subdivide, y solo el titular lo dice."""

    def test_nombre_de_delegacion(self):
        self.assertEqual(delegaciones_en("Balacera en Sánchez Taboada"), ["Sánchez Taboada"])
        self.assertEqual(delegaciones_en("BALACERA EN SANCHEZ TABOADA"), ["Sánchez Taboada"])
        self.assertEqual(delegaciones_en("Obra en San Antonio de los Buenos"),
                         ["San Antonio de los Buenos"])

    def test_landmark_del_titular_real(self):
        t = "Reportan a dos personas baleadas en estacionamiento del Aeropuerto de Tijuana"
        self.assertEqual(delegaciones_en(t), ["Otay Centenario"])

    def test_playas_de_rosarito_no_es_playas_de_tijuana(self):
        self.assertEqual(delegaciones_en("Pronóstico del clima hoy en Playas de Rosarito"), [])
        self.assertEqual(delegaciones_en("Ejecutan a un hombre en Playas de Tijuana"),
                         ["Playas de Tijuana"])

    def test_zona_norte_del_beisbol_no_es_centro(self):
        t = "Cae Toros ante Sultanes en el juego 2 de la final de la zona norte"
        self.assertEqual(delegaciones_en(t), [])

    def test_el_pipila_es_ambiguo_y_se_omite(self):
        # Hay un El Pipila en Cerro Colorado y otro en Sanchez Taboada.
        self.assertEqual(delegaciones_en("Choque y volcadura en El Pípila deja tres lesionados"), [])

    def test_frase_completa_no_subcadena(self):
        # 'otay' dentro de otra palabra no cuenta; solo la frase completa.
        self.assertEqual(delegaciones_en("Empresa Otaymex abre planta"), [])
        self.assertEqual(delegaciones_en("Obra en Otay"), ["Otay Centenario"])

    def test_otay_mesa_es_san_diego(self):
        self.assertEqual(delegaciones_en("Otay Mesa detention center report"), [])
        self.assertEqual(delegaciones_en("Proyectan apertura de Garita Otay 2"), ["Otay Centenario"])

    def test_la_presa_este_no_cuenta_como_la_presa(self):
        self.assertEqual(delegaciones_en("Vecinos de La Presa Este exigen agua"), ["La Presa Este"])
        self.assertEqual(delegaciones_en("Baja el nivel de la presa Abelardo L. Rodríguez"),
                         ["La Presa A.L.R."])

    def test_dos_delegaciones_en_orden_canonico(self):
        self.assertEqual(
            delegaciones_en("Cierran acceso de Playas de Tijuana a Otay"),
            ["Otay Centenario", "Playas de Tijuana"],
        )

    def test_claves_coinciden_con_el_catalogo(self):
        self.assertEqual(set(DELEGACIONES), set(DELEGACIONES_TIJUANA))

    def test_nombre_propio_de_delegacion_implica_tijuana(self):
        # Coherencia entre gazeteros: nombrar la delegacion es nombrar Tijuana.
        # 'Centro' y 'La Mesa' se excluyen porque a secas son genericos.
        for d in DELEGACIONES_TIJUANA:
            if d in ("Centro", "La Mesa"):
                continue
            self.assertIn("Tijuana", zonas_en("Vecinos de {} protestan".format(d)), d)


if __name__ == "__main__":
    unittest.main()
