"""Contratos del lector de la API oficial; siempre offline, sin red ni token.

El limite HTTP se inyecta (`abrir`), como en el resto del repositorio se
inyecta el reloj. Ninguna prueba toca graph.facebook.com.
"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pulso.publicidad_meta import armar, perfil_vacio, publicar, seccion, url_biblioteca
from pulso.publicidad_meta_api import (_rango, anuncio_de_api, cosechar,
                                       descubrir, token)
from pulso.validador import validar_perfil_meta, validar_publicidad_meta

RAIZ = Path(__file__).resolve().parents[1]
AHORA = "2026-09-22T18:00:00+00:00"
PID = "257333027729841"

FILA = {
    "id": "987654321",
    "page_id": PID,
    "page_name": "Julieta Ramirez",
    "ad_delivery_start_time": "2026-08-07T00:00:00+0000",
    "ad_delivery_stop_time": "2026-09-03T00:00:00+0000",
    "ad_creative_bodies": ["Texto sintetico, no es un anuncio real."],
    "bylines": "Julieta Ramirez",
    "currency": "MXN",
    "spend": {"lower_bound": "2000", "upper_bound": "2500"},
    "impressions": {"lower_bound": "150000", "upper_bound": "175000"},
    "estimated_audience_size": {"lower_bound": "500000", "upper_bound": "1000000"},
    "publisher_platforms": ["INSTAGRAM", "FACEBOOK"],
    "delivery_by_region": [{"region": "Baja California", "percentage": "0.83"}],
    "demographic_distribution": [
        {"age": "25-34", "gender": "female", "percentage": "0.21"},
        {"age": "18-24", "gender": "male", "percentage": "0.10"}],
    # Meta devuelve la instantanea con el token pegado. No debe publicarse.
    "ad_snapshot_url": "https://www.facebook.com/ads/archive/render_ad/?id=987654321&access_token=SECRETO",
}


class RespuestaFalsa:
    def __init__(self, cuerpo):
        self._cuerpo = json.dumps(cuerpo).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self._cuerpo


def abridor(*paginas):
    """Un `abrir` que sirve las paginas dadas en orden y cuenta llamadas."""
    restantes = list(paginas)
    llamadas = []

    def abrir(peticion, timeout=None):
        llamadas.append(peticion.full_url)
        return RespuestaFalsa(restantes.pop(0) if restantes else {"data": []})

    abrir.llamadas = llamadas
    return abrir


class TestPublicidadMetaApi(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((RAIZ / "config/publicidad-meta.json").read_text(encoding="utf-8"))
        self.persona = next(p for p in self.config["personas"] if p["id"] == "jarp")

    # -- mapeo ------------------------------------------------------------

    def test_mapea_una_fila_al_contrato_del_documento(self):
        a = anuncio_de_api(FILA, PID, "2026-09-22")
        self.assertEqual(a["id"], "987654321")
        self.assertEqual(a["pagina_id"], PID)
        self.assertEqual(a["desde"], "2026-08-07")
        self.assertEqual(a["hasta"], "2026-09-03")
        self.assertEqual(a["estado"], "inactivo")
        self.assertEqual(a["moneda"], "MXN")
        self.assertEqual(a["gasto"], {"minimo": 2000.0, "maximo": 2500.0})
        self.assertEqual(a["plataformas"], ["Facebook", "Instagram"])
        self.assertEqual(a["regiones"], ["Baja California"])
        # La fuente no dice el formato ni agrupa creativos: no se inventan.
        self.assertEqual(a["formato"], "desconocido")
        self.assertIsNone(a["grupo"])

    def test_la_url_se_construye_y_no_arrastra_el_token(self):
        a = anuncio_de_api(FILA, PID, "2026-09-22")
        self.assertEqual(a["url"], "https://www.facebook.com/ads/library/?id=987654321")
        self.assertNotIn("access_token", json.dumps(a))

    def test_un_anuncio_de_otra_pagina_es_error_no_un_dato(self):
        ajena = dict(FILA, page_id="999")
        with self.assertRaises(ValueError):
            anuncio_de_api(ajena, PID, "2026-09-22")

    def test_sigue_entregando_cuando_no_hay_fecha_de_fin(self):
        viva = dict(FILA)
        viva.pop("ad_delivery_stop_time")
        a = anuncio_de_api(viva, PID, "2026-09-22")
        self.assertIsNone(a["hasta"])
        self.assertEqual(a["estado"], "activo")

    def test_rango_abierto_y_rango_vacio(self):
        self.assertEqual(_rango({"lower_bound": "100"}), {"minimo": 100.0, "maximo": None})
        # Sin ningun limite no hay rango: es ausencia, no un cero.
        self.assertIsNone(_rango({}))
        self.assertIsNone(_rango(None))

    def test_desglose_es_texto_y_va_ordenado(self):
        a = anuncio_de_api(FILA, PID, "2026-09-22")
        self.assertEqual([p["etiqueta"] for p in a["entrega"]],
                         ["18-24 male", "25-34 female"])
        self.assertTrue(all(isinstance(p["valor"], str) for p in a["entrega"]))

    # -- cosecha ----------------------------------------------------------

    def test_sin_token_no_escribe_nada(self):
        with patch("pulso.publicidad_meta_api.token", return_value=""):
            with self.assertRaises(RuntimeError) as caso:
                cosechar(self.config, AHORA)
        self.assertIn("token", str(caso.exception).lower())

    def test_la_cosecha_pasa_el_validador_de_extremo_a_extremo(self):
        abrir = abridor({"data": [FILA]})
        capturas, sondeos = cosechar(self.config, AHORA, llave="prueba",
                                     persona_id="jarp", abrir=abrir)
        self.assertEqual([s["estado"] for s in sondeos], ["ok"])
        with tempfile.TemporaryDirectory() as carpeta:
            indice = publicar(self.config, capturas, carpeta)
            self.assertEqual(validar_publicidad_meta(indice, self.config)[0], [])
            detalle = json.loads((Path(carpeta) / "pauta-meta/jarp.json").read_text(encoding="utf-8"))
            self.assertEqual(validar_perfil_meta(detalle, self.config)[0], [])
            self.assertEqual(detalle["anuncios"]["estado"], "ok")

    def test_la_cosecha_conserva_informacion_y_audiencia_previas(self):
        """La API no da esas dos secciones; omitirlas las preserva.

        Es el caso que decide el diseno: emitirlas vacias borraria lo que
        Julieta ya tiene de la transcripcion manual.
        """
        previo = perfil_vacio(self.persona)
        previo["informacion"] = seccion(
            url_biblioteca(PID), {"desde": "2024-01-01", "hasta": "2026-09-21"},
            estado="ok", datos={"transparencia": [{"etiqueta": "Creada", "valor": "2021"}],
                                "totales": [], "pagadores": []},
            consultado="2026-09-21T18:00:00+00:00", completo=True)
        abrir = abridor({"data": [FILA]})
        capturas, _ = cosechar(self.config, AHORA, llave="prueba",
                               persona_id="jarp", abrir=abrir)
        self.assertNotIn("informacion", capturas["perfiles"]["jarp"])
        self.assertNotIn("audiencia", capturas["perfiles"]["jarp"])
        _, detalles = armar(self.config, capturas, {"jarp": previo})
        self.assertEqual(detalles["jarp"]["informacion"]["datos"],
                         previo["informacion"]["datos"])
        self.assertEqual(detalles["jarp"]["anuncios"]["datos"][0]["id"], "987654321")

    def test_una_lectura_truncada_no_se_declara_completa(self):
        siguiente = "https://graph.facebook.com/v21.0/ads_archive?after=abc"
        abrir = abridor({"data": [FILA], "paging": {"next": siguiente}})
        capturas, sondeos = cosechar(self.config, AHORA, llave="prueba",
                                     persona_id="jarp", limite=1, abrir=abrir)
        anuncios = capturas["perfiles"]["jarp"]["anuncios"]
        self.assertEqual(anuncios["estado"], "parcial")
        self.assertFalse(anuncios["completo"])
        self.assertFalse(sondeos[0]["completo"])

    def test_un_fallo_de_la_api_no_borra_ni_miente(self):
        with patch("pulso.publicidad_meta_api._pedir",
                   side_effect=RuntimeError("La API respondio 500")):
            capturas, sondeos = cosechar(self.config, AHORA, llave="prueba",
                                         persona_id="jarp")
        anuncios = capturas["perfiles"]["jarp"]["anuncios"]
        self.assertEqual(anuncios["estado"], "fallo")
        self.assertIsNone(anuncios["datos"])
        self.assertFalse(anuncios["completo"])
        self.assertEqual(sondeos[0]["estado"], "fallo")

    def test_la_consulta_pide_politicos_de_mexico_desde_2024(self):
        abrir = abridor({"data": []})
        cosechar(self.config, AHORA, llave="prueba", persona_id="jarp", abrir=abrir)
        url = abrir.llamadas[0]
        self.assertIn("ad_type=POLITICAL_AND_ISSUE_ADS", url)
        self.assertIn("ad_delivery_date_min=2024-01-01", url)
        self.assertIn("MX", url)

    def test_dos_corridas_iguales_dan_bytes_iguales(self):
        def corrida(carpeta):
            capturas, _ = cosechar(self.config, AHORA, llave="prueba",
                                   persona_id="jarp", abrir=abridor({"data": [FILA]}))
            publicar(self.config, capturas, carpeta)
            return {str(p): p.read_bytes() for p in sorted(Path(carpeta).rglob("*.json"))}

        with tempfile.TemporaryDirectory() as carpeta:
            primera = corrida(carpeta)
            self.assertEqual(primera, corrida(carpeta))

    # -- descubrir --------------------------------------------------------

    def test_descubrir_agrupa_por_pagina_y_no_toca_la_config(self):
        otra = dict(FILA, page_id="111222333", page_name="Otra pagina",
                    bylines="Comite de prueba")
        antes = json.dumps(self.config, sort_keys=True)
        abrir = abridor({"data": [FILA, otra, dict(otra, id="5")]})
        hallados = descubrir(self.config, llave="prueba", persona_id="agc", abrir=abrir)
        self.assertEqual(json.dumps(self.config, sort_keys=True), antes)
        candidatos = hallados[0]["candidatos"]
        # Ordenados por cuantos anuncios sostienen la coincidencia.
        self.assertEqual(candidatos[0]["pagina_id"], "111222333")
        self.assertEqual(candidatos[0]["anuncios"], 2)
        self.assertEqual(candidatos[0]["pagadores"], ["Comite de prueba"])

    def test_descubrir_ignora_a_quien_ya_tiene_pagina(self):
        abrir = abridor({"data": []})
        hallados = descubrir(self.config, llave="prueba", abrir=abrir)
        self.assertNotIn("jarp", [h["id"] for h in hallados])
        self.assertNotIn("mpao", [h["id"] for h in hallados])

    def test_token_vacio_cuando_no_hay_variable(self):
        self.assertEqual(token({"OTRA": "x"}), "")
        self.assertEqual(token({"META_ADS_TOKEN": "abc"}), "abc")


if __name__ == "__main__":
    unittest.main()
