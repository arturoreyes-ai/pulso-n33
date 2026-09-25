"""Pruebas del cliente de Apify, siempre sin red.

La red se sustituye en 'pulso.apify.urlopen'. Lo que mas se prueba aqui no es
el parseo sino la GUARDIA: que una entrada con cookies o credenciales sea un
error y no un aviso. Esa regla es la que sostiene la posicion legal de
docs/PLAN.md seccion 3, y una regla legal que solo vive en un comentario se
rompe en el primer pull request apurado.
"""

import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from pulso import apify

CATALOGO = os.path.join("config", "apify.json")


class _Respuesta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def _responder(payload):
    return _Respuesta(json.dumps(payload).encode("utf-8"))


class TestToken(unittest.TestCase):
    def test_recorta_espacios(self):
        # Pegar el token de la consola web arrastra un salto de linea, y un
        # token con \n de sobra falla con 401 sin decir por que.
        self.assertEqual(apify.token({"APIFY_TOKEN": " apify_api_xyz\n"}), "apify_api_xyz")

    def test_sin_token_es_excepcion_propia(self):
        # Propia y no RuntimeError: el llamador la atrapa para degradarse a
        # vacio, igual que el panel de YouTube sin llave.
        with self.assertRaises(apify.SinToken):
            apify.token({})

    def test_vacio_cuenta_como_ausente(self):
        with self.assertRaises(apify.SinToken):
            apify.token({"APIFY_TOKEN": "   "})

    def test_no_lee_el_entorno_real_cuando_se_le_pasa_uno(self):
        with patch.dict(os.environ, {"APIFY_TOKEN": "del-sistema"}):
            self.assertEqual(apify.token({"APIFY_TOKEN": "explicito"}), "explicito")


class TestRevisarEntrada(unittest.TestCase):
    """La guardia contra actores logueados. Ver pulso/apify.py, regla 1."""

    def test_acepta_una_entrada_publica(self):
        apify.revisar_entrada({"directUrls": ["https://x.test/a"], "resultsLimit": 10})

    def test_acepta_entrada_vacia_y_none(self):
        apify.revisar_entrada({})
        apify.revisar_entrada(None)

    def test_rechaza_cookies_de_sesion(self):
        with self.assertRaises(apify.ActorProhibido):
            apify.revisar_entrada({"sessionCookie": "c_user=1"}, "actor~x")

    def test_rechaza_credenciales(self):
        for llave in ("password", "loginCredentials", "authToken", "li_at"):
            with self.subTest(llave=llave):
                with self.assertRaises(apify.ActorProhibido):
                    apify.revisar_entrada({llave: "algo"}, "actor~x")

    def test_no_le_importa_la_capitalizacion(self):
        # Los actores no se ponen de acuerdo entre sessionCookie,
        # sessioncookie y SessionCookies.
        for llave in ("SessionCookies", "SESSIONID", "sessionCookie"):
            with self.subTest(llave=llave):
                with self.assertRaises(apify.ActorProhibido):
                    apify.revisar_entrada({llave: "x"}, "actor~x")

    def test_username_no_es_credencial(self):
        # En casi todos los actores 'username' es el perfil OBJETIVO, no una
        # credencial. Prohibirlo dejaria sin usar todo el catalogo publico.
        apify.revisar_entrada({"username": ["gobiernobc"]})

    def test_el_mensaje_nombra_al_actor_y_la_llave(self):
        with self.assertRaises(apify.ActorProhibido) as ctx:
            apify.revisar_entrada({"sessionCookie": "x"}, "apidojo~tweet-scraper")
        self.assertIn("apidojo~tweet-scraper", str(ctx.exception))
        # La llave se reporta como la escribio el autor, no normalizada: es
        # la que tiene que buscar en el archivo para borrarla.
        self.assertIn("sessionCookie", str(ctx.exception))

    def test_correr_actor_revisa_antes_de_gastar(self):
        # La guardia va ANTES de la peticion: un actor prohibido no debe
        # llegar a costar dinero para enterarse de que estaba prohibido.
        with patch.object(apify, "urlopen") as falso:
            with self.assertRaises(apify.ActorProhibido):
                apify.correr_actor("a~b", {"cookies": []}, "tok", 10)
        falso.assert_not_called()


class TestEnParalelo(unittest.TestCase):
    """La red va a la vez; el orden de salida es el de entrada, nunca el de
    llegada. Sin eso dos corridas iguales darian bytes distintos."""

    def test_devuelve_en_orden_de_entrada_aunque_lleguen_al_reves(self):
        import time
        tareas = [(lambda i=i: (time.sleep(0.02 * (5 - i)), i)[1]) for i in range(6)]
        self.assertEqual([r for r, _ in apify.en_paralelo(tareas)], list(range(6)))

    def test_un_error_se_devuelve_en_su_lugar_sin_cancelar_a_las_demas(self):
        def revienta():
            raise ValueError("408")
        salida = apify.en_paralelo([lambda: 1, revienta, lambda: 3])
        self.assertEqual([r for r, _ in salida], [1, None, 3])
        self.assertIsInstance(salida[1][1], ValueError)

    def test_de_verdad_corre_a_la_vez(self):
        import threading
        import time
        activas, pico, candado = [0], [0], threading.Lock()

        def tarea():
            with candado:
                activas[0] += 1
                pico[0] = max(pico[0], activas[0])
            time.sleep(0.05)
            with candado:
                activas[0] -= 1
        apify.en_paralelo([tarea] * 12)
        self.assertGreater(pico[0], 1)
        self.assertLessEqual(pico[0], apify.HILOS)


class TestPresupuesto(unittest.TestCase):
    def test_reparte_entre_actores(self):
        p = apify.Presupuesto(300)
        self.assertEqual(p.reparto(4), 75)

    def test_reparto_nunca_es_cero_con_actores(self):
        # Con mas actores que presupuesto, cada uno recibe 1 y el tope duro
        # de cobrar() corta. Cero convertiria una corrida cara en una corrida
        # vacia y silenciosa.
        self.assertEqual(apify.Presupuesto(3).reparto(10), 1)

    def test_sin_actores_no_reparte(self):
        self.assertEqual(apify.Presupuesto(300).reparto(0), 0)

    def test_cobra_y_acumula_por_actor(self):
        p = apify.Presupuesto(100)
        p.cobrar("a~b", 30)
        p.cobrar("a~b", 20)
        p.cobrar("c~d", 10)
        self.assertEqual(p.gastado, 60)
        self.assertEqual(p.resumen()["por_concepto"], {"a~b": 50, "c~d": 10})

    def test_el_tope_es_duro(self):
        p = apify.Presupuesto(50)
        p.cobrar("a~b", 50)
        with self.assertRaises(apify.PresupuestoAgotado):
            p.cobrar("c~d", 1)

    def test_el_cobro_rechazado_no_gasta(self):
        p = apify.Presupuesto(50)
        with self.assertRaises(apify.PresupuestoAgotado):
            p.cobrar("a~b", 51)
        self.assertEqual(p.gastado, 0)

    def test_resumen_ordenado(self):
        # Determinismo: cualquier serie que se escriba va ordenada.
        p = apify.Presupuesto(100)
        for n in ("z~z", "a~a", "m~m"):
            p.cobrar(n, 1)
        self.assertEqual(list(p.resumen()["por_concepto"]), ["a~a", "m~m", "z~z"])


class TestVerificar(unittest.TestCase):
    RESPUESTA = {"data": {
        "username": "pulso",
        "isPaying": True,
        "plan": {"id": "PERSONAL", "monthlyUsageCreditsUsd": 49},
    }}

    def test_devuelve_plan_sin_devolver_el_token(self):
        with patch.object(apify, "urlopen", return_value=_responder(self.RESPUESTA)):
            v = apify.verificar("apify_api_secreto")
        self.assertEqual(v["usuario"], "pulso")
        self.assertEqual(v["plan"], "PERSONAL")
        self.assertTrue(v["de_paga"])
        self.assertEqual(v["credito_mensual_usd"], 49)
        self.assertNotIn("apify_api_secreto", json.dumps(v))

    def test_manda_el_token_como_bearer(self):
        with patch.object(apify, "urlopen", return_value=_responder(self.RESPUESTA)) as u:
            apify.verificar("apify_api_secreto")
        req = u.call_args[0][0]
        self.assertEqual(req.get_header("Authorization"), "Bearer apify_api_secreto")

    def test_plan_gratuito_sin_credito(self):
        payload = {"data": {"username": "x", "isPaying": False, "plan": {"id": "FREE"}}}
        with patch.object(apify, "urlopen", return_value=_responder(payload)):
            v = apify.verificar("t")
        self.assertFalse(v["de_paga"])
        self.assertIsNone(v["credito_mensual_usd"])


class TestErroresHTTP(unittest.TestCase):
    """401, 402 y 408 piden acciones distintas y por eso se distinguen."""

    def _falla(self, codigo, cuerpo=b"{}"):
        from urllib.error import HTTPError
        return HTTPError("https://api.apify.com/v2/x", codigo, "err", {}, io.BytesIO(cuerpo))

    def test_401_es_sin_token(self):
        with patch.object(apify, "urlopen", side_effect=self._falla(401)):
            with self.assertRaises(apify.SinToken):
                apify.verificar("caducado")

    def test_402_es_credito_agotado(self):
        with patch.object(apify, "urlopen", side_effect=self._falla(402)):
            with self.assertRaises(apify.PresupuestoAgotado):
                apify.verificar("t")

    def test_408_manda_a_bajar_la_cuota_no_a_subir_el_timeout(self):
        with patch.object(apify, "urlopen", side_effect=self._falla(408)):
            with self.assertRaises(RuntimeError) as ctx:
                apify.correr_actor("a~b", {"x": 1}, "t", 10)
        self.assertIn("cuota", str(ctx.exception))


class TestCorrerActor(unittest.TestCase):
    def test_devuelve_los_items(self):
        with patch.object(apify, "urlopen", return_value=_responder([{"a": 1}, {"a": 2}])):
            items = apify.correr_actor("apify~x", {"resultsLimit": 2}, "t", 2)
        self.assertEqual(len(items), 2)

    def test_la_barra_se_vuelve_tilde(self):
        # La API escribe usuario~actor; el catalogo y la consola web usan
        # usuario/actor. Aceptar los dos evita un 404 por una diagonal.
        with patch.object(apify, "urlopen", return_value=_responder([])) as u:
            apify.correr_actor("apify/instagram-scraper", {}, "t", 5)
        self.assertIn("apify~instagram-scraper", u.call_args[0][0].full_url)

    def test_el_timeout_nunca_pasa_el_tope_de_la_plataforma(self):
        with patch.object(apify, "urlopen", return_value=_responder([])) as u:
            apify.correr_actor("a~b", {}, "t", 5, timeout=9000)
        self.assertIn("timeout={}".format(apify.TOPE_SINCRONO), u.call_args[0][0].full_url)

    def test_el_limite_viaja_en_el_query(self):
        with patch.object(apify, "urlopen", return_value=_responder([])) as u:
            apify.correr_actor("a~b", {}, "t", 25)
        self.assertIn("limit=25", u.call_args[0][0].full_url)

    def test_una_respuesta_que_no_es_lista_no_truena(self):
        with patch.object(apify, "urlopen", return_value=_responder({"error": "x"})):
            self.assertEqual(apify.correr_actor("a~b", {}, "t", 5), [])


class TestCatalogo(unittest.TestCase):
    """Lee el config/apify.json real, como el resto de la suite."""

    def test_el_catalogo_real_no_tiene_errores(self):
        _, errores = apify.leer_catalogo(CATALOGO)
        self.assertEqual(errores, [])

    def test_todo_viene_apagado(self):
        # Encender un actor es una decision legal y deja rastro en el diff.
        activos, _ = apify.leer_catalogo(CATALOGO)
        self.assertEqual(activos, [])

    def test_cada_actor_declara_idioma(self):
        # Nunca se adivina del texto: un modelo de sentimiento con texto en
        # otro idioma devuelve una etiqueta plausible, no un error.
        with open(CATALOGO, encoding="utf-8") as fh:
            doc = json.load(fh)
        for a in doc["actores"]:
            with self.subTest(actor=a["id"]):
                self.assertIn(a.get("idioma"), ("es", "en"))

    def test_cada_actor_y_senuelo_trae_razon_escrita(self):
        with open(CATALOGO, encoding="utf-8") as fh:
            doc = json.load(fh)
        for a in doc["actores"] + doc["senuelos"]:
            with self.subTest(actor=a["id"]):
                self.assertTrue((a.get("razon") or "").strip())

    def _catalogo_temporal(self, doc):
        d = tempfile.mkdtemp()
        ruta = os.path.join(d, "apify.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(doc, fh)
        return ruta

    def test_un_actor_activo_con_sesion_es_error(self):
        # No basta con quitar "activo": false para encender un raspado
        # logueado. Esta es la prueba que sostiene esa afirmacion.
        ruta = self._catalogo_temporal({"actores": [{
            "id": "malo~x", "idioma": "es", "activo": True, "razon": "prueba",
            "entrada": {"sessionCookie": "c_user=1"},
        }]})
        _, errores = apify.leer_catalogo(ruta)
        self.assertTrue(any("Bright Data" in e for e in errores))

    def test_un_actor_activo_sin_razon_es_error(self):
        ruta = self._catalogo_temporal({"actores": [{
            "id": "x~y", "idioma": "es", "activo": True, "entrada": {},
        }]})
        _, errores = apify.leer_catalogo(ruta)
        self.assertTrue(any("razon" in e for e in errores))

    def test_un_idioma_no_soportado_es_error(self):
        ruta = self._catalogo_temporal({"actores": [{
            "id": "x~y", "idioma": "pt", "activo": True, "razon": "prueba",
            "entrada": {},
        }]})
        _, errores = apify.leer_catalogo(ruta)
        self.assertTrue(any("idioma" in e for e in errores))

    def test_un_actor_apagado_no_se_revisa_ni_se_devuelve(self):
        # Un senuelo apagado documenta por que NO se usa; que traiga una
        # entrada prohibida es justo el punto.
        ruta = self._catalogo_temporal({"actores": [{
            "id": "x~y", "activo": False, "entrada": {"password": "x"},
        }]})
        activos, errores = apify.leer_catalogo(ruta)
        self.assertEqual((activos, errores), ([], []))


if __name__ == "__main__":
    unittest.main()
