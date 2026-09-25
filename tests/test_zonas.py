"""Pruebas del alcance geografico.

El caso que motiva el modulo es real: el feed de El Imparcial trae al grupo
entero y en la primera corrida de 504 notas 'hermosillo' y 'sonora' salieron
como temas principales de un tablero de Baja California.
"""

import unittest

from pulso import DELEGACIONES_TIJUANA
from pulso.zonas import DELEGACIONES, alcance, delegaciones_en, es_estatal, fuera_en, zonas_en, FUERA
from pulso.zonas import (AMBIGUOS, AMBIGUOS_EXTRANJERO, CALLES_HOMONIMAS, EXTRANJERO, LUGARES,
                         alcance_redes, extranjero_en, nombra_mexico, prosa_de)


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

    def test_la_capital_es_fuera_de_la_region(self):
        # Faltaba entera, y de ahi sale la mayor parte de la nota nacional. El
        # caso, medido el 21 de septiembre de 2026: leido de un medio de una
        # sola zona, este titular devolvia ('zona', ['Tijuana']) --- sin
        # veredicto de fuera dispara la rama de `zona_medio` y el tablero le
        # acreditaba a Tijuana el programa vehicular de la Ciudad de Mexico.
        titulo = "Hoy No Circula sabado 19 de septiembre: que autos no circulan en CDMX"
        self.assertEqual(alcance(titulo, "Tijuana"), ("fuera", []))
        self.assertEqual(alcance("Tren Mexico-Pachuca: conoce las estaciones", "Tijuana"),
                         ("fuera", []))

    def test_un_estado_que_tambien_es_colonia_de_tijuana_no_esta_en_fuera(self):
        # Morelos, Hidalgo y Durango son estados Y colonias de Tijuana, y
        # "morelos" ademas esta en LUGARES. Meterlos en FUERA haria que el
        # mismo token significara dos lugares. Esta prueba es la razon escrita.
        alc, zonas = alcance("Balacera en la colonia Morelos", "Tijuana")
        self.assertEqual(alc, "zona")
        self.assertIn("Tijuana", zonas)
        for estado in ("morelos", "hidalgo", "durango"):
            self.assertNotIn(estado, FUERA)

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


class TestAlcanceRedes(unittest.TestCase):
    """El quinto cajon, `extranjero`, que solo ven las piezas de redes.

    El caso, del 22 de septiembre de 2026: el gacetero no conocia el
    extranjero, asi que "Mas de 280 mil ninos en Gaza regresaron a clases", de
    N+, caia en la cubeta Mexico, indistinguible de una nota nacional.
    """

    def test_la_prensa_no_cambia(self):
        # `alcance` zonifica notas.json y no ve el extranjero: si esto se
        # mueve, cambia la prensa, que no es lo que se decidio.
        for titulo, esperado in [
            ("Rusia ataca Ucrania", ("nacional", [])),
            ("Congreso pone sobre la mesa avances y pendientes de Sonora", ("zona", ["Tijuana"])),
            ("Rusia advierte que las sanciones complican la paz", ("fuera", [])),
        ]:
            with self.subTest(titulo=titulo):
                self.assertEqual(alcance(titulo, None), esperado)

    def test_el_extranjero_nombrado(self):
        self.assertEqual(alcance_redes("Mas de 280 mil ninos en Gaza regresaron a clases"),
                         ("extranjero", []))
        self.assertEqual(extranjero_en("Rusia ataca Ucrania"), ["ucrania", "rusia"])

    def test_frase_completa_y_no_subcadena(self):
        # 'iran' esta dentro de 'tirano', 'roma' de 'aroma', 'peru' de 'perulero'.
        for texto in ("Un tirano con aroma de perulero", "Suben los chiles serranos"):
            with self.subTest(texto=texto):
                self.assertEqual(extranjero_en(texto), [])

    def test_lo_que_no_esta_en_la_lista_y_por_que(self):
        # Cada exclusion con su caso, escrito junto a EXTRANJERO en zonas.py.
        # Estados Unidos: "cruzar a Estados Unidos" es nota del corredor.
        # California: esta dentro de "baja california". Papa: fold() hace del
        # Papa de un conductor el Vaticano. Chile: la salsa. Quito: el verbo.
        for termino in ("estados unidos", "eeuu", "usa", "eu", "california", "papa", "chile",
                        "quito", "kenia", "grecia", "libia", "nevada", "jamaica",
                        "latinoamerica", "san antonio", "colorado"):
            with self.subTest(termino=termino):
                self.assertNotIn(termino, EXTRANJERO)
        self.assertEqual(alcance_redes("Asi esta la fila para cruzar a Estados Unidos"),
                         ("nacional", []))
        self.assertEqual(alcance_redes("Su Papa regresa a pagar la gasolina en Puebla"),
                         ("fuera", []))

    def test_homonimos_medidos_en_el_archivo(self):
        # Salieron de medir la lista sobre los 6,699 titulares de notas.json.
        for texto in ("Proponen ajustar la tarifa de verano de Bahia de los Angeles",
                      "Kenia Os presume fotografia", "Cruz Azul le quito el invicto al America",
                      "Iran a audiencia por fusion en octubre",
                      "Derma Center ya esta disponible en Farmacias Roma",
                      "Lluvias complican vuelos de Air France; AICM anuncia apoyo",
                      "Asi se celebro el Festival del Chile en Nogada",
                      "te veo el lunes en Argentina 1100 colonia Alamitos",
                      "Vive en la calle Venezuela"):
            with self.subTest(texto=texto):
                self.assertEqual(extranjero_en(texto), [])
        # El pais de verdad sigue contando, y el marcador de un partido tambien.
        self.assertEqual(extranjero_en("Iran advierte a Corea del Sur"), ["iran", "corea del sur"])
        self.assertEqual(extranjero_en("Argentina 2, Mexico 1"), ["argentina"])

    def test_nuevo_mexico_es_extranjero_y_mexico_no(self):
        self.assertEqual(alcance_redes("Incendio en Nuevo Mexico"), ("extranjero", []))
        self.assertTrue(nombra_mexico("Mexico vence a Argentina"))
        self.assertFalse(nombra_mexico("Incendio en Nuevo Mexico"))
        # Nombrar Mexico bloquea el extranjero y NO crea `fuera`.
        self.assertEqual(alcance_redes("Mexico vence a Argentina en el Mundial"), ("nacional", []))
        self.assertEqual(alcance_redes("Detienen a mexicanos en Texas"), ("nacional", []))

    def test_nombrar_mexico_le_gana_a_la_cola_de_etiquetas(self):
        # 24 de septiembre de 2026, primer dia de los perfiles de N+ y Azteca
        # Noticias: cuatro notas nacionales llegaron al muro de Tijuana por un
        # #tijuana al final del pie. Mexico es el nivel 3 y la etiqueta el 5.
        self.assertEqual(alcance_redes(
            "Donald Trump volvio a referirse a Mexico ante la ONU\n#nmas #noticias #tijuana"),
            ("nacional", []))
        # Lo que nombra el corredor en la prosa sigue siendo del corredor, y
        # la etiqueta sigue contando cuando la prosa no nombra nada.
        self.assertEqual(alcance_redes("Deportados llegan a Tijuana; Sheinbaum promete apoyo"),
                         ("zona", ["Tijuana"]))
        self.assertEqual(alcance_redes("Balacera deja un herido\n#tijuana"), ("zona", ["Tijuana"]))

    def test_precedencia(self):
        casos = [
            # 1. El corredor, nombrado de verdad, gana.
            ("Deportados desde Texas llegan a Tijuana", ("zona", ["Tijuana"])),
            ("Choque en La Presa Este; el conductor era de Texas", ("zona", ["Tijuana"])),
            # 2. Baja California a secas gana sobre el extranjero.
            ("Gobierno del Estado firma convenio con Japon", ("estatal", ["estatal"])),
            # 3. Un lugar mexicano de fuera gana sobre el extranjero.
            ("Sheinbaum en Oaxaca recibe al presidente de Francia", ("fuera", [])),
            # 5. Lo debil cede: un homonimo...
            ("Congreso pone sobre la mesa avances y pendientes de Sonora", ("fuera", [])),
            ("Rusia advierte que las sanciones complican la paz", ("extranjero", [])),
            ("En El Rosario, Sinaloa, localizan cinco recipientes", ("fuera", [])),
            # ...y una etiqueta, cuando el texto nombra algo de fuera.
            ("31 Millones de Soldados vs EEUU!! Iran Prepara Su Mayor Fuerza #tijuana",
             ("extranjero", [])),
            ("Golpe a los carteles de Jalisco y Sinaloa #mexicali", ("fuera", [])),
            # Sin nada de fuera en el texto, lo debil sigue contando.
            ("Balacera en la colonia #tijuana", ("zona", ["Tijuana"])),
            ("Choque en La Presa", ("zona", ["Tijuana"])),
            # Una etiqueta del extranjero cuenta cuando el texto no nombra nada.
            ("#noticias #peru", ("extranjero", [])),
        ]
        for texto, esperado in casos:
            with self.subTest(texto=texto):
                self.assertEqual(alcance_redes(texto), esperado)

    def test_la_prosa_es_lo_que_la_pieza_dice(self):
        # Solo la COLA de etiquetas es debil; las del principio son antetitulo
        # (CNR: "#ROSARITO | ...") y la que sigue a una preposicion es frase.
        self.assertEqual(prosa_de("Cierran la garita #tijuana #noticias").split(),
                         ["Cierran", "la", "garita"])
        self.assertEqual(prosa_de("Migrantes de Haití llegan a #Tijuana #noticias").split(),
                         ["Migrantes", "de", "Haití", "llegan", "a", "#Tijuana"])
        self.assertEqual(prosa_de("#TIJUANA | Deportan a hondureño"),
                         "#TIJUANA | Deportan a hondureño")
        # Solo etiquetas: son lo unico que la pieza dice, y se quedan.
        self.assertEqual(prosa_de("#noticias #peru"), "#noticias #peru")
        # La firma del canal, cortada por texto plegado, solo al final.
        self.assertEqual(prosa_de("Choque en Los Ángeles | Telemundo San Diego",
                                  ["| TELEMUNDO SAN DIEGO"]).strip(),
                         "Choque en Los Ángeles")

    def test_lo_que_la_revision_encontro(self):
        # Casos de la revision de diseno del 22 de septiembre de 2026, cada uno
        # un error de la primera version.
        casos = [
            # La etiqueta usada como palabra y el antetitulo son prosa.
            ("Migrantes de Haití llegan a #Tijuana", ("zona", ["Tijuana"])),
            ("#TIJUANA | Deportan a hondureño desde Texas", ("zona", ["Tijuana"])),
            # LUGARES empata por subcadena, asi que lo debil se borra igual.
            ("Hallan tesoros escondidos en Egipto", ("extranjero", [])),
            # fold() hacia de la canada Canada.
            ("Choque en la cañada del arroyo", ("nacional", [])),
            # El verbo, en cualquier lugar de la frase.
            ("Los alumnos irán a clases el lunes", ("nacional", [])),
            # Una delegacion de Tijuana no cede ante Sonora, solo ante el extranjero.
            ("Balacera en La Mesa; el detenido llegó de Sonora", ("zona", ["Tijuana"])),
            ("Se desborda la presa en Bangladesh, dice Egipto", ("extranjero", [])),
            # Mexico sin escribir "Mexico".
            ("El gobierno de Sheinbaum frena el alza pese a la guerra en Medio Oriente",
             ("nacional", [])),
            ("Harfuch informa decomiso en AICM; llegó de Colombia", ("nacional", [])),
        ]
        for texto, esperado in casos:
            with self.subTest(texto=texto):
                self.assertEqual(alcance_redes(texto), esperado)

    def test_la_avenida_revolucion_de_mixcoac_no_es_tijuana(self):
        # Uno TV, busqueda de Ensenada, 24 de septiembre de 2026: la avenida es
        # alias directo de la Zona Centro, asi que `alcance` le daba Tijuana
        # con 'zona', el veredicto mas fuerte, y Mixcoac no estaba en FUERA.
        pie = ("Circula en redes sociales el video del momento en que un grupo de "
               "sujetos agrede a automovilistas y les rompen los cristales del coche "
               "en Mixcoac, cerca de Av. Revolución")
        self.assertEqual(alcance_redes(pie), ("fuera", []))
        self.assertEqual(alcance_redes(pie + "\n#noticias #tijuana"), ("fuera", []))
        self.assertEqual(alcance_redes("Asaltan a automovilistas en la Avenida Revolución, "
                                       "en la Ciudad de México"), ("fuera", []))
        self.assertEqual(alcance_redes("Balacera en Av. Revolución; el detenido llegó de "
                                       "Sonora"), ("fuera", []))
        # Sin nada de fuera, la avenida sigue siendo la de Tijuana.
        self.assertEqual(alcance_redes("Balacera en Av. Revolución"), ("zona", ["Tijuana"]))
        self.assertEqual(alcance_redes("Turistas llenan la Avenida Revolución #tijuana"),
                         ("zona", ["Tijuana"]))
        # Y no cede ante Mexico nombrado ni ante el extranjero. El primero es
        # un titulo real en cache que la primera version mando a la cubeta
        # Mexico; la visita fue a la avenida de Tijuana.
        self.assertEqual(alcance_redes("Avenida Revolución se prepara para recibir a "
                                       "Claudia Sheinbaum 🇲🇽"), ("zona", ["Tijuana"]))
        self.assertEqual(alcance_redes("Migrantes de Honduras llegan a la Avenida Revolución"),
                         ("zona", ["Tijuana"]))

    def test_la_prensa_no_ve_la_calle_homonima(self):
        # CALLES_HOMONIMAS es solo de redes: en `alcance` la avenida sigue
        # siendo Tijuana aunque la nota nombre la capital, como antes. Los dos
        # primeros son titulares de notas.json.
        for titulo, esperado in [
            ("Convoca Sheinbaum a ciudadanos, funcionarios y personajes públicos que "
             "abarrotan la avenida Revolución en Tijuana", ("zona", ["Tijuana"])),
            ("Cierres por informe de Sheinbaum afectan ventas de comerciantes en la "
             "Avenida Revolución", ("zona", ["Tijuana"])),
            ("Asaltan a automovilistas en la Avenida Revolución, en la Ciudad de México",
             ("zona", ["Tijuana"])),
        ]:
            with self.subTest(titulo=titulo):
                self.assertEqual(alcance(titulo, None), esperado)
        # Mixcoac si entro a FUERA, y lo ve la prensa; no toca ningun titular
        # de notas.json del 24 de septiembre de 2026.
        self.assertEqual(alcance("Asaltan a automovilistas en Mixcoac", "Tijuana"),
                         ("fuera", []))

    def test_los_debiles_son_del_gacetero_y_el_extranjero_no(self):
        # Un AMBIGUO que no esta en el gacetero no cede nada: es peso muerto.
        del_gacetero = {t for ts in LUGARES.values() for t in ts} | set(FUERA)
        for termino in AMBIGUOS + AMBIGUOS_EXTRANJERO:
            with self.subTest(termino=termino):
                self.assertIn(termino, del_gacetero)
        # Las calles viven en las delegaciones de Tijuana.
        de_delegaciones = {t for ts in DELEGACIONES.values() for t in ts}
        for termino in CALLES_HOMONIMAS:
            with self.subTest(termino=termino):
                self.assertIn(termino, de_delegaciones)
        # Y ningun lugar del extranjero es a la vez del gacetero.
        for termino in EXTRANJERO:
            with self.subTest(termino=termino):
                self.assertNotIn(termino, del_gacetero)


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
