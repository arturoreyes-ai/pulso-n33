"""Pruebas del pipeline completo, siempre sin red.

Dos propiedades importan mas que los conteos:

  determinismo   dos corridas con la misma entrada dan bytes identicos, si no
                 cada corrida del cron ensuciaria el diff aunque nada cambie.
  idempotencia   volver a correr no reescribe 'capturado' ni infla 'nuevas'.
"""

import copy
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from pulso import VERSION
from pulso.pipeline import correr
from pulso.roster import Roster
from pulso.sentimiento import AnalizadorFalso
from pulso.validador import validar_estado, validar_fuentes, validar_notas, validar_temas

AHORA = "2026-09-03T18:00:00+00:00"
DESPUES = "2026-09-04T18:00:00+00:00"


def leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


class BasePipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")
        cls.medios = leer("config/medios.json")["medios"]
        cls.corpus = leer("tests/fixtures/corpus.json")

    # Los 15 titulares del corpus van de septiembre de 2025 a septiembre de
    # 2026, asi que con la retencion de 30 dias de produccion casi todo se
    # archivaria y estas pruebas se quedarian con dos notas. Se usa una
    # retencion amplia para que sigan probando lo que fueron escritas para
    # probar; la ventana y el archivo tienen su propia clase mas abajo.
    RETENCION_AMPLIA = 400

    def correr_en(self, destino, ahora=AHORA, metodo="ninguno",
                  retener_dias=RETENCION_AMPLIA, analizador=None):
        return correr(
            medios=self.medios,
            roster=self.roster,
            salida=destino,
            sin_red=True,
            corpus=self.corpus,
            ahora=ahora,
            metodo=metodo,
            retener_dias=retener_dias,
            analizador=analizador,
        )


class TestCorridaOffline(BasePipeline):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.estado = self.correr_en(self.tmp)

    def test_escribe_los_tres_archivos(self):
        for nombre in ("notas.json", "fuentes.json", "estado.json"):
            self.assertTrue(os.path.exists(os.path.join(self.tmp, nombre)), nombre)

    def test_la_salida_se_valida(self):
        e1, _ = validar_notas(leer(os.path.join(self.tmp, "notas.json")), self.roster, self.medios)
        e2, _ = validar_fuentes(leer(os.path.join(self.tmp, "fuentes.json")), self.medios)
        e3, _ = validar_estado(leer(os.path.join(self.tmp, "estado.json")))
        self.assertEqual(e1 + e2 + e3, [])

    def test_modo_corpus_y_sin_fuentes_ok(self):
        # En modo corpus no se toca la red: ninguna fuente puede estar 'ok'.
        activos = [m for m in self.medios if m["activo"]]
        self.assertEqual(self.estado["modo"], "corpus")
        self.assertEqual(self.estado["fuentes_ok"], 0)
        self.assertEqual(self.estado["fuentes_fallo"], len(activos))

    def test_solo_ingesta_medios_del_catalogo(self):
        # El corpus trae 15 titulares de 11 medios distintos, y solo se
        # ingestan los que estan en config/medios.json: no se inventa un id
        # ni una URL de feed para los demas. El conteo exacto depende del
        # catalogo, asi que se calcula en vez de fijarse a mano.
        notas = leer(os.path.join(self.tmp, "notas.json"))
        nombres = {m["nombre"].lower() for m in self.medios}
        esperadas = sum(1 for c in self.corpus if (c["fuente"] or "").lower() in nombres)
        ids_medios = {m["id"] for m in self.medios}
        self.assertEqual(notas["total"], esperadas)
        self.assertGreater(esperadas, 5, "el catalogo deberia cubrir varios medios del corpus")
        self.assertTrue(all(n["fuente"] in ids_medios for n in notas["notas"]))

    def test_conserva_notas_de_medios_apagados(self):
        # 'activo' decide si se consulta la red, no si el historico se borra.
        # Un medio apagado no reporta salud, pero sus notas siguen ahi.
        medios = copy.deepcopy(self.medios)
        nombres_corpus = {(c["fuente"] or "").lower() for c in self.corpus}
        apagado = next(m for m in medios if m["nombre"].lower() in nombres_corpus)
        apagado["activo"] = False

        destino = tempfile.mkdtemp()
        correr(
            medios=medios,
            roster=self.roster,
            salida=destino,
            sin_red=True,
            corpus=self.corpus,
            ahora=AHORA,
            metodo="ninguno",
            retener_dias=self.RETENCION_AMPLIA,
        )
        notas = leer(os.path.join(destino, "notas.json"))["notas"]
        salud = {s["id"] for s in leer(os.path.join(destino, "fuentes.json"))["fuentes"]}
        self.assertIn(apagado["id"], {n["fuente"] for n in notas})
        self.assertNotIn(apagado["id"], salud)

    def test_delegaciones_solo_en_tijuana(self):
        # Toda nota trae la lista; solo las de Tijuana pueden traerla llena.
        notas = leer(os.path.join(self.tmp, "notas.json"))["notas"]
        for n in notas:
            self.assertIsInstance(n["delegaciones"], list, n["id"])
            if n["delegaciones"]:
                self.assertIn("Tijuana", n["zonas"], n["titulo"])

    def test_resuelve_delegacion_desde_el_titular(self):
        destino = tempfile.mkdtemp()
        corpus = [{
            "titulo": "Ejecutan a un hombre a tiros en Playas de Tijuana",
            "fuente": "Zeta Tijuana",
            "fecha": "2026-09-01",
        }]
        correr(
            medios=self.medios,
            roster=self.roster,
            salida=destino,
            sin_red=True,
            corpus=corpus,
            ahora=AHORA,
            metodo="ninguno",
            retener_dias=self.RETENCION_AMPLIA,
        )
        notas = leer(os.path.join(destino, "notas.json"))["notas"]
        self.assertEqual(len(notas), 1)
        self.assertEqual(notas[0]["zonas"], ["Tijuana"])
        self.assertEqual(notas[0]["delegaciones"], ["Playas de Tijuana"])

    def test_resuelve_figuras(self):
        notas = leer(os.path.join(self.tmp, "notas.json"))["notas"]
        con_figura = [n for n in notas if n["figuras"]]
        self.assertEqual(len(con_figura), 4)

    def test_el_titular_por_cargo_va_al_alcalde_del_dia(self):
        # Corpus 1, del 14 de agosto de 2026: 'presidente municipal de
        # Tijuana' tiene que ser Gutierrez, no Burgueno.
        notas = leer(os.path.join(self.tmp, "notas.json"))["notas"]
        nota = next(n for n in notas if n["fecha"] == "2026-08-14")
        self.assertEqual([h["id"] for h in nota["figuras"]], ["agc"])
        self.assertEqual(nota["figuras"][0]["via"], "cargo")

    def test_orden_descendente_por_fecha(self):
        notas = leer(os.path.join(self.tmp, "notas.json"))["notas"]
        fechas = [n["fecha"] for n in notas]
        self.assertEqual(fechas, sorted(fechas, reverse=True))

    def test_sin_postura_por_omision(self):
        notas = leer(os.path.join(self.tmp, "notas.json"))["notas"]
        self.assertTrue(all(n["postura"] is None for n in notas))
        self.assertEqual(self.estado["metodo_postura"], "ninguno")

    def test_campos_derivados(self):
        notas = leer(os.path.join(self.tmp, "notas.json"))["notas"]
        for n in notas:
            self.assertTrue(n["dominio"])
            self.assertTrue(n["url"].startswith("http"))
            self.assertEqual(n["capturado"], AHORA)

    def test_notas_json_no_lleva_marca_de_tiempo_de_corrida(self):
        # notas.json no tiene 'generado' a nivel raiz: si lo tuviera, cada
        # corrida del cron produciria un commit aunque no hubiera notas
        # nuevas. El unico timestamp que aparece es 'capturado', y es por
        # nota y se conserva (ver TestIdempotencia). 'ventana_dias' es
        # configuracion, no una marca de tiempo: solo cambia si se cambia la
        # bandera.
        datos = leer(os.path.join(self.tmp, "notas.json"))
        self.assertEqual(sorted(datos.keys()),
                         ["esquema", "notas", "total", "ventana_dias"])

    def test_estado_reporta_el_roster(self):
        self.assertEqual(self.estado["pulso_version"], VERSION)
        self.assertEqual(self.estado["roster_figuras"], len(self.roster.figuras))
        self.assertLess(self.estado["roster_vigentes"], self.estado["roster_figuras"])


class TestDeterminismo(BasePipeline):
    def test_dos_corridas_dan_bytes_identicos(self):
        a, b = tempfile.mkdtemp(), tempfile.mkdtemp()
        self.correr_en(a)
        self.correr_en(b)
        for nombre in ("notas.json", "fuentes.json", "estado.json"):
            with open(os.path.join(a, nombre), "rb") as fa, open(os.path.join(b, nombre), "rb") as fb:
                self.assertEqual(fa.read(), fb.read(), nombre)

    def test_json_con_acentos_literales_y_salto_final(self):
        d = tempfile.mkdtemp()
        self.correr_en(d)
        with open(os.path.join(d, "notas.json"), encoding="utf-8") as fh:
            crudo = fh.read()
        self.assertIn("Burgueño", crudo)       # no ñ: el diff se lee
        self.assertNotIn("\\u00f1", crudo)
        self.assertTrue(crudo.endswith("\n"))


class TestIdempotencia(BasePipeline):
    def test_actualiza_zona_historica_si_cambia_el_catalogo(self):
        d = tempfile.mkdtemp()
        medios_viejos = copy.deepcopy(self.medios)
        afn_viejo = next(m for m in medios_viejos if m["id"] == "afn")
        afn_viejo["zona"] = "estatal"
        correr(
            medios=medios_viejos,
            roster=self.roster,
            salida=d,
            sin_red=True,
            corpus=self.corpus,
            ahora=AHORA,
            metodo="ninguno",
            retener_dias=self.RETENCION_AMPLIA,
        )

        self.correr_en(d, ahora=DESPUES)
        notas_afn = [
            n for n in leer(os.path.join(d, "notas.json"))["notas"]
            if n["fuente"] == "afn"
        ]
        self.assertTrue(notas_afn)
        self.assertTrue(all(n["zona_medio"] == "Tijuana" for n in notas_afn))

    def test_rellena_delegaciones_de_un_corte_viejo_sin_migracion(self):
        # Un corte anterior al campo no trae la clave; la siguiente corrida la
        # agrega a todo el historico porque la resolucion se repite entera.
        d = tempfile.mkdtemp()
        self.correr_en(d)
        ruta = os.path.join(d, "notas.json")
        doc = leer(ruta)
        for n in doc["notas"]:
            del n["delegaciones"]
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, ensure_ascii=False)

        self.correr_en(d, ahora=DESPUES)
        notas = leer(ruta)["notas"]
        self.assertTrue(notas)
        self.assertTrue(all(isinstance(n.get("delegaciones"), list) for n in notas))

    def test_segunda_corrida_no_trae_nuevas_ni_pierde_capturado(self):
        d = tempfile.mkdtemp()
        primera = self.correr_en(d, ahora=AHORA)
        segunda = self.correr_en(d, ahora=DESPUES)

        self.assertEqual(primera["notas_nuevas"], primera["notas_total"])
        self.assertEqual(segunda["notas_nuevas"], 0)
        self.assertEqual(segunda["notas_total"], primera["notas_total"])

        notas = leer(os.path.join(d, "notas.json"))["notas"]
        self.assertTrue(all(n["capturado"] == AHORA for n in notas))

    def test_notas_json_no_cambia_entre_corridas_sin_novedades(self):
        # Esto es lo que hace util el guarda `git diff --quiet` del workflow:
        # una corrida sin notas nuevas no ensucia el repo.
        d = tempfile.mkdtemp()
        self.correr_en(d, ahora=AHORA)
        ruta = os.path.join(d, "notas.json")
        with open(ruta, "rb") as fh:
            antes = fh.read()
        self.correr_en(d, ahora=DESPUES)
        with open(ruta, "rb") as fh:
            self.assertEqual(fh.read(), antes)

    def test_arrastra_ultima_ok_de_la_corrida_anterior(self):
        # Lo que lee la alarma de feed muerto: si hoy falla, se conserva
        # cuando fue la ultima vez que respondio.
        d = tempfile.mkdtemp()
        self.correr_en(d)
        ruta = os.path.join(d, "fuentes.json")
        datos = leer(ruta)
        datos["fuentes"][0]["ultima_ok"] = "2026-09-02T11:00:00+00:00"
        with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(datos, fh, ensure_ascii=False)
        self.correr_en(d, ahora=DESPUES)
        self.assertEqual(leer(ruta)["fuentes"][0]["ultima_ok"], "2026-09-02T11:00:00+00:00")


class TestClasificadorEncendido(BasePipeline):
    def test_metodo_diccionario_llena_postura(self):
        d = tempfile.mkdtemp()
        estado = self.correr_en(d, metodo="diccionario")
        notas = leer(os.path.join(d, "notas.json"))["notas"]
        self.assertEqual(estado["metodo_postura"], "diccionario")
        self.assertTrue(all(n["postura"] is not None for n in notas))
        errores, _ = validar_notas({"esquema": 1, "total": len(notas), "notas": notas},
                                   self.roster, self.medios)
        self.assertEqual(errores, [])

    def test_apagarlo_vuelve_a_dejar_postura_en_null(self):
        # El paso es reemplazable de verdad: se puede apagar sin migrar datos.
        d = tempfile.mkdtemp()
        self.correr_en(d, metodo="diccionario")
        self.correr_en(d, metodo="ninguno")
        notas = leer(os.path.join(d, "notas.json"))["notas"]
        self.assertTrue(all(n["postura"] is None for n in notas))

    def test_metodo_modelo_llena_tono_y_valida(self):
        d = tempfile.mkdtemp()
        estado = self.correr_en(d, metodo="modelo", analizador=AnalizadorFalso())
        notas = leer(os.path.join(d, "notas.json"))["notas"]
        self.assertEqual(estado["metodo_postura"], "modelo")
        self.assertTrue(all(n["postura"]["metodo"] == "modelo" for n in notas))
        self.assertTrue(all("confianza" in n["postura"] for n in notas))
        errores, _ = validar_notas({"esquema": 1, "total": len(notas), "notas": notas},
                                   self.roster, self.medios)
        self.assertEqual(errores, [])
        errores, _ = validar_estado(estado)
        self.assertEqual(errores, [])

    def test_la_segunda_corrida_no_vuelve_a_clasificar(self):
        # Las notas que siguen en el feed arrastran su etiqueta: el modelo
        # solo ve lo nuevo. Sin esto, el cron reclasificaria todo cada hora.
        d = tempfile.mkdtemp()
        self.correr_en(d, metodo="modelo", analizador=AnalizadorFalso())
        primera = leer(os.path.join(d, "notas.json"))["notas"]
        segundo = AnalizadorFalso()
        self.correr_en(d, ahora=DESPUES, metodo="modelo", analizador=segundo)
        segunda = leer(os.path.join(d, "notas.json"))["notas"]
        self.assertEqual(segundo.llamadas, 1)   # una llamada, con lista vacia
        self.assertEqual([n["postura"] for n in primera], [n["postura"] for n in segunda])

    def test_cambiar_de_modelo_a_ninguno_borra_las_etiquetas(self):
        d = tempfile.mkdtemp()
        self.correr_en(d, metodo="modelo", analizador=AnalizadorFalso())
        self.correr_en(d, metodo="ninguno")
        notas = leer(os.path.join(d, "notas.json"))["notas"]
        self.assertTrue(all(n["postura"] is None for n in notas))


class TestTemasPorZona(BasePipeline):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.correr_en(self.tmp)
        self.temas = leer(os.path.join(self.tmp, "temas.json"))

    def test_hay_bloque_por_zona_con_minimo_publicado(self):
        self.assertIn("por_zona", self.temas)
        for zona, bloque in self.temas["por_zona"].items():
            self.assertNotEqual(zona, "estatal")
            self.assertGreater(bloque["notas_ventana"], 0)
            self.assertIn(bloque["minimo"], (2, 3))
            for t in bloque["temas"]:
                self.assertGreaterEqual(t["n"], bloque["minimo"])
                self.assertIn(zona, t["zonas"])

    def test_zonas_chicas_bajan_el_minimo(self):
        # El corpus tiene 15 titulares: ninguna zona llega a 100 notas.
        for bloque in self.temas["por_zona"].values():
            self.assertEqual(bloque["minimo"], 2)

    def test_zona_sin_notas_no_aparece(self):
        estado = leer(os.path.join(self.tmp, "estado.json"))
        for zona in self.temas["por_zona"]:
            self.assertIn(zona, estado["por_zona"])

    def test_pasa_el_validador(self):
        errores, _ = validar_temas(self.temas)
        self.assertEqual(errores, [])

    def test_fuentes_llevan_zona(self):
        fuentes = leer(os.path.join(self.tmp, "fuentes.json"))["fuentes"]
        por_id = {m["id"]: m for m in self.medios}
        for f in fuentes:
            self.assertEqual(f.get("zona"), por_id[f["id"]].get("zona"))


class TestSitio(BasePipeline):
    def test_arma_site_con_datos_y_roster(self):
        from pulso.sitio import armar

        datos = tempfile.mkdtemp()
        self.correr_en(datos)
        destino = os.path.join(tempfile.mkdtemp(), "_site")
        archivos = armar(destino, origen="sitio", datos=datos, config="config")

        self.assertIn("index.html", archivos)
        self.assertIn("data/notas.json", archivos)
        self.assertIn("data/estado.json", archivos)
        self.assertIn("config/roster.json", archivos)


if __name__ == "__main__":
    unittest.main()
