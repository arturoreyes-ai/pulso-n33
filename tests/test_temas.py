"""Pruebas del motor de temas.

Lo que se fija no es que salgan temas bonitos, sino las tres reglas honestas:
conteos y no porcentajes, nada por debajo del minimo, y prensa y comentarios
sin mezclar. Mas las dos trampas que salieron de una corrida real: nombres de
lugar disfrazados de tema, y frecuencia por termino en vez de por documento.
"""

import unittest

from pulso.temas import ngramas, temas, tokenizar


def nota(i, titulo, fecha, zonas=None, fuente="zeta"):
    return {"id": str(i), "titulo": titulo, "fecha": fecha,
            "zonas": zonas if zonas is not None else ["Tijuana"], "fuente": fuente}


class TestTokenizar(unittest.TestCase):
    def test_quita_vacias_y_cortas(self):
        t = tokenizar("El agua de la presa se acaba")
        self.assertIn("agua", t)
        self.assertIn("presa", t)
        self.assertNotIn("el", t)
        self.assertNotIn("de", t)

    def test_quita_nombres_de_lugar(self):
        # Un lugar no es un tema: es la faceta 'zona'. Sin esto, 'diego' (de
        # 'San Diego') y 'tijuana' salen como temas principales.
        t = tokenizar("Obra en Tijuana y San Diego avanza")
        self.assertNotIn("tijuana", t)
        self.assertNotIn("diego", t)
        self.assertIn("avanza", t)
        # 'taboada' no es nada mas que un lugar; 'colorado' y 'centro' si son
        # palabras, y por eso no van en la lista.
        self.assertNotIn("taboada", tokenizar("Balacera en Sánchez Taboada"))

    def test_quita_genericos_de_titular(self):
        t = tokenizar("Llega nuevo hospital para personas de la zona")
        self.assertNotIn("llega", t)
        self.assertNotIn("nuevo", t)
        self.assertNotIn("personas", t)
        self.assertIn("hospital", t)

    def test_pliega_acentos(self):
        self.assertIn("percepcion", tokenizar("La percepción de inseguridad"))

    def test_descarta_numeros_sueltos(self):
        self.assertNotIn("2026", tokenizar("Presupuesto 2026 aprobado"))


class TestNgramas(unittest.TestCase):
    def test_hasta_trigramas(self):
        g = ngramas(["agua", "potable", "escasez"])
        self.assertIn("agua", g)
        self.assertIn("agua potable", g)
        self.assertIn("agua potable escasez", g)

    def test_las_vacias_ya_no_separan(self):
        # 'percepcion de inseguridad' llega como bigrama 'percepcion
        # inseguridad', que es la forma que se quiere agrupar.
        g = ngramas(tokenizar("La percepción de inseguridad crece"))
        self.assertIn("percepcion inseguridad", g)


class TestTemas(unittest.TestCase):
    def test_respeta_el_minimo(self):
        regs = [nota(i, "Escasez de agua potable en la colonia", "2026-09-01") for i in range(2)]
        r = temas(regs, "2026-09-03", minimo=3)
        self.assertEqual(r["temas"], [])

    def test_detecta_un_tema_por_encima_del_minimo(self):
        regs = [nota(i, "Escasez de agua potable en la colonia", "2026-09-01") for i in range(4)]
        r = temas(regs, "2026-09-03", minimo=3)
        terminos = [t["termino"] for t in r["temas"]]
        self.assertTrue(any("agua" in t for t in terminos))

    def test_frecuencia_por_documento_no_por_termino(self):
        # Un solo titular que repite la palabra no inventa un tema.
        regs = [nota(0, "Agua agua agua agua agua potable", "2026-09-01")]
        r = temas(regs, "2026-09-03", minimo=3)
        self.assertEqual(r["temas"], [])

    def test_momento_contra_la_ventana_anterior(self):
        regs = [nota(i, "Escasez de agua potable", "2026-09-01") for i in range(5)]
        regs += [nota(100 + i, "Escasez de agua potable", "2026-08-25") for i in range(2)]
        r = temas(regs, "2026-09-03", ventana_dias=7, minimo=3)
        # La etiqueta que sobrevive al desempate es la mas especifica, o sea
        # el trigrama 'escasez agua potable' y no el unigrama 'agua'.
        agua = next(t for t in r["temas"] if "agua" in t["termino"])
        self.assertEqual(agua["n"], 5)
        self.assertEqual(agua["n_previo"], 2)
        self.assertEqual(agua["momento"], 3)
        self.assertEqual(r["notas_ventana"], 5)
        self.assertEqual(r["notas_previas"], 2)

    def test_no_reporta_porcentajes(self):
        # Con volumen bajo un porcentaje se mueve con dos comentarios, asi
        # que el contrato es conteos. docs/PLAN.md seccion 6.
        regs = [nota(i, "Escasez de agua potable", "2026-09-01") for i in range(4)]
        r = temas(regs, "2026-09-03", minimo=3)
        for t in r["temas"]:
            self.assertNotIn("porcentaje", t)
            self.assertNotIn("pct", t)
            self.assertIsInstance(t["n"], int)

    def test_colapsa_etiquetas_del_mismo_grupo(self):
        # 'agua', 'agua potable' y 'agua potable escasez' cubren las mismas
        # notas: es un tema, no tres.
        regs = [nota(i, "Escasez de agua potable", "2026-09-01") for i in range(4)]
        r = temas(regs, "2026-09-03", minimo=3)
        self.assertEqual(len(r["temas"]), 1)
        self.assertTrue(r["descartados"])

    def test_marca_tema_de_un_solo_medio(self):
        # Un tema sostenido por un medio es la agenda de ese medio.
        regs = [nota(i, "Pronostican cielo despejado", "2026-09-01", fuente="zeta") for i in range(4)]
        r = temas(regs, "2026-09-03", minimo=3)
        self.assertTrue(r["temas"][0]["un_solo_medio"])

        regs2 = [nota(i, "Escasez de agua potable", "2026-09-01",
                      fuente="zeta" if i % 2 else "soltij") for i in range(4)]
        r2 = temas(regs2, "2026-09-03", minimo=3)
        self.assertFalse(r2["temas"][0]["un_solo_medio"])

    def test_desglose_por_zona_cuenta_en_todas(self):
        regs = [nota(i, "Fila en la garita fronteriza", "2026-09-01",
                     zonas=["Tijuana", "San Diego"]) for i in range(3)]
        r = temas(regs, "2026-09-03", minimo=3)
        z = r["temas"][0]["zonas"]
        self.assertEqual(z.get("Tijuana"), 3)
        self.assertEqual(z.get("San Diego"), 3)

    def test_nota_sin_zona_se_rotula_nacional(self):
        regs = [nota(i, "Suben las tasas hipotecarias", "2026-09-01", zonas=[]) for i in range(3)]
        r = temas(regs, "2026-09-03", minimo=3)
        self.assertIn("nacional", r["temas"][0]["zonas"])

    def test_ignora_fechas_futuras(self):
        # Un feed mal fechado no debe inventar tendencia.
        regs = [nota(i, "Escasez de agua potable", "2027-01-01") for i in range(5)]
        r = temas(regs, "2026-09-03", minimo=3)
        self.assertEqual(r["notas_ventana"], 0)
        self.assertEqual(r["temas"], [])

    def test_el_origen_viaja_en_la_salida(self):
        # Prensa y comentarios nunca se mezclan: cada corrida dice de donde
        # vino. docs/PLAN.md seccion 6 regla 3.
        r = temas([], "2026-09-03", origen="comentarios")
        self.assertEqual(r["origen"], "comentarios")

    def test_determinista(self):
        regs = [nota(i, "Escasez de agua potable en la colonia", "2026-09-01") for i in range(5)]
        a = temas(regs, "2026-09-03", minimo=3)
        b = temas(list(reversed(regs)), "2026-09-03", minimo=3)
        self.assertEqual([t["termino"] for t in a["temas"]],
                         [t["termino"] for t in b["temas"]])


if __name__ == "__main__":
    unittest.main()
