"""Pruebas de la ventana reciente y el archivo mensual.

El archivo existe porque notas.json crecia sin limite: 506 bytes por nota y
unas 200 notas nuevas al dia son ~35 MB al ano, y el tablero se los bajaba
todos. Lo que estas pruebas fijan es que partir el historico no pierda ni
duplique nada, y que reresolver todo en cada corrida no ensucie el repo.
"""

import json
import os
import tempfile
import unittest
from datetime import date

from pulso.archivo import (
    GRACIA_DIAS,
    RETENCION_DIAS,
    fecha_de,
    indice_de,
    mes_de,
    meses_en_disco,
    para_temas,
    particionar,
    ruta_indice,
    ruta_mes,
)
from pulso.pipeline import _escribir_si_cambio, correr
from pulso.roster import Roster
from pulso.validador import validar_archivo

HOY = date(2026, 9, 4)


def nota(i, fecha, titulo="Titular de prueba"):
    return {"id": "id%03d" % i, "titulo": titulo, "fecha": fecha,
            "publicado": (fecha + "T12:00:00") if fecha else None,
            "capturado": "2026-09-04T00:00:00+00:00", "url": "https://x.mx/%d" % i,
            "dominio": "x.mx", "fuente": "zeta", "zona_medio": "Tijuana",
            "zonas": ["Tijuana"], "alcance": "zona", "figuras": [], "postura": None}


def leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


class TestFechas(unittest.TestCase):
    def test_fecha_de_acepta_fecha_y_prefijo_iso(self):
        self.assertEqual(fecha_de("2026-09-04"), date(2026, 9, 4))
        self.assertEqual(fecha_de("2026-09-04T18:00:00+00:00"), date(2026, 9, 4))

    def test_fecha_de_tolera_basura(self):
        for v in (None, "", "ayer", "04/09/2026"):
            self.assertIsNone(fecha_de(v))

    def test_mes_de(self):
        self.assertEqual(mes_de(nota(1, "2026-07-13")), "2026-07")

    def test_sin_fecha_el_mes_sale_de_capturado(self):
        # Si no envejecieran por 'capturado' se quedarian en la ventana para
        # siempre, y la acumulacion sin limite volveria por la puerta de
        # atras: es el mismo problema que el archivo resuelve, mas chico.
        n = nota(1, None)
        n["capturado"] = "2026-06-15T10:00:00+00:00"
        self.assertEqual(mes_de(n), "2026-06")

    def test_sin_fecha_ni_capturado_no_se_puede_fechar(self):
        n = nota(1, None)
        n["capturado"] = "ni idea"
        self.assertIsNone(mes_de(n))


class TestParticionar(unittest.TestCase):
    def test_reciente_a_la_ventana(self):
        ventana, por_mes = particionar([nota(1, "2026-09-01")], HOY, 30)
        self.assertEqual(len(ventana), 1)
        self.assertEqual(por_mes, {})

    def test_viejo_al_mes_que_le_toca(self):
        ventana, por_mes = particionar([nota(1, "2026-07-13")], HOY, 30)
        self.assertEqual(ventana, [])
        self.assertEqual(list(por_mes), ["2026-07"])

    def test_el_corte_es_inclusivo(self):
        # Una nota de exactamente `retener` dias se queda. Un dia mas y se va.
        justo = nota(1, "2026-08-05")      # 30 dias
        pasada = nota(2, "2026-08-04")     # 31 dias
        ventana, por_mes = particionar([justo, pasada], HOY, 30)
        self.assertEqual([n["id"] for n in ventana], ["id001"])
        self.assertEqual(por_mes["2026-08"][0]["id"], "id002")

    def test_sin_fecha_pero_recien_capturada_se_queda(self):
        ventana, por_mes = particionar([nota(1, None)], HOY, 30)
        self.assertEqual(len(ventana), 1)
        self.assertEqual(por_mes, {})

    def test_sin_fecha_y_capturada_hace_meses_se_archiva(self):
        n = nota(1, None)
        n["capturado"] = "2026-06-15T10:00:00+00:00"
        ventana, por_mes = particionar([n], HOY, 30)
        self.assertEqual(ventana, [])
        self.assertEqual(list(por_mes), ["2026-06"])

    def test_fecha_futura_se_queda_en_la_ventana(self):
        # Un feed mal fechado no debe crear un mes en el futuro.
        ventana, por_mes = particionar([nota(1, "2027-01-01")], HOY, 30)
        self.assertEqual(len(ventana), 1)
        self.assertEqual(por_mes, {})

    def test_no_pierde_ni_duplica(self):
        notas = [nota(i, "2026-%02d-15" % m) for i, m in enumerate(range(1, 10))]
        ventana, por_mes = particionar(notas, HOY, 30)
        ids = [n["id"] for n in ventana] + [n["id"] for ms in por_mes.values() for n in ms]
        self.assertEqual(len(ids), len(notas))
        self.assertEqual(len(set(ids)), len(notas))

    def test_orden_descendente_en_los_dos_lados(self):
        notas = [nota(1, "2026-07-01"), nota(2, "2026-07-20"), nota(3, "2026-09-02")]
        ventana, por_mes = particionar(notas, HOY, 30)
        self.assertEqual([n["fecha"] for n in por_mes["2026-07"]],
                         ["2026-07-20", "2026-07-01"])
        self.assertEqual(len(ventana), 1)


class TestIndice(unittest.TestCase):
    def test_resume_cada_mes(self):
        por_mes = {"2026-07": [nota(1, "2026-07-01"), nota(2, "2026-07-31")]}
        i = indice_de(por_mes)
        self.assertEqual(i["total"], 2)
        self.assertEqual(i["meses"][0]["mes"], "2026-07")
        self.assertEqual(i["meses"][0]["desde"], "2026-07-01")
        self.assertEqual(i["meses"][0]["hasta"], "2026-07-31")

    def test_meses_mas_recientes_primero(self):
        por_mes = {"2026-06": [nota(1, "2026-06-01")], "2026-08": [nota(2, "2026-08-01")]}
        self.assertEqual([m["mes"] for m in indice_de(por_mes)["meses"]],
                         ["2026-08", "2026-06"])


class TestEscribirSiCambio(unittest.TestCase):
    """Sin esto, reresolver todo el historico reescribiria cada mes en cada
    corrida y el repo se llenaria de commits sin cambio real."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.ruta = os.path.join(self.tmp, "x.json")

    def test_escribe_la_primera_vez(self):
        self.assertTrue(_escribir_si_cambio(self.ruta, {"a": 1}))

    def test_no_reescribe_lo_identico(self):
        _escribir_si_cambio(self.ruta, {"a": 1})
        antes = os.stat(self.ruta).st_mtime_ns
        self.assertFalse(_escribir_si_cambio(self.ruta, {"a": 1}))
        self.assertEqual(os.stat(self.ruta).st_mtime_ns, antes)

    def test_si_reescribe_lo_distinto(self):
        _escribir_si_cambio(self.ruta, {"a": 1})
        self.assertTrue(_escribir_si_cambio(self.ruta, {"a": 2}))
        self.assertEqual(leer(self.ruta), {"a": 2})


class TestParaTemas(unittest.TestCase):
    def test_si_la_ventana_alcanza_no_toca_el_archivo(self):
        ventana = [nota(1, "2026-08-10"), nota(2, "2026-09-02")]
        por_mes = {"2026-07": [nota(3, "2026-07-01")]}
        self.assertEqual(len(para_temas(ventana, por_mes, HOY, 7)), 2)

    def test_si_la_ventana_es_corta_suma_el_mes_reciente(self):
        # El momento se mide contra el periodo anterior, asi que hacen falta
        # 14 dias para reportar 7.
        ventana = [nota(1, "2026-09-02")]
        por_mes = {"2026-07": [nota(2, "2026-07-01")], "2026-08": [nota(3, "2026-08-20")]}
        base = para_temas(ventana, por_mes, HOY, 7)
        self.assertEqual(sorted(n["id"] for n in base), ["id001", "id003"])

    def test_sin_archivo_devuelve_la_ventana(self):
        self.assertEqual(len(para_temas([nota(1, "2026-09-02")], {}, HOY, 7)), 1)


class TestPipelineConArchivo(unittest.TestCase):
    """De punta a punta, sin red."""

    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")
        with open("config/medios.json", encoding="utf-8") as fh:
            cls.medios = json.load(fh)["medios"]
        with open("tests/fixtures/corpus.json", encoding="utf-8") as fh:
            cls.corpus = json.load(fh)

    def correr_en(self, destino, ahora="2026-09-04T12:00:00+00:00", retener=30):
        return correr(medios=self.medios, roster=self.roster, salida=destino,
                      sin_red=True, corpus=self.corpus, ahora=ahora,
                      retener_dias=retener)

    def test_parte_el_corpus_en_ventana_y_archivo(self):
        d = tempfile.mkdtemp()
        estado = self.correr_en(d)
        self.assertEqual(estado["notas_ventana"] + estado["notas_archivadas"],
                         estado["notas_total"])
        self.assertTrue(estado["archivos"] > 0, "el corpus abarca varios meses")

    def test_la_ventana_declara_su_tamano(self):
        d = tempfile.mkdtemp()
        self.correr_en(d, retener=45)
        self.assertEqual(leer(os.path.join(d, "notas.json"))["ventana_dias"], 45)

    def test_una_nota_archivada_no_vuelve_como_nueva(self):
        # Si correr() solo leyera la ventana, cada corrida contaria de nuevo
        # como nuevas las notas ya archivadas que siguen en el feed.
        d = tempfile.mkdtemp()
        primera = self.correr_en(d)
        segunda = self.correr_en(d)
        self.assertEqual(primera["notas_nuevas"], primera["notas_total"])
        self.assertEqual(segunda["notas_nuevas"], 0)
        self.assertEqual(segunda["notas_total"], primera["notas_total"])

    def test_no_reescribe_el_archivo_sin_novedades(self):
        d = tempfile.mkdtemp()
        self.correr_en(d)
        antes = {m: os.stat(ruta_mes(d, m)).st_mtime_ns for m in meses_en_disco(d)}
        self.correr_en(d, ahora="2026-09-04T18:00:00+00:00")
        despues = {m: os.stat(ruta_mes(d, m)).st_mtime_ns for m in meses_en_disco(d)}
        self.assertEqual(antes, despues)

    def test_determinista(self):
        a, b = tempfile.mkdtemp(), tempfile.mkdtemp()
        self.correr_en(a)
        self.correr_en(b)
        for mes in meses_en_disco(a):
            with open(ruta_mes(a, mes), "rb") as fa, open(ruta_mes(b, mes), "rb") as fb:
                self.assertEqual(fa.read(), fb.read(), mes)
        with open(ruta_indice(a), "rb") as fa, open(ruta_indice(b), "rb") as fb:
            self.assertEqual(fa.read(), fb.read())

    def test_hoy_sale_de_ahora_no_del_reloj(self):
        # Con date.today() la misma entrada daria particiones distintas segun
        # el dia en que se corriera.
        a, b = tempfile.mkdtemp(), tempfile.mkdtemp()
        e1 = self.correr_en(a, ahora="2026-09-04T12:00:00+00:00")
        e2 = self.correr_en(b, ahora="2026-12-31T12:00:00+00:00")
        self.assertNotEqual(e1["notas_ventana"], e2["notas_ventana"],
                            "una fecha muy posterior deberia archivar mas")

    def test_la_salida_se_valida(self):
        d = tempfile.mkdtemp()
        self.correr_en(d)
        errores, _ = validar_archivo(d, leer(os.path.join(d, "notas.json")),
                                     self.roster, self.medios, hoy=date(2026, 9, 4))
        self.assertEqual(errores, [])

    def test_acortar_la_retencion_mueve_notas_al_archivo(self):
        d = tempfile.mkdtemp()
        amplia = self.correr_en(d, retener=400)
        angosta = self.correr_en(d, retener=7)
        self.assertLess(angosta["notas_ventana"], amplia["notas_ventana"])
        self.assertEqual(angosta["notas_total"], amplia["notas_total"])


class TestValidadorArchivo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")
        with open("config/medios.json", encoding="utf-8") as fh:
            cls.medios = json.load(fh)["medios"]

    def montar(self, ventana_notas, meses, ventana_dias=30, indice=None):
        d = tempfile.mkdtemp()
        os.makedirs(os.path.join(d, "archivo"))
        for mes, notas in meses.items():
            _escribir_si_cambio(ruta_mes(d, mes),
                                {"esquema": 1, "mes": mes, "total": len(notas),
                                 "notas": notas})
        _escribir_si_cambio(ruta_indice(d), indice or indice_de(meses))
        return d, {"esquema": 1, "ventana_dias": ventana_dias,
                   "total": len(ventana_notas), "notas": ventana_notas}

    def validar(self, d, ventana):
        return validar_archivo(d, ventana, self.roster, self.medios, hoy=HOY)[0]

    def test_sin_archivo_es_valido(self):
        d = tempfile.mkdtemp()
        self.assertEqual(self.validar(d, {"esquema": 1, "total": 0, "notas": []}), [])

    def test_atrapa_id_en_los_dos_lados(self):
        repetida = nota(1, "2026-07-15")
        d, ventana = self.montar([repetida], {"2026-07": [repetida]})
        self.assertTrue(any("tambien esta en" in e for e in self.validar(d, ventana)))

    def test_atrapa_mes_en_disco_que_el_indice_no_lista(self):
        d, ventana = self.montar([], {"2026-07": [nota(1, "2026-07-15")]},
                                 indice={"esquema": 1, "total": 0, "meses": []})
        self.assertTrue(any("el indice no lista" in e for e in self.validar(d, ventana)))

    def test_atrapa_total_del_indice_mal(self):
        notas = [nota(1, "2026-07-15")]
        d, ventana = self.montar([], {"2026-07": notas},
                                 indice={"esquema": 1, "total": 99, "meses": [
                                     {"mes": "2026-07", "notas": 1, "desde": "2026-07-15",
                                      "hasta": "2026-07-15", "archivo": "notas-2026-07.json"}]})
        self.assertTrue(any("no suma" in e for e in self.validar(d, ventana)))

    def test_atrapa_nota_en_el_mes_equivocado(self):
        d, ventana = self.montar([], {"2026-07": [nota(1, "2026-06-15")]})
        self.assertTrue(any("es de 2026-06" in e for e in self.validar(d, ventana)))

    def test_atrapa_nota_vieja_dejada_en_la_ventana(self):
        # Es el sintoma de que la ventana dejo de recortarse, o sea el
        # problema que el archivo resuelve, volviendo por la puerta de atras.
        d, ventana = self.montar([nota(1, "2026-01-01")], {})
        self.assertTrue(any("siguen en la ventana" in e for e in self.validar(d, ventana)))

    def test_la_gracia_permite_un_dia_extra(self):
        # La corrida puede cruzar la medianoche entre particionar y escribir.
        limite = date(2026, 9, 4).toordinal() - RETENCION_DIAS - GRACIA_DIAS + 1
        d, ventana = self.montar([nota(1, date.fromordinal(limite).isoformat())], {})
        self.assertEqual([e for e in self.validar(d, ventana) if "ventana" in e], [])


if __name__ == "__main__":
    unittest.main()
