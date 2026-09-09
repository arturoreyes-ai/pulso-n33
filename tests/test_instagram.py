"""Pruebas de la cosecha de Instagram, siempre sin red.

Se sustituye 'pulso.instagram.correr_actor', que es el unico punto que toca
Apify. Los nombres de campo del fixture son los que devuelve de verdad
apify~instagram-scraper (`text`, `ownerUsername`, `timestamp`, `likesCount`,
`repliesCount`, `postUrl`), y estan ahi a proposito: la prueba que mas
importa de este modulo es que `ownerUsername` NO sobreviva a la ingesta.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from pulso import instagram
from pulso.validador import validar_redes, validar_redes_comentarios

AHORA = "2026-09-03T18:00:00+00:00"

CUENTA = {"id": "zeta_ig", "handle": "@zetatijuana", "zona": "Tijuana",
          "idioma": "es", "activo": True, "verificado": True}

POSTS = [{"url": "https://www.instagram.com/p/AAA/"},
         {"url": "https://www.instagram.com/p/BBB/"}]

COMENTARIOS = [
    {"id": "17900", "text": "El puente sigue cerrado, nadie avisa",
     "ownerUsername": "vecina_tj", "ownerProfilePicUrl": "https://x.test/p.jpg",
     "timestamp": "2026-09-02T10:00:00.000Z", "likesCount": 4, "repliesCount": 1,
     "postUrl": "https://www.instagram.com/p/AAA/"},
    {"id": "17901", "text": "Otra vez el agua",
     "ownerUsername": "otro", "timestamp": "2026-09-02T11:00:00.000Z",
     "likesCount": 0, "repliesCount": 0,
     "postUrl": "https://www.instagram.com/p/AAA/"},
]


class _Actor:
    """Sustituye correr_actor: devuelve posts en la 1a pasada, comentarios en la 2a."""

    def __init__(self, posts=None, comentarios=None):
        self.posts = POSTS if posts is None else posts
        self.comentarios = COMENTARIOS if comentarios is None else comentarios
        self.llamadas = []

    def __call__(self, actor, entrada, tok, limite, timeout=None):
        self.llamadas.append(entrada)
        return self.posts if entrada.get("resultsType") == "posts" else self.comentarios


class BaseCache(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.cache = os.path.join(self.dir, "instagram")


class TestIdentidad(BaseCache):
    """La identidad se tira al INGERIR, no al derivar. Es la regla del modulo."""

    def test_limpiar_no_deja_pasar_al_autor(self):
        limpio = instagram._limpiar(COMENTARIOS[0], "https://x.test/p/AAA/", CUENTA)
        for campo in instagram.IDENTIDAD:
            with self.subTest(campo=campo):
                self.assertNotIn(campo, limpio)
        self.assertNotIn("vecina_tj", json.dumps(limpio))

    def test_el_cache_tampoco_guarda_identidad(self):
        # No basta con que derivar() limpie: si el autor llega al cache, ya
        # esta escrito en disco y hay que borrarlo. Se tira antes.
        with patch.object(instagram, "correr_actor", _Actor()):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        crudo = json.dumps(instagram.leer_cache(self.cache))
        self.assertNotIn("vecina_tj", crudo)
        self.assertNotIn("ownerUsername", crudo)

    def test_el_id_no_es_el_de_instagram(self):
        # El id de Instagram ata la frase a una cuenta y es dato de la
        # plataforma. El nuestro es sha256(post|texto plegado).
        limpio = instagram._limpiar(COMENTARIOS[0], "https://x.test/p/AAA/", CUENTA)
        self.assertNotEqual(limpio["id"], "17900")
        self.assertEqual(len(limpio["id"]), 16)

    def test_un_comentario_vacio_se_descarta(self):
        self.assertIsNone(instagram._limpiar({"text": "   "}, "u", CUENTA))


class TestIdempotencia(BaseCache):
    def test_dos_corridas_no_inflan_el_conteo(self):
        actor = _Actor()
        with patch.object(instagram, "correr_actor", actor):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
            primera = len(instagram.leer_cache(self.cache))
            # El registro de vistos frena la segunda; se fuerza a 0 dias para
            # probar que aun cosechando de nuevo el conteo no sube.
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        self.assertEqual(len(instagram.leer_cache(self.cache)), primera)

    def test_el_mismo_texto_en_el_mismo_post_colapsa(self):
        # El mismo comentario copiado dos veces no son dos opiniones.
        dobles = [COMENTARIOS[0], dict(COMENTARIOS[0], id="99999")]
        with patch.object(instagram, "correr_actor", _Actor(comentarios=dobles)):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        self.assertEqual(len(instagram.leer_cache(self.cache)), 1)

    def test_el_mismo_texto_en_otro_post_no_colapsa(self):
        otro = dict(COMENTARIOS[0], postUrl="https://www.instagram.com/p/BBB/")
        with patch.object(instagram, "correr_actor",
                          _Actor(comentarios=[COMENTARIOS[0], otro])):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        self.assertEqual(len(instagram.leer_cache(self.cache)), 2)


class TestFrenoDeCosto(BaseCache):
    """El registro de vistos existe para no pagar dos veces. Ver el encabezado."""

    def test_un_post_reciente_no_se_vuelve_a_pedir(self):
        actor = _Actor()
        with patch.object(instagram, "correr_actor", actor):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        pasadas = [e["resultsType"] for e in actor.llamadas]
        # Dos pasadas de posts (baratas) pero UNA sola de comentarios.
        self.assertEqual(pasadas.count("comments"), 1)

    def test_pendientes_deja_pasar_lo_viejo(self):
        vistos = {"a": "2026-08-01", "b": "2026-09-02"}
        self.assertEqual(instagram.pendientes(["a", "b"], vistos, AHORA), ["a"])

    def test_pendientes_deja_pasar_lo_nunca_visto(self):
        self.assertEqual(instagram.pendientes(["nuevo"], {}, AHORA), ["nuevo"])


class TestRetencion(BaseCache):
    def test_purgar_tira_lo_viejo_y_deja_lo_nuevo(self):
        os.makedirs(self.cache)
        for dia in ("2026-07-01", "2026-09-02"):
            with open(os.path.join(self.cache, dia + ".json"), "w", encoding="utf-8") as fh:
                json.dump([], fh)
        self.assertEqual(instagram.purgar(self.cache, AHORA), 1)
        self.assertEqual(sorted(os.listdir(self.cache)), ["2026-09-02.json"])

    def test_purgar_no_tira_el_registro_de_vistos(self):
        # vistos.json no es una cosecha: si se purgara, la corrida siguiente
        # volveria a pagar por todos los posts.
        os.makedirs(self.cache)
        instagram.guardar_vistos({"https://x.test/p/A/": "2026-01-01"}, self.cache)
        instagram.purgar(self.cache, AHORA)
        self.assertEqual(instagram.leer_vistos(self.cache),
                         {"https://x.test/p/A/": "2026-01-01"})


class TestDegradacion(BaseCache):
    def test_sin_token_devuelve_vacio_y_lo_dice(self):
        nuevos, salud, _ = instagram.cosechar(
            [CUENTA], AHORA, cache=self.cache, entorno={})
        self.assertEqual(nuevos, [])
        self.assertEqual([s["estado"] for s in salud], ["sin_token"])

    def test_una_cuenta_sin_verificar_no_se_cosecha(self):
        # Un handle derivado del nombre del medio da una cuenta ajena o
        # vacia, y las dos se cobran igual. Ver config/instagram.json.
        cuenta = dict(CUENTA, verificado=False)
        with patch.object(instagram, "correr_actor", _Actor()) as actor:
            nuevos, salud, _ = instagram.cosechar([cuenta], AHORA, tok="t",
                                                  cache=self.cache)
        self.assertEqual((nuevos, salud), ([], []))

    def test_un_fallo_de_una_cuenta_no_tumba_las_demas(self):
        def revienta(actor, entrada, tok, limite, timeout=None):
            if entrada["directUrls"][0].endswith("mala/"):
                raise RuntimeError("502")
            return _Actor()(actor, entrada, tok, limite)

        mala = dict(CUENTA, id="mala_ig", handle="@mala")
        with patch.object(instagram, "correr_actor", revienta):
            _, salud, _ = instagram.cosechar([mala, CUENTA], AHORA, tok="t",
                                             cache=self.cache)
        estados = {s["cuenta"]: s["estado"] for s in salud}
        self.assertEqual(estados, {"mala_ig": "fallo", "zeta_ig": "ok"})


class TestDerivar(BaseCache):
    def _panel(self, temas=None):
        with patch.object(instagram, "correr_actor", _Actor()):
            _, salud, gasto = instagram.cosechar([CUENTA], AHORA, tok="t",
                                                 cache=self.cache)
        return instagram.derivar(instagram.leer_cache(self.cache), AHORA,
                                 salud, gasto, temas)

    def test_conteos_por_zona_y_cuenta(self):
        p = self._panel()
        self.assertEqual(p["por_zona"], {"Tijuana": 2})
        self.assertEqual(p["por_cuenta"], {"zeta_ig": 2})
        self.assertEqual(p["comentarios_vigentes"], 2)

    def test_cuenta_los_posts_no_los_comentarios(self):
        self.assertEqual(self._panel()["posts_vigentes"], 1)

    def test_cruza_temas_de_prensa(self):
        p = self._panel(temas=[{"termino": "agua"}, {"termino": "predial"}])
        self.assertEqual(p["por_tema"], [{"tema": "agua", "comentarios": 1, "posts": 1}])

    def test_un_texto_repetido_en_varios_posts_es_brigada(self):
        # El caso real: "PAGINA DE 4SC0 Y APARTE FAKE!!" identico en NUEVE
        # posts de AFN, el 20% de esa cuenta. El deduplicado no lo agarra
        # porque el id es sha256(post|texto), a proposito.
        base = dict(CUENTA)
        coms = [dict(COMENTARIOS[0], text="PAGINA DE 4SC0 Y APARTE FAKE!!",
                     postUrl="https://www.instagram.com/p/{}/".format(n))
                for n in ("A", "B", "C", "D")]
        vig = [instagram._limpiar(c, c["postUrl"], base) for c in coms]
        p = instagram.derivar(vig, AHORA, [], {})
        self.assertEqual(p["repetidos"], 4)
        self.assertEqual(p["opinion"], 0)

    def test_dos_posts_no_alcanzan_para_brigada(self):
        base = dict(CUENTA)
        coms = [dict(COMENTARIOS[0], postUrl="https://www.instagram.com/p/{}/".format(n))
                for n in ("A", "B")]
        vig = [instagram._limpiar(c, c["postUrl"], base) for c in coms]
        self.assertEqual(instagram.derivar(vig, AHORA, [], {})["repetidos"], 0)

    def test_un_emoji_solo_es_reaccion_y_no_opinion(self):
        vig = [instagram._limpiar(dict(COMENTARIOS[0], text=t), "u", CUENTA)
               for t in ("👏👏", "el agua no llega")]
        p = instagram.derivar(vig, AHORA, [], {}, temas=[{"termino": "agua"}])
        self.assertEqual(p["reacciones"], 1)
        self.assertEqual(p["opinion"], 1)
        # El aplauso no cuenta como comentario sobre el tema.
        self.assertEqual(p["por_tema"], [{"tema": "agua", "comentarios": 1, "posts": 1}])

    def test_la_brigada_no_infla_un_tema(self):
        base = dict(CUENTA)
        coms = [dict(COMENTARIOS[0], text="el agua es un desastre",
                     postUrl="https://www.instagram.com/p/{}/".format(n))
                for n in ("A", "B", "C", "D")]
        vig = [instagram._limpiar(c, c["postUrl"], base) for c in coms]
        p = instagram.derivar(vig, AHORA, [], {}, temas=[{"termino": "agua"}])
        self.assertEqual(p["por_tema"], [])

    def test_no_emite_ningun_porcentaje(self):
        # Regla de los 30 de PRODUCT.md: con ~15 comentarios por post casi
        # cualquier corte cae debajo del minimo.
        crudo = json.dumps(self._panel())
        self.assertNotIn("pct", crudo)
        self.assertNotIn("porcentaje", crudo)

    def test_el_panel_pasa_el_validador(self):
        errores, _ = validar_redes(self._panel())
        self.assertEqual(errores, [])

    def test_los_mapas_van_ordenados(self):
        # Determinismo: el cron commitea detras de `git diff --cached --quiet`.
        otra = dict(CUENTA, id="afn_ig", zona="Ensenada")
        with patch.object(instagram, "correr_actor", _Actor()):
            _, salud, gasto = instagram.cosechar([otra, CUENTA], AHORA, tok="t",
                                                 cache=self.cache)
        p = instagram.derivar(instagram.leer_cache(self.cache), AHORA, salud, gasto)
        for campo in ("por_zona", "por_cuenta", "por_idioma"):
            with self.subTest(campo=campo):
                self.assertEqual(list(p[campo]), sorted(p[campo]))

    def test_dos_derivaciones_son_identicas(self):
        with patch.object(instagram, "correr_actor", _Actor()):
            _, salud, gasto = instagram.cosechar([CUENTA], AHORA, tok="t",
                                                 cache=self.cache)
        vig = instagram.leer_cache(self.cache)
        a = json.dumps(instagram.derivar(vig, AHORA, salud, gasto))
        b = json.dumps(instagram.derivar(vig, AHORA, salud, gasto))
        self.assertEqual(a, b)


class TestValidadorRedes(unittest.TestCase):
    BASE = {
        "esquema": 1, "generado": AHORA, "plataforma": "instagram",
        "retencion_dias": 30, "comentarios_vigentes": 0, "posts_vigentes": 0,
        "opinion": 0, "repetidos": 0, "reacciones": 0,
        "sentimiento": {"metodo": "ninguno", "modelo": None, "positivo": 0,
                        "negativo": 0, "neutral": 0, "sin_clasificar": 0,
                        "sin_modelo_idioma": 0},
        "por_zona": {}, "por_cuenta": {}, "por_idioma": {}, "por_tema": [],
        "salud": [{"cuenta": "zeta_ig", "estado": "ok"}],
        "gasto": {"resultados": 300, "gastado": 0, "por_concepto": {}},
    }

    def test_el_minimo_valido_pasa(self):
        self.assertEqual(validar_redes(dict(self.BASE))[0], [])

    def test_identidad_filtrada_es_error(self):
        e, _ = validar_redes(dict(self.BASE, autores=[{"ownerUsername": "x"}]))
        self.assertTrue(any("clave prohibida" in x for x in e))

    def test_el_tono_debe_cuadrar_con_opinion(self):
        # Si el tono se contara sobre el total, los aplausos y la brigada
        # entrarian al sentimiento de la ciudad.
        malo = dict(self.BASE, opinion=10)
        e, _ = validar_redes(malo)
        self.assertTrue(any("se cuenta sobre opinion" in x for x in e))

    def test_un_porcentaje_es_error(self):
        e, _ = validar_redes(dict(self.BASE, por_zona={}, porcentaje=50))
        self.assertTrue(any("regla de los 30" in x for x in e))

    def test_retencion_distinta_de_30_es_error(self):
        e, _ = validar_redes(dict(self.BASE, retencion_dias=90))
        self.assertTrue(any("retencion_dias" in x for x in e))

    def test_un_mapa_desordenado_es_error(self):
        e, _ = validar_redes(dict(self.BASE, por_zona={"Tijuana": 1, "Ensenada": 2}))
        self.assertTrue(any("ordenado" in x for x in e))

    def test_un_idioma_desconocido_es_error(self):
        e, _ = validar_redes(dict(self.BASE, por_idioma={"pt": 3}))
        self.assertTrue(any("idioma" in x for x in e))

    def test_una_zona_desconocida_es_error(self):
        e, _ = validar_redes(dict(self.BASE, por_zona={"Hermosillo": 3}))
        self.assertTrue(any("zona desconocida" in x for x in e))

    def test_sin_cuentas_es_aviso_no_error(self):
        e, a = validar_redes(dict(self.BASE, salud=[]))
        self.assertEqual(e, [])
        self.assertTrue(any("ninguna cuenta verificada" in x for x in a))


class TestCatalogoCuentas(unittest.TestCase):
    """Lee el config/instagram.json real, como el resto de la suite."""

    def setUp(self):
        with open(os.path.join("config", "instagram.json"), encoding="utf-8") as fh:
            self.cfg = json.load(fh)

    def test_toda_cuenta_verificada_cita_su_sondeo(self):
        # Verificar no es editar el campo: es correr --sondear y anotar lo
        # que devolvio. De los seis handles derivados originales, CINCO
        # estaban mal y ninguno habria dado error al cosechar.
        for c in self.cfg["cuentas"]:
            if not c.get("verificado"):
                continue
            with self.subTest(cuenta=c["id"]):
                self.assertTrue(c.get("handle"), "una cuenta verificada necesita handle")
                self.assertIn("Sondeada", c.get("razon", ""))

    def test_una_cuenta_sin_handle_no_esta_activa(self):
        # Los huecos (Mexicali, San Quintin) se registran, no se cosechan.
        for c in self.cfg["cuentas"]:
            if not c.get("handle"):
                with self.subTest(cuenta=c["id"]):
                    self.assertFalse(c.get("activo"))

    def test_los_senuelos_traen_el_numero_que_los_delato(self):
        # Un senuelo sin evidencia es una opinion. @zetanoticias tiene 1,330
        # seguidores y 4,333 posts: pasa cualquier filtro numerico y aun asi
        # es otro medio.
        for s in self.cfg["senuelos"]:
            with self.subTest(handle=s["handle"]):
                self.assertTrue((s.get("porque") or "").strip())

    def test_cada_cuenta_declara_idioma_y_razon(self):
        for c in self.cfg["cuentas"]:
            with self.subTest(cuenta=c["id"]):
                self.assertIn(c.get("idioma"), ("es", "en"))
                self.assertTrue((c.get("razon") or "").strip())

    def test_no_hay_hashtags(self):
        # Un hashtag no lleva zona; se la acreditaria a todo comentario que
        # no nombre lugar. Ver senuelos en el archivo.
        for c in self.cfg["cuentas"]:
            with self.subTest(cuenta=c["id"]):
                self.assertFalse((c.get("handle") or "").startswith("#"))


# ------------------------------------------------------------ destacados

# Los nombres de campo son los del item de POST de apify~instagram-scraper.
# `latestComments` y `firstComment` traen texto de comentarios con su autor y
# NO estan en ninguna lista de identidad: por eso _limpiar_post es lista
# blanca. `likesCount: -1` es como el actor reporta likes ocultos.
POSTS_RICOS = [
    {"url": "https://www.instagram.com/p/AAA/", "type": "Sidecar",
     "caption": "Cierran la garita de San Ysidro por obras\n\nEl cruce estara "
                "cerrado toda la noche del domingo, informo CBP. #tijuana",
     "timestamp": "2026-09-01T10:00:00.000Z", "likesCount": 120, "commentsCount": 40,
     "ownerUsername": "zeta.tijuana", "ownerFullName": "Semanario ZETA", "ownerId": "1",
     "latestComments": [{"text": "pesimo servicio", "ownerUsername": "vecino_tj"}],
     "firstComment": "primer comentario"},
    {"url": "https://www.instagram.com/p/BBB/", "type": "Video",
     "caption": "x" * 200,
     "timestamp": "2026-09-02T10:00:00.000Z", "likesCount": -1, "commentsCount": 3,
     "videoViewCount": 900, "videoPlayCount": 1500},
    # Diez dias antes de AHORA: dentro de la retencion, fuera de la ventana.
    {"url": "https://www.instagram.com/p/VIEJO/", "type": "Image",
     "caption": "Nota vieja", "timestamp": "2026-08-24T10:00:00.000Z",
     "likesCount": 9999, "commentsCount": 1},
]


def _comentarios(post, likes, fecha="2026-09-02T10:00:00.000Z"):
    """Un comentario distinto por cada valor de likes, todos en `post`."""
    return [{"id": str(i), "text": "comentario numero {} sobre el agua".format(i),
             "ownerUsername": "alguien", "timestamp": fecha, "likesCount": n,
             "repliesCount": 0, "postUrl": post}
            for i, n in enumerate(likes)]


class TestPublicaciones(BaseCache):
    """El catalogo de posts: lista blanca, catalogo en cache y su retencion."""

    def test_limpiar_post_es_lista_blanca(self):
        # No basta con restar IDENTIDAD: el item trae comentarios ajenos con
        # autor en latestComments y firstComment.
        p = instagram._limpiar_post(POSTS_RICOS[0], CUENTA)
        self.assertEqual(sorted(p), ["comentarios", "cuenta", "fecha", "likes", "tipo",
                                     "titulo", "url", "zona"])
        crudo = json.dumps(p)
        for prohibido in ("vecino_tj", "pesimo servicio", "primer comentario",
                          "zeta.tijuana", "Semanario ZETA"):
            self.assertNotIn(prohibido, crudo)

    def test_el_titulo_es_la_primera_linea_del_pie(self):
        p = instagram._limpiar_post(POSTS_RICOS[0], CUENTA)
        self.assertEqual(p["titulo"], "Cierran la garita de San Ysidro por obras")

    def test_el_titulo_se_recorta(self):
        p = instagram._limpiar_post(POSTS_RICOS[1], CUENTA)
        self.assertLessEqual(len(p["titulo"]), instagram.TITULO_MAXIMO)
        self.assertTrue(p["titulo"].endswith("…"))

    def test_tipo_en_espanol_y_likes_ocultos_a_cero(self):
        p = instagram._limpiar_post(POSTS_RICOS[1], CUENTA)
        self.assertEqual(p["tipo"], "video")
        self.assertEqual(p["likes"], 0)
        # El mayor de los dos conteos de video.
        self.assertEqual(p["reproducciones"], 1500)

    def test_sin_video_no_hay_reproducciones(self):
        p = instagram._limpiar_post(POSTS_RICOS[0], CUENTA)
        self.assertNotIn("reproducciones", p)
        self.assertEqual(p["tipo"], "carrusel")

    def test_sin_url_no_hay_registro(self):
        self.assertIsNone(instagram._limpiar_post({"caption": "x"}, CUENTA))

    def test_cosechar_guarda_el_catalogo_aunque_no_toque_cosechar(self):
        # La segunda corrida del mismo dia no pide comentarios (freno de
        # costo) pero SI refresca los likes: sin esto los destacados se
        # congelarian en la primera lectura.
        mas_likes = [dict(POSTS_RICOS[0], likesCount=500)] + POSTS_RICOS[1:]
        with patch.object(instagram, "correr_actor", _Actor(posts=POSTS_RICOS)):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        with patch.object(instagram, "correr_actor", _Actor(posts=mas_likes)) as actor:
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        self.assertEqual([e["resultsType"] for e in actor.llamadas], ["posts"])
        pubs = instagram.leer_publicaciones(self.cache)
        self.assertEqual(pubs["https://www.instagram.com/p/AAA/"]["likes"], 500)

    def test_el_catalogo_se_poda_a_la_retencion(self):
        viejo = {"https://x/": {"url": "https://x/", "fecha": "2026-07-01", "likes": 1},
                 "https://y/": {"url": "https://y/", "fecha": "2026-09-01", "likes": 1},
                 "https://z/": {"url": "https://z/", "fecha": "", "likes": 1}}
        vivas = instagram.guardar_publicaciones(viejo, AHORA, self.cache)
        self.assertEqual(list(vivas), ["https://y/"])
        self.assertEqual(list(instagram.leer_publicaciones(self.cache)), ["https://y/"])

    def test_los_registros_no_son_cosecha(self):
        # purgar() no los borra, leer_cache() no los lee como comentarios y
        # clasificar_cache() no intenta etiquetarlos.
        from pulso.sentimiento import AnalizadorFalso
        with patch.object(instagram, "correr_actor", _Actor(posts=POSTS_RICOS)):
            instagram.cosechar([CUENTA], AHORA, tok="t", cache=self.cache)
        instagram.purgar(self.cache, AHORA)
        self.assertIn("publicaciones.json", os.listdir(self.cache))
        self.assertTrue(all("texto" in c for c in instagram.leer_cache(self.cache)))
        etiquetados, _ = instagram.clasificar_cache(self.cache, AnalizadorFalso())
        self.assertEqual(etiquetados, 2)


class TestDestacados(BaseCache):
    OTRA = dict(CUENTA, id="elvigia_ig", handle="@elvigiaensenada", zona="Ensenada",
                nombre="El Vigía")

    def _panel(self, publicaciones, comentarios=None, temas=None, cuentas=None):
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA) for c in (comentarios or [])]
        return instagram.derivar(vig, AHORA, [], {}, temas, publicaciones,
                                 cuentas or [CUENTA])

    def _pubs(self, cuenta=CUENTA, posts=POSTS_RICOS):
        return {p["url"]: p for p in (instagram._limpiar_post(x, cuenta) for x in posts)}

    def test_la_ventana_deja_fuera_lo_viejo_aunque_tenga_mas_likes(self):
        urls = [d["url"] for d in self._panel(self._pubs())["destacados"]]
        self.assertEqual(urls, ["https://www.instagram.com/p/AAA/",
                                "https://www.instagram.com/p/BBB/"])

    def test_una_fecha_posterior_a_ahora_es_reloj_roto_y_queda_fuera(self):
        pubs = self._pubs(posts=[dict(POSTS_RICOS[0], timestamp="2026-09-04T00:00:00Z")])
        self.assertEqual(self._panel(pubs)["destacados"], [])

    def test_orden_por_likes_luego_comentarios_luego_url(self):
        posts = [dict(POSTS_RICOS[0], url="https://www.instagram.com/p/{}/".format(u),
                      likesCount=l, commentsCount=c)
                 for u, l, c in (("C", 10, 1), ("A", 10, 5), ("B", 10, 5), ("D", 50, 0))]
        urls = [d["url"].rsplit("/", 2)[1] for d in self._panel(self._pubs(posts=posts))["destacados"]]
        self.assertEqual(urls, ["D", "A", "B", "C"])

    def test_union_del_top_general_y_del_top_por_zona(self):
        tj = [dict(POSTS_RICOS[0], url="https://www.instagram.com/p/T{}/".format(i),
                   likesCount=1000 - i) for i in range(20)]
        ens = [dict(POSTS_RICOS[0], url="https://www.instagram.com/p/E{}/".format(i),
                    likesCount=10 - i) for i in range(20)]
        pubs = {**self._pubs(posts=tj), **self._pubs(cuenta=self.OTRA, posts=ens)}
        d = self._panel(pubs, cuentas=[CUENTA, self.OTRA])["destacados"]
        por_zona = {}
        for x in d:
            por_zona[x["zona"]] = por_zona.get(x["zona"], 0) + 1
        # 15 de Tijuana (el top general) y 15 de Ensenada (su propio top).
        self.assertEqual(por_zona, {"Ensenada": 15, "Tijuana": 15})
        self.assertEqual([x["likes"] for x in d], sorted((x["likes"] for x in d), reverse=True))

    def test_una_cuenta_que_ya_no_esta_en_config_no_sale(self):
        d = self._panel(self._pubs(), cuentas=[self.OTRA])["destacados"]
        self.assertEqual(d, [])

    def test_conteos_por_post_cuadran_y_no_hay_texto(self):
        coms = _comentarios("https://www.instagram.com/p/AAA/", [3, 0, 1])
        coms.append(dict(coms[0], id="e", text="👏👏"))  # reaccion
        p = self._panel(self._pubs(), coms, temas=[{"termino": "agua"}])
        aaa = p["destacados"][0]
        self.assertEqual((aaa["cosechados"], aaa["opinion"]), (4, 3))
        suma = sum(aaa["sentimiento"].values())
        self.assertEqual(suma, aaa["opinion"])
        self.assertEqual(aaa["temas"], [{"tema": "agua", "comentarios": 3}])
        self.assertEqual(aaa["comentarios"], 40)  # el total del actor, no el cosechado
        self.assertNotIn("texto", json.dumps(p))
        self.assertNotIn("comentario numero", json.dumps(p))

    def test_el_catalogo_de_cuentas_va_sin_handle(self):
        apagada = {"id": "canal66_ig", "handle": None, "nombre": "Mexicali — sin cuenta",
                   "zona": "Mexicali", "activo": False, "verificado": False}
        p = self._panel({}, cuentas=[CUENTA, apagada])
        self.assertEqual(p["cuentas"], [
            {"cuenta": "canal66_ig", "nombre": "Mexicali — sin cuenta", "zona": "Mexicali",
             "activa": False},
            {"cuenta": "zeta_ig", "nombre": "zeta_ig", "zona": "Tijuana", "activa": True},
        ])
        self.assertNotIn("handle", json.dumps(p))

    def test_el_panel_con_destacados_pasa_el_validador_y_es_identico(self):
        coms = _comentarios("https://www.instagram.com/p/AAA/", [3, 0, 1])
        a = self._panel(self._pubs(), coms, temas=[{"termino": "agua"}])
        b = self._panel(self._pubs(), coms, temas=[{"termino": "agua"}])
        self.assertEqual(json.dumps(a), json.dumps(b))
        errores, _ = validar_redes(a)
        self.assertEqual(errores, [])
        self.assertNotIn("pct", json.dumps(a))


class TestComentariosPublicados(BaseCache):
    """El archivo de efimero/: texto sin identidad, y la regla del 'ver mas'."""

    POST = "https://www.instagram.com/p/AAA/"

    def _publicado(self, likes, visibles=2, maximo=10, extra=None):
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA)
               for c in _comentarios(self.POST, likes) + (extra or [])]
        destacados = [{"url": self.POST}]
        return instagram.publicar_comentarios(vig, destacados, AHORA,
                                              visibles=visibles, maximo=maximo)

    def test_visibles_siempre_y_despues_solo_con_likes(self):
        doc = self._publicado([5, 0, 4, 0, 3, 0, 2, 1])
        likes = [c["likes"] for c in doc["por_post"][self.POST]]
        # Con visibles=2: los dos primeros van siempre; del tercero en
        # adelante solo lo que alguien voto. Aqui ningun cero entra porque los
        # dos visibles ya tienen likes.
        self.assertEqual(likes, [5, 4, 3, 2, 1])

    def test_un_cero_visible_si_entra(self):
        doc = self._publicado([0, 0, 0], visibles=2)
        self.assertEqual([c["likes"] for c in doc["por_post"][self.POST]], [0, 0])

    def test_el_maximo_corta(self):
        doc = self._publicado(list(range(1, 20)), visibles=5, maximo=10)
        self.assertEqual(len(doc["por_post"][self.POST]), 10)

    def test_a_igual_likes_el_mas_reciente_primero(self):
        coms = _comentarios(self.POST, [1], fecha="2026-08-30T00:00:00Z") + [
            dict(_comentarios(self.POST, [1], fecha="2026-09-02T00:00:00Z")[0],
                 id="z", text="el mas nuevo")]
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA) for c in coms]
        doc = instagram.publicar_comentarios(vig, [{"url": self.POST}], AHORA)
        self.assertEqual(doc["por_post"][self.POST][0]["texto"], "el mas nuevo")

    def test_sin_identidad_ni_id(self):
        doc = self._publicado([5, 4])
        crudo = json.dumps(doc)
        for prohibido in ("alguien", "ownerUsername", '"id"', "respuestas", "cuenta"):
            self.assertNotIn(prohibido, crudo)
        self.assertEqual(sorted(doc["por_post"][self.POST][0]),
                         ["fecha", "likes", "sentimiento", "texto"])

    def test_solo_posts_destacados(self):
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA)
               for c in _comentarios("https://www.instagram.com/p/OTRO/", [9])]
        doc = instagram.publicar_comentarios(vig, [{"url": self.POST}], AHORA)
        self.assertEqual(doc["por_post"], {})

    def test_brigada_y_reacciones_no_se_publican(self):
        base = _comentarios(self.POST, [50])[0]
        brigada = [dict(base, id=str(n), text="PAGINA DE 4SC0 Y APARTE FAKE!!",
                        postUrl="https://www.instagram.com/p/{}/".format(n))
                   for n in ("AAA", "B", "C")]
        aplauso = dict(base, id="ap", text="👏👏", likesCount=99)
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA)
               for c in brigada + [aplauso] + _comentarios(self.POST, [1])]
        doc = instagram.publicar_comentarios(vig, [{"url": self.POST}], AHORA)
        textos = [c["texto"] for c in doc["por_post"][self.POST]]
        self.assertEqual(textos, ["comentario numero 0 sobre el agua"])

    def test_las_menciones_se_enmascaran_y_una_mencion_sola_no_se_publica(self):
        # El caso real de la primera publicacion: un comentario que era solo
        # "@aa_boxeador". Es la identidad de un tercero, y no dice nada.
        base = _comentarios(self.POST, [3])[0]
        coms = [dict(base, id="a", text="@aa_boxeador"),
                dict(base, id="b", text="@vecina.tj tiene razon, el agua no llega", likesCount=2)]
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA) for c in coms]
        doc = instagram.publicar_comentarios(vig, [{"url": self.POST}], AHORA)
        textos = [c["texto"] for c in doc["por_post"][self.POST]]
        self.assertEqual(textos, ["@… tiene razon, el agua no llega"])
        self.assertNotIn("aa_boxeador", json.dumps(doc))
        self.assertNotIn("vecina.tj", json.dumps(doc))

    def test_el_texto_se_recorta(self):
        largo = [dict(_comentarios(self.POST, [1])[0], text="a" * 900)]
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA) for c in largo]
        doc = instagram.publicar_comentarios(vig, [{"url": self.POST}], AHORA)
        texto = doc["por_post"][self.POST][0]["texto"]
        self.assertEqual(len(texto), instagram.TEXTO_MAXIMO)
        self.assertTrue(texto.endswith("…"))

    def test_la_etiqueta_va_en_espanol_o_null(self):
        vig = [instagram._limpiar(c, c["postUrl"], CUENTA)
               for c in _comentarios(self.POST, [2, 1])]
        vig[0]["sentimiento"] = {"etiqueta": "NEG", "confianza": 0.9, "modelo": "m"}
        doc = instagram.publicar_comentarios(vig, [{"url": self.POST}], AHORA)
        self.assertEqual([c["sentimiento"] for c in doc["por_post"][self.POST]],
                         ["negativo", None])

    def test_pasa_su_validador_y_es_identico(self):
        a = self._publicado([5, 0, 4])
        b = self._publicado([5, 0, 4])
        self.assertEqual(json.dumps(a), json.dumps(b))
        errores, _ = validar_redes_comentarios(a, {"destacados": [{"url": self.POST}]})
        self.assertEqual(errores, [])


class TestValidadorDestacados(unittest.TestCase):
    DESTACADO = {
        "url": "https://www.instagram.com/p/AAA/", "cuenta": "tjnoticias_ig",
        "zona": "Tijuana", "fecha": "2026-09-01", "titulo": "Titular", "tipo": "video",
        "likes": 10, "comentarios": 5, "reproducciones": 100, "cosechados": 3,
        "opinion": 2,
        "sentimiento": {"positivo": 1, "negativo": 1, "neutral": 0,
                        "sin_clasificar": 0, "sin_modelo_idioma": 0},
        "temas": [{"tema": "agua", "comentarios": 2}],
    }
    CON = dict(TestValidadorRedes.BASE, ventana_dias=7, destacados_maximo=15,
               cuentas=[{"cuenta": "tjnoticias_ig", "nombre": "TjNoticias",
                         "zona": "Tijuana", "activa": True}],
               destacados=[DESTACADO])

    def _con(self, **cambios):
        d = dict(self.CON)
        d["destacados"] = [dict(self.DESTACADO, **cambios)]
        return d

    def test_ausencia_es_aviso_no_error(self):
        e, a = validar_redes(dict(TestValidadorRedes.BASE))
        self.assertEqual(e, [])
        self.assertTrue(any("corte anterior" in x for x in a))

    def test_el_bloque_valido_pasa_con_un_id_de_13_caracteres(self):
        # tjnoticias_ig tiene 13 caracteres: RE_ID no aplica a cuentas.
        self.assertEqual(validar_redes(dict(self.CON))[0], [])

    def test_una_cuenta_fuera_del_catalogo_es_error(self):
        e, _ = validar_redes(self._con(cuenta="otra_ig"))
        self.assertTrue(any("no esta en 'cuentas'" in x for x in e))

    def test_una_fecha_posterior_a_generado_es_error(self):
        e, _ = validar_redes(self._con(fecha="2026-09-04"))
        self.assertTrue(any("reloj roto" in x for x in e))

    def test_una_fecha_fuera_de_la_ventana_es_error(self):
        e, _ = validar_redes(self._con(fecha="2026-08-20"))
        self.assertTrue(any("fuera de la ventana" in x for x in e))

    def test_un_titulo_largo_es_error(self):
        e, _ = validar_redes(self._con(titulo="x" * 161))
        self.assertTrue(any("titular del pie" in x for x in e))

    def test_un_handle_en_cuentas_es_clave_prohibida(self):
        d = dict(self.CON, cuentas=[dict(self.CON["cuentas"][0], handle="@x")])
        e, _ = validar_redes(d)
        self.assertTrue(any("clave prohibida" in x for x in e))

    def test_sentimiento_que_no_cuadra_es_error(self):
        e, _ = validar_redes(self._con(opinion=5))
        self.assertTrue(any("sentimiento suma" in x for x in e))

    def test_desorden_es_error(self):
        d = dict(self.CON)
        d["destacados"] = [dict(self.DESTACADO, likes=1),
                           dict(self.DESTACADO, url="https://www.instagram.com/p/B/", likes=9)]
        e, _ = validar_redes(d)
        self.assertTrue(any("no esta ordenado por (-likes" in x for x in e))

    def test_mas_del_maximo_por_zona_es_error(self):
        d = dict(self.CON, destacados_maximo=1)
        d["destacados"] = [dict(self.DESTACADO),
                           dict(self.DESTACADO, url="https://www.instagram.com/p/B/", likes=1)]
        e, _ = validar_redes(d)
        self.assertTrue(any("el maximo es 1" in x for x in e))

    def test_reproducciones_en_cero_es_error(self):
        e, _ = validar_redes(self._con(reproducciones=0))
        self.assertTrue(any("reproducciones" in x for x in e))

    def test_un_tipo_en_ingles_es_error(self):
        e, _ = validar_redes(self._con(tipo="Video"))
        self.assertTrue(any("tipo" in x for x in e))


class TestValidadorRedesComentarios(unittest.TestCase):
    POST = "https://www.instagram.com/p/AAA/"
    BASE = {"esquema": 1, "generado": AHORA, "plataforma": "instagram",
            "retencion_dias": 30, "visibles": 2, "maximo": 10,
            "por_post": {POST: [
                {"texto": "uno", "likes": 3, "fecha": "2026-09-01", "sentimiento": "negativo"},
                {"texto": "dos", "likes": 0, "fecha": "", "sentimiento": None},
                {"texto": "tres", "likes": 0, "fecha": "", "sentimiento": None},
            ]}}
    REDES = {"destacados": [{"url": POST}]}

    def _con(self, filas=None, **cambios):
        d = dict(self.BASE, **cambios)
        if filas is not None:
            d["por_post"] = {self.POST: filas}
        return d

    def test_el_cero_despues_de_los_visibles_es_error(self):
        e, _ = validar_redes_comentarios(self.BASE, self.REDES)
        self.assertTrue(any("sin likes despues de los 2 visibles" in x for x in e))

    def test_el_valido_pasa(self):
        e, _ = validar_redes_comentarios(self._con(self.BASE["por_post"][self.POST][:2]),
                                         self.REDES)
        self.assertEqual(e, [])

    def test_un_post_fuera_de_destacados_es_error(self):
        e, _ = validar_redes_comentarios(self._con(self.BASE["por_post"][self.POST][:2]),
                                         {"destacados": []})
        self.assertTrue(any("no esta en redes.destacados" in x for x in e))

    def test_identidad_o_id_es_error(self):
        filas = [dict(self.BASE["por_post"][self.POST][0], ownerUsername="x")]
        e, _ = validar_redes_comentarios(self._con(filas), self.REDES)
        self.assertTrue(any("clave prohibida" in x for x in e))
        filas = [dict(self.BASE["por_post"][self.POST][0], id="17900")]
        e, _ = validar_redes_comentarios(self._con(filas), self.REDES)
        self.assertTrue(any("clave prohibida" in x for x in e))

    def test_una_mencion_sin_enmascarar_es_error(self):
        filas = [dict(self.BASE["por_post"][self.POST][0], texto="@fulano tiene razon")]
        e, _ = validar_redes_comentarios(self._con(filas), self.REDES)
        self.assertTrue(any("mencion" in x for x in e))
        filas = [dict(self.BASE["por_post"][self.POST][0], texto="@… tiene razon")]
        e, _ = validar_redes_comentarios(self._con(filas), self.REDES)
        self.assertEqual(e, [])

    def test_texto_largo_es_error(self):
        filas = [dict(self.BASE["por_post"][self.POST][0], texto="a" * 301)]
        e, _ = validar_redes_comentarios(self._con(filas), self.REDES)
        self.assertTrue(any("recorte es 300" in x for x in e))

    def test_desorden_por_likes_es_error(self):
        filas = [dict(self.BASE["por_post"][self.POST][0], likes=1),
                 dict(self.BASE["por_post"][self.POST][0], likes=5)]
        e, _ = validar_redes_comentarios(self._con(filas), self.REDES)
        self.assertTrue(any("no esta ordenado por likes" in x for x in e))


if __name__ == "__main__":
    unittest.main()
