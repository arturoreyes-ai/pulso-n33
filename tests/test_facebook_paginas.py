"""Pruebas de la cosecha de paginas de Facebook para Redes, siempre sin red.

Se sustituye 'pulso.facebook.correr_actor', que es el unico punto que toca
Apify. Los campos de los fixtures son los que devolvio el sondeo real del 23
de septiembre de 2026 (`likes`, `comments`, `shares`, `topLevelUrl`,
`sharedPost`, `user`), y los casos que mas importan son tres: que la identidad
del comentarista no llegue al cache, que un post que solo comparte otro no
entre, y que no se paguen comentarios de posts fuera de la ventana.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from pulso import facebook
from pulso.validador import (validar_facebook_config, validar_marcas, validar_redes,
                             validar_redes_comentarios)

AHORA = "2026-09-03T18:00:00+00:00"

PAGINA = {"id": "ndtijuana_fb", "pagina": "NdTijuana", "nombre": "Noticias de Tijuana",
          "ambito": "regional", "idioma": "es", "seguidores": 1430000,
          "activo": True, "verificado": "2026-09-23", "razon": "Sondeada."}


def _post(n, texto, likes, hace="2026-09-03T12:00:00.000Z", **cambios):
    base = {
        "postId": str(n), "facebookId": "100064377021835",
        "url": "https://www.facebook.com/NdTijuana/posts/pfbid0{}".format(n),
        "topLevelUrl": "https://www.facebook.com/100064377021835/posts/{}".format(n),
        "text": texto, "time": hace, "likes": likes, "comments": 3, "shares": 2,
        "pageName": "NdTijuana",
        "user": {"id": "100064377021835", "name": "Noticias de Tijuana",
                 "profileUrl": "https://www.facebook.com/NdTijuana"},
        "topComments": [{"text": "primero", "profileName": "Vecino"}],
    }
    base.update(cambios)
    return base


POSTS = [
    _post(1, "Fuerte incendio de un taller en la colonia Arenales, Tijuana", 95),
    _post(2, "#NDTInforma | Volcadura en el bulevar Federico Benítez", 8),
    _post(3, "Capturan a operador del Cártel en Culiacán, Sinaloa", 400),
    _post(4, "https://www.facebook.com/share/p/1AvvepNuzY/?mibextid=wwXIfr", 52,
          sharedPost={"text": "DEJANOS TUS COMENTARIOS",
                      "user": {"id": "1000686", "name": "La Prensa Baja California"}}),
    _post(5, "Hace dos días en Tijuana", 900, hace="2026-09-01T12:00:00.000Z"),
]


def _comentario(texto, post, likes=1):
    return {"id": "c-" + texto[:5], "commentId": "c", "text": texto, "likesCount": likes,
            "commentsCount": 0, "date": "2026-09-03T13:00:00.000Z",
            "profileName": "Vecina Tijuana", "profileId": "777",
            "profileUrl": "https://www.facebook.com/vecina.tj",
            "profilePicture": "https://scontent.test/p.jpg",
            "inputUrl": post}


URL_1 = "https://www.facebook.com/NdTijuana/posts/pfbid01"
COMENTARIOS = [_comentario("Otra vez sin bomberos a tiempo", URL_1, 7),
               _comentario("Ese taller ya tenía reportes", URL_1, 2)]


class _Actor:
    """Posts en la 1a pasada, comentarios en la 2a; guarda lo que se pidio."""

    def __init__(self, posts=None, comentarios=None):
        self.posts = POSTS if posts is None else posts
        self.comentarios = COMENTARIOS if comentarios is None else comentarios
        self.llamadas = []

    def __call__(self, actor, entrada, tok, limite, timeout=None):
        self.llamadas.append((actor, entrada))
        return self.posts if actor == facebook.ACTOR_POSTS else self.comentarios


class BaseCache(unittest.TestCase):
    def setUp(self):
        self.cache = os.path.join(tempfile.mkdtemp(), "facebook")

    def cosechar(self, actor=None, **kw):
        with patch.object(facebook, "correr_actor", actor or _Actor()):
            return facebook.cosechar([PAGINA], AHORA, tok="t", cache=self.cache, **kw)


class TestLimpieza(unittest.TestCase):
    def test_el_compartido_no_entra(self):
        # Blanco y Rojo, 23 de septiembre de 2026: los tres posts sondeados eran
        # un enlace share/p/ con el contenido de La Prensa Baja California.
        limpio, motivo = facebook._limpiar_de_pagina(POSTS[3], PAGINA, AHORA)
        self.assertIsNone(limpio)
        self.assertEqual(motivo, "compartido")

    def test_compartir_con_texto_propio_si_entra(self):
        p = _post(9, "Así amaneció el bulevar Agua Caliente en Tijuana", 10,
                  sharedPost={"text": "otro"})
        limpio, _ = facebook._limpiar_de_pagina(p, PAGINA, AHORA)
        self.assertEqual(limpio["zona"], "Tijuana")

    def test_la_zona_sale_del_pie_y_no_de_la_pagina(self):
        zonas = {p["postId"]: facebook._limpiar_de_pagina(p, PAGINA, AHORA)[0] for p in POSTS}
        self.assertEqual(zonas["1"]["zona"], "Tijuana")
        self.assertEqual(zonas["1"]["alcance"], "zona")
        # Regional: un lugar mexicano fuera de Baja California se tira.
        self.assertIsNone(zonas["3"])
        # Un medio del corredor que no nombra lugar es Corredor, sin precisar.
        self.assertEqual((zonas["2"]["zona"], zonas["2"]["alcance"]), ("estatal", "nacional"))

    def test_el_registro_no_trae_la_consulta_ni_la_pagina(self):
        limpio, _ = facebook._limpiar_de_pagina(POSTS[0], PAGINA, AHORA)
        self.assertNotIn("origen", limpio)
        self.assertNotIn("fuente", limpio)
        self.assertEqual(limpio["cuenta"], "ndtijuana_fb")
        self.assertEqual(limpio["compartidos"], 2)
        for clave in ("user", "topComments", "pageName", "facebookId"):
            self.assertNotIn(clave, json.dumps(limpio))

    def test_la_pagina_sin_usuario_se_lee_por_profile_php(self):
        self.assertEqual(facebook._url_de_pagina({"pagina": "100086488503408"}),
                         "https://www.facebook.com/profile.php?id=100086488503408")
        self.assertEqual(facebook._url_de_pagina({"pagina": "NdTijuana"}),
                         "https://www.facebook.com/NdTijuana/")


class TestCosecha(BaseCache):
    def test_la_identidad_no_llega_al_cache(self):
        self.cosechar()
        crudo = ""
        for nombre in os.listdir(self.cache):
            with open(os.path.join(self.cache, nombre), encoding="utf-8") as fh:
                crudo += fh.read()
        for prohibido in ("Vecina Tijuana", "777", "vecina.tj", "scontent.test", "profileName",
                          "Noticias de Tijuana", "La Prensa Baja California"):
            self.assertNotIn(prohibido, crudo)

    def test_solo_paga_comentarios_de_la_ventana_y_los_de_mas_reacciones(self):
        actor = _Actor()
        _, salud, _ = self.cosechar(actor, comentarios_para=1)
        pedidas = [u["url"] for a, e in actor.llamadas if a == facebook.ACTOR_COMENTARIOS
                   for u in e["startUrls"]]
        # El 5 tiene 900 reacciones pero es de hace dos dias; el 3 tiene 400
        # pero es de Sinaloa. El que se paga es el 1.
        self.assertEqual(pedidas, [URL_1])
        self.assertEqual(salud[0]["compartidos"], 1)
        self.assertEqual(salud[0]["fuera"], 1)
        self.assertEqual(salud[0]["comentarios"], 2)

    def test_no_vuelve_a_pagar_el_mismo_post(self):
        self.cosechar(comentarios_para=1)
        actor = _Actor()
        _, salud, _ = self.cosechar(actor, comentarios_para=1)
        # El 1 ya se cosecho: el siguiente de la ventana es el 2.
        pedidas = [u["url"] for a, e in actor.llamadas if a == facebook.ACTOR_COMENTARIOS
                   for u in e["startUrls"]]
        self.assertEqual(pedidas, ["https://www.facebook.com/NdTijuana/posts/pfbid02"])

    def test_sin_token_lo_dice(self):
        from pulso.apify import SinToken
        with patch.object(facebook, "token", side_effect=SinToken("sin")):
            _, salud, _ = facebook.cosechar([PAGINA], AHORA, cache=self.cache)
        self.assertEqual(salud[0]["estado"], "sin_token")


class TestDerivar(BaseCache):
    def _panel(self):
        nuevos, salud, gasto = self.cosechar()
        panel = facebook.derivar(facebook.leer_cache(self.cache), AHORA, salud, gasto, [],
                                 facebook.leer_publicaciones(self.cache), [PAGINA])
        return panel

    def test_el_panel_pasa_el_validador(self):
        panel = self._panel()
        e, _ = validar_redes(panel, plataforma="facebook")
        self.assertEqual(e, [])
        self.assertEqual(panel["plataforma"], "facebook")
        urls = [d["url"] for d in panel["destacados"]]
        # Fuera de la ventana y compartido no se destacan.
        self.assertNotIn("https://www.facebook.com/NdTijuana/posts/pfbid05", urls)
        self.assertNotIn("https://www.facebook.com/NdTijuana/posts/pfbid04", urls)
        d = panel["destacados"][0]
        self.assertEqual(d["url"], URL_1)
        for campo in ("likes", "comentarios", "compartidos", "alcance", "publicado"):
            self.assertIn(campo, d)

    def test_el_texto_publicado_pasa_el_validador(self):
        panel = self._panel()
        texto = facebook.publicar_comentarios(facebook.leer_cache(self.cache),
                                              panel["destacados"], AHORA)
        e, _ = validar_redes_comentarios(texto, panel, "facebook")
        self.assertEqual(e, [])
        self.assertEqual([c["texto"] for c in texto["por_post"][URL_1]],
                         ["Otra vez sin bomberos a tiempo", "Ese taller ya tenía reportes"])

    def test_determinista(self):
        panel = self._panel()

        def otra_vez():
            return facebook.derivar(facebook.leer_cache(self.cache), AHORA, panel["salud"],
                                    panel["gasto"], [], facebook.leer_publicaciones(self.cache),
                                    [PAGINA])
        self.assertEqual(json.dumps(otra_vez(), ensure_ascii=False, indent=1),
                         json.dumps(otra_vez(), ensure_ascii=False, indent=1))

    def test_un_destacado_con_identidad_es_error(self):
        panel = self._panel()
        panel["destacados"][0]["user"] = {"name": "Noticias de Tijuana"}
        e, _ = validar_redes(panel, plataforma="facebook")
        self.assertTrue(e)


class TestConfig(unittest.TestCase):
    """Lee el config/facebook.json real, como el resto de la suite."""

    def setUp(self):
        with open(os.path.join("config", "facebook.json"), encoding="utf-8") as fh:
            self.cfg = json.load(fh)

    def test_el_config_real_valida(self):
        e, _ = validar_facebook_config(self.cfg)
        self.assertEqual(e, [])

    def test_toda_pagina_activa_cita_su_sondeo(self):
        for p in self.cfg["paginas"]:
            if p.get("activo"):
                with self.subTest(pagina=p["id"]):
                    self.assertIn("Sondeada", p["razon"])

    def test_una_pagina_con_zona_es_error(self):
        malo = dict(self.cfg, paginas=[dict(PAGINA, zona="Tijuana")])
        e, _ = validar_facebook_config(malo)
        self.assertTrue(any("no lleva 'zona'" in x for x in e), e)

    def test_activa_sin_sondeo_es_error(self):
        malo = dict(self.cfg, paginas=[dict(PAGINA, verificado=None)])
        e, _ = validar_facebook_config(malo)
        self.assertTrue(any("verificado" in x for x in e), e)

    def test_la_pagina_no_es_una_url(self):
        malo = dict(self.cfg, paginas=[dict(PAGINA, pagina="https://www.facebook.com/NdTijuana")])
        e, _ = validar_facebook_config(malo)
        self.assertTrue(any("sin URL" in x for x in e), e)

    def test_el_presupuesto_alcanza_para_todas_las_paginas_activas(self):
        # El reparto divide parejo y la pasada de comentarios se recorta en
        # silencio a lo que sobra: esta prueba convierte ese recorte en error.
        c = self.cfg["cosecha"]
        activas = [p for p in self.cfg["paginas"] if p.get("activo")]
        necesita = c["posts_por_pagina"] + c["comentarios_para"] * c["comentarios_por_post"]
        self.assertGreaterEqual(c["presupuesto_resultados"] // len(activas), necesita)

    def test_una_marca_una_red_con_facebook(self):
        ig = {"cuentas": [{"id": "x_ig", "marca": "bn", "seguidores": 136814, "activo": True}]}
        fb = {"paginas": [{"id": "x_fb", "marca": "bn", "seguidores": 1140000, "activo": True}]}
        e, _ = validar_marcas(ig, {"perfiles": []}, fb)
        self.assertTrue(any("una marca, una red" in x for x in e), e)
        # Y los tres configs reales cumplen: Blanco y Negro se lee en Facebook.
        with open(os.path.join("config", "instagram.json"), encoding="utf-8") as fh:
            ig_real = json.load(fh)
        with open(os.path.join("config", "tiktok.json"), encoding="utf-8") as fh:
            tk_real = json.load(fh)
        e, a = validar_marcas(ig_real, tk_real, self.cfg)
        self.assertEqual(e, [])
        self.assertFalse([x for x in a if "blanconegro" in x], a)


if __name__ == "__main__":
    unittest.main()
