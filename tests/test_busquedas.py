"""Pruebas de la cosecha de Google Noticias, siempre sin red.

La red se sustituye en dos puntos: 'pulso.fetch.urlopen' cuando lo que se
prueba es el parseo del XML, y 'feed=' cuando lo que se prueba es cosechar.
El fixture tests/fixtures/google-noticias.xml trae seis items y cada uno fija
un comportamiento distinto; esta escrito con el XML real que devuelve
news.google.com.
"""

import io
import json
import unittest
from unittest.mock import patch

from pulso import busquedas, fetch
from pulso.normalizar import fold, id_nota
from pulso.validador import RE_GN_SOURCE, validar_notas

AHORA = "2026-09-03T18:00:00+00:00"


def leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


with open("tests/fixtures/google-noticias.xml", "rb") as _fh:
    XML = _fh.read()


class _Respuesta(io.BytesIO):
    """Lo minimo que urlopen le da a fetch_rss: read() y headers."""

    headers = {"Content-Type": "application/xml"}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def items_del_fixture():
    with patch.object(fetch, "urlopen", return_value=_Respuesta(XML)):
        return fetch.fetch_rss("https://news.google.com/rss/search?q=x")


class TestFetchSource(unittest.TestCase):
    """El <source> es lo unico que dice de que medio es la nota."""

    def test_extrae_texto_y_url_de_source(self):
        items = items_del_fixture()
        self.assertEqual(items[0]["fuente_texto"], "Zeta Tijuana")
        self.assertEqual(items[0]["fuente_url"], "https://zetatijuana.com")

    def test_un_item_sin_source_deja_las_claves_vacias(self):
        huerfano = [i for i in items_del_fixture()
                    if i["titulo"] == "Titular huerfano sin publicador"][0]
        self.assertEqual(huerfano["fuente_texto"], "")
        self.assertEqual(huerfano["fuente_url"], "")

    def test_los_feeds_del_catalogo_no_se_rompen_sin_source(self):
        # RSS 2.0 normal, sin <source>: las dos claves nuevas salen vacias y
        # el resto del item queda igual que siempre.
        xml = (b'<rss version="2.0"><channel><item>'
               b'<title>Titular</title><link>https://ejemplo.mx/a</link>'
               b'<pubDate>Wed, 02 Sep 2026 14:00:00 GMT</pubDate>'
               b'</item></channel></rss>')
        with patch.object(fetch, "urlopen", return_value=_Respuesta(xml)):
            items = fetch.fetch_rss("https://ejemplo.mx/feed")
        self.assertEqual(items[0]["titulo"], "Titular")
        self.assertEqual(items[0]["fuente_texto"], "")


MEDIO_EJEMPLO = {"id": "ejemplo", "nombre": "Ejemplo", "url": "https://www.ejemplo.mx/feed/"}
MEDIO_CON_CDN = dict(MEDIO_EJEMPLO, imagenes_de=["i0.wp.com"])


def _feed(*items):
    return (b'<?xml version="1.0"?><rss version="2.0" '
            b'xmlns:media="http://search.yahoo.com/mrss/" '
            b'xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>'
            + b"".join(items) + b"</channel></rss>")


def _item(titulo, extra=b""):
    return (b"<item><title>" + titulo + b"</title><link>https://www.ejemplo.mx/" + titulo
            + b"</link><pubDate>Wed, 02 Sep 2026 14:00:00 GMT</pubDate>" + extra + b"</item>")


def _items(xml, medio=MEDIO_EJEMPLO):
    with patch.object(fetch, "urlopen", return_value=_Respuesta(xml)):
        return fetch.fetch_rss("https://www.ejemplo.mx/feed/", medio=medio)


class TestImagenDelFeed(unittest.TestCase):
    """La miniatura sale del feed del propio medio y solo si es del medio.

    Los casos son los del sondeo del 14 de septiembre de 2026 sobre los quince
    feeds del catalogo: enclosure de video en Zeta, sprite de emoji en Tecate,
    stock en Noticias Ensenada, Photon en los medios de San Diego.
    """

    def test_media_thumbnail_del_propio_host(self):
        xml = _feed(_item(b"a", b'<media:thumbnail url="https://www.ejemplo.mx/f/a.jpg"/>'))
        self.assertEqual(_items(xml)[0]["imagen"], "https://www.ejemplo.mx/f/a.jpg")

    def test_subdominio_del_medio_vale(self):
        xml = _feed(_item(b"a", b'<media:content medium="image" url="https://statics.ejemplo.mx/a.jpg"/>'))
        self.assertEqual(_items(xml)[0]["imagen"], "https://statics.ejemplo.mx/a.jpg")

    def test_enclosure_de_video_no_es_imagen(self):
        xml = _feed(_item(b"a", b'<enclosure url="https://www.ejemplo.mx/v.mp4" type="video/mp4" length="1"/>'))
        self.assertIsNone(_items(xml)[0]["imagen"])

    def test_enclosure_de_imagen_si(self):
        xml = _feed(_item(b"a", b'<enclosure url="https://www.ejemplo.mx/a.jpg" type="image/jpeg" length="1"/>'))
        self.assertEqual(_items(xml)[0]["imagen"], "https://www.ejemplo.mx/a.jpg")

    def test_salta_el_sprite_de_emoji_y_toma_el_siguiente_img(self):
        desc = (b'<description>&lt;p&gt;Hola &lt;img class="wp-smiley" src="https://s.w.org/e.png" '
                b'width="72" height="72"&gt; y &lt;img src="https://www.ejemplo.mx/wp/a-1024x682.jpeg" '
                b'width="1024"&gt;&lt;/p&gt;</description>')
        item = _items(_feed(_item(b"a", desc)))[0]
        self.assertEqual(item["imagen"], "https://www.ejemplo.mx/wp/a-1024x682.jpeg")

    def test_ni_una_palabra_de_la_descripcion_llega_al_item(self):
        desc = b"<description>Cuerpo de la nota que no debe guardarse</description>"
        item = _items(_feed(_item(b"a", desc)))[0]
        self.assertEqual(set(item), {"titulo", "url", "fecha_cruda", "fuente_texto", "fuente_url", "imagen"})
        self.assertNotIn("Cuerpo", json.dumps(item))

    def test_content_encoded_tambien(self):
        enc = b'<content:encoded>&lt;img src="https://www.ejemplo.mx/b.jpg"&gt;</content:encoded>'
        self.assertEqual(_items(_feed(_item(b"a", enc)))[0]["imagen"], "https://www.ejemplo.mx/b.jpg")

    def test_stock_y_otro_medio_se_descartan(self):
        xml = _feed(
            _item(b"a", b'<media:content medium="image" url="https://images.pexels.com/x.jpg"/>'),
            _item(b"b", b'<description>&lt;img src="https://zetatijuana.com/wp/z.jpg"&gt;</description>'),
        )
        items = _items(xml)
        self.assertIsNone(items[0]["imagen"])
        self.assertIsNone(items[1]["imagen"])

    def test_cdn_solo_si_la_fila_lo_declara(self):
        xml = _feed(_item(b"a", b'<description>&lt;img src="https://i0.wp.com/ejemplo.mx/a.jpg?fit=640%2C360"&gt;</description>'))
        self.assertIsNone(_items(xml)[0]["imagen"])
        self.assertEqual(_items(xml, MEDIO_CON_CDN)[0]["imagen"],
                         "https://i0.wp.com/ejemplo.mx/a.jpg?fit=640%2C360")

    def test_http_sin_s_y_data_uri_se_rechazan(self):
        xml = _feed(
            _item(b"a", b'<media:thumbnail url="http://www.ejemplo.mx/a.jpg"/>'),
            _item(b"b", b'<description>&lt;img src="data:image/png;base64,AAAA"&gt;</description>'),
        )
        items = _items(xml)
        self.assertIsNone(items[0]["imagen"])
        self.assertIsNone(items[1]["imagen"])

    def test_sin_medio_no_se_busca(self):
        xml = _feed(_item(b"a", b'<media:thumbnail url="https://www.ejemplo.mx/a.jpg"/>'))
        with patch.object(fetch, "urlopen", return_value=_Respuesta(xml)):
            item = fetch.fetch_rss("https://www.ejemplo.mx/feed/")[0]
        self.assertNotIn("imagen", item)


class TestUrlDeBusqueda(unittest.TestCase):
    def test_locale_es_y_en(self):
        es = busquedas.url_de({"q": "san quintin", "idioma": "es"})
        en = busquedas.url_de({"q": "tijuana border", "idioma": "en"})
        self.assertIn("hl=es-419", es)
        self.assertIn("ceid=MX%3Aes-419", es)
        self.assertIn("hl=en-US", en)
        self.assertIn("ceid=US%3Aen", en)

    def test_la_ventana_la_pone_el_cosechador_no_la_consulta(self):
        url = busquedas.url_de({"q": "tecate", "idioma": "es"})
        self.assertIn("when%3A1d", url)

    def test_ventana_por_renglon_gana(self):
        url = busquedas.url_de({"q": "tecate", "idioma": "es", "ventana": "when:7d"})
        self.assertIn("when%3A7d", url)
        self.assertNotIn("when%3A1d", url)

    def test_una_consulta_con_ampersand_no_inyecta_parametros(self):
        # urlencode y no concatenacion: '&hl=en-US' tiene que quedar DENTRO de
        # q, no convertirse en otro parametro que cambie la edicion del feed.
        url = busquedas.url_de({"q": "tecate&hl=en-US", "idioma": "es"})
        self.assertIn("hl=es-419", url)
        self.assertNotIn("&hl=en-US", url)

    def test_es_pura(self):
        b = {"q": "san quintin", "idioma": "es"}
        self.assertEqual(busquedas.url_de(b), busquedas.url_de(b))


class TestTituloSinPublicador(unittest.TestCase):
    def test_quita_el_sufijo_exacto(self):
        t, ok = busquedas.limpiar_titulo("Reportan apagon - Zeta Tijuana", "Zeta Tijuana")
        self.assertEqual(t, "Reportan apagon")
        self.assertTrue(ok)

    def test_no_parte_un_titular_que_contiene_guion(self):
        # El caso testigo: un recorte por el ultimo ' - ' dejaria
        # 'Tijuana - San Diego: la garita cierra el domingo' en 'Tijuana'.
        t, ok = busquedas.limpiar_titulo(
            "Tijuana - San Diego: la garita cierra el domingo - Zeta Tijuana",
            "Zeta Tijuana")
        self.assertEqual(t, "Tijuana - San Diego: la garita cierra el domingo")
        self.assertTrue(ok)

    def test_sin_publicador_no_recorta(self):
        t, ok = busquedas.limpiar_titulo("Titular - Otro Medio", "")
        self.assertEqual(t, "Titular - Otro Medio")
        self.assertFalse(ok)

    def test_publicador_que_no_empata_no_recorta(self):
        t, ok = busquedas.limpiar_titulo("Titular - Otro Medio", "Zeta Tijuana")
        self.assertEqual(t, "Titular - Otro Medio")
        self.assertFalse(ok)


class TestIdentidadDelPublicador(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.medios = leer("config/medios.json")["medios"]
        cls.alias = leer("config/busquedas.json")["publicadores"]

    def cosechar(self, alias=None, **kw):
        return busquedas.cosechar(
            [{"id": "bq_prueba", "nombre": "Prueba", "q": "x", "idioma": "es",
              "activo": True}],
            self.medios, ahora=AHORA, alias=alias,
            feed=lambda *_a, **_k: items_del_fixture(), **kw)

    def test_dominio_conocido_usa_el_id_del_catalogo(self):
        items, _ = self.cosechar()
        zeta = [i for i in items if i["medio"]["id"] == "zeta"]
        self.assertTrue(zeta)
        self.assertEqual(zeta[0]["item"]["dominio"], "zetatijuana.com")

    def test_el_id_empata_con_el_de_la_copia_del_feed_directo(self):
        # La razon de ser de todo el diseño de identidad: la copia que trae
        # Google y la que trae el feed de Zeta tienen que ser la MISMA nota.
        items, _ = self.cosechar()
        zeta = [i for i in items
                if i["item"]["titulo"] == "Reportan apagon en la zona centro"][0]
        self.assertEqual(id_nota(zeta["medio"]["id"], zeta["item"]["titulo"]),
                         id_nota("zeta", "Reportan apagon en la zona centro"))

    def test_dominio_de_grupo_cae_a_sintetica_sin_alias(self):
        items, salud = self.cosechar(alias=None)
        sol = [i for i in items if "bulevar" in i["item"]["titulo"]][0]
        self.assertTrue(RE_GN_SOURCE.match(sol["medio"]["id"]))

    def test_el_alias_a_mano_resuelve_el_dominio_de_grupo(self):
        items, _ = self.cosechar(alias=self.alias)
        sol = [i for i in items if "bulevar" in i["item"]["titulo"]][0]
        self.assertEqual(sol["medio"]["id"], "soltij")
        self.assertEqual(sol["item"]["dominio"], "elsoldetijuana.com.mx")

    def test_publicador_desconocido_es_gn_hash_estable(self):
        items, _ = self.cosechar()
        valle = [i for i in items if "Productores" in i["item"]["titulo"]][0]
        self.assertTrue(RE_GN_SOURCE.match(valle["medio"]["id"]))
        self.assertEqual(valle["medio"]["id"],
                         busquedas._fuente_sintetica("elvalledesq.example"))
        self.assertEqual(valle["medio"]["zona"], "estatal")

    def test_ninguna_nota_queda_con_el_dominio_de_google(self):
        items, _ = self.cosechar()
        self.assertTrue(items)
        for i in items:
            self.assertNotIn("google", i["item"]["dominio"])

    def test_el_nombre_no_resuelve_un_dominio(self):
        # Los dos mapas van separados: si fueran uno, el nombre plegado de un
        # medio podria satisfacer una busqueda por dominio.
        por_dominio, por_nombre = busquedas.indice_publicadores(self.medios)
        self.assertIn("zetatijuana.com", por_dominio)
        self.assertNotIn(fold("Zeta Tijuana"), por_dominio)
        self.assertIn(fold("Zeta Tijuana"), por_nombre)


class TestCosecha(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.medios = leer("config/medios.json")["medios"]

    def busqueda(self, bid="bq_prueba"):
        return {"id": bid, "nombre": "Prueba", "q": "x", "idioma": "es", "activo": True}

    def test_descarta_lo_fuera_de_ventana_y_lo_reporta(self):
        items, salud = busquedas.cosechar(
            [self.busqueda()], self.medios, ahora=AHORA,
            feed=lambda *_a, **_k: items_del_fixture())
        self.assertEqual(salud[0]["detalle"]["fuera_de_ventana"], 1)
        self.assertNotIn("Nota vieja", [i["item"]["titulo"] for i in items])

    def test_descarta_lo_que_no_trae_publicador_y_lo_reporta(self):
        _items, salud = busquedas.cosechar(
            [self.busqueda()], self.medios, ahora=AHORA,
            feed=lambda *_a, **_k: items_del_fixture())
        self.assertEqual(salud[0]["detalle"]["sin_publicador"], 1)

    def test_una_busqueda_caida_es_salud_no_excepcion(self):
        def rota(*_a, **_k):
            raise fetch.NoEsFeed("respuesta HTML, no RSS; consentimiento de Google")
        items, salud = busquedas.cosechar(
            [self.busqueda()], self.medios, ahora=AHORA, feed=rota)
        self.assertEqual(items, [])
        self.assertEqual(salud[0]["estado"], "fallo")
        self.assertIn("NoEsFeed", salud[0]["error"])
        self.assertIsNone(salud[0]["ultima_ok"])

    def test_un_renglon_de_salud_por_busqueda(self):
        _items, salud = busquedas.cosechar(
            [self.busqueda("bq_una"), self.busqueda("bq_otra")], self.medios,
            ahora=AHORA, feed=lambda *_a, **_k: items_del_fixture())
        self.assertEqual([s["id"] for s in salud], ["bq_una", "bq_otra"])
        for s in salud:
            self.assertEqual(s["metodo"], "busqueda")
            self.assertEqual(s["zona"], "estatal")

    def test_el_presupuesto_se_reparte_y_no_se_lo_come_la_primera(self):
        # La regresion del 8 de septiembre de 2026: con el tope global por
        # orden de llegada, las dos primeras busquedas se llevaban las 40 y
        # las otras cuatro traian cero. El cupo es por busqueda, no una
        # carrera.
        seis = [self.busqueda("bq_n{}".format(i)) for i in range(6)]
        _items, salud = busquedas.cosechar(
            seis, self.medios, ahora=AHORA,
            feed=lambda *_a, **_k: items_del_fixture(),
            max_por_corrida=12)
        self.assertTrue(all(s["obtenidas"] > 0 for s in salud),
                        [s["obtenidas"] for s in salud])

    def test_respeta_el_cupo_por_busqueda(self):
        _items, salud = busquedas.cosechar(
            [self.busqueda()], self.medios, ahora=AHORA,
            feed=lambda *_a, **_k: items_del_fixture(),
            max_por_busqueda=1, max_por_corrida=1)
        self.assertEqual(salud[0]["obtenidas"], 1)
        self.assertEqual(salud[0]["detalle"]["recortadas"], 3)

    def test_lo_recortado_no_cuenta_como_resuelto(self):
        # resueltas + sinteticas tiene que sumar obtenidas, o el detalle
        # describe lo que se habria llevado y no lo que se llevo.
        _items, salud = busquedas.cosechar(
            [self.busqueda()], self.medios, ahora=AHORA,
            feed=lambda *_a, **_k: items_del_fixture(),
            max_por_busqueda=2, max_por_corrida=2)
        d = salud[0]["detalle"]
        self.assertEqual(d["resueltas"] + d["sinteticas"], salud[0]["obtenidas"])

    def test_dos_cosechas_del_mismo_xml_dan_el_mismo_orden(self):
        def corre():
            items, _ = busquedas.cosechar(
                [self.busqueda()], self.medios, ahora=AHORA,
                feed=lambda *_a, **_k: items_del_fixture())
            return [(i["medio"]["id"], i["item"]["titulo"]) for i in items]
        self.assertEqual(corre(), corre())

    def test_activas_ignora_las_apagadas(self):
        doc = {"busquedas": [{"id": "bq_a", "activo": True},
                             {"id": "bq_b", "activo": False},
                             {"id": "bq_c"}]}
        self.assertEqual([b["id"] for b in busquedas.activas(doc)], ["bq_a", "bq_c"])
        self.assertEqual(busquedas.activas(None), [])

    def test_salud_sin_red_no_construye_red_ni_mide_reloj(self):
        salud = busquedas.salud_sin_red([self.busqueda()], AHORA, {})
        self.assertEqual(salud[0]["ms"], 0)
        self.assertEqual(salud[0]["estado"], "fallo")
        self.assertIn("sin red", salud[0]["error"])


class TestContratoDeNotaDeBusqueda(unittest.TestCase):
    """Autocontenidas, al estilo de tests/test_descubrimiento.py."""

    def nota(self, **cambios):
        fuente = "gn-" + "a" * 12
        titulo = "Productores del valle piden agua"
        base = {
            "id": id_nota(fuente, titulo), "titulo": titulo,
            "url": "https://news.google.com/rss/articles/CBMi?oc=5",
            "dominio": "elvalledesq.example", "fuente": fuente,
            "zona_medio": "estatal", "zonas": ["San Quintín"], "delegaciones": [],
            "alcance": "zona", "fecha": "2026-09-02",
            "publicado": "2026-09-02T10:00:00+00:00",
            "capturado": AHORA, "figuras": [], "postura": None,
            "origen": "busqueda_web", "descubierta_por": "bq_sanquintin",
        }
        base.update(cambios)
        if "titulo" in cambios or "fuente" in cambios:
            base["id"] = id_nota(base["fuente"], base["titulo"])
        return base

    def validar(self, nota, medios=None, busq=None):
        return validar_notas({"esquema": 1, "total": 1, "notas": [nota]},
                             medios=medios if medios is not None else [],
                             busquedas=busq if busq is not None
                             else [{"id": "bq_sanquintin"}])[0]

    def test_fuente_sintetica_valida(self):
        self.assertEqual(self.validar(self.nota()), [])

    def test_fuente_del_catalogo_valida_con_la_zona_del_medio(self):
        medios = [{"id": "zeta", "zona": "Tijuana", "activo": True}]
        nota = self.nota(fuente="zeta", zona_medio="Tijuana")
        self.assertEqual(self.validar(nota, medios=medios), [])

    def test_fuente_del_catalogo_con_zona_equivocada_es_error(self):
        # La rama que un espejo ingenuo de 'es_descubrimiento' se saltaria.
        medios = [{"id": "zeta", "zona": "Tijuana", "activo": True}]
        nota = self.nota(fuente="zeta", zona_medio="estatal")
        errores = self.validar(nota, medios=medios)
        self.assertTrue(any("zona_medio" in e for e in errores), errores)

    def test_sintetica_con_zona_que_no_es_estatal_es_error(self):
        nota = self.nota(zona_medio="Tijuana")
        errores = self.validar(nota, medios=[{"id": "zeta", "zona": "Tijuana"}])
        self.assertTrue(any("estatal" in e for e in errores), errores)

    def test_descubierta_por_fuera_del_config_es_error(self):
        # Borrar un renglon de config/busquedas.json invalida el historico que
        # trajo y deja sin idioma a sus fuentes sinteticas.
        errores = self.validar(self.nota(), busq=[{"id": "bq_otra"}])
        self.assertTrue(any("busquedas.json" in e for e in errores), errores)

    def test_fuente_arbitraria_es_error(self):
        nota = self.nota(fuente="inventada")
        errores = self.validar(nota, medios=[{"id": "zeta", "zona": "Tijuana"}])
        self.assertTrue(errores)


if __name__ == "__main__":
    unittest.main()
