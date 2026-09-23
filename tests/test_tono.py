"""El servicio de tono de la busqueda en vivo (pulso/tono.py).

Nunca carga el modelo: el analizador es `AnalizadorFalso`, con la misma
interfaz. El servidor escucha en 127.0.0.1 con un puerto que elige el sistema;
es un socket local, no la red.
"""

import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from pulso import tono
from pulso.sentimiento import A_SENTIMIENTO, A_TONO, AnalizadorFalso

SECRETO = "secreto-de-prueba"


class TestEtiquetar(unittest.TestCase):
    def test_traduce_con_los_vocabularios_del_pipeline(self):
        a = AnalizadorFalso()
        textos = ["Gran logro para la ciudad", "Denuncian robo en la colonia", "Abre la garita"]
        prensa = tono.etiquetar(textos, "prensa", "es", a)
        comentarios = tono.etiquetar(textos, "comentarios", "es", a)
        self.assertEqual(prensa["etiquetas"], [A_TONO["POS"], A_TONO["NEG"], A_TONO["NEU"]])
        self.assertEqual(comentarios["etiquetas"], [A_SENTIMIENTO["POS"], A_SENTIMIENTO["NEG"], A_SENTIMIENTO["NEU"]])
        self.assertEqual(prensa["modelo"], AnalizadorFalso.modelo)

    def test_el_vacio_cuenta_como_en_el_pipeline(self):
        # El pipeline manda NEU un texto vacio; aqui no hay un caso propio.
        r = tono.etiquetar(["", "   "], "comentarios", "es", AnalizadorFalso())
        self.assertEqual(r["etiquetas"], ["neutral", "neutral"])

    def test_otro_idioma_no_pasa_por_el_modelo(self):
        a = AnalizadorFalso(idioma="es")
        r = tono.etiquetar(["Great win for the city"], "prensa", "en", a)
        self.assertEqual(r, {"etiquetas": [None], "modelo": None})
        self.assertEqual(a.llamadas, 0)

    def test_lista_vacia(self):
        self.assertEqual(tono.etiquetar([], "prensa", "es", AnalizadorFalso()), {"etiquetas": [], "modelo": None})


class TestPeticion(unittest.TestCase):
    def test_valida_la_forma(self):
        ok = json.dumps({"textos": ["a"], "vocabulario": "prensa", "idioma": "es"})
        self.assertEqual(tono.leer_peticion(ok), (["a"], "prensa", "es"))
        for malo in ("no es json", "[]", json.dumps({"textos": "a", "vocabulario": "prensa", "idioma": "es"}),
                     json.dumps({"textos": [1], "vocabulario": "prensa", "idioma": "es"}),
                     json.dumps({"textos": ["a"], "vocabulario": "postura", "idioma": "es"}),
                     json.dumps({"textos": ["a"], "vocabulario": "prensa", "idioma": "fr"}),
                     json.dumps({"textos": ["a"] * (tono.TOPE_TEXTOS + 1), "vocabulario": "prensa", "idioma": "es"})):
            with self.assertRaises(tono.PeticionInvalida, msg=malo[:60]):
                tono.leer_peticion(malo)

    def test_sin_secreto_configurado_no_pasa_nadie(self):
        self.assertFalse(tono.secreto_valido("", ""))
        self.assertFalse(tono.secreto_valido("x", ""))
        self.assertFalse(tono.secreto_valido("", "x"))
        self.assertFalse(tono.secreto_valido("y", "x"))
        self.assertTrue(tono.secreto_valido("x", "x"))


class _Falso(tono.Manejador):
    analizador_falso = AnalizadorFalso()

    def secreto(self):
        return SECRETO

    def analizador(self, idioma):
        return self.analizador_falso


class TestServicio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.servidor = ThreadingHTTPServer(("127.0.0.1", 0), _Falso)
        cls.hilo = threading.Thread(target=cls.servidor.serve_forever, daemon=True)
        cls.hilo.start()
        cls.base = "http://127.0.0.1:{}/".format(cls.servidor.server_address[1])

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()
        cls.servidor.server_close()

    def _pedir(self, cuerpo=None, secreto=SECRETO):
        datos = None if cuerpo is None else json.dumps(cuerpo).encode("utf-8")
        cabeceras = {"Content-Type": "application/json"}
        if secreto is not None:
            cabeceras[tono.CABECERA_SECRETO] = secreto
        with urlopen(Request(self.base, data=datos, headers=cabeceras), timeout=5) as r:
            return r.status, json.loads(r.read().decode("utf-8"))

    def test_etiqueta_por_http(self):
        estado, cuerpo = self._pedir({"textos": ["Excelente trabajo", "Mal servicio"],
                                      "vocabulario": "comentarios", "idioma": "es"})
        self.assertEqual(estado, 200)
        self.assertEqual(cuerpo["etiquetas"], ["positivo", "negativo"])

    def test_ingles_vuelve_sin_etiqueta(self):
        _estado, cuerpo = self._pedir({"textos": ["Great"], "vocabulario": "prensa", "idioma": "en"})
        self.assertEqual(cuerpo, {"etiquetas": [None], "modelo": None})

    def test_sin_secreto_401(self):
        for secreto in (None, "otro"):
            with self.assertRaises(HTTPError) as e:
                self._pedir({"textos": ["a"], "vocabulario": "prensa", "idioma": "es"}, secreto=secreto)
            self.assertEqual(e.exception.code, 401)

    def test_cuerpo_invalido_400(self):
        with self.assertRaises(HTTPError) as e:
            self._pedir({"textos": ["a"], "vocabulario": "postura", "idioma": "es"})
        self.assertEqual(e.exception.code, 400)

    def test_get_calienta(self):
        estado, cuerpo = self._pedir()
        self.assertEqual(estado, 200)
        self.assertEqual(cuerpo["listo"], True)

    def test_una_falla_del_modelo_vuelve_como_500_con_su_tipo(self):
        # Antes moria sin respuesta y Vercel solo decia FUNCTION_INVOCATION_FAILED.
        class Roto(AnalizadorFalso):
            def predecir(self, textos, lote=32, uno_a_uno=False):
                raise OSError("sin modelo en el cache")
        original = _Falso.analizador_falso
        _Falso.analizador_falso = Roto()
        try:
            with self.assertRaises(HTTPError) as e:
                self._pedir({"textos": ["hola"], "vocabulario": "prensa", "idioma": "es"})
            self.assertEqual(e.exception.code, 500)
            cuerpo = json.loads(e.exception.read().decode("utf-8"))
            self.assertEqual(cuerpo["error"], "OSError")
            self.assertNotIn("hola", json.dumps(cuerpo))
        finally:
            _Falso.analizador_falso = original


if __name__ == "__main__":
    unittest.main()
