"""La portada de Tecate repite el destacado; no debe duplicar ni medir prensa."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pulso.comunicados import correr, derivar, extraer, leer_fuente
from pulso.spiders.noticias import fecha_es
from pulso.validador import validar_comunicados, validar_todo

AHORA = "2026-09-08T18:00:00+00:00"


class TestComunicados(unittest.TestCase):
    def setUp(self):
        self.fuente = leer_fuente("config/comunicados.json")
        self.items = extraer(self.fuente, Path("tests/fixtures/comunicados.html").read_bytes())

    def test_extrae_deduplica_y_normaliza(self):
        self.assertEqual(len(self.items), 3)
        datos = derivar(self.items, self.fuente, AHORA)
        self.assertEqual([f["fecha"] for f in datos["comunicados"]], ["2026-09-08", "2026-09-07", None])
        self.assertEqual(datos["comunicados"][0]["titulo"], "Comunicado municipal de prueba")
        self.assertEqual(validar_comunicados(datos), ([], []))

    def test_fechas_editoriales(self):
        for entrada in ("8 Septiembre 2026", "8 de septiembre de 2026", "8 SEPTIEMBRE 2026"):
            self.assertEqual(fecha_es(entrada), "2026-09-08")
        for entrada in ("31 Febrero 2026", "29 Febrero 2025", "sin fecha"):
            self.assertEqual(fecha_es(entrada), "")
        self.assertEqual(fecha_es("29 Febrero 2024"), "2024-02-29")

    def test_orden_determinista_y_desempate(self):
        extra = dict(self.items[0], url="https://tecate.gob.mx/noticias/288")
        items = self.items + [extra]
        self.assertEqual(derivar(items, self.fuente, AHORA), derivar(items[::-1], self.fuente, AHORA))

    def test_fallo_conserva_y_recuperacion_reemplaza(self):
        anterior = derivar(self.items, self.fuente, AHORA)
        for error in (None, "Fallo de red"):
            fallo = derivar([], self.fuente, "2026-09-09T18:00:00+00:00", anterior, error)
            self.assertEqual(fallo["comunicados"], anterior["comunicados"])
            self.assertEqual(fallo["ultimo_exito"], AHORA)
            self.assertEqual(fallo["estado"], "fallo")
        recuperado = derivar(self.items[:1], self.fuente, AHORA, fallo)
        self.assertEqual(len(recuperado["comunicados"]), 1)

    def test_offline_no_contamina_red(self):
        anterior = derivar(self.items, self.fuente, AHORA, sin_red=True)
        fallo = derivar([], self.fuente, AHORA, anterior)
        self.assertEqual(fallo["comunicados"], [])
        self.assertIsNone(fallo["ultimo_exito"])

    def test_contrato_rechaza_cuerpo_url_y_orden(self):
        for cambio in ("cuerpo", "url", "orden"):
            datos = derivar(self.items, self.fuente, AHORA)
            if cambio == "cuerpo":
                datos["comunicados"][0]["cuerpo"] = "Texto ajeno"
            elif cambio == "url":
                datos["comunicados"][0]["url"] = "javascript:alert(1)"
            else:
                datos["comunicados"].reverse()
            self.assertTrue(validar_comunicados(datos)[0])

    def test_persistencia_idempotente_y_aislada(self):
        with tempfile.TemporaryDirectory() as carpeta:
            prensa = Path(carpeta, "notas.json")
            prensa.write_text('{"notas": []}', encoding="utf-8")
            correr(self.fuente, carpeta, AHORA, sin_red=True)
            ruta = Path(carpeta, "comunicados.json")
            primero = ruta.read_bytes()
            correr(self.fuente, carpeta, AHORA, sin_red=True)
            self.assertEqual(primero, ruta.read_bytes())
            self.assertEqual(prensa.read_text(encoding="utf-8"), '{"notas": []}')
            self.assertEqual(sorted(p.name for p in Path(carpeta).iterdir()), ["comunicados.json", "notas.json"])

    def test_excepcion_de_red_se_publica_como_fallo(self):
        with tempfile.TemporaryDirectory() as carpeta:
            with patch("pulso.scraping.scrapear_medios", side_effect=RuntimeError("sin red")):
                datos = correr(self.fuente, carpeta, AHORA)
            self.assertEqual(datos["estado"], "fallo")
            self.assertEqual(validar_comunicados(datos)[0], [])

    def test_validador_revisa_documento_sin_prensa(self):
        with tempfile.TemporaryDirectory() as carpeta:
            Path(carpeta, "comunicados.json").write_text('{}', encoding="utf-8")
            errores, _ = validar_todo(dir_datos=carpeta, dir_efimero=carpeta)
            self.assertTrue(any("comunicados" in e for e in errores))


if __name__ == "__main__":
    unittest.main()
