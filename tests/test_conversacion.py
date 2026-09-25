"""Pruebas del modulo de YouTube.

Lo que mas importa aqui no es la ingesta, es el cumplimiento: la retencion de
30 dias de las Politicas para Desarrolladores (III.E.4.d), que el texto crudo
no llegue nunca a lo que se commitea, y que la cuota se respete sin descubrir
el limite a golpes. Nada de esto llama a la red.
"""

import json
import os
import tempfile
import unittest

from pulso.roster import Roster
from pulso.conversacion import (
    BUSQUEDAS_POR_CORRIDA,
    COSTO_BUSQUEDA,
    RETENCION_DIAS,
    CuotaAgotada,
    Presupuesto,
    SinLlave,
    cosechar,
    derivar,
    guardar_cache,
    leer_cache,
    llave,
    purgar,
)

CANALES = [
    {"id": "uno", "nombre": "Canal Uno", "canal": "UCaaa", "zona": "Tijuana", "activo": True},
    {"id": "dos", "nombre": "Canal Dos", "canal": "UCbbb", "zona": "Mexicali", "activo": True},
    {"id": "off", "nombre": "Apagado", "canal": "UCccc", "zona": "Tecate", "activo": False},
]


def comentario(cid, texto, fecha, canal="uno", zona="Tijuana", titulo=""):
    return {"id": cid, "texto": texto, "likes": 0, "respuestas": 0,
            "publicado": fecha + "T12:00:00Z", "fecha": fecha,
            "video": "v1", "video_titulo": titulo, "canal": canal,
            "zona_canal": zona, "capturado": fecha + "T12:00:00Z"}


class TestLlave(unittest.TestCase):
    def test_sin_llave_lanza(self):
        with self.assertRaises(SinLlave):
            llave({})
        with self.assertRaises(SinLlave):
            llave({"YOUTUBE_API_KEY": "   "})

class TestPresupuesto(unittest.TestCase):
    def test_cobra_y_acumula(self):
        p = Presupuesto(tope=10)
        p.cobrar("commentThreads")
        p.cobrar("commentThreads")
        self.assertEqual(p.gastado, 2)
        self.assertEqual(p.resumen()["llamadas"]["commentThreads"], 2)

    def test_se_detiene_antes_de_pasarse(self):
        # Detenerse solo, sin esperar el 403: la cuota no se libera hasta
        # medianoche del Pacifico, asi que agotarla cuesta el dia entero.
        p = Presupuesto(tope=2)
        p.cobrar("videos")
        p.cobrar("videos")
        with self.assertRaises(CuotaAgotada):
            p.cobrar("videos")
        self.assertEqual(p.gastado, 2)

    def test_search_usa_presupuesto_separado_y_acotado(self):
        p = Presupuesto(
            tope=BUSQUEDAS_POR_CORRIDA,
            costos=COSTO_BUSQUEDA,
            cuota_diaria=100,
            reserva=100 - BUSQUEDAS_POR_CORRIDA,
        )
        for _ in range(BUSQUEDAS_POR_CORRIDA):
            p.cobrar("search")
        with self.assertRaises(CuotaAgotada):
            p.cobrar("search")
        self.assertEqual(p.resumen()["cuota_diaria"], 100)


class TestRetencion(unittest.TestCase):
    """La regla de 30 dias, hecha codigo."""

    def setUp(self):
        self.cache = tempfile.mkdtemp()

    def escribir(self, dia, n=1):
        ruta = os.path.join(self.cache, dia + ".json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump([comentario("c%s%d" % (dia, i), "hola", dia) for i in range(n)], fh)
        return ruta

    def test_borra_lo_que_paso_de_30_dias(self):
        self.escribir("2026-09-01")     # 2 dias
        self.escribir("2026-08-20")     # 14 dias
        viejo = self.escribir("2026-07-01")   # 64 dias
        vivos, borrados = purgar(self.cache, "2026-09-03T00:00:00+00:00")
        self.assertEqual((vivos, borrados), (2, 1))
        self.assertFalse(os.path.exists(viejo))

    def test_el_limite_es_exactamente_la_retencion(self):
        justo = self.escribir("2026-08-05")     # 29 dias
        pasado = self.escribir("2026-08-03")    # 31 dias
        purgar(self.cache, "2026-09-03T00:00:00+00:00")
        self.assertTrue(os.path.exists(justo))
        self.assertFalse(os.path.exists(pasado))

    def test_retencion_declarada_es_30(self):
        self.assertEqual(RETENCION_DIAS, 30)

    def test_archivo_con_nombre_raro_no_se_conserva(self):
        # Si no se puede fechar, no se puede garantizar la retencion.
        raro = os.path.join(self.cache, "pendiente.json")
        with open(raro, "w", encoding="utf-8") as fh:
            fh.write("[]")
        purgar(self.cache, "2026-09-03T00:00:00+00:00")
        self.assertFalse(os.path.exists(raro))

    def test_cache_inexistente_no_truena(self):
        self.assertEqual(purgar(os.path.join(self.cache, "nada"), "2026-09-03T00:00:00+00:00"),
                         (0, 0))

    def test_guardar_dos_veces_el_mismo_dia_fusiona_por_id(self):
        ahora = "2026-09-03T12:00:00+00:00"
        guardar_cache([comentario("a", "hola", "2026-09-03")], ahora, self.cache)
        guardar_cache([comentario("a", "hola", "2026-09-03"),
                       comentario("b", "adios", "2026-09-03")], ahora, self.cache)
        self.assertEqual(len(leer_cache(self.cache)), 2)

    def test_guardar_fusiona_las_etiquetas_de_tema(self):
        ahora = "2026-09-03T12:00:00+00:00"
        a = comentario("a", "hola", "2026-09-03")
        a["temas"] = ["agua"]
        b = comentario("a", "hola", "2026-09-03")
        b["temas"] = ["seguridad"]
        guardar_cache([a], ahora, self.cache)
        guardar_cache([b], ahora, self.cache)
        self.assertEqual(leer_cache(self.cache)[0]["temas"], ["agua", "seguridad"])


class TestDegradacion(unittest.TestCase):
    def test_sin_llave_no_lanza_y_lo_reporta(self):
        # El tablero tiene que poder mostrar prensa sin comentarios.
        n, salud, cuentas = cosechar(CANALES, "2026-09-03T12:00:00+00:00", entorno={},
                                    cache=tempfile.mkdtemp())
        self.assertEqual(n, 0)
        self.assertEqual([s["estado"] for s in salud], ["sin_llave", "sin_llave"])
        self.assertIn("YOUTUBE_API_KEY", salud[0]["error"])
        self.assertEqual(cuentas["presupuesto"]["gastado"], 0)

    def test_omite_canales_apagados(self):
        _, salud, _ = cosechar(CANALES, "2026-09-03T12:00:00+00:00", entorno={},
                               cache=tempfile.mkdtemp())
        self.assertNotIn("off", [s["id"] for s in salud])


class TestDerivados(unittest.TestCase):
    """Lo unico que se commitea: sin texto literal ni identidad."""

    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")

    def derivar_con(self, coms):
        return derivar(coms, self.roster, "2026-09-03T12:00:00+00:00", [], {})

    def test_no_publica_texto_de_comentarios(self):
        # La prueba central de cumplimiento: el texto vive 30 dias en cache,
        # nunca en lo que entra a git.
        coms = [comentario("c%d" % i, "El agua no llega a mi colonia otra vez",
                           "2026-09-01") for i in range(6)]
        panel = self.derivar_con(coms)
        crudo = json.dumps(panel, ensure_ascii=False)
        self.assertNotIn("El agua no llega", crudo)
        self.assertNotIn("mi colonia", crudo)

    def test_no_publica_ids_de_comentario(self):
        coms = [comentario("comentario-unico-%d" % i, "agua potable escasez",
                           "2026-09-01") for i in range(6)]
        crudo = json.dumps(self.derivar_con(coms))
        self.assertNotIn("comentario-unico", crudo)

    def test_si_publica_conteos_derivados(self):
        coms = [comentario("c%d" % i, "escasez de agua potable en la colonia",
                           "2026-09-01") for i in range(6)]
        panel = self.derivar_con(coms)
        self.assertEqual(panel["comentarios_vigentes"], 6)
        self.assertEqual(panel["por_zona"].get("Tijuana"), 6)
        self.assertEqual(panel["por_canal"].get("uno"), 6)
        self.assertTrue(panel["temas"])
        self.assertTrue(any("agua" in t["termino"] for t in panel["temas"]))

    def test_los_temas_no_traen_ejemplos(self):
        # 'ejemplos' es texto literal de comentarios.
        coms = [comentario("c%d" % i, "escasez de agua potable", "2026-09-01")
                for i in range(6)]
        for t in self.derivar_con(coms)["temas"]:
            self.assertNotIn("ejemplos", t)
            self.assertNotIn("notas", t)

    def test_cuenta_figuras_mencionadas(self):
        coms = [comentario("c%d" % i, "Abdiel Gutiérrez no resolvió nada",
                           "2026-09-01") for i in range(4)]
        self.assertEqual(self.derivar_con(coms)["por_figura"].get("agc"), 4)

    def test_zona_del_canal_cuando_el_comentario_no_nombra_ciudad(self):
        # Un comentario suelto rara vez nombra su ciudad.
        coms = [comentario("c1", "ya basta de esto", "2026-09-01",
                           canal="dos", zona="Mexicali")]
        self.assertEqual(self.derivar_con(coms)["por_zona"].get("Mexicali"), 1)

    def test_el_titulo_del_video_da_contexto(self):
        # El comentario no dice Ensenada, el video si.
        coms = [comentario("c1", "que barbaridad", "2026-09-01", canal="dos",
                           zona="Mexicali", titulo="Falta agua en Ensenada")]
        self.assertEqual(self.derivar_con(coms)["por_zona"].get("Ensenada"), 1)

    def test_lleva_el_aviso_de_retencion(self):
        panel = self.derivar_con([])
        self.assertEqual(panel["retencion_dias"], 30)
        self.assertIn("30", panel["aviso"])

    def test_publica_resumen_derivado_filtrable_por_tema(self):
        coms = []
        for i in range(6):
            c = comentario(
                "tema-%d" % i,
                "falta agua potable en la colonia?",
                "2026-09-01",
                titulo="Crisis de agua potable en Tijuana",
            )
            c.update({"temas": ["agua potable"], "likes": i, "respuestas": 1})
            coms.append(c)
        detalle = self.derivar_con(coms)["por_tema"][0]
        self.assertEqual(detalle["tema"], "agua potable")
        self.assertEqual(detalle["comentarios"], 6)
        self.assertEqual(detalle["videos"], 1)
        self.assertEqual(detalle["preguntas"], 6)
        self.assertTrue(any("agua" in s["termino"] for s in detalle["subtemas"]))


class TestCanalesConfig(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open("config/canales.json", encoding="utf-8") as fh:
            cls.cfg = json.load(fh)

    def test_ids_unicos_y_con_formato(self):
        import re
        ids = [c["id"] for c in self.cfg["canales"]]
        self.assertEqual(len(ids), len(set(ids)))
        for i in ids:
            self.assertRegex(i, r"^[a-z0-9_]{2,12}$")

    def test_zonas_conocidas(self):
        from pulso import ZONAS
        for c in self.cfg["canales"]:
            self.assertIn(c["zona"], ZONAS, c["id"])

    def test_todos_los_canales_traen_id_de_canal(self):
        for c in self.cfg["canales"]:
            self.assertTrue(c["canal"].startswith("UC"), c["id"])
            self.assertTrue(c.get("verificado"), c["id"])

    def test_los_senuelos_no_estan_entre_los_canales(self):
        # @UniradioInforma y @afntijuana resuelven a canales muertos. Estan
        # documentados en 'senuelos' justo para que nadie los reinstale.
        activos = {c["canal"] for c in self.cfg["canales"]}
        for s in self.cfg["senuelos"]:
            self.assertNotIn(s["canal"], activos, s["handle"])
            self.assertTrue(s["porque"])

    def test_el_imparcial_no_esta_activo(self):
        # Su canal es la insignia de Sonora: 190K subs, cero ciudades de BC
        # en 15 subidas. Es el unico lo bastante grande para torcer todo.
        senuelos = {s["canal"] for s in self.cfg["senuelos"]}
        self.assertIn("UCSZpvocAhw_WU5R3wVOxRCg", senuelos)


if __name__ == "__main__":
    unittest.main()
