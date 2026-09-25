"""Pruebas del clasificador local de sentimiento y de lo que publica.

Nada de esto carga el modelo: se usa AnalizadorFalso, que tiene la misma
forma. Lo que se fija aqui es el contrato -- que se etiqueta, que se
conserva, que se publica y, sobre todo, que NO se publica.
"""

import json
import os
import tempfile
import unittest

from pulso import VERSION
from pulso.clasificar import clasificar, clasificar_lote, sin_idioma
from pulso.normalizar import id_nota
from pulso.roster import Roster
from pulso.sentimiento import (
    IDIOMAS,
    Analizador,
    AnalizadorFalso,
    recortar,
)
from pulso.validador import validar_conversacion, validar_notas
from pulso.conversacion import clasificar_cache, derivar, guardar_cache, leer_cache


def nota(i, titulo, postura=None):
    return {"id": "n%d" % i, "titulo": titulo, "postura": postura}


def comentario(cid, texto, fecha="2026-09-01", canal="uno", zona="Tijuana",
               titulo="", temas=None, sentimiento=None):
    c = {"id": cid, "texto": texto, "likes": 1, "respuestas": 0,
         "publicado": fecha + "T12:00:00Z", "fecha": fecha,
         "video": "v1", "video_titulo": titulo, "canal": canal,
         "zona_canal": zona, "capturado": fecha + "T12:00:00Z",
         "origen": "canal", "temas": temas or []}
    if sentimiento is not None:
        c["sentimiento"] = {"etiqueta": sentimiento, "confianza": 0.9,
                            "modelo": AnalizadorFalso.modelo}
    return c


class TestAnalizadorFalso(unittest.TestCase):
    def test_recorta_y_normaliza_espacios(self):
        self.assertEqual(recortar("  hola \n mundo  "), "hola mundo")
        self.assertEqual(len(recortar("x" * 1000)), 400)


class TestClasificarLote(unittest.TestCase):
    def test_ninguno_deja_null(self):
        notas = [nota(1, "a", {"etiqueta": "neutral"}), nota(2, "b")]
        self.assertEqual(clasificar_lote(notas, "ninguno"), 0)
        self.assertTrue(all(n["postura"] is None for n in notas))

    def test_diccionario_sigue_igual(self):
        notas = [nota(1, "Alcalde inaugura obra y entrega apoyo")]
        clasificar_lote(notas, "diccionario")
        self.assertEqual(notas[0]["postura"]["metodo"], "diccionario")
        self.assertIsInstance(notas[0]["postura"]["puntaje"], int)

    def test_modelo_traduce_a_tono_y_lleva_modelo(self):
        notas = [nota(1, "Crece la inseguridad en la colonia"), nota(2, "Gran logro deportivo")]
        n = clasificar_lote(notas, "modelo", AnalizadorFalso())
        self.assertEqual(n, 2)
        self.assertEqual(notas[0]["postura"]["etiqueta"], "adversa")
        self.assertEqual(notas[1]["postura"]["etiqueta"], "favorable")
        for x in notas:
            p = x["postura"]
            self.assertEqual(p["metodo"], "modelo")
            self.assertEqual(p["modelo"], AnalizadorFalso.modelo)
            self.assertEqual(p["version"], VERSION)
            self.assertNotIn("puntaje", p)
            self.assertTrue(0 <= p["confianza"] <= 1)

    def test_conserva_etiquetas_vigentes_y_clasifica_solo_el_resto(self):
        falso = AnalizadorFalso()
        vigente = {"etiqueta": "neutral", "confianza": 0.5, "metodo": "modelo",
                   "modelo": falso.modelo, "version": "0.0.1"}
        notas = [nota(1, "Sin agua otra vez", vigente), nota(2, "Sin agua otra vez")]
        self.assertEqual(clasificar_lote(notas, "modelo", falso), 1)
        self.assertEqual(notas[0]["postura"]["etiqueta"], "neutral")   # no se toco
        self.assertEqual(notas[1]["postura"]["etiqueta"], "adversa")

    def test_otro_modelo_o_el_diccionario_no_cuentan_como_vigentes(self):
        falso = AnalizadorFalso()
        notas = [
            nota(1, "Sin agua", {"etiqueta": "neutral", "confianza": 0.5, "metodo": "modelo",
                                 "modelo": "otro/modelo", "version": VERSION}),
            nota(2, "Sin agua", {"etiqueta": "neutral", "puntaje": 0, "metodo": "diccionario",
                                 "version": VERSION}),
        ]
        self.assertEqual(clasificar_lote(notas, "modelo", falso), 2)

    def test_la_postura_del_modelo_pasa_el_validador(self):
        notas = [nota(1, "Sin agua otra vez")]
        clasificar_lote(notas, "modelo", AnalizadorFalso())
        n = dict(
            notas[0], url="https://x.mx/a", dominio="x.mx", fuente="zeta",
            zona_medio="Tijuana", zonas=["Tijuana"], alcance="zona",
            fecha="2026-09-01", publicado=None, capturado="2026-09-01T00:00:00+00:00",
            figuras=[],
        )
        n["id"] = id_nota("zeta", n["titulo"])
        errores, _ = validar_notas({"esquema": 1, "total": 1, "notas": [n]})
        self.assertEqual(errores, [])

    def test_clasificar_de_una_nota_rechaza_modelo(self):
        with self.assertRaises(ValueError):
            clasificar("x", "modelo")

    def test_metodo_desconocido(self):
        with self.assertRaises(ValueError):
            clasificar_lote([nota(1, "x")], "vibras")


class TestClasificarCache(unittest.TestCase):
    def setUp(self):
        self.cache = tempfile.mkdtemp()
        guardar_cache([comentario("c1", "Sin agua otra vez"),
                       comentario("c2", "Gran noticia para todos")],
                      "2026-09-01T12:00:00+00:00", cache=self.cache)

    def test_etiqueta_en_el_cache_y_no_en_otro_lado(self):
        n = clasificar_cache(self.cache, AnalizadorFalso())
        self.assertEqual(n, 2)
        por_id = {c["id"]: c for c in leer_cache(self.cache)}
        self.assertEqual(por_id["c1"]["sentimiento"]["etiqueta"], "NEG")
        self.assertEqual(por_id["c2"]["sentimiento"]["etiqueta"], "POS")
        self.assertEqual(por_id["c1"]["texto"], "Sin agua otra vez")  # el texto sigue ahi

    def test_segunda_pasada_no_reclasifica(self):
        falso = AnalizadorFalso()
        clasificar_cache(self.cache, falso)
        self.assertEqual(clasificar_cache(self.cache, falso), 0)
        self.assertEqual(falso.llamadas, 1)

    def test_cache_inexistente_no_truena(self):
        self.assertEqual(clasificar_cache(os.path.join(self.cache, "nada"), AnalizadorFalso()), 0)


class TestDerivadosConSentimiento(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")

    def derivar_con(self, coms):
        return derivar(coms, self.roster, "2026-09-03T12:00:00+00:00", [], {})

    def coms(self):
        return [
            comentario("c1", "Sin agua otra vez en la colonia", sentimiento="NEG", temas=["agua"]),
            comentario("c2", "Otra vez sin agua, que barbaridad?", sentimiento="NEG", temas=["agua"]),
            comentario("c3", "Gran noticia, felicidades", sentimiento="POS"),
            comentario("c4", "Sesion de cabildo del martes", sentimiento="NEU"),
            comentario("c5", "ya basta", canal="dos", zona="Mexicali"),   # sin etiqueta
        ]

    def test_conteos_globales_y_metodo(self):
        s = self.derivar_con(self.coms())["sentimiento"]
        self.assertEqual(s["metodo"], "modelo")
        self.assertEqual(s["modelo"], AnalizadorFalso.modelo)
        self.assertEqual((s["positivo"], s["negativo"], s["neutral"], s["sin_clasificar"]), (1, 2, 1, 1))

    def test_sin_etiquetas_el_metodo_es_ninguno(self):
        s = self.derivar_con([comentario("c1", "hola")])["sentimiento"]
        self.assertEqual(s["metodo"], "ninguno")
        self.assertIsNone(s["modelo"])
        self.assertEqual(s["sin_clasificar"], 1)

    def test_detalle_por_zona(self):
        panel = self.derivar_con(self.coms())
        tj = panel["por_zona_detalle"]["Tijuana"]
        self.assertEqual(tj["comentarios"], panel["por_zona"]["Tijuana"])
        self.assertEqual(tj["sentimiento"], {"positivo": 1, "negativo": 2, "neutral": 1})
        self.assertEqual(tj["preguntas"], 1)
        self.assertEqual(tj["interacciones"], 4)
        agua = tj["por_tema"][0]
        self.assertEqual(agua["tema"], "agua")
        self.assertEqual(agua["comentarios"], 2)
        self.assertEqual(agua["sentimiento"]["negativo"], 2)
        mx = panel["por_zona_detalle"]["Mexicali"]
        self.assertEqual(mx["sentimiento"], {"positivo": 0, "negativo": 0, "neutral": 0})

    def test_por_tema_lleva_sentimiento(self):
        panel = self.derivar_con(self.coms())
        agua = next(t for t in panel["por_tema"] if t["tema"] == "agua")
        self.assertEqual(agua["sentimiento"]["negativo"], 2)

    def test_no_publica_texto_ni_etiqueta_por_comentario(self):
        crudo = json.dumps(self.derivar_con(self.coms()), ensure_ascii=False)
        self.assertNotIn("Sin agua otra vez", crudo)
        self.assertNotIn("barbaridad", crudo)
        self.assertNotIn('"c1"', crudo)
        self.assertNotIn("confianza", crudo)   # la etiqueta individual se queda en el cache

    def test_pasa_el_validador(self):
        panel = self.derivar_con(self.coms())
        errores, _ = validar_conversacion(panel)
        self.assertEqual(errores, [])

    def test_el_validador_rechaza_texto(self):
        panel = self.derivar_con(self.coms())
        panel["por_zona_detalle"]["Tijuana"]["texto"] = "hola"
        errores, _ = validar_conversacion(panel)
        self.assertTrue(any("prohibida" in e for e in errores))

    def test_el_validador_exige_que_los_conteos_cuadren(self):
        panel = self.derivar_con(self.coms())
        panel["sentimiento"]["positivo"] += 1
        errores, _ = validar_conversacion(panel)
        self.assertTrue(any("suman" in e for e in errores))


def nota_de(i, titulo, fuente, postura=None):
    n = nota(i, titulo, postura)
    n["fuente"] = fuente
    return n


IDIOMAS_PRUEBA = {"soltij": "es", "kpbs": "en", "voiceofsd": "en"}


class TestIdiomaDelMedio(unittest.TestCase):
    """Un modelo no se aplica a un idioma que no habla.

    El caso real: los cuatro medios de San Diego publican en ingles y se
    estaban etiquetando con RoBERTuito, entrenado con tuits en espanol. Son
    98 de las 888 notas del corte. El modelo no falla con texto en otro
    idioma: devuelve una etiqueta plausible, y eso no se distingue de un
    acierto mirando la salida.
    """

    def test_el_modelo_no_etiqueta_lo_que_no_habla(self):
        notas = [nota_de(1, "Sin agua otra vez en Tijuana", "soltij"),
                 nota_de(2, "San Diego rents keep climbing", "kpbs")]
        clasificar_lote(notas, "modelo", AnalizadorFalso(), idiomas=IDIOMAS_PRUEBA)
        self.assertEqual(notas[0]["postura"]["etiqueta"], "adversa")
        self.assertIsNone(notas[1]["postura"])

    def test_solo_cuenta_las_que_si_clasifico(self):
        notas = [nota_de(1, "Sin agua", "soltij"),
                 nota_de(2, "Rent hike", "kpbs"),
                 nota_de(3, "Eviction notice", "voiceofsd")]
        self.assertEqual(
            clasificar_lote(notas, "modelo", AnalizadorFalso(), idiomas=IDIOMAS_PRUEBA), 1)

    def test_el_modelo_ni_ve_los_titulares_ajenos(self):
        # No basta con borrar la etiqueta despues: mandar el texto al modelo
        # y tirar el resultado gastaria CPU y, con el modelo real, memoria.
        # Hasta el 25 de septiembre de 2026 esta prueba solo miraba que
        # `postura` saliera null, que ya fija la de arriba; ahora mira lo que
        # el modelo recibio.
        class Grabador(AnalizadorFalso):
            def __init__(self):
                super().__init__()
                self.vistos = []

            def predecir(self, textos, lote=32, uno_a_uno=False):
                self.vistos.extend(textos)
                return super().predecir(textos, lote, uno_a_uno)

        grabador = Grabador()
        notas = [nota_de(1, "Rent hike", "kpbs"), nota_de(2, "Sin agua en Tijuana", "soltij"),
                 nota_de(3, "Eviction", "voiceofsd")]
        clasificar_lote(notas, "modelo", grabador, idiomas=IDIOMAS_PRUEBA)
        self.assertEqual(grabador.vistos, ["Sin agua en Tijuana"])
        # Y sin nada en su idioma, el modelo ni se llama.
        solo_ingles = Grabador()
        clasificar_lote([nota_de(4, "Rent hike", "kpbs")], "modelo", solo_ingles,
                        idiomas=IDIOMAS_PRUEBA)
        self.assertEqual(solo_ingles.vistos, [])

    def test_un_analizador_en_ingles_si_las_etiqueta(self):
        notas = [nota_de(1, "Sin agua", "soltij"), nota_de(2, "No rent", "kpbs")]
        clasificar_lote(notas, "modelo", AnalizadorFalso(idioma="en"),
                        idiomas=IDIOMAS_PRUEBA)
        self.assertIsNone(notas[0]["postura"])
        self.assertEqual(notas[1]["postura"]["etiqueta"], "adversa")

    def test_el_diccionario_tampoco_se_aplica_al_ingles(self):
        # El lexico es de palabras en espanol.
        notas = [nota_de(1, "Robo en la colonia", "soltij"),
                 nota_de(2, "Robbery downtown", "kpbs")]
        self.assertEqual(clasificar_lote(notas, "diccionario",
                                         idiomas=IDIOMAS_PRUEBA), 1)
        self.assertEqual(notas[0]["postura"]["metodo"], "diccionario")
        self.assertIsNone(notas[1]["postura"])

    def test_sin_mapa_de_idiomas_todo_es_espanol(self):
        # Compatibilidad: antes del campo, las 20 fuentes eran espanol.
        notas = [nota_de(1, "Sin agua", "soltij"), nota_de(2, "Rent hike", "kpbs")]
        self.assertEqual(clasificar_lote(notas, "modelo", AnalizadorFalso()), 2)

    def test_cuenta_las_que_quedaron_sin_modelo(self):
        notas = [nota_de(1, "a", "soltij"), nota_de(2, "b", "kpbs"),
                 nota_de(3, "c", "voiceofsd")]
        self.assertEqual(sin_idioma(notas, "es", IDIOMAS_PRUEBA), 2)
        self.assertEqual(sin_idioma(notas, "en", IDIOMAS_PRUEBA), 1)

    def test_una_fuente_desconocida_se_asume_espanol(self):
        # Las fuentes descubiertas por GDELT no estan en el catalogo, y la
        # consulta de descubrimiento filtra sourcelang:spanish.
        notas = [nota_de(1, "Sin agua", "web-abc123def456")]
        clasificar_lote(notas, "modelo", AnalizadorFalso(), idiomas=IDIOMAS_PRUEBA)
        self.assertEqual(notas[0]["postura"]["etiqueta"], "adversa")

    def test_idioma_sin_modelo_falla_en_voz_alta(self):
        with self.assertRaises(ValueError):
            Analizador(idioma="fr")


class TestIdiomaEnElCatalogo(unittest.TestCase):
    """El catalogo publicado tiene que declarar el idioma de cada medio."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join("config", "medios.json"), encoding="utf-8") as fh:
            cls.medios = json.load(fh)["medios"]

    def test_todos_declaran_idioma(self):
        for m in self.medios:
            self.assertIn(m.get("idioma"), IDIOMAS, m["id"])

    def test_los_de_san_diego_estan_en_ingles(self):
        por_id = {m["id"]: m for m in self.medios}
        for mid in ("kpbs", "voiceofsd", "timessd", "inewsource"):
            self.assertEqual(por_id[mid]["idioma"], "en", mid)

    def test_el_idioma_concuerda_con_lo_que_dice_la_nota(self):
        # La nota lo decia en prosa desde el principio; el campo lo hace
        # legible para el codigo.
        for m in self.medios:
            if "en inglés" in (m.get("nota") or "").lower():
                self.assertEqual(m["idioma"], "en", m["id"])

if __name__ == "__main__":
    unittest.main()
