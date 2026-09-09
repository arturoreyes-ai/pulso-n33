"""Pruebas del pipeline completo, siempre sin red.

Dos propiedades importan mas que los conteos:

  determinismo   dos corridas con la misma entrada dan bytes identicos, si no
                 cada corrida del cron ensuciaria el diff aunque nada cambie.
  idempotencia   volver a correr no reescribe 'capturado' ni infla 'nuevas'.
"""

import copy
import hashlib
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from pulso import VERSION
from pulso.busquedas import CLAVES_DETALLE
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
                  retener_dias=RETENCION_AMPLIA, analizador=None, busquedas=None):
        return correr(
            busquedas=busquedas,
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


class TestBusquedas(BasePipeline):
    """Cosecha de Google Noticias dentro del pipeline. Nunca toca la red."""

    DOC = {
        "publicadores": {"oem.com.mx": "soltij"},
        "busquedas": [{"id": "bq_sanquintin", "nombre": "San Quintin", "q": "x",
                       "idioma": "es", "activo": True},
                      {"id": "bq_frontera_en", "nombre": "Frontera", "q": "y",
                       "idioma": "en", "activo": True}],
    }

    def cosecha_falsa(self, titulo, dominio="elvalledesq.example",
                      bid="bq_sanquintin", fecha="Wed, 02 Sep 2026 14:00:00 GMT"):
        """Un item ya resuelto, en la forma que devuelve busquedas.cosechar."""
        fuente = "gn-" + hashlib.sha256(dominio.encode("utf-8")).hexdigest()[:12]
        return {"medio": {"id": fuente, "nombre": dominio,
                          "url": "https://" + dominio + "/", "zona": "estatal",
                          "tipo": "busqueda"},
                "item": {"titulo": titulo,
                         "url": "https://news.google.com/rss/articles/CBM" + titulo[:4],
                         "dominio": dominio, "fecha_cruda": fecha},
                "origen": "busqueda_web", "descubierta_por": bid}

    def correr_con(self, destino, items, ahora=AHORA, medios_rss=None, **kw):
        """Corrida en modo red con LAS DOS fronteras de red sustituidas.

        sin_red=False es lo unico que ejercita la rama de cosecha, pero
        entonces fetch_medios tambien corre: si no se sustituye, cada prueba
        sale a los 18 feeds de verdad. Las pruebas son siempre sin red.
        """
        salud = [{"id": b["id"], "nombre": b["nombre"],
                  "url": "https://news.google.com/x", "metodo": "busqueda",
                  "zona": "estatal", "estado": "ok", "obtenidas": len(items),
                  "nuevas": 0, "ms": 0, "ultima_ok": ahora, "error": None,
                  "detalle": dict.fromkeys(CLAVES_DETALLE, 0)}
                 for b in self.DOC["busquedas"]]
        resultados, salud_rss = medios_rss if medios_rss is not None else ([], [])
        with patch("pulso.pipeline.fetch_medios",
                   return_value=(resultados, salud_rss)):
            with patch("pulso.pipeline.cosechar", return_value=(items, salud)):
                return correr(medios=self.medios, roster=self.roster,
                              salida=destino, sin_red=False, ahora=ahora,
                              retener_dias=self.RETENCION_AMPLIA,
                              busquedas=self.DOC, **kw)

    def test_sin_red_emite_un_fallo_por_busqueda_y_no_toca_la_red(self):
        destino = tempfile.mkdtemp()
        with patch("pulso.pipeline.cosechar",
                   side_effect=AssertionError("la red no se toca en modo corpus")):
            self.correr_en(destino, busquedas=self.DOC)
        salud = {s["id"]: s
                 for s in leer(os.path.join(destino, "fuentes.json"))["fuentes"]}
        for b in self.DOC["busquedas"]:
            self.assertEqual(salud[b["id"]]["estado"], "fallo")
            self.assertEqual(salud[b["id"]]["ms"], 0)
            self.assertIn("sin red", salud[b["id"]]["error"])

    def test_sin_busquedas_la_salida_es_la_de_siempre(self):
        con, sin = tempfile.mkdtemp(), tempfile.mkdtemp()
        self.correr_en(con, busquedas=None)
        self.correr_en(sin)
        self.assertEqual(leer(os.path.join(con, "notas.json")),
                         leer(os.path.join(sin, "notas.json")))

    def test_la_nota_de_busqueda_no_queda_con_el_dominio_de_google(self):
        destino = tempfile.mkdtemp()
        self.correr_con(destino,
                        [self.cosecha_falsa("Productores del valle piden agua")])
        notas = leer(os.path.join(destino, "notas.json"))["notas"]
        bq = [n for n in notas if n.get("origen") == "busqueda_web"]
        self.assertEqual(len(bq), 1)
        self.assertEqual(bq[0]["dominio"], "elvalledesq.example")
        self.assertEqual(bq[0]["zona_medio"], "estatal")

    def test_nuevas_se_cuenta_contra_la_busqueda_no_contra_la_fuente(self):
        destino = tempfile.mkdtemp()
        self.correr_con(destino,
                        [self.cosecha_falsa("Productores del valle piden agua")])
        salud = {s["id"]: s
                 for s in leer(os.path.join(destino, "fuentes.json"))["fuentes"]}
        self.assertEqual(salud["bq_sanquintin"]["nuevas"], 1)

    def test_ningun_feed_reporta_mas_nuevas_que_obtenidas(self):
        # Una nota que Google encuentra de un medio del catalogo tiene fuente
        # 'soltij'; contar su 'nueva' ahi inflaria las de ese feed por encima
        # de lo que el feed mismo trajo, que es un numero que no se puede leer.
        destino = tempfile.mkdtemp()
        item = self.cosecha_falsa("Obras en el bulevar avanzan")
        item["medio"] = {"id": "soltij", "nombre": "El Sol de Tijuana",
                         "url": "https://www.elsoldetijuana.com.mx/",
                         "zona": "Tijuana", "tipo": "rss"}
        item["item"]["dominio"] = "elsoldetijuana.com.mx"
        # El feed de El Sol responde en esta corrida, pero SIN esa nota: solo
        # Google la trajo. Su renglon tiene obtenidas 0.
        sol = [m for m in self.medios if m["id"] == "soltij"][0]
        salud_rss = [{"id": "soltij", "nombre": sol["nombre"], "url": sol["url"],
                      "metodo": "rss", "zona": sol["zona"], "estado": "ok",
                      "obtenidas": 0, "nuevas": 0, "ms": 1, "ultima_ok": AHORA,
                      "error": None}]
        self.correr_con(destino, [item], medios_rss=([], salud_rss))
        filas = [s for s in leer(os.path.join(destino, "fuentes.json"))["fuentes"]
                 if s.get("metodo") == "rss"]
        self.assertTrue(filas)
        for s in filas:
            self.assertLessEqual(s["nuevas"], s["obtenidas"], s["id"])

    def test_la_copia_curada_gana_a_la_de_google(self):
        # La misma nota por el feed de Zeta y por Google: sobrevive una sola,
        # con el enlace real del medio y sin marca de origen.
        destino = tempfile.mkdtemp()
        titulo = "Reportan apagon en la zona centro de Tijuana"
        zeta = [m for m in self.medios if m["id"] == "zeta"][0]
        item = self.cosecha_falsa(titulo, dominio="zetatijuana.com")
        item["medio"] = dict(zeta)
        resultados = [(zeta, [{"titulo": titulo,
                               "url": "https://zetatijuana.com/nota",
                               "fecha_cruda": "Wed, 02 Sep 2026 14:00:00 GMT"}])]
        salud_rss = [{"id": zeta["id"], "nombre": zeta["nombre"], "url": zeta["url"],
                      "metodo": "rss", "zona": zeta["zona"], "estado": "ok",
                      "obtenidas": 1, "nuevas": 0, "ms": 1, "ultima_ok": AHORA,
                      "error": None}]
        self.correr_con(destino, [item], medios_rss=(resultados, salud_rss))
        notas = [n for n in leer(os.path.join(destino, "notas.json"))["notas"]
                 if n["titulo"] == titulo]
        self.assertEqual(len(notas), 1)
        self.assertEqual(notas[0]["url"], "https://zetatijuana.com/nota")
        self.assertNotIn("origen", notas[0])

    def test_el_idioma_de_una_fuente_sintetica_sobrevive_a_la_segunda_corrida(self):
        # En la corrida 1 el medio sintetico existe en memoria; en la 2 ya no,
        # y sin recuperar el idioma desde 'descubierta_por' el modelo espanol
        # etiquetaria un titular en ingles y devolveria una etiqueta plausible,
        # no un error. Falla SOLO en la segunda corrida, que es exactamente
        # como se escondio meses la falla original de los medios de San Diego.
        destino = tempfile.mkdtemp()
        item = self.cosecha_falsa("Sewage spill closes Imperial Beach shoreline",
                                  dominio="borderreport.example",
                                  bid="bq_frontera_en")
        self.correr_con(destino, [item], metodo="modelo", analizador=AnalizadorFalso())

        estado = self.correr_con(destino, [], ahora=DESPUES,
                                 metodo="modelo", analizador=AnalizadorFalso())
        notas = [n for n in leer(os.path.join(destino, "notas.json"))["notas"]
                 if n.get("origen") == "busqueda_web"]
        self.assertEqual(len(notas), 1)
        self.assertIsNone(notas[0]["postura"],
                          "el modelo espanol etiqueto un titular en ingles")
        self.assertGreaterEqual(estado["notas_sin_modelo_idioma"], 1)

    def test_el_detalle_reporta_cuantas_no_llegan_al_muro(self):
        destino = tempfile.mkdtemp()
        # Un titular que no nombra ningun lugar: alcance nacional, zonas [].
        self.correr_con(destino, [self.cosecha_falsa("Suben los precios del gas")])
        salud = {s["id"]: s
                 for s in leer(os.path.join(destino, "fuentes.json"))["fuentes"]}
        self.assertEqual(salud["bq_sanquintin"]["detalle"]["notas"], 1)
        self.assertEqual(salud["bq_sanquintin"]["detalle"]["sin_zona"], 1)

    def test_dos_corridas_con_busquedas_dan_bytes_identicos(self):
        uno, dos = tempfile.mkdtemp(), tempfile.mkdtemp()
        items = [self.cosecha_falsa("Productores del valle piden agua")]
        self.correr_con(uno, items)
        self.correr_con(dos, items)
        for archivo in ("notas.json", "temas.json"):
            with open(os.path.join(uno, archivo), encoding="utf-8") as a:
                with open(os.path.join(dos, archivo), encoding="utf-8") as b:
                    self.assertEqual(a.read(), b.read(), archivo)


if __name__ == "__main__":
    unittest.main()
