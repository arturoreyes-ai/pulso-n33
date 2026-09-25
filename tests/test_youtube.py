"""Shorts y videos de YouTube por feed publico. Siempre sin red.

Las fixtures de tests/fixtures/youtube/ son feeds Atom REALES recortados, y se
parsean con el parser de verdad: el parser es lo que se prueba. La red se
sustituye parcheando `youtube.leer_feed`, que existe justo para eso.

Los casos con nombre propio, todos medidos el 18 de septiembre de 2026:

- El Vigia: su fila decia Ensenada y nueve de sus quince Shorts son
  nacionales, con el mas visto del corredor hablando de Trump y la UE.
- Zeta: su lista UULF, la de "solo videos largos", devolvio diez entradas con
  enlace /shorts/. Es la prueba de que la lista no clasifica y el enlace si.
- televisamxl: su lista UUSH devuelve 404 porque el canal no tiene Shorts.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from pulso import youtube
from pulso.normalizar import fold
from pulso.validador import (PLATAFORMAS_REDES, validar_redes, validar_youtube_config)

AHORA = "2026-09-18T18:00:00+00:00"
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "youtube")


def _fixture(nombre):
    with open(os.path.join(FIXTURES, nombre), "rb") as f:
        return f.read()


def _canal(cid="yt_prueba", **extra):
    fila = {"id": cid, "nombre": "Canal de prueba", "canal": "UCIN8fNpieOt_gCE1sKyUylA",
            "formatos": ["short", "video"], "ambito": "regional", "idioma": "es",
            "activo": True, "verificado": "2026-09-18", "nota": "fixture"}
    fila.update(extra)
    return fila


class TestListas(unittest.TestCase):
    """El prefijo de la lista automatica, que es de lo que cuelga todo."""

    def test_el_uc_se_reemplaza_no_se_antepone(self):
        # La unica afirmacion sobre la que descansa la fuente entera. Un
        # `"UUSH" + canal` daria UUSHUCIN... y el feed devolveria 404 para
        # todos los canales a la vez.
        self.assertEqual(youtube._lista("UCIN8fNpieOt_gCE1sKyUylA", "short"),
                         "UUSHIN8fNpieOt_gCE1sKyUylA")
        self.assertEqual(youtube._lista("UCIN8fNpieOt_gCE1sKyUylA", "video"),
                         "UULFIN8fNpieOt_gCE1sKyUylA")

    def test_el_enlace_decide_el_formato_no_la_lista(self):
        self.assertEqual(
            youtube._formato_del_enlace("https://www.youtube.com/shorts/abc"), "short")
        self.assertEqual(
            youtube._formato_del_enlace("https://www.youtube.com/watch?v=abc"), "video")
        self.assertIsNone(youtube._formato_del_enlace("https://www.youtube.com/playlist?list=x"))


class TestCosecha(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _cosechar(self, canales, feeds):
        """feeds: dict {id_de_lista: bytes o excepcion}."""
        def falso(url, timeout=15):
            clave = url.rsplit("=", 1)[-1]
            v = feeds.get(clave)
            if v is None:
                raise youtube.SinLista(url)
            if isinstance(v, Exception):
                raise v
            return v
        with patch.object(youtube, "leer_feed", side_effect=falso):
            return youtube.cosechar(canales, AHORA, cache=self.dir)

    def test_la_lista_de_videos_trae_shorts_y_manda_el_enlace(self):
        # El caso Zeta: diez de las entradas de su lista "solo videos largos"
        # tienen enlace /shorts/. Descartarlas perderia diez Shorts reales.
        c = _canal("yt_zeta", canal="UC-NHHkALnId41yENpdCuLKQ")
        pubs, salud = self._cosechar([c], {"UULF-NHHkALnId41yENpdCuLKQ":
                                           _fixture("zeta-videos.xml")})
        formatos = {}
        for p in pubs.values():
            formatos[p["formato"]] = formatos.get(p["formato"], 0) + 1
        # De las diez, seis entran y cuatro nombran lugares de fuera de Baja
        # California, asi que el ambito regional las tira. Ninguna se pierde
        # por venir en la lista "equivocada", que es lo que se prueba aqui.
        self.assertEqual(formatos.get("short"), 6)
        self.assertEqual(formatos.get("video"), 2)
        self.assertEqual(salud[0]["fuera"], 4)
        # Y la discrepancia se cuenta: es el aviso de que el prefijo dejo de
        # significar lo que creemos.
        self.assertEqual(salud[0]["reclasificados"], 6)
        self.assertEqual(salud[0]["descartados"], 0)

    def test_un_formato_apagado_en_el_config_manda_sobre_la_lista(self):
        # El Vigia entra con formatos ["short"] porque sus videos son digestos
        # diarios. Un Short que aparezca en la lista de videos si entra; un
        # video, no.
        c = _canal("yt_zeta", canal="UC-NHHkALnId41yENpdCuLKQ", formatos=["short"])
        pubs, salud = self._cosechar([c], {"UUSH-NHHkALnId41yENpdCuLKQ":
                                           _fixture("zeta-videos.xml")})
        self.assertTrue(pubs)
        self.assertTrue(all(p["formato"] == "short" for p in pubs.values()))
        self.assertEqual(salud[0]["descartados"], 2)

    def test_el_404_es_hueco_medido_y_no_falla(self):
        # televisamxl: el canal no tiene lista de Shorts. Un `fallo` diria que
        # algo se rompio y un `ok` con posts 0 diria que hoy no publico.
        c = _canal("yt_televisamxl", canal="UCcmuFsMIIIHO3LBqeBVfm8Q")
        _, salud = self._cosechar([c], {})
        self.assertEqual(salud[0]["estado"], "sin_lista")
        self.assertEqual(salud[0]["posts"], 0)
        self.assertIn("nota", salud[0])

    def test_un_error_de_red_si_es_falla_y_la_corrida_sigue(self):
        malo = _canal("yt_malo", canal="UCcmuFsMIIIHO3LBqeBVfm8Q", formatos=["short"])
        bueno = _canal("yt_bueno", canal="UCIN8fNpieOt_gCE1sKyUylA", formatos=["short"])
        _, salud = self._cosechar([malo, bueno], {
            "UUSHcmuFsMIIIHO3LBqeBVfm8Q": HTTPError("u", 500, "boom", None, None),
            "UUSHIN8fNpieOt_gCE1sKyUylA": _fixture("elvigia-shorts.xml"),
        })
        estados = {s["cuenta"]: s["estado"] for s in salud}
        self.assertEqual(estados["yt_malo"], "fallo")
        self.assertEqual(estados["yt_bueno"], "ok")

    def test_un_canal_apagado_no_se_lee(self):
        c = _canal("yt_off", activo=False)
        pubs, salud = self._cosechar([c], {})
        self.assertEqual(pubs, {})
        self.assertEqual(salud, [])

    def test_el_catalogo_conserva_una_pieza_que_salio_del_feed(self):
        # Milenio publica ~29 piezas al dia y el feed devuelve 15, asi que una
        # puede salirse DENTRO de la ventana de 24 horas. Sin catalogo
        # desapareceria del corte a media ventana.
        c = _canal("yt_elvigia", formatos=["short"])
        feed = {"UUSHIN8fNpieOt_gCE1sKyUylA": _fixture("elvigia-shorts.xml")}
        primera, _ = self._cosechar([c], feed)
        self.assertTrue(primera)
        vacio = b'<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'
        segunda, _ = self._cosechar([c], {"UUSHIN8fNpieOt_gCE1sKyUylA": vacio})
        self.assertEqual(set(primera), set(segunda))


class TestZona(unittest.TestCase):
    """La zona sale del pie, nunca de la fila del canal."""

    def test_la_zona_del_canal_nunca_se_consulta(self):
        # La guardia directa contra el error que documenta el encabezado: la
        # tercera rama de zonas.alcance cree la zona declarada del medio, y es
        # justo lo que los nueve Shorts nacionales de El Vigia desmienten.
        # La regla de titulo y descripcion vive en redes.zona_por_titulo desde
        # el 22 de septiembre de 2026, asi que el espia va alli; y el
        # gacetero que se llama al final es zonas.alcance, via alcance_redes.
        c = _canal(ambito="regional")
        entrada = _entrada_suelta(_fixture("elvigia-shorts.xml"))
        with patch("pulso.redes.zona_por_ambito",
                   return_value=("Tijuana", "zona")) as espia:
            youtube._limpiar_pieza(entrada, c, "short")
        self.assertEqual(espia.call_args[0][1], "regional")
        with patch("pulso.zonas.alcance", return_value=("zona", ["Tijuana"])) as gac:
            youtube._limpiar_pieza(entrada, c, "short")
        self.assertIsNone(gac.call_args[0][1],
                          "el segundo argumento de alcance() tiene que ser None: es la zona "
                          "declarada del medio y creersela es el bug de El Vigia")

    def test_la_tabla_de_ambitos(self):
        from pulso.redes import zona_por_ambito
        # (veredicto del gacetero, {ambito: zona esperada}). Lista y no dict
        # porque el veredicto lleva una lista dentro.
        casos = [
            (("zona", ["Tecate"]), {"regional": "Tecate", "nacional": "Tecate",
                                    "internacional": "Tecate"}),
            (("estatal", ["estatal"]), {"regional": "estatal", "nacional": "estatal",
                                        "internacional": "estatal"}),
            (("fuera", []), {"regional": None, "nacional": "nacional",
                             "internacional": "nacional"}),
            (("extranjero", []), {"regional": "internacional", "nacional": "internacional",
                                  "internacional": "internacional"}),
            (("nacional", []), {"regional": "nacional", "nacional": "nacional",
                                "internacional": "internacional"}),
        ]
        for veredicto, esperado in casos:
            for ambito, zona in esperado.items():
                with patch("pulso.redes.alcance_redes", return_value=veredicto):
                    self.assertEqual(zona_por_ambito("t", ambito)[0], zona,
                                     "{} con ambito {}".format(veredicto, ambito))

    def test_la_descripcion_zonifica_pero_no_se_publica(self):
        # Vale 8 puntos de resolucion (65% contra 57%), y es el unico punto del
        # modulo por donde podria fugarse un cuerpo.
        entrada = _entrada_suelta(_fixture("canal33-videos.xml"), 1)
        limpio, _ = youtube._limpiar_pieza(entrada, _canal(), "video")
        self.assertIsNotNone(limpio)
        for clave in ("descripcion", "resumen", "cuerpo", "texto"):
            self.assertNotIn(clave, limpio)

    def test_la_firma_del_canal_es_evidencia_debil(self):
        # El caso del 22 de septiembre de 2026: 17 de 43 titulos de Telemundo
        # 20 terminan en "| TELEMUNDO SAN DIEGO", y esa firma mandaba al muro
        # de San Diego un helicoptero caido en Los Angeles.
        titulo = ("Tres muertos tras caída del helicóptero de Telemundo 52 y NBC4 en "
                  "Los Ángeles | Telemundo San Diego")
        firma = ["| TELEMUNDO SAN DIEGO"]
        self.assertEqual(youtube._zona(titulo, "", "internacional"), ("San Diego", "zona"))
        self.assertEqual(youtube._zona(titulo, "", "internacional", firma),
                         ("internacional", "extranjero"))
        # Pero quitarla sin mas era peor: casi todo lo demas que firma es de San
        # Diego, en barrios que el gacetero no conoce, y sin la firma se iria a
        # Mundo. Mientras el texto no nombre otro lugar, la firma cuenta.
        for local in ("Arrestan a hombre tras persecución en Pacific Beach | TELEMUNDO SAN DIEGO",
                      "Hombre ataca a agentes tras ser sentenciado | TELEMUNDO SAN DIEGO"):
            with self.subTest(titulo=local):
                self.assertEqual(youtube._zona(local, "", "internacional", firma),
                                 ("San Diego", "zona"))
        # Una pieza que nombra San Diego de verdad lo sigue siendo.
        self.assertEqual(
            youtube._zona("Choque en Chula Vista con un camion de Texas | TELEMUNDO SAN DIEGO",
                          "", "internacional", firma),
            ("San Diego", "zona"))
        # Y el corte es exacto: una firma que no esta al final no es firma.
        self.assertEqual(
            youtube._zona("TELEMUNDO SAN DIEGO: lo que paso hoy en Los Angeles", "",
                          "internacional", firma),
            ("San Diego", "zona"))

    def test_el_residuo_de_un_canal_del_corredor_es_corredor_sin_precisar(self):
        # El caso del 22 de septiembre de 2026: 39 de 233 piezas de los canales
        # regionales caian en la cubeta Mexico, y casi todas eran nota local
        # que no escribe su ciudad.
        self.assertEqual(youtube._zona("Sindicatura fiscaliza a jireh", "", "regional"),
                         ("estatal", "nacional"))
        # Si nombra a Mexico es nota nacional dicha por un medio local.
        self.assertEqual(
            youtube._zona("Comienza la era Rafael Marquez con la seleccion mexicana", "",
                          "regional"),
            ("nacional", "nacional"))
        # Y un canal nacional conserva su residuo nacional, como siempre.
        self.assertEqual(youtube._zona("Sindicatura fiscaliza a jireh", "", "nacional"),
                         ("nacional", "nacional"))

    def test_la_firma_se_quita_solo_para_zonificar(self):
        # Lo publicado sigue siendo el titular del canal, tal cual.
        entrada = _entrada_suelta(_fixture("canal33-videos.xml"), 1)
        original, _ = youtube._limpiar_pieza(entrada, _canal(), "video")
        palabras = original["titulo"].split()
        firma = " ".join(palabras[-2:])
        limpio, _ = youtube._limpiar_pieza(entrada, _canal(sufijos_titulo=[firma]), "video")
        self.assertEqual(limpio["titulo"], original["titulo"])

    def test_un_lugar_de_fuera_se_tira_en_ambito_regional(self):
        entrada = _entrada_suelta(_fixture("elvigia-shorts.xml"))
        with patch("pulso.redes.alcance_redes", return_value=("fuera", [])):
            limpio, motivo = youtube._limpiar_pieza(entrada, _canal(ambito="regional"), "short")
            self.assertIsNone(limpio)
            self.assertEqual(motivo, "fuera")
            limpio, _ = youtube._limpiar_pieza(entrada, _canal(ambito="nacional"), "short")
            self.assertEqual(limpio["zona"], "nacional")
            self.assertEqual(limpio["alcance"], "fuera")


class TestDocumento(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _panel(self, canales, feeds):
        def falso(url, timeout=15):
            v = feeds.get(url.rsplit("=", 1)[-1])
            if v is None:
                raise youtube.SinLista(url)
            return v
        with patch.object(youtube, "leer_feed", side_effect=falso):
            pubs, salud = youtube.cosechar(canales, AHORA, cache=self.dir)
        return youtube.derivar(AHORA, salud, pubs, canales), pubs, salud

    def _todo(self):
        canales = [_canal("yt_zeta", canal="UC-NHHkALnId41yENpdCuLKQ"),
                   _canal("yt_canal33", canal="UCZmZ8OjbrweO1neWu6NJtGA"),
                   _canal("yt_elvigia", canal="UCIN8fNpieOt_gCE1sKyUylA", ambito="nacional")]
        return self._panel(canales, {
            "UULF-NHHkALnId41yENpdCuLKQ": _fixture("zeta-videos.xml"),
            "UULFZmZ8OjbrweO1neWu6NJtGA": _fixture("canal33-videos.xml"),
            "UUSHIN8fNpieOt_gCE1sKyUylA": _fixture("elvigia-shorts.xml"),
        })

    def test_el_titulo_manda_sobre_la_descripcion(self):
        # El caso del 18 de septiembre de 2026: "Intocable recorre por primera
        # vez las calles del centro de CDMX", de N+, salio `zona: Tijuana` con
        # `alcance: "zona"` y encabezo el muro de Tijuana. El titulo nombra la
        # capital; la descripcion nombraba Tijuana de paso, en una lista de
        # fechas de gira. Una descripcion de YouTube trae giras, listas de
        # ciudades y texto fijo del canal: no puede mover un titular que ya
        # nombro lugar.
        titulo = "Intocable recorre por primera vez las calles del centro de CDMX"
        gira = "Gira 2026: Monterrey, Tijuana y Guadalajara"
        self.assertEqual(youtube._zona(titulo, gira, "nacional"), ("nacional", "fuera"))
        self.assertEqual(youtube._zona(titulo, gira, "regional"), (None, "fuera"))
        # Y el titulo que SI nombra la region tampoco se deja mover.
        self.assertEqual(youtube._zona("Choque en Tijuana", "ocurrio en Ensenada",
                                       "regional"), ("Tijuana", "zona"))

    def test_la_descripcion_sigue_desempatando_cuando_el_titulo_calla(self):
        # Los catorce puntos que la descripcion aporta no se tiran: solo se
        # limitan al caso para el que se agrego. "Esto exigieron trabajadores
        # de TELNOR a Sheinbaum" no nombra lugar y es de Tijuana.
        self.assertEqual(
            youtube._zona("Esto exigieron trabajadores de TELNOR a Sheinbaum",
                          "Los trabajadores se manifestaron en Tijuana", "regional"),
            ("Tijuana", "zona"))

    def test_un_mismo_canal_no_repite_titular_en_los_dos_formatos(self):
        # El caso del 18 de septiembre de 2026: CNR subio "LOCALIZAN A HOMBRE
        # SIN VIDA..." como Short y como video largo y las dos entraron --- el
        # corte es por formato, asi que cada una gano su lugar en su propia
        # cola y nada las cruzaba. En pantalla eran dos tarjetas seguidas
        # diciendo lo mismo.
        from pulso.redes import _destacados
        pubs = {}
        for i, (fmt, vistas) in enumerate((("short", 10), ("video", 900))):
            url = "https://www.youtube.com/x{}".format(i)
            pubs[url] = {"url": url, "cuenta": "yt_cnr", "zona": "Tijuana", "formato": fmt,
                         "fecha": "2026-09-18", "titulo": "Localizan a hombre sin vida",
                         "tipo": "video", "publicado": "2026-09-18T12:00:00+00:00",
                         "reproducciones": vistas, "valoraciones": 0}
        # Otra cuenta con el MISMO titular no se toca: dos medios cubriendo lo
        # mismo es pluralidad de cobertura, no repeticion.
        otra = "https://www.youtube.com/x9"
        pubs[otra] = dict(pubs["https://www.youtube.com/x0"], url=otra, cuenta="yt_zeta")
        comun = dict(comentarios=[], opinion=[], temas=None,
                     cuentas=[{"id": "yt_cnr"}, {"id": "yt_zeta"}], dentro=lambda p: True,
                     cifras=youtube.CIFRAS, orden=youtube.ORDEN, formatos=youtube.FORMATOS,
                     turnos=True)
        sin = _destacados(pubs, **comun)
        con = _destacados(pubs, dedupe_titulo=True, **comun)
        self.assertEqual(len(sin), 3)
        self.assertEqual(len(con), 2)
        # Se queda la mas vista, y la otra cuenta sigue ahi.
        cnr = [d for d in con if d["cuenta"] == "yt_cnr"]
        self.assertEqual(len(cnr), 1)
        self.assertEqual(cnr[0]["reproducciones"], 900)
        self.assertEqual(len([d for d in con if d["cuenta"] == "yt_zeta"]), 1)

    def test_el_documento_valida(self):
        panel, _, _ = self._todo()
        errores, _ = validar_redes(panel, plataforma="youtube")
        self.assertEqual(errores, [])

    def test_el_residuo_del_corredor_valida_en_youtube_y_no_en_tiktok(self):
        # `estatal` sin lugar es de un medio del corredor. En YouTube vale; el
        # mismo par en TikTok seria la busqueda acreditando su zona.
        panel, _, _ = self._todo()
        panel["destacados"][0]["zona"] = "estatal"
        panel["destacados"][0]["alcance"] = "nacional"
        errores, _ = validar_redes(panel, plataforma="youtube")
        self.assertFalse(any("alcance 'nacional'" in e for e in errores), errores)
        self.assertTrue(PLATAFORMAS_REDES["youtube"]["residuo_corredor"])
        self.assertFalse(PLATAFORMAS_REDES["tiktok"]["residuo_corredor"])

    def test_no_lleva_las_cifras_que_el_feed_no_publica(self):
        # Un `likes: 0` o un `comentarios: 0` se leerian como "nadie" cuando lo
        # cierto es que la fuente no lo dice. Cuarta regla de PRODUCT.md.
        panel, _, _ = self._todo()
        self.assertTrue(panel["destacados"])
        for d in panel["destacados"]:
            self.assertNotIn("likes", d)
            self.assertNotIn("comentarios", d)
            self.assertNotIn("duracion", d)
            self.assertNotIn("creador", d)
            self.assertIn("reproducciones", d)
            self.assertIn("valoraciones", d)
        self.assertFalse(PLATAFORMAS_REDES["youtube"]["duracion"])
        self.assertFalse(PLATAFORMAS_REDES["youtube"]["creador"])

    def test_el_validador_rechaza_una_cifra_ajena(self):
        panel, _, _ = self._todo()
        panel["destacados"][0]["likes"] = 0
        errores, _ = validar_redes(panel, plataforma="youtube")
        self.assertTrue(any("'likes' no existe en youtube" in e for e in errores), errores)

    def test_el_corte_es_por_formato(self):
        # Sin el, los Shorts se llevan todos los puestos: mediana de 447 vistas
        # contra 7 de los videos, y encima son vistas que no miden lo mismo.
        panel, _, _ = self._todo()
        formatos = {d["formato"] for d in panel["destacados"]}
        self.assertEqual(formatos, {"short", "video"})

    def test_el_tope_se_respeta_por_zona_y_formato(self):
        panel, _, _ = self._todo()
        cuenta = {}
        for d in panel["destacados"]:
            clave = (d["zona"], d["formato"])
            cuenta[clave] = cuenta.get(clave, 0) + 1
        self.assertTrue(all(n <= panel["destacados_maximo"] for n in cuenta.values()), cuenta)

    def test_el_orden_emitido_es_por_vistas(self):
        panel, _, _ = self._todo()
        claves = [(-d["reproducciones"], -d["valoraciones"], d["url"])
                  for d in panel["destacados"]]
        self.assertEqual(claves, sorted(claves))

    def test_cosecha_comentarios_es_false_y_obliga_a_los_ceros(self):
        panel, _, _ = self._todo()
        self.assertIs(panel["cosecha_comentarios"], False)
        for campo in ("comentarios_vigentes", "opinion", "repetidos", "reacciones"):
            self.assertEqual(panel[campo], 0)
        # Y con el campo en false el aviso por post se calla: si no, saldria en
        # las ~200 filas de cada corrida y dejaria de ser una senal.
        _, avisos = validar_redes(panel, plataforma="youtube")
        self.assertFalse([a for a in avisos if "sin comentarios cosechados" in a])
        panel["cosecha_comentarios"] = True
        _, avisos = validar_redes(panel, plataforma="youtube")
        self.assertTrue([a for a in avisos if "sin comentarios cosechados" in a])

    def test_un_conteo_distinto_de_cero_con_la_cosecha_apagada_es_error(self):
        panel, _, _ = self._todo()
        panel["opinion"] = 3
        errores, _ = validar_redes(panel, plataforma="youtube")
        self.assertTrue(any("o se cosecho o no se cosecho" in e for e in errores), errores)

    def test_determinismo(self):
        # El cron commitea data/ detras de `git diff --cached --quiet`: dos
        # corridas sobre lo mismo tienen que dar los mismos bytes.
        a, _, _ = self._todo()
        b, _, _ = self._todo()
        self.assertEqual(json.dumps(a, ensure_ascii=False, sort_keys=False),
                         json.dumps(b, ensure_ascii=False, sort_keys=False))

    def test_el_catalogo_de_cuentas_no_reclama_lugar(self):
        # La fila de un canal NO lleva zona, ni siquiera en la salida: darle
        # una es el bug de El Vigia con la puerta abierta.
        panel, _, _ = self._todo()
        self.assertTrue(panel["cuentas"])
        self.assertTrue(all(c["zona"] == "estatal" for c in panel["cuentas"]))

    def test_turnos_reparte_y_no_rellena(self):
        from pulso.redes import _destacados
        pubs = {}
        for i in range(20):
            cuenta = "yt_a" if i < 15 else "yt_b"
            url = "https://www.youtube.com/shorts/v{}".format(i)
            pubs[url] = {"url": url, "cuenta": cuenta, "zona": "Tijuana", "formato": "short",
                         "fecha": "2026-09-18", "titulo": "t", "tipo": "video",
                         "publicado": "2026-09-18T12:00:00+00:00",
                         "reproducciones": 1000 - i, "valoraciones": 0}
        cuentas = [{"id": "yt_a"}, {"id": "yt_b"}]
        comun = dict(comentarios=[], opinion=[], temas=None, cuentas=cuentas,
                     dentro=lambda p: True, cifras=youtube.CIFRAS, orden=youtube.ORDEN,
                     formatos=youtube.FORMATOS)
        sin = _destacados(pubs, turnos=False, **comun)
        con = _destacados(pubs, turnos=True, **comun)
        # Reparte: yt_b no entra sin turnos y si entra con ellos.
        self.assertNotIn("yt_b", {d["cuenta"] for d in sin})
        self.assertIn("yt_b", {d["cuenta"] for d in con})
        # Y no rellena: emite los mismos de siempre.
        self.assertEqual(len(sin), len(con))

    def test_con_un_solo_canal_los_turnos_no_cambian_nada(self):
        from pulso.redes import _destacados
        pubs = {}
        for i in range(20):
            url = "https://www.youtube.com/shorts/v{}".format(i)
            pubs[url] = {"url": url, "cuenta": "yt_a", "zona": "Ensenada", "formato": "short",
                         "fecha": "2026-09-18", "titulo": "t", "tipo": "video",
                         "publicado": "2026-09-18T12:00:00+00:00",
                         "reproducciones": 1000 - i, "valoraciones": 0}
        comun = dict(comentarios=[], opinion=[], temas=None, cuentas=[{"id": "yt_a"}],
                     dentro=lambda p: True, cifras=youtube.CIFRAS, orden=youtube.ORDEN,
                     formatos=youtube.FORMATOS)
        self.assertEqual(_destacados(pubs, turnos=False, **comun),
                         _destacados(pubs, turnos=True, **comun))


class TestConfigReal(unittest.TestCase):
    """config/youtube.json de verdad: las pruebas leen el config real."""

    @classmethod
    def setUpClass(cls):
        raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(raiz, "config", "youtube.json"), encoding="utf-8") as f:
            cls.cfg = json.load(f)
        with open(os.path.join(raiz, "config", "canales.json"), encoding="utf-8") as f:
            cls.canales_api = json.load(f)

    def test_sufijos_titulo_es_una_lista_de_firmas_largas(self):
        for malo in ("| TELEMUNDO", [], ["TJ"], [3]):
            cfg = json.loads(json.dumps(self.cfg))
            cfg["canales"][0]["sufijos_titulo"] = malo
            with self.subTest(sufijos=malo):
                errores, _ = validar_youtube_config(cfg)
                self.assertTrue(any("'sufijos_titulo'" in e for e in errores), errores)

    def test_una_fila_con_zona_es_error_con_el_caso_escrito(self):
        cfg = json.loads(json.dumps(self.cfg))
        cfg["canales"][0]["zona"] = "Ensenada"
        errores, _ = validar_youtube_config(cfg)
        self.assertTrue(any("no lleva 'zona'" in e for e in errores), errores)

    def test_el_id_de_canal_coincide_con_el_catalogo_de_la_api(self):
        # Los dos modulos de YouTube leen catalogos distintos a proposito, pero
        # cuando nombran el mismo canal tienen que nombrar el mismo canal.
        # Hasta el 25 de septiembre de 2026 bastaba con que coincidieran diez
        # ids, asi que uno mal copiado pasaba. Ahora se empata por nombre
        # plegado ("Sintesis TV" y "Síntesis TV" son el mismo) y cada par tiene
        # que traer el mismo id. Todo canal de la API tiene su fila aqui: si
        # una se renombra, esto lo dice en vez de dejar de compararla.
        mios = {fold(c["nombre"]): c for c in self.cfg["canales"]}
        for c in self.canales_api["canales"]:
            with self.subTest(canal=c["nombre"]):
                self.assertIn(fold(c["nombre"]), mios)
                self.assertEqual(mios[fold(c["nombre"])]["canal"], c["canal"])

    def test_ningun_canal_del_catalogo_es_senuelo(self):
        senuelos = {s["canal"] for s in self.canales_api["senuelos"]}
        for c in self.cfg["canales"]:
            self.assertNotIn(c["canal"], senuelos, c["id"])


def _entrada_suelta(xml, i=0):
    import xml.etree.ElementTree as ET
    return ET.fromstring(xml).findall("a:entry", youtube.NS)[i]


if __name__ == "__main__":
    unittest.main()
