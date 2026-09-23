"""Contratos de gasto, identidad y fallos; siempre offline y sin navegador."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from pulso.publicidad_meta import (anuncio_de_texto, armar, combinar_seccion,
    normalizar_anuncios, perfil_vacio, publicar, rango_meta, seccion, url_biblioteca)
from pulso.publicidad_meta_navegador import (cosechar, informacion_de_texto,
    audiencia_de_texto, leer_anuncios, LecturaBloqueada)
from pulso.validador import validar_perfil_meta, validar_publicidad_meta, validar_publicidad_meta_config

RAIZ = Path(__file__).resolve().parents[1]
AHORA = "2026-09-21T18:00:00+00:00"
PID = "257333027729841"
TARJETA = """Inactive
Library ID: 123456
Dec 20, 2023 - Jan 1, 2024
Estimated audience size:
>1M
Amount spent (MXN):
MX$2K - MX$2.5K
Impressions:
150K - 175K
See ad details
Sponsored • Paid for by Ejemplo de prueba
Texto sintético, no es un anuncio real.
Play video
"""


class TestPublicidadMeta(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((RAIZ / "config/publicidad-meta.json").read_text(encoding="utf-8"))
        self.persona = next(p for p in self.config["personas"] if p["id"] == "jarp")
        self.anuncio = anuncio_de_texto(TARJETA, PID, ["Baja California"])
        self.detalle = perfil_vacio(self.persona)
        self.detalle["anuncios"] = seccion(url_biblioteca(PID),
            {"desde": "2024-01-01", "hasta": "2026-09-21"}, estado="ok", datos=[self.anuncio], consultado=AHORA, completo=True)

    def test_catalogo_no_confunde_ine_por_homonimia(self):
        gasto = json.loads((RAIZ / "data/gasto-electoral.json").read_text(encoding="utf-8"))
        self.assertEqual(validar_publicidad_meta_config(self.config, gasto=gasto)[0], [])
        self.persona["ine"]["contienda"] = "Otra elección"
        self.assertTrue(validar_publicidad_meta_config(self.config, gasto=gasto)[0])

    def test_no_admite_pagina_sin_fuente(self):
        self.persona["pagina"]["fuentes"] = []
        self.assertTrue(validar_publicidad_meta_config(self.config)[0])

    def test_no_admite_identificador_de_archivo(self):
        self.persona["id"] = "../archivo"
        self.assertTrue(validar_publicidad_meta_config(self.config)[0])

    def test_rangos_y_decimales_no_son_puntos_medios(self):
        self.assertEqual(self.anuncio["gasto"], {"minimo": 2000, "maximo": 2500})
        self.assertEqual(rango_meta("<100"), {"minimo": None, "maximo": 100})
        self.assertEqual(rango_meta(">1M"), {"minimo": 1000000, "maximo": None})
        self.assertIsNone(rango_meta("Not available"))
        self.anuncio["gasto"]["minimo"] = 5000
        self.assertTrue(validar_perfil_meta(self.detalle, self.config)[0])

    def test_entrega_solapa_el_inicio_no_solo_fecha_creacion(self):
        self.assertEqual(len(normalizar_anuncios([self.anuncio])), 1)
        self.anuncio["hasta"] = "2023-12-31"
        self.assertEqual(normalizar_anuncios([self.anuncio]), [])

    def test_dedupe_por_id_no_por_texto(self):
        otro = dict(self.anuncio, id="789", url="https://www.facebook.com/ads/library/?id=789")
        self.assertEqual(len(normalizar_anuncios([otro, self.anuncio, self.anuncio])), 2)

    def test_grupos_no_se_declaran_completos(self):
        self.anuncio["grupo"] = 5
        self.assertTrue(validar_perfil_meta(self.detalle, self.config)[0])
        self.detalle["anuncios"].update(estado="parcial", completo=False)
        self.assertEqual(validar_perfil_meta(self.detalle, self.config)[0], [])

    def test_anuncio_ajeno_rechazado(self):
        self.anuncio["pagina_id"] = "987"
        self.assertTrue(validar_perfil_meta(self.detalle, self.config)[0])

    def test_url_con_token_no_se_publica(self):
        self.detalle["anuncios"]["fuente"] += "&access_token=secreto-ficticio"
        self.assertTrue(validar_perfil_meta(self.detalle, self.config)[0])

    def test_campos_inesperados_no_se_publican(self):
        self.anuncio["cookies"] = "dato-prohibido"
        self.assertTrue(validar_perfil_meta(self.detalle, self.config)[0])

    def test_fallo_conserva_dato_fecha_y_geografia(self):
        previo = self.detalle["anuncios"]
        previo["geografia"] = "Baja California"
        fallo = seccion(url_biblioteca(PID), estado="fallo", consultado="2026-09-22T18:00:00+00:00", motivo="red")
        resultado = combinar_seccion(previo, fallo)
        self.assertEqual(resultado["datos"], previo["datos"])
        self.assertEqual(resultado["ultimo_exito"], AHORA)
        self.assertEqual(resultado["geografia"], "Baja California")
        self.assertFalse(resultado["completo"])

    def test_cambio_de_pagina_no_hereda_datos(self):
        self.detalle["pagina_id"] = "otro"
        with self.assertRaises(ValueError):
            armar(self.config, {"perfiles": {}, "reporte": {}}, {"jarp": self.detalle})

    def test_captura_no_puede_inventar_identidad(self):
        with self.assertRaises(ValueError):
            armar(self.config, {"perfiles": {"jarp": {"pagina_id": "987"}}, "reporte": {}})

    def test_ausencia_no_es_cero(self):
        indice, _ = armar(self.config, {"perfiles": {}, "reporte": {}})
        self.assertTrue(all(p["anuncios"] is None for p in indice["perfiles"]))
        self.assertEqual(len(indice["perfiles"]), 10)
        self.assertEqual(validar_publicidad_meta(indice, self.config)[0], [])

    def test_cero_audiencia_explicito(self):
        periodo, datos = audiencia_de_texto("Last 7 days (Sep 12, 2026 - Sep 18, 2026)\nAmount spent\n0\nAds\n0", "7")
        self.assertEqual(datos["anuncios"], 0)
        self.assertEqual(datos["importe"], 0)
        self.assertEqual(periodo["desde"], "2026-09-12")

    def test_moneda_no_se_infiere_del_pais(self):
        info = informacion_de_texto("About the advertiser\nPage transparency\nTotal amount spent $123\nAug 4, 2020 - Sep 18, 2026 in Mexico")
        self.assertIsNone(info["totales"][0]["moneda"])
        self.assertEqual(info["totales"][0]["importe"], 123)

    def test_sondeo_bloqueado_no_abre_navegador(self):
        with patch("pulso.publicidad_meta_navegador.permitido_por_robots", return_value=False):
            capturas, sondeos = cosechar(self.config, AHORA, probar=True)
        self.assertTrue(all(s["estado"] == "bloqueado" for s in sondeos))
        self.assertIsNone(capturas["perfiles"]["jarp"]["anuncios"]["datos"])

    def test_serializacion_determinista_e_idempotente(self):
        captura = {"perfiles": {"jarp": {"pagina_id": PID, "anuncios": self.detalle["anuncios"]}}, "reporte": {}}
        with tempfile.TemporaryDirectory() as carpeta:
            publicar(self.config, captura, carpeta)
            rutas = sorted(Path(carpeta).rglob("*.json"))
            primero = {str(p): p.read_bytes() for p in rutas}
            publicar(self.config, copy.deepcopy(captura), carpeta)
            self.assertEqual(primero, {str(p): p.read_bytes() for p in rutas})

    def test_indice_rechaza_detalle_faltante_y_conteo_incorrecto(self):
        indice, detalles = armar(self.config, {"perfiles": {"jarp": {
            "pagina_id": PID, "anuncios": self.detalle["anuncios"]}}})
        self.assertEqual(validar_publicidad_meta(indice, self.config, detalles)[0], [])
        sin_julieta = {k: v for k, v in detalles.items() if k != "jarp"}
        self.assertTrue(validar_publicidad_meta(indice, self.config, sin_julieta)[0])
        next(p for p in indice["perfiles"] if p["id"] == "jarp")["anuncios"] = 999
        self.assertTrue(validar_publicidad_meta(indice, self.config, detalles)[0])

    def test_no_boton_no_significa_paginacion_completa(self):
        pagina = MagicMock()
        pagina.get_by_role.return_value.count.return_value = 0
        pagina.evaluate.side_effect = [[{"texto": TARJETA, "plataformas": [], "video": False}], None]
        pagina.wait_for_function.side_effect = TimeoutError()
        with patch("pulso.publicidad_meta_navegador.esperar", return_value=TARJETA), \
             patch("pulso.publicidad_meta_navegador.comprobar_pagina", return_value=TARJETA):
            resultado = leer_anuncios(pagina, PID, AHORA, 2)
        self.assertFalse(resultado["completo"])
        self.assertEqual(resultado["estado"], "parcial")
        self.assertEqual(len(resultado["datos"]), 1)

    def test_bloqueo_despues_de_tarjetas_detiene_lecturas(self):
        pagina = MagicMock()
        pagina.get_by_role.return_value.count.return_value = 0
        pagina.evaluate.side_effect = [[{"texto": TARJETA, "plataformas": [], "video": False}], None]
        pagina.wait_for_function.side_effect = TimeoutError()
        with patch("pulso.publicidad_meta_navegador.esperar", return_value=TARJETA), \
             patch("pulso.publicidad_meta_navegador.comprobar_pagina", side_effect=[TARJETA, LecturaBloqueada("login")]):
            resultado = leer_anuncios(pagina, PID, AHORA, 2)
        self.assertEqual(pagina.goto.call_count, 1)
        self.assertEqual(resultado["motivo"], "lectura_bloqueada")
        self.assertEqual(len(resultado["datos"]), 1)


if __name__ == "__main__":
    unittest.main()
