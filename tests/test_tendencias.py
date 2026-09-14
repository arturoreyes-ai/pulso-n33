"""Pruebas de las tendencias de X, siempre sin red.

Se sustituye 'pulso.tendencias.correr_actor', el unico punto que toca Apify.
Los nombres de campo del fixture son los que devuelve de verdad
automation-lab~twitter-trends-scraper (`rank`, `name`, `tweetVolume`,
`tweetVolumeAvailable`, `isPromoted`, `twitterSearchUrl`, `locationWoeid`,
`asOf`...), a proposito: la prueba que mas importa es que ninguno de ellos
sobreviva a la lista blanca, que las promocionadas se tiren y que un volumen
ausente sea "sin dato" y no cero.
"""

import json
import os
import shutil
import tempfile
import unittest
from datetime import date
from unittest.mock import patch

from pulso import ZONAS, tendencias
from pulso.apify import Presupuesto, revisar_entrada
from pulso.validador import validar_tendencias, validar_tendencias_config, validar_todo

AHORA = "2026-09-03T18:00:00+00:00"
HOY = date(2026, 9, 3)

TIJUANA = {"id": "tijuana", "nombre": "Tijuana", "woeid": 149361, "zona": "Tijuana",
           "ambito": "zona", "activo": True, "razon": "p"}
MEXICO = {"id": "mexico", "nombre": "México", "woeid": 23424900, "zona": None,
          "ambito": "nacional", "activo": True, "razon": "p"}
MUNDO = {"id": "mundo", "nombre": "Mundo", "woeid": 1, "zona": None,
         "ambito": "mundial", "activo": True, "razon": "p"}


def _hueco(uid, zona):
    return {"id": uid, "nombre": zona, "woeid": None, "zona": zona, "ambito": "zona",
            "activo": False, "razon": "hueco"}


# Una fila por zona, como exige el validador: Tijuana con lista y las demas
# como hueco registrado (en el config real Mexicali y San Diego si tienen).
HUECOS = [_hueco("mexicali", "Mexicali"), _hueco("ensenada", "Ensenada"),
          _hueco("rosarito", "Playas de Rosarito"), _hueco("tecate", "Tecate"),
          _hueco("sanquintin", "San Quintín"), _hueco("sanfelipe", "San Felipe"),
          _hueco("sandiego", "San Diego")]
UBICACIONES = [TIJUANA, MEXICO] + HUECOS


def _item(**cambios):
    base = {"rank": 1, "name": "#Tijuana", "tweetVolume": None, "tweetVolumeAvailable": False,
            "isHashtag": True, "isPromoted": False,
            "twitterSearchUrl": "http://twitter.com/search?q=%23Tijuana", "query": "%23Tijuana",
            "locationName": "Tijuana", "locationWoeid": 149361, "countryCode": "MX",
            "countryName": "Mexico", "locationType": "Town",
            "asOf": "2026-09-03T17:55:00.000Z", "scrapedAt": "2026-09-03T17:58:12.345Z",
            "locationCount": 1, "locationsTrendingIn": ["Tijuana"], "bestRank": 1}
    base.update(cambios)
    return base


ITEMS = [
    _item(rank=3, name="Garita San Ysidro", isHashtag=False, tweetVolume=12400,
          tweetVolumeAvailable=True),
    _item(rank=1),
    _item(rank=2, name="#Promo", isPromoted=True),
    _item(rank=4, name="Lluvia", isHashtag=False, tweetVolume=0, tweetVolumeAvailable=True),
    # Mexico, con un asOf dos minutos DESPUES de AHORA: el actor sella el corte
    # al raspar y `ahora` se toma antes de la llamada, asi que unos segundos o
    # minutos de diferencia son lo normal. Ni error ni aviso.
    _item(rank=1, name="Sheinbaum", isHashtag=False, locationWoeid=23424900,
          locationName="Mexico", locationType="Country", asOf="2026-09-03T18:02:00Z",
          tweetVolume=250000, tweetVolumeAvailable=True),
]


class _Actor:
    """Sustituye correr_actor. Guarda las llamadas para asegurar que fue una."""

    def __init__(self, items=None, error=None):
        self.items = ITEMS if items is None else items
        self.error = error
        self.llamadas = []

    def __call__(self, actor, entrada, tok, limite, timeout=None):
        self.llamadas.append((actor, entrada, limite))
        if self.error:
            raise self.error
        return self.items


def _cosechar(actor=None, ubicaciones=UBICACIONES, **kw):
    actor = actor or _Actor()
    with patch.object(tendencias, "correr_actor", actor):
        return actor, tendencias.cosechar(ubicaciones, AHORA, tok="t", **kw)


def _panel(items=None, ubicaciones=UBICACIONES, maximo=20, salud=None):
    por_woeid = tendencias.limpiar(ITEMS if items is None else items)
    return tendencias.derivar(por_woeid, AHORA, salud or [], Presupuesto(200).resumen(),
                              ubicaciones, maximo=maximo)


def _por_id(panel, uid):
    return next(u for u in panel["ubicaciones"] if u["id"] == uid)


class TestEntrada(unittest.TestCase):
    def test_las_ubicaciones_van_como_texto_y_el_mundo_como_palabra(self):
        e = tendencias._entrada([TIJUANA, MEXICO, MUNDO], 20)
        # Ordenadas por id: mexico, mundo, tijuana. El WOEID 1 es 'worldwide'.
        self.assertEqual(e, {"locations": ["23424900", "worldwide", "149361"],
                             "maxTrendsPerLocation": 20})

    def test_el_tope_se_acota_al_de_x(self):
        self.assertEqual(tendencias._entrada([TIJUANA], 500)["maxTrendsPerLocation"], 50)
        self.assertEqual(tendencias._entrada([TIJUANA], 0)["maxTrendsPerLocation"], 1)

    def test_una_apagada_o_sin_woeid_no_se_pide(self):
        e = tendencias._entrada(UBICACIONES + [dict(TIJUANA, id="zz", woeid=None)], 20)
        self.assertEqual(e["locations"], ["23424900", "149361"])

    def test_la_entrada_pasa_la_guardia_de_sesion(self):
        revisar_entrada(tendencias._entrada(UBICACIONES, 20), tendencias.ACTOR)


class TestLimpieza(unittest.TestCase):
    def test_lista_blanca_exacta(self):
        con, motivo = tendencias._limpiar(ITEMS[0])
        self.assertIsNone(motivo)
        self.assertEqual(con, {"puesto": 3, "nombre": "Garita San Ysidro",
                               "url": "https://x.com/search?q=%22Garita%20San%20Ysidro%22",
                               "volumen": 12400})
        sin, _ = tendencias._limpiar(ITEMS[1])
        self.assertEqual(sorted(sin), ["nombre", "puesto", "url"])
        self.assertEqual(sin["url"], "https://x.com/search?q=%23Tijuana")

    def test_promocionada_e_identidad_se_tiran(self):
        self.assertEqual(tendencias._limpiar(ITEMS[2]), (None, "promocionada"))
        self.assertEqual(tendencias._limpiar(_item(name="@fulano")), (None, "identidad"))
        self.assertEqual(tendencias._limpiar(_item(name="  ")), (None, "sin_nombre"))
        self.assertEqual(tendencias._limpiar(_item(rank=0)), (None, "sin_puesto"))

    def test_volumen_cero_o_retirado_es_sin_dato(self):
        # X retiro el volumen de casi todas en enero de 2026: ausente, no 0.
        self.assertNotIn("volumen", tendencias._limpiar(ITEMS[3])[0])
        self.assertNotIn("volumen", tendencias._limpiar(
            _item(tweetVolume=500, tweetVolumeAvailable=False))[0])
        self.assertEqual(
            tendencias._limpiar(_item(tweetVolume=500, tweetVolumeAvailable=True))[0]["volumen"],
            500)

    def test_la_url_se_construye_aqui_y_no_se_copia_del_actor(self):
        self.assertEqual(tendencias._url("Lluvia"), "https://x.com/search?q=Lluvia")
        self.assertEqual(tendencias._url("#Tijuana"), "https://x.com/search?q=%23Tijuana")
        self.assertEqual(tendencias._url("Garita San Ysidro"),
                         "https://x.com/search?q=%22Garita%20San%20Ysidro%22")

    def test_el_corte_va_en_el_formato_de_ahora(self):
        self.assertEqual(tendencias._corte("2026-09-03T17:55:00.000Z"),
                         "2026-09-03T17:55:00+00:00")
        self.assertEqual(tendencias._corte("2026-09-03T10:55:00-07:00"),
                         "2026-09-03T17:55:00+00:00")
        self.assertEqual(tendencias._corte("2026-09-03T17:55:00"), "2026-09-03T17:55:00+00:00")
        self.assertIsNone(tendencias._corte("ayer"))
        self.assertIsNone(tendencias._corte(None))

    def test_limpiar_agrupa_por_woeid_y_conserva_el_puesto_de_x(self):
        por = tendencias.limpiar(ITEMS)
        self.assertEqual(sorted(por), [149361, 23424900])
        tj = por[149361]
        # La promocionada era el puesto 2: el hueco se queda, no se renumera.
        self.assertEqual([t["puesto"] for t in tj["tendencias"]], [1, 3, 4])
        self.assertEqual(tj["descartes"], {"promocionada": 1})
        self.assertEqual(tj["corte"], "2026-09-03T17:55:00+00:00")

    def test_un_puesto_repetido_se_queda_con_el_primero(self):
        por = tendencias.limpiar([_item(rank=1, name="A"), _item(rank=1, name="B")])
        self.assertEqual([t["nombre"] for t in por[149361]["tendencias"]], ["A"])

    def test_ningun_campo_crudo_sobrevive(self):
        crudo = json.dumps(tendencias.limpiar(ITEMS))
        for campo in tendencias.CAMPOS_CRUDOS:
            self.assertNotIn('"{}"'.format(campo), crudo)
        self.assertNotIn("twitter.com", crudo)


class TestCosecha(unittest.TestCase):
    def test_sin_token_no_llama_y_lo_dice(self):
        actor = _Actor()
        with patch.object(tendencias, "correr_actor", actor):
            por, salud, gasto = tendencias.cosechar(UBICACIONES, AHORA, entorno={})
        self.assertEqual(actor.llamadas, [])
        self.assertEqual(por, {})
        self.assertEqual([s["ubicacion"] for s in salud], ["mexico", "tijuana"])
        self.assertTrue(all(s["estado"] == "sin_token" for s in salud))
        self.assertIn("APIFY_TOKEN", salud[0]["error"])
        self.assertEqual(gasto["gastado"], 0)

    def test_una_llamada_para_todas_con_el_limite_justo(self):
        actor, (_, _, gasto) = _cosechar(maximo=20)
        self.assertEqual(len(actor.llamadas), 1)
        nombre, entrada, limite = actor.llamadas[0]
        self.assertEqual(nombre, tendencias.ACTOR)
        self.assertEqual(entrada["locations"], ["23424900", "149361"])
        self.assertEqual(limite, 40)
        self.assertEqual(gasto["gastado"], len(ITEMS))
        self.assertEqual(gasto["por_concepto"], {tendencias.ACTOR: len(ITEMS)})

    def test_un_fallo_del_actor_se_reporta_y_no_truena(self):
        _, (por, salud, _) = _cosechar(_Actor(error=RuntimeError("HTTP 500")))
        self.assertEqual(por, {})
        self.assertEqual([s["estado"] for s in salud], ["fallo", "fallo"])
        self.assertIn("RuntimeError", salud[0]["error"])

    def test_el_presupuesto_se_revisa_antes_de_llamar(self):
        # Presupuesto.cobrar avisa cuando ya se gasto; aqui se revisa antes.
        actor, (_, salud, gasto) = _cosechar(presupuesto=Presupuesto(10), maximo=20)
        self.assertEqual(actor.llamadas, [])
        self.assertTrue(all(s["estado"] == "fallo" for s in salud))
        self.assertIn("presupuesto insuficiente", salud[0]["error"])
        self.assertEqual(gasto["gastado"], 0)

    def test_sin_dato_cuando_el_actor_no_trae_la_ubicacion(self):
        solo_tj = [i for i in ITEMS if i["locationWoeid"] == 149361]
        _, (_, salud, _) = _cosechar(_Actor(items=solo_tj))
        mx = next(s for s in salud if s["ubicacion"] == "mexico")
        self.assertEqual((mx["estado"], mx["tendencias"]), ("sin_dato", 0))
        self.assertTrue(mx.get("nota"))

    def test_la_salud_cuenta_las_promocionadas(self):
        _, (_, salud, _) = _cosechar()
        tj = next(s for s in salud if s["ubicacion"] == "tijuana")
        self.assertEqual((tj["estado"], tj["tendencias"], tj["promocionadas"]), ("ok", 3, 1))


class TestDerivar(unittest.TestCase):
    def test_una_fila_por_ubicacion_ordenada_por_id(self):
        p = _panel()
        self.assertEqual([u["id"] for u in p["ubicaciones"]],
                         sorted(u["id"] for u in UBICACIONES))
        ens = _por_id(p, "ensenada")
        self.assertEqual((ens["activa"], ens["estado"], ens["woeid"], ens["tendencias"]),
                         (False, "sin_lista", None, []))

    def test_conserva_el_puesto_de_x_y_el_volumen_solo_cuando_x_lo_da(self):
        tj = _por_id(_panel(), "tijuana")
        self.assertEqual(tj["estado"], "ok")
        self.assertEqual([t["puesto"] for t in tj["tendencias"]], [1, 3, 4])
        self.assertEqual([t.get("volumen") for t in tj["tendencias"]], [None, 12400, None])
        self.assertEqual(tj["corte"], "2026-09-03T17:55:00+00:00")

    def test_es_identico_con_la_entrada_al_reves(self):
        self.assertEqual(json.dumps(_panel(ITEMS)), json.dumps(_panel(list(reversed(ITEMS)))))

    def test_pasa_el_validador_sin_avisar_por_segundos_de_diferencia(self):
        # En la primera corrida real (2026-09-12) el corte llego entre 5 y 11
        # segundos despues de `generado` en las cinco ubicaciones: si eso
        # avisara, avisaria en cada corrida.
        e, a = validar_tendencias(_panel())
        self.assertEqual(e, [])
        self.assertFalse(any("reloj" in x for x in a))

    def test_un_corte_muy_posterior_a_generado_es_aviso(self):
        p = _panel()
        _por_id(p, "mexico")["corte"] = "2026-09-03T18:30:00+00:00"
        e, a = validar_tendencias(p)
        self.assertEqual(e, [])
        self.assertTrue(any("reloj" in x and "mexico" in x for x in a))

    def test_ningun_campo_crudo_ni_identidad_llega_a_data(self):
        crudo = json.dumps(_panel(ITEMS + [_item(rank=9, name="@alguien")]))
        for campo in tendencias.CAMPOS_CRUDOS:
            self.assertNotIn('"{}"'.format(campo), crudo)
        self.assertNotIn("@alguien", crudo)
        self.assertNotIn("twitter.com", crudo)

    def test_la_salud_cuadra_con_las_filas(self):
        p = _panel()
        self.assertEqual([s["ubicacion"] for s in p["salud"]], ["mexico", "tijuana"])
        tj = next(s for s in p["salud"] if s["ubicacion"] == "tijuana")
        self.assertEqual((tj["estado"], tj["tendencias"], tj["promocionadas"]), ("ok", 3, 1))

    def test_el_maximo_recorta_y_la_salud_lo_refleja(self):
        p = _panel(maximo=2)
        self.assertEqual(len(_por_id(p, "tijuana")["tendencias"]), 2)
        self.assertEqual(
            next(s for s in p["salud"] if s["ubicacion"] == "tijuana")["tendencias"], 2)
        self.assertEqual(validar_tendencias(p)[0], [])

    def test_un_fallo_de_la_cosecha_manda_sobre_los_datos(self):
        salud = [{"ubicacion": "tijuana", "estado": "fallo", "tendencias": 0,
                  "promocionadas": 0, "error": "x"}]
        p = _panel(salud=salud)
        tj = _por_id(p, "tijuana")
        self.assertEqual((tj["estado"], tj["tendencias"]), ("fallo", []))
        self.assertEqual(validar_tendencias(p)[0], [])

    def test_sin_token_pasa_el_validador(self):
        actor = _Actor()
        with patch.object(tendencias, "correr_actor", actor):
            por, salud, gasto = tendencias.cosechar(UBICACIONES, AHORA, entorno={})
        p = tendencias.derivar(por, AHORA, salud, gasto, UBICACIONES)
        self.assertEqual({u["estado"] for u in p["ubicaciones"] if u["activa"]}, {"sin_token"})
        self.assertEqual(validar_tendencias(p)[0], [])


class TestValidador(unittest.TestCase):
    def _con(self, **cambios):
        return dict(_panel(), **cambios)

    def _tj(self, doc):
        return _por_id(doc, "tijuana")

    def test_el_valido_pasa(self):
        self.assertEqual(validar_tendencias(_panel())[0], [])

    def test_acceso_debe_ser_sin_sesion(self):
        e, _ = validar_tendencias(self._con(acceso="cookies"))
        self.assertTrue(any("'acceso'" in x for x in e))

    def test_volumen_cero_es_error(self):
        doc = _panel()
        self._tj(doc)["tendencias"][0]["volumen"] = 0
        self.assertTrue(any("ausente es sin dato, nunca 0" in x
                            for x in validar_tendencias(doc)[0]))

    def test_el_puesto_debe_crecer(self):
        doc = _panel()
        t = self._tj(doc)["tendencias"]
        t[0]["puesto"], t[1]["puesto"] = t[1]["puesto"], t[0]["puesto"]
        self.assertTrue(any("'puesto' debe crecer" in x for x in validar_tendencias(doc)[0]))

    def test_url_ajena_es_error(self):
        doc = _panel()
        self._tj(doc)["tendencias"][0]["url"] = "https://twitter.com/search?q=x"
        self.assertTrue(any("url ajena" in x for x in validar_tendencias(doc)[0]))

    def test_zona_y_ambito_deben_cuadrar(self):
        doc = _panel()
        _por_id(doc, "mexico")["zona"] = "Tijuana"
        self.assertTrue(any("no cuadran" in x for x in validar_tendencias(doc)[0]))

    def test_mas_del_maximo_es_error(self):
        doc = self._con(maximo_por_ubicacion=2)
        self.assertTrue(any("mas de maximo_por_ubicacion" in x
                            for x in validar_tendencias(doc)[0]))

    def test_un_campo_crudo_del_actor_es_clave_prohibida(self):
        doc = _panel()
        self._tj(doc)["tendencias"][0]["tweetVolume"] = 5
        self.assertTrue(any("clave prohibida" in x for x in validar_tendencias(doc)[0]))

    def test_un_porcentaje_es_error(self):
        e, _ = validar_tendencias(self._con(porcentaje=50))
        self.assertTrue(any("porcentaje prohibido" in x for x in e))

    def test_desorden_de_ubicaciones_es_error(self):
        doc = _panel()
        doc["ubicaciones"] = list(reversed(doc["ubicaciones"]))
        self.assertTrue(any("no esta ordenada por id" in x for x in validar_tendencias(doc)[0]))

    def test_la_salud_debe_cuadrar(self):
        doc = _panel()
        doc["salud"][0]["tendencias"] += 1
        self.assertTrue(any("salud no cuadra" in x for x in validar_tendencias(doc)[0]))

    def test_una_zona_sin_fila_es_error(self):
        doc = _panel()
        doc["ubicaciones"] = [u for u in doc["ubicaciones"] if u["id"] != "ensenada"]
        self.assertTrue(any("exactamente una ubicacion" in x and "Ensenada" in x
                            for x in validar_tendencias(doc)[0]))

    def test_sin_lista_solo_en_apagadas(self):
        doc = _panel()
        _por_id(doc, "ensenada")["estado"] = "sin_dato"
        self.assertTrue(any("'sin_lista'" in x for x in validar_tendencias(doc)[0]))
        doc = _panel()
        self._tj(doc)["estado"] = "sin_lista"
        self.assertTrue(any("'sin_lista'" in x for x in validar_tendencias(doc)[0]))

    def test_ok_es_tener_lista(self):
        doc = _panel()
        self._tj(doc)["tendencias"] = []
        self.assertTrue(any("'ok' es exactamente tener" in x for x in validar_tendencias(doc)[0]))

    def test_identidad_en_el_nombre_es_error(self):
        doc = _panel()
        self._tj(doc)["tendencias"][0]["nombre"] = "@fulano"
        self.assertTrue(any("identidad" in x for x in validar_tendencias(doc)[0]))

    def test_corte_invalido_es_error_y_futuro_es_aviso(self):
        doc = _panel()
        self._tj(doc)["corte"] = "ayer"
        self.assertTrue(any("'corte'" in x for x in validar_tendencias(doc)[0]))
        doc = _panel()
        self._tj(doc)["corte"] = "2026-09-03T18:30:00+00:00"
        e, a = validar_tendencias(doc)
        self.assertEqual(e, [])
        self.assertTrue(any("reloj" in x and "tijuana" in x for x in a))


class TestConfigReal(unittest.TestCase):
    """Lee el config/tendencias.json real, como el resto de la suite."""

    def setUp(self):
        with open(os.path.join("config", "tendencias.json"), encoding="utf-8") as fh:
            self.cfg = json.load(fh)

    def test_el_config_real_pasa_su_validador(self):
        self.assertEqual(validar_tendencias_config(self.cfg)[0], [])

    def test_cinco_activas_cinco_huecos_y_cada_zona_una_vez(self):
        activas = [u for u in self.cfg["ubicaciones"] if u["activo"]]
        huecos = [u for u in self.cfg["ubicaciones"] if not u["activo"]]
        self.assertEqual(sorted(u["id"] for u in activas),
                         ["mexicali", "mexico", "mundo", "sandiego", "tijuana"])
        self.assertEqual(len(huecos), 5)
        zonas = sorted(u["zona"] for u in self.cfg["ubicaciones"] if u["ambito"] == "zona")
        self.assertEqual(zonas, sorted(z for z in ZONAS if z != "estatal"))

    def test_las_activas_citan_su_confirmacion_y_los_huecos_su_razon(self):
        # Encender no es editar el campo: es correr --ubicaciones y anotar la
        # fecha. Un hueco se registra, no se cosecha.
        for u in self.cfg["ubicaciones"]:
            with self.subTest(ubicacion=u["id"]):
                if u["activo"]:
                    self.assertIn("Confirmada", u["razon"])
                    self.assertIsInstance(u["woeid"], int)
                else:
                    self.assertIsNone(u["woeid"])
                    self.assertIn("hueco", u["razon"].lower())

    def test_la_entrada_real_pasa_la_guardia_de_sesion(self):
        revisar_entrada(tendencias._entrada(self.cfg["ubicaciones"],
                                            self.cfg["cosecha"]["maximo_por_ubicacion"]),
                        self.cfg["actor"])

    def test_el_presupuesto_cubre_la_llamada(self):
        activas = sum(1 for u in self.cfg["ubicaciones"] if u["activo"])
        cosecha = self.cfg["cosecha"]
        self.assertGreaterEqual(cosecha["presupuesto_resultados"],
                                cosecha["maximo_por_ubicacion"] * activas)

    def test_el_actor_esta_en_el_catalogo_apagado_y_el_de_cookies_es_senuelo(self):
        with open(os.path.join("config", "apify.json"), encoding="utf-8") as fh:
            catalogo = json.load(fh)
        fila = next(a for a in catalogo["actores"] if a["id"] == self.cfg["actor"])
        self.assertFalse(fila["activo"])
        self.assertIn("mikolabs~x-twitter-trends-scraper",
                      [s["id"] for s in catalogo["senuelos"]])


class TestExploracion(unittest.TestCase):
    def test_probar_pide_pocas_y_no_escribe(self):
        actor = _Actor()
        with patch.object(tendencias, "correr_actor", actor):
            filas = tendencias.probar(UBICACIONES, AHORA, tok="t", maximo=5)
        _, entrada, limite = actor.llamadas[0]
        self.assertEqual((entrada["maxTrendsPerLocation"], limite), (5, 10))
        self.assertEqual([f["ubicacion"] for f in filas], ["mexico", "tijuana"])
        tj = next(f for f in filas if f["ubicacion"] == "tijuana")
        self.assertEqual(len(tj["tendencias"]), 3)
        self.assertEqual(tj["descartes"], {"promocionada": 1})

    def test_ubicaciones_disponibles_filtra_a_la_region_y_al_mundo(self):
        crudas = [{"woeid": 1, "name": "Worldwide", "countryCode": None, "placeType": "Supername"},
                  {"woeid": 149361, "name": "Tijuana", "countryCode": "MX", "placeType": "Town"},
                  {"woeid": 44418, "name": "London", "countryCode": "GB", "placeType": "Town"},
                  {"woeid": 2487889, "name": "San Diego", "countryCode": "US", "placeType": "Town"}]
        actor = _Actor(items=crudas)
        with patch.object(tendencias, "correr_actor", actor):
            filas = tendencias.ubicaciones_disponibles(tok="t")
        _, entrada, _ = actor.llamadas[0]
        self.assertTrue(entrada["getAvailableLocations"])
        self.assertEqual(entrada["locations"], ["worldwide"])
        self.assertEqual([f["nombre"] for f in filas], ["Worldwide", "Tijuana", "San Diego"])


class TestValidarTodo(unittest.TestCase):
    """El archivo entra a validar_todo como opcional, con el config real."""

    def _corrida(self, raiz):
        datos = os.path.join(raiz, "data")
        os.makedirs(datos)
        os.makedirs(os.path.join(raiz, "efimero"))
        for nombre in ("notas", "fuentes", "temas", "estado"):
            shutil.copy(os.path.join("data", nombre + ".json"),
                        os.path.join(datos, nombre + ".json"))
        shutil.copytree(os.path.join("data", "archivo"), os.path.join(datos, "archivo"))
        return datos

    def test_un_tendencias_valido_pasa_y_uno_roto_se_nombra(self):
        with tempfile.TemporaryDirectory() as raiz:
            datos = self._corrida(raiz)
            ruta = os.path.join(datos, "tendencias.json")
            with open(ruta, "w", encoding="utf-8") as fh:
                json.dump(_panel(), fh, ensure_ascii=False)
            errores, _ = validar_todo("config", datos, hoy=HOY)
            self.assertEqual(errores, [])
            with open(ruta, "w", encoding="utf-8") as fh:
                json.dump({}, fh)
            errores, _ = validar_todo("config", datos, hoy=HOY)
            self.assertTrue(any("tendencias" in e for e in errores))


if __name__ == "__main__":
    unittest.main()
