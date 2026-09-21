"""Pruebas de la lista blanca de Facebook (pulso/facebook.py), siempre sin red.

No hay cosecha propia que probar: la corre pulso/consultas.py. Lo que se prueba
aqui es lo que solo Facebook sabe, y la prueba que mas importa es que la
identidad del comentarista -- `profileName`, `profileId`, `profileUrl`,
`profilePicture`, que el actor devuelve POR CADA COMENTARIO -- no sobreviva a
la ingesta. Los nombres de campo del fixture son los que publican de verdad
apify~facebook-posts-scraper y apify~facebook-comments-scraper.
"""

import json
import unittest

from pulso import apify, facebook

AHORA = "2026-09-03T18:00:00+00:00"
FUENTE = {"cuenta": "cq_vivelabaja", "plataforma": "facebook", "origen": "pagina",
          "valor": "vivelabaja", "idioma": "es"}


def _post(**cambios):
    base = {
        "postId": "1001", "facebookId": "555",
        "url": "https://m.facebook.com/vivelabaja/posts/pfbid0abc?__cft__[0]=x&__tn__=y",
        "text": "Este fin de semana en Tijuana abrimos el nuevo desarrollo",
        "time": "2026-09-01T18:00:00.000Z", "timestamp": 1788285600,
        "likes": 88, "comments": 12, "shares": 0, "viewsCount": 0,
        "pageName": "Vive la Baja",
        "user": {"id": "555", "name": "Vive la Baja", "profileUrl": "https://www.facebook.com/vivelabaja"},
        "media": [{"__typename": "Photo", "thumbnail": "https://scontent.test/a.jpg"}],
    }
    base.update(cambios)
    return base


def _comentario(texto, likes=0, **cambios):
    base = {"id": "c1", "commentId": "c1", "text": texto, "likesCount": likes,
            "commentsCount": 0, "date": "2026-09-02T10:00:00.000Z",
            "profileName": "Vecina Tijuana", "profileId": "777",
            "profileUrl": "https://www.facebook.com/vecina.tj",
            "profilePicture": "https://scontent.test/p.jpg",
            "inputUrl": "https://www.facebook.com/vivelabaja/posts/pfbid0abc",
            "facebookUrl": "https://www.facebook.com/vivelabaja/posts/pfbid0abc?comment_id=c1"}
    base.update(cambios)
    return base


class TestIdentidad(unittest.TestCase):
    def test_el_comentario_limpio_no_trae_identidad(self):
        c = facebook._limpiar_comentario(_comentario("Felicidades, se ve muy bien", 3),
                                         "https://www.facebook.com/vivelabaja/posts/pfbid0abc",
                                         FUENTE, "Tijuana")
        self.assertEqual(sorted(c), ["cuenta", "fecha", "id", "idioma", "likes", "plataforma",
                                     "post", "respuestas", "texto", "zona_cuenta"])
        crudo = json.dumps(c)
        for prohibido in ("Vecina", "777", "profileName", "profileId", "profileUrl",
                          "profilePicture", "commentId", "vecina.tj"):
            self.assertNotIn(prohibido, crudo)
        self.assertEqual((c["likes"], c["fecha"], c["zona_cuenta"], c["cuenta"]),
                         (3, "2026-09-02", "Tijuana", "cq_vivelabaja"))

    def test_el_post_limpio_no_trae_autor_ni_ids(self):
        p, motivo = facebook._limpiar_post(_post(), FUENTE, AHORA)
        self.assertIsNone(motivo)
        self.assertEqual(sorted(p), ["alcance", "comentarios", "compartidos", "cuenta", "fecha",
                                     "fuente", "likes", "origen", "publicado", "tipo", "titulo",
                                     "url", "zona"])
        crudo = json.dumps(p)
        for prohibido in ("pageName", "postId", "facebookId", "user", "555", "1001"):
            self.assertNotIn(prohibido, crudo)

    def test_un_comentario_vacio_no_es_registro(self):
        self.assertIsNone(facebook._limpiar_comentario(_comentario("  "), "u", FUENTE, None))


class TestLimpiezaPost(unittest.TestCase):
    def _limpio(self, **k):
        return facebook._limpiar_post(_post(**k), FUENTE, AHORA)

    def test_la_url_se_canoniza_y_pierde_el_rastreo(self):
        p, _ = self._limpio()
        self.assertEqual(p["url"], "https://www.facebook.com/vivelabaja/posts/pfbid0abc")

    def test_permalink_conserva_solo_story_fbid_e_id(self):
        u = facebook._url_post("https://web.facebook.com/permalink.php?story_fbid=1&id=2&__tn__=x")
        self.assertEqual(u, "https://www.facebook.com/permalink.php?story_fbid=1&id=2")

    def test_videos_reels_y_watch(self):
        self.assertEqual(facebook._url_post("https://www.facebook.com/vivelabaja/videos/123/"),
                         "https://www.facebook.com/vivelabaja/videos/123")
        self.assertEqual(facebook._url_post("https://www.facebook.com/reel/456?x=1"),
                         "https://www.facebook.com/reel/456")
        self.assertEqual(facebook._url_post("https://www.facebook.com/watch/?v=789&ref=x"),
                         "https://www.facebook.com/watch/?v=789")

    def test_perfiles_grupos_fotos_y_otros_hosts_no_son_post(self):
        for u in ("https://www.facebook.com/groups/vecinos/posts/1",
                  "https://www.facebook.com/profile.php?id=1",
                  "https://www.facebook.com/photo.php?fbid=1",
                  "https://www.instagram.com/p/AAA/", "", None):
            with self.subTest(url=u):
                self.assertIsNone(facebook._url_post(u))

    def test_publicado_desde_time_o_desde_timestamp(self):
        self.assertEqual(self._limpio()[0]["publicado"], "2026-09-01T18:00:00+00:00")
        p, _ = self._limpio(time=None)
        self.assertEqual(p["publicado"], "2026-09-01T18:00:00+00:00")
        self.assertEqual(self._limpio(time=None, timestamp=None)[1], "sin_fecha")
        self.assertEqual(self._limpio(time="2026-09-04T00:00:00.000Z", timestamp=None)[1], "futuro")

    def test_sin_url_y_anuncio_fuera(self):
        self.assertEqual(self._limpio(url="")[1], "sin_url")
        self.assertEqual(self._limpio(isSponsored=True)[1], "anuncio")

    def test_compartidos_viaja_en_cero_y_reproducciones_solo_si_hay(self):
        p, _ = self._limpio()
        self.assertEqual(p["compartidos"], 0)
        self.assertNotIn("reproducciones", p)
        p, _ = self._limpio(viewsCount=900, shares=4)
        self.assertEqual((p["reproducciones"], p["compartidos"]), (900, 4))

    def test_tipo(self):
        self.assertEqual(self._limpio()[0]["tipo"], "imagen")
        p, _ = self._limpio(media=[{"__typename": "Video"}])
        self.assertEqual(p["tipo"], "video")
        self.assertEqual(self._limpio(media=[])[0]["tipo"], "otro")

    def test_la_zona_sale_del_texto_con_ambito_nacional(self):
        self.assertEqual((self._limpio()[0]["zona"], self._limpio()[0]["alcance"]),
                         ("Tijuana", "zona"))
        p, _ = self._limpio(text="Nueva sucursal, pronto mas noticias")
        self.assertEqual((p["zona"], p["alcance"]), ("nacional", "nacional"))
        # Un lugar de fuera no se tira: es lo que una consulta por termino fue
        # a buscar. Queda nacional/fuera.
        p, _ = self._limpio(text="Abrimos en Guadalajara, Jalisco")
        self.assertEqual((p["zona"], p["alcance"]), ("nacional", "fuera"))
        self.assertEqual(facebook._limpiar_post(_post(text="Abrimos en Guadalajara"), FUENTE,
                                                AHORA, ambito="regional")[1], "fuera")


class TestEntradas(unittest.TestCase):
    def test_pagina_y_comentarios_pasan_la_guardia_de_sesion(self):
        e = facebook._entrada_pagina(facebook.url_pagina("@vivelabaja"), 20, 30)
        self.assertEqual(e["startUrls"], [{"url": "https://www.facebook.com/vivelabaja/"}])
        self.assertEqual((e["resultsLimit"], e["onlyPostsNewerThan"]), (20, "30 days"))
        apify.revisar_entrada(e, facebook.ACTOR_POSTS)
        c = facebook._entrada_comentarios(["https://www.facebook.com/vivelabaja/posts/1"], 20, 30)
        self.assertEqual(c["viewOption"], facebook.VISTA_COMENTARIOS)
        self.assertEqual(c["onlyCommentsNewerThan"], "30 days")
        apify.revisar_entrada(c, facebook.ACTOR_COMENTARIOS)

    def test_la_busqueda_por_palabra_esta_apagada(self):
        self.assertIsNone(facebook.ACTOR_BUSQUEDA)
        with self.assertRaises(apify.ActorProhibido):
            facebook._entrada_busqueda("vive la baja", 20, 30)

    def test_url_de_comentario_cruza_con_la_pedida(self):
        pedidas = ["https://www.facebook.com/vivelabaja/posts/pfbid0abc"]
        self.assertEqual(facebook._url_comentario(_comentario("x"), pedidas), pedidas[0])
        sin_input = _comentario("x", inputUrl=None)
        self.assertEqual(facebook._url_comentario(sin_input, pedidas), pedidas[0])


class TestCatalogoApify(unittest.TestCase):
    def test_los_dos_actores_estan_documentados_y_apagados(self):
        with open("config/apify.json", encoding="utf-8") as fh:
            doc = json.load(fh)
        ids = {a["id"]: a for a in doc["actores"]}
        for actor in (facebook.ACTOR_POSTS, facebook.ACTOR_COMENTARIOS):
            with self.subTest(actor=actor):
                self.assertIn(actor, ids)
                self.assertFalse(ids[actor]["activo"])
                self.assertTrue(ids[actor]["razon"].strip())
        # La busqueda por palabra esta en senuelos mientras ACTOR_BUSQUEDA sea None.
        senuelos = {s["id"] for s in doc["senuelos"]}
        self.assertIn("scraper_one~facebook-posts-search", senuelos)
        self.assertNotIn("scraper_one~facebook-posts-search", ids)


if __name__ == "__main__":
    unittest.main()
