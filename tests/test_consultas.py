"""Pruebas de `pulso consultas` (pulso/consultas.py), siempre sin red.

Se sustituye 'pulso.consultas.correr_actor', el UNICO punto que toca Apify
para las tres plataformas. Los nombres de campo de los fixtures son los reales
de cada actor (ver tests/test_tiktok.py, tests/test_instagram.py y
tests/test_facebook.py). Lo que mas importa aqui, en este orden: que la
identidad de quien comenta no sobreviva en ningun cache; que dos corridas
den bytes identicos; que el documento pase su validador con la salvedad de
tono exacta; y que YouTube y X salgan `sin_dato` y no en cero.
"""

import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from pulso import consultas, facebook, instagram, tiktok
from pulso.pipeline import _serializar
from pulso.sentimiento import AnalizadorFalso
from pulso.validador import (validar_consultas, validar_consultas_comentarios,
                             validar_consultas_config)

AHORA = "2026-09-03T18:00:00+00:00"
CONFIG = os.path.join("config", "consultas.json")

CONSULTA = {
    "id": "cq_vivelabaja", "termino": "Vive la Baja", "tipo": "empresa", "idioma": "es",
    "activo": True, "verificado": "2026-09-01",
    "tiktok": {"consulta": "vive la baja"},
    "instagram": {"hashtags": ["vivelabaja"], "cuentas": ["@vivelabaja"]},
    "facebook": {"paginas": ["vivelabaja"]},
    "prensa": {"q": "\"Vive la Baja\""},
    "nota": "prueba",
}
PERSONA = {
    "id": "cq_persona", "termino": "Valente Márquez", "tipo": "persona", "idioma": "es",
    "activo": True, "verificado": "2026-09-01",
    "tiktok": {"consulta": "valente marquez"},
    "nota": "prueba",
}
COSECHA = dict(consultas.COSECHA_OMISION, posts_por_fuente=5, comentarios_por_post=5)


def _epoch(iso):
    return int(datetime.fromisoformat(iso).timestamp())


def _video(texto="Ruta del vino en Ensenada con Vive la Baja #ensenada", **cambios):
    base = {"id": "7301", "text": texto, "createTime": _epoch("2026-08-20T10:00:00+00:00"),
            "webVideoUrl": "https://www.tiktok.com/@ViveLaBaja/video/7301?lang=es",
            "authorMeta": {"name": "vivelabaja", "nickName": "Vive", "privateAccount": False},
            "diggCount": 120, "shareCount": 7, "playCount": 5000, "commentCount": 40,
            "collectCount": 3, "isAd": False, "videoMeta": {"duration": 30}}
    base.update(cambios)
    return base


def _comentario_tk(texto, likes=0):
    return {"cid": "c-" + texto[:6], "text": texto, "diggCount": likes, "replyCommentTotal": 0,
            "createTimeISO": "2026-08-21T11:00:00.000Z", "uniqueId": "vecino_tj", "uid": "99",
            "avatarThumbnail": "https://x.test/p.jpg",
            "videoWebUrl": "https://www.tiktok.com/@vivelabaja/video/7301"}


def _post_ig(url="https://www.instagram.com/p/AAA/", caption="Nueva casa en Tijuana"):
    return {"url": url, "caption": caption, "type": "Sidecar", "likesCount": 540,
            "commentsCount": 31, "timestamp": "2026-08-25T02:10:00.000Z",
            "ownerUsername": "vivelabaja", "ownerId": "1", "shortCode": "AAA"}


def _comentario_ig(texto, likes=0, post="https://www.instagram.com/p/AAA/"):
    return {"id": "ig-" + texto[:6], "text": texto, "ownerUsername": "clienta_feliz",
            "timestamp": "2026-08-26T10:00:00.000Z", "likesCount": likes, "repliesCount": 0,
            "postUrl": post}


def _post_fb(url="https://www.facebook.com/vivelabaja/posts/pfbid0abc",
             text="Este fin de semana en Tijuana abrimos"):
    return {"postId": "1001", "url": url, "text": text, "time": "2026-08-28T18:00:00.000Z",
            "likes": 88, "comments": 12, "shares": 2, "pageName": "Vive la Baja",
            "user": {"id": "555", "name": "Vive la Baja"},
            "media": [{"__typename": "Photo"}]}


def _comentario_fb(texto, likes=0, post="https://www.facebook.com/vivelabaja/posts/pfbid0abc"):
    return {"id": "fb1", "commentId": "fb1", "text": texto, "likesCount": likes,
            "commentsCount": 0, "date": "2026-08-29T10:00:00.000Z",
            "profileName": "Vecina Tijuana", "profileId": "777",
            "profileUrl": "https://www.facebook.com/vecina.tj", "inputUrl": post}


class _Actor:
    """Sustituye correr_actor. Despacha por actor y forma de la entrada."""

    def __init__(self):
        self.llamadas = []

    def __call__(self, actor, entrada, tok, limite, timeout=None):
        self.llamadas.append((actor, entrada, limite))
        if actor == tiktok.ACTOR_VIDEOS:
            return [_video()]
        if actor == tiktok.ACTOR_COMENTARIOS:
            return [_comentario_tk("Que bonito lugar, felicidades", 4),
                    _comentario_tk("Carisimo todo", 1)]
        if actor == instagram.ACTOR_POSTS:
            if entrada.get("resultsType") == "comments":
                return [_comentario_ig("Me encanta el diseno", 9),
                        _comentario_ig("Cuanto cuesta? @amiga mira", 2)]
            if "explore/tags" in entrada["directUrls"][0]:
                # El hashtag ve el post propio (ya visto por la cuenta) y uno ajeno.
                return [_post_ig(), _post_ig("https://www.instagram.com/p/BBB/",
                                              "Vine a ver el desarrollo #vivelabaja")]
            return [_post_ig()]
        if actor == facebook.ACTOR_POSTS:
            return [_post_fb()]
        if actor == facebook.ACTOR_COMENTARIOS:
            return [_comentario_fb("Excelente ubicacion", 5),
                    _comentario_fb("No contestan el telefono", 0)]
        raise AssertionError("actor inesperado {}".format(actor))


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.cache = os.path.join(self.dir, "cache")

    def _cosechar(self, filas=None, actor=None, ahora=AHORA, **kw):
        actor = actor or _Actor()
        with patch.object(consultas, "correr_actor", actor):
            salida = consultas.cosechar(filas or [CONSULTA], ahora, tok="t", cache=self.cache,
                                        cosecha=COSECHA, **kw)
        return actor, salida

    def _doc(self, filas=None, ahora=AHORA, **kw):
        filas = filas or [CONSULTA]
        _, (_, salud, gasto) = self._cosechar(filas, ahora=ahora)
        return consultas.derivar(filas, ahora, salud, gasto, cache=self.cache, cosecha=COSECHA,
                                 **kw)


class TestFuentes(unittest.TestCase):
    def test_orden_fijo_y_cuenta_es_el_id_del_termino(self):
        f = consultas._fuentes(CONSULTA)
        self.assertEqual([(x["plataforma"], x["origen"], x["valor"]) for x in f], [
            ("tiktok", "busqueda", "vive la baja"),
            ("instagram", "cuenta", "@vivelabaja"),
            ("instagram", "hashtag", "vivelabaja"),
            ("facebook", "pagina", "vivelabaja"),
        ])
        self.assertTrue(all(x["cuenta"] == "cq_vivelabaja" for x in f))

    def test_solo_activas_y_verificadas(self):
        apagada = dict(CONSULTA, id="cq_apagada", activo=False)
        sin_fecha = dict(CONSULTA, id="cq_sinfecha", verificado=None)
        self.assertEqual([c["id"] for c in consultas._activas([apagada, CONSULTA, sin_fecha])],
                         ["cq_vivelabaja"])
        self.assertEqual(consultas._activas([CONSULTA], solo={"otra"}), [])


class TestCosecha(Base):
    def test_las_entradas_de_la_primera_pasada(self):
        actor, _ = self._cosechar()
        entradas = {(a, e.get("resultsType"), e.get("directUrls", [None])[0]): e
                    for a, e, _ in actor.llamadas}
        tk = next(e for a, e, _ in actor.llamadas if a == tiktok.ACTOR_VIDEOS)
        self.assertEqual((tk["searchQueries"], tk["videoSearchDateFilter"]),
                         (["vive la baja"], "PAST_MONTH"))
        ig_tag = entradas[(instagram.ACTOR_POSTS, "posts",
                           "https://www.instagram.com/explore/tags/vivelabaja/")]
        self.assertEqual(ig_tag["onlyPostsNewerThan"], "30 days")
        self.assertIn((instagram.ACTOR_POSTS, "posts", "https://www.instagram.com/vivelabaja/"),
                      entradas)
        fb = next(e for a, e, _ in actor.llamadas if a == facebook.ACTOR_POSTS)
        self.assertEqual(fb["startUrls"], [{"url": "https://www.facebook.com/vivelabaja/"}])

    def test_el_cache_es_por_termino_y_plataforma(self):
        self._cosechar()
        for p in consultas.PLATAFORMAS:
            self.assertTrue(os.path.isdir(os.path.join(self.cache, "cq_vivelabaja", p)), p)

    def test_la_cuenta_gana_al_hashtag_en_el_post_propio(self):
        self._cosechar()
        pubs = consultas.leer_publicaciones(os.path.join(self.cache, "cq_vivelabaja", "instagram"))
        self.assertEqual(pubs["https://www.instagram.com/p/AAA/"]["origen"], "cuenta")
        self.assertEqual(pubs["https://www.instagram.com/p/BBB/"]["origen"], "hashtag")

    def test_la_segunda_corrida_no_repaga_comentarios_hasta_dias_entre_cosechas(self):
        self._cosechar()
        mas_tarde = (datetime.fromisoformat(AHORA) + timedelta(days=5)).isoformat()
        actor, _ = self._cosechar(ahora=mas_tarde)
        coms = [a for a, _, _ in actor.llamadas
                if a in (tiktok.ACTOR_COMENTARIOS, facebook.ACTOR_COMENTARIOS)]
        ig_coms = [e for a, e, _ in actor.llamadas if e.get("resultsType") == "comments"]
        self.assertEqual((coms, ig_coms), ([], []), "con 7 dias, a los 5 no se paga de nuevo")
        actor, _ = self._cosechar(ahora=(datetime.fromisoformat(AHORA)
                                         + timedelta(days=8)).isoformat())
        self.assertTrue([a for a, _, _ in actor.llamadas if a == tiktok.ACTOR_COMENTARIOS])

    def test_sin_token_devuelve_vacio_y_no_escribe(self):
        with patch.object(consultas, "correr_actor", _Actor()):
            nuevos, salud, _ = consultas.cosechar([CONSULTA], AHORA, cache=self.cache,
                                                  cosecha=COSECHA, entorno={})
        self.assertEqual(nuevos, [])
        self.assertEqual({s["estado"] for s in salud}, {"sin_token"})
        self.assertEqual(len(salud), 4)
        self.assertFalse(os.path.exists(self.cache))

    def test_un_presupuesto_para_todas_las_fuentes(self):
        actor, (_, _, gasto) = self._cosechar()
        limites = {l for _, _, l in actor.llamadas}
        self.assertTrue(all(l >= 1 for l in limites))
        self.assertEqual(gasto["resultados"], COSECHA["presupuesto_resultados"])
        self.assertGreater(gasto["gastado"], 0)

    def test_la_busqueda_de_facebook_apagada_es_una_fila_fallo_y_no_tumba_las_demas(self):
        con_busqueda = dict(CONSULTA, facebook={"paginas": ["vivelabaja"], "busqueda": "vive la baja"})
        _, (_, salud, _) = self._cosechar([con_busqueda])
        fila = next(s for s in salud if s["origen"] == "busqueda" and s["plataforma"] == "facebook")
        self.assertEqual(fila["estado"], "fallo")
        self.assertIn("ActorProhibido", fila["error"])
        self.assertEqual([s["estado"] for s in salud if s is not fila], ["ok"] * 4)

    def test_probar_no_escribe_y_solo_hace_la_primera_pasada(self):
        actor = _Actor()
        with patch.object(consultas, "correr_actor", actor):
            filas = consultas.probar([CONSULTA, dict(CONSULTA, id="cq_off", activo=False)],
                                     AHORA, tok="t", cosecha=COSECHA)
        self.assertFalse(os.path.exists(self.cache))
        self.assertEqual({a for a, _, _ in actor.llamadas},
                         {tiktok.ACTOR_VIDEOS, instagram.ACTOR_POSTS, facebook.ACTOR_POSTS})
        # Apagadas incluidas: es el paso previo a encenderlas.
        self.assertEqual({f["consulta"] for f in filas}, {"cq_vivelabaja", "cq_off"})
        tk = next(f for f in filas if f["plataforma"] == "tiktok" and f["consulta"] == "cq_vivelabaja")
        self.assertEqual(tk["publicaciones"][0]["creador"], "@vivelabaja")
        self.assertNotIn("claves_descartadas", tk)

    def test_probar_dice_los_campos_de_lo_descartado_y_nunca_su_contenido(self):
        actor = _Actor()
        actor.__class__ = type("_A", (_Actor,), {
            "__call__": lambda self, a, e, t, l, timeout=None:
                [{"error": "not found", "profileName": "Vecina", "url": ""}]})
        with patch.object(consultas, "correr_actor", actor):
            filas = consultas.probar([CONSULTA], AHORA, tok="t", cosecha=COSECHA)
        fb = next(f for f in filas if f["plataforma"] == "facebook")
        self.assertEqual(fb["descartes"], {"sin_url": 1})
        self.assertEqual(fb["claves_descartadas"], ["error", "profileName", "url"])
        self.assertNotIn("Vecina", json.dumps(filas))


class TestIdentidad(Base):
    def test_ninguna_identidad_llega_al_cache(self):
        self._cosechar()
        crudo = ""
        for raiz, _, archivos in os.walk(self.cache):
            for a in archivos:
                with open(os.path.join(raiz, a), encoding="utf-8") as fh:
                    crudo += fh.read()
        for prohibido in ("vecino_tj", "uniqueId", "avatarThumbnail", "clienta_feliz",
                          "ownerUsername", "Vecina", "profileName", "profileId", "profileUrl",
                          "pageName", "\"user\""):
            self.assertNotIn(prohibido, crudo)
        # El creador de TikTok si: es quien publico y la URL ya lo trae.
        self.assertIn("@vivelabaja", crudo)

    def test_el_documento_no_trae_texto_ni_identidad(self):
        doc = self._doc()
        crudo = _serializar(doc)
        for prohibido in ("Que bonito", "Me encanta", "Excelente ubicacion", "clienta_feliz",
                          "\"texto\"", "\"user\"", "profileName"):
            self.assertNotIn(prohibido, crudo)


MEDIOS_PRENSA = [
    {"id": "elvigia", "nombre": "El Vigía", "url": "https://www.elvigia.net/",
     "zona": "Ensenada", "activo": True, "idioma": "es"},
    {"id": "kpbs", "nombre": "KPBS", "url": "https://www.kpbs.org/index.rss",
     "zona": "San Diego", "activo": True, "idioma": "en"},
]
BUSCADOR = {"id": "byn", "nombre": "Blanco y Negro Noticias",
            "url": "https://blancoynegro.mx/?s={q}&feed=rss2", "idioma": "es",
            "activo": True, "verificado": "2026-09-01", "nota": "prueba"}
BUSCADOR_APAGADO = dict(BUSCADOR, id="off", url="https://apagado.mx/?s={q}&feed=rss2",
                        activo=False, verificado=None)


def _gn(titulo, token, fecha, fuente="El Vigía", fuente_url="https://www.elvigia.net"):
    return {"titulo": "{} - {}".format(titulo, fuente),
            "url": "https://news.google.com/rss/articles/{}?oc=5".format(token),
            "fecha_cruda": fecha, "fuente_texto": fuente, "fuente_url": fuente_url}


def _wp(titulo, slug, fecha, host="blancoynegro.mx"):
    return {"titulo": titulo, "url": "https://{}/bc/{}".format(host, slug), "fecha_cruda": fecha}


class TestPrensa(Base):
    """La prensa mide seis meses, cada titular lleva tono, y hay dos caminos."""

    def _feed(self, url, timeout=15):
        if url.startswith("https://news.google.com/"):
            return [_gn("Vive la Baja abre temporada en Ensenada", "CBMiXabc",
                        "Fri, 14 Aug 2026 14:00:00 GMT"),
                    # Dentro de los 180 dias y fuera de los 30: la ventana es la
                    # de la prensa.
                    _gn("Vive la Baja, denuncia por falta de agua", "CBMiXjul",
                        "Wed, 01 Jul 2026 14:00:00 GMT"),
                    # Anterior a los 180 dias: se cuenta, no se muestra.
                    _gn("Vive la Baja hace un ano", "CBMiXviejo",
                        "Mon, 01 Sep 2025 14:00:00 GMT"),
                    # En ingles, de un medio del catalogo: sin modelo de idioma.
                    _gn("Vive la Baja opens season", "CBMiXen",
                        "Sat, 15 Aug 2026 14:00:00 GMT", "KPBS", "https://www.kpbs.org")]
        if "blancoynegro.mx" in url:
            self.assertNotIn("%22", url, "sin comillas: WordPress las manda al LIKE")
            self.assertIn("s=Vive%20la%20Baja", url)
            return [
                # El mismo titular que el buscador de noticias: gana el del medio.
                _wp("Vive la Baja abre temporada en Ensenada", "abre", "Fri, 14 Aug 2026 09:00:00 GMT"),
                _wp("Crecen quejas contra Vive la Baja; denuncia por fraudes", "quejas",
                    "Wed, 11 Mar 2026 09:00:00 GMT"),
                # Empareja por el cuerpo pero el titular no nombra el termino: fuera.
                _wp("Hallan fosa en Sinaloa", "fosa", "Tue, 30 Jun 2026 09:00:00 GMT"),
                # Nombra el termino pero es de 2024: `anteriores`.
                _wp("Vive la Baja: estafa inmobiliaria", "estafa", "Fri, 08 Mar 2024 09:00:00 GMT"),
                # Enlace de otro host: fuera.
                _wp("Vive la Baja en otro sitio", "otro", "Fri, 14 Aug 2026 09:00:00 GMT",
                    host="otro.mx"),
            ]
        raise AssertionError("url inesperada: " + url)

    def _prensa(self, filas=None, **kw):
        kw.setdefault("robots", lambda url: True)
        kw.setdefault("cosecha", COSECHA)
        return consultas.prensa(filas or [CONSULTA], MEDIOS_PRENSA, AHORA, feed=self._feed,
                                buscadores=[BUSCADOR, BUSCADOR_APAGADO], **kw)

    def test_lo_excluido_a_mano_no_sale_y_se_cuenta(self):
        """Un homonimo se descarta por titular, con su razon en el config.

        Por TITULAR y no por enlace: el del buscador de noticias es un token
        que rota entre corridas, asi que una exclusion por url dejaria de
        aplicar sola. Y por contencion, porque el mismo titular llega con y
        sin el sufijo « - Medio» segun el camino.
        """
        fila = dict(CONSULTA, prensa={
            "q": "\"Vive la Baja\"",
            "excluidos": [{"titulo": "denuncia por falta de agua", "razon": "otro tema"},
                          {"titulo": "estafa inmobiliaria", "razon": "de 2024, y no es"}]})
        b = self._prensa([fila])["cq_vivelabaja"]
        self.assertNotIn("Vive la Baja, denuncia por falta de agua",
                         [r["titulo"] for r in b["resultados"]])
        self.assertEqual(b["anteriores"], [], "tambien se descarta entre los anteriores")
        self.assertEqual(b["excluidos"], 2, "uno de cada lista")
        self.assertEqual(b["tono"]["titulares"], 3, "el conteo cuadra con lo que queda")
        errores, _ = validar_consultas(self._doc(prensa=self._prensa([fila])),
                                       {"consultas": [CONSULTA]})
        self.assertEqual(errores, [])

    def test_sin_exclusiones_el_conteo_va_en_cero(self):
        self.assertEqual(self._prensa()["cq_vivelabaja"]["excluidos"], 0)

    def test_seis_meses_dos_caminos_y_los_anteriores_se_cuentan(self):
        b = self._prensa()["cq_vivelabaja"]
        self.assertEqual((b["estado"], b["ventana_dias"]), ("ok", 180))
        titulos = [r["titulo"] for r in b["resultados"]]
        self.assertEqual(titulos, [
            "Vive la Baja opens season",
            "Vive la Baja abre temporada en Ensenada",
            "Vive la Baja, denuncia por falta de agua",
            "Crecen quejas contra Vive la Baja; denuncia por fraudes",
        ], "orden por fecha descendente, sin repetidos, solo los que nombran el termino")
        # El repetido se queda con el enlace del MEDIO, no con el token.
        abre = b["resultados"][1]
        self.assertEqual((abre["origen"], abre["url"], abre["dominio"], abre["fuente"]),
                         ("medio", "https://blancoynegro.mx/bc/abre", "blancoynegro.mx",
                          "Blanco y Negro Noticias"))
        agua = b["resultados"][2]
        self.assertEqual((agua["origen"], agua["url"], agua["dominio"]),
                         ("noticias", "https://news.google.com/rss/articles/CBMiXjul?oc=5",
                          "elvigia.net"))
        # Los anteriores del buscador del medio se publican como filas, con
        # fecha; los del buscador de noticias solo como conteo (los filtro
        # pulso/busquedas.py antes de que los vieramos).
        self.assertEqual([(r["titulo"], r["fecha"], r["origen"]) for r in b["anteriores"]],
                         [("Vive la Baja: estafa inmobiliaria", "2024-03-08", "medio")])
        self.assertEqual([(x["id"], x["anteriores"]) for x in b["buscadores"]],
                         [("noticias", 1), ("byn", 1)])
        self.assertEqual(b["buscadores"][1]["titulares"], 2)
        self.assertIn("180 días", b["muestra"])
        for r in b["resultados"] + b["anteriores"]:
            self.assertEqual(set(r), {"titulo", "url", "dominio", "fuente", "fecha", "origen",
                                      "tono"})
            self.assertNotIn("idioma", r)

    def test_sin_modelo_el_tono_es_null_y_se_cuenta_sin_clasificar(self):
        b = self._prensa()["cq_vivelabaja"]
        self.assertTrue(all(r["tono"] is None for r in b["resultados"]))
        t = b["tono"]
        self.assertEqual((t["titulares"], t["sin_clasificar"], t["sin_modelo_idioma"],
                          t["metodo"], t["modelo"]), (4, 4, 0, "ninguno", None))
        self.assertEqual(t["favorable"] + t["adversa"] + t["neutral"], 0)

    def test_con_modelo_cada_titular_lleva_tono_de_prensa_y_el_ingles_queda_fuera(self):
        b = self._prensa(analizador=AnalizadorFalso())["cq_vivelabaja"]
        por_titulo = {r["titulo"]: r["tono"] for r in b["resultados"]}
        self.assertEqual(por_titulo["Crecen quejas contra Vive la Baja; denuncia por fraudes"],
                         "adversa")
        self.assertEqual(por_titulo["Vive la Baja, denuncia por falta de agua"], "adversa")
        self.assertEqual(por_titulo["Vive la Baja abre temporada en Ensenada"], "neutral")
        self.assertIsNone(por_titulo["Vive la Baja opens season"], "KPBS publica en ingles")
        t = b["tono"]
        self.assertEqual((t["adversa"], t["neutral"], t["favorable"], t["sin_modelo_idioma"],
                          t["sin_clasificar"], t["metodo"]), (2, 1, 0, 1, 0, "modelo"))
        self.assertEqual(t["modelo"], AnalizadorFalso.modelo)
        for r in b["resultados"]:
            self.assertNotIn(r["tono"], ("positivo", "negativo"),
                             "vocabulario de prensa, nunca el de comentarios")
        # Los anteriores llevan tono por fila y NO entran al conteo del bloque.
        self.assertEqual([r["tono"] for r in b["anteriores"]], ["neutral"])
        self.assertEqual(t["titulares"], 4)
        self.assertEqual(b["por_medio"], [
            {"fuente": "Blanco y Negro Noticias", "dominio": "blancoynegro.mx", "titulares": 2,
             "favorable": 0, "adversa": 1, "neutral": 1},
            {"fuente": "El Vigía", "dominio": "elvigia.net", "titulares": 1,
             "favorable": 0, "adversa": 1, "neutral": 0},
            {"fuente": "KPBS", "dominio": "kpbs.org", "titulares": 1,
             "favorable": 0, "adversa": 0, "neutral": 0},
        ])

    def test_se_lee_de_las_filas_apagadas_tambien(self):
        apagada = dict(CONSULTA, activo=False, verificado=None)
        self.assertEqual(self._prensa([apagada])["cq_vivelabaja"]["estado"], "ok")

    def test_robots_prohibido_se_dice_y_no_se_pide(self):
        pedidas = []

        def feed(url, timeout=15):
            pedidas.append(url)
            return self._feed(url, timeout)
        b = consultas.prensa([CONSULTA], MEDIOS_PRENSA, AHORA, feed=feed, cosecha=COSECHA,
                             buscadores=[BUSCADOR],
                             robots=lambda url: "blancoynegro" not in url)["cq_vivelabaja"]
        self.assertFalse([u for u in pedidas if "blancoynegro" in u])
        self.assertEqual(b["buscadores"][1]["estado"], "robots")
        self.assertEqual(len(b["resultados"]), 3, "solo el buscador de noticias")

    def test_una_segunda_pagina_solo_si_la_primera_viene_llena_y_dentro(self):
        pedidas = []

        def feed(url, timeout=15):
            pedidas.append(url)
            if url.startswith("https://news.google.com/"):
                return []
            if "paged=2" in url:
                return [_wp("Vive la Baja, pagina dos", "p2", "Sun, 01 Mar 2026 09:00:00 GMT")]
            return [_wp("Vive la Baja {}".format(i), "p{}".format(i),
                        "Fri, 14 Aug 2026 09:00:00 GMT") for i in range(10)]
        b = consultas.prensa([CONSULTA], MEDIOS_PRENSA, AHORA, feed=feed, cosecha=COSECHA,
                             buscadores=[BUSCADOR], robots=lambda url: True)["cq_vivelabaja"]
        self.assertEqual(len([u for u in pedidas if "paged=2" in u]), 1)
        self.assertEqual(len(b["resultados"]), 10, "la de marzo es anterior a la ventana")
        self.assertEqual([r["fecha"] for r in b["anteriores"]], ["2026-03-01"])
        self.assertEqual(b["buscadores"][0], {"id": "noticias", "nombre": "buscador de noticias",
                                              "estado": "ok", "titulares": 0, "anteriores": 0})

    def test_sin_q_es_sin_dato_y_todo_caido_es_fallo(self):
        sin_q = dict(CONSULTA, prensa={})
        self.assertEqual(self._prensa([sin_q])["cq_vivelabaja"]["estado"], "sin_dato")

        def caido(url, timeout=15):
            raise OSError("sin red")
        b = consultas.prensa([CONSULTA], [], AHORA, feed=caido, buscadores=[BUSCADOR],
                             robots=lambda url: True)["cq_vivelabaja"]
        self.assertEqual(b["estado"], "fallo")
        self.assertEqual(b["razon"], consultas.RAZON_PRENSA_FALLO)

    def test_un_buscador_caido_no_tumba_el_bloque(self):
        def feed(url, timeout=15):
            if "blancoynegro" in url:
                raise OSError("sin red")
            return self._feed(url, timeout)
        b = consultas.prensa([CONSULTA], MEDIOS_PRENSA, AHORA, feed=feed, cosecha=COSECHA,
                             buscadores=[BUSCADOR], robots=lambda url: True)["cq_vivelabaja"]
        self.assertEqual(b["estado"], "ok")
        self.assertEqual(b["buscadores"][1]["estado"], "fallo")
        self.assertEqual(len(b["resultados"]), 3)

    def test_url_buscador_y_nombra(self):
        self.assertEqual(consultas.url_buscador(BUSCADOR, "Grupo Concordia"),
                         "https://blancoynegro.mx/?s=Grupo%20Concordia&feed=rss2")
        self.assertEqual(consultas.url_buscador(BUSCADOR, "x", 2),
                         "https://blancoynegro.mx/?s=x&feed=rss2&paged=2")
        self.assertTrue(consultas._nombra("Crecen quejas contra GRUPO CONCORDIA", "Grupo Concordia"))
        self.assertFalse(consultas._nombra("Detienen a dos en Concordia, Sinaloa", "Grupo Concordia"))
        self.assertTrue(consultas._nombra("Valente Marquez Amezquita", "Valente Márquez"))

    def test_el_bloque_pasa_el_validador_y_entra_al_documento(self):
        prensa = self._prensa(analizador=AnalizadorFalso())
        doc = self._doc(prensa=prensa)
        errores, _ = validar_consultas(doc, {"consultas": [CONSULTA]})
        self.assertEqual(errores, [])
        self.assertEqual(doc["ventana_prensa_dias"], 180)
        self.assertEqual(doc["consultas"][0]["prensa"]["ventana_dias"], 180)


AGREGADOS = [
    {"url": "https://zetatijuana.com/2026/05/dinero-seguro/",
     "titulo": "“Dinero seguro”, invertir en un terreno en Tijuana",
     "fuente": "Semanario ZETA", "fecha": "2026-05-18", "nota": "prueba"},
    # Sin fecha: un post de Facebook no publica una legible sin sesion.
    {"url": "https://www.facebook.com/TijuanaLineaRoja/posts/1493856925630886/",
     "titulo": "¡Sigue la impunidad! Denuncian fraudes inmobiliarios",
     "fuente": "Tijuana Línea Roja (Facebook)", "fecha": None, "nota": "prueba"},
    {"url": "https://saidbetanzos.com/2026/04/22/despojo/",
     "titulo": "Denuncian despojo con helicóptero; el juez retrasa audiencias",
     "fuente": "Said Betanzos", "fecha": "2026-04-22", "nota": "prueba"},
]


class TestAgregados(Base):
    """Los enlaces que una fila trae a mano: lista propia, fuera de la prensa."""

    def test_orden_tono_y_forma(self):
        filas = consultas.agregados([dict(CONSULTA, agregados=AGREGADOS)], AHORA,
                                    analizador=AnalizadorFalso())["cq_vivelabaja"]
        self.assertEqual([r["fecha"] for r in filas], ["2026-05-18", "2026-04-22", None],
                         "por fecha descendente y la que falta al final")
        for r in filas:
            self.assertEqual(set(r), {"titulo", "url", "fuente", "fecha", "origen", "tono"})
            self.assertEqual(r["origen"], "manual")
            self.assertIn(r["tono"], consultas.TONOS_PRENSA,
                          "vocabulario de prensa, nunca el de comentarios")
        duro = dict(AGREGADOS[0], titulo="Crisis y denuncia por el despojo de un predio")
        fila = consultas.agregados([dict(CONSULTA, agregados=[duro])], AHORA,
                                   analizador=AnalizadorFalso())["cq_vivelabaja"][0]
        self.assertEqual(fila["tono"], "adversa")

    def test_sin_analizador_el_tono_es_null(self):
        filas = consultas.agregados([dict(CONSULTA, agregados=AGREGADOS)], AHORA)["cq_vivelabaja"]
        self.assertTrue(all(r["tono"] is None for r in filas))

    def test_una_fila_sin_agregados_no_aparece_ni_en_el_documento(self):
        self.assertEqual(consultas.agregados([CONSULTA], AHORA), {})
        doc = self._doc(agregados=consultas.agregados([CONSULTA], AHORA))
        self.assertNotIn("agregados", doc["consultas"][0],
                         "la clave se omite: una lista vacia diria «no hay nada que agregar»")

    def test_entran_al_documento_y_pasan_el_validador(self):
        fila = dict(CONSULTA, agregados=AGREGADOS)
        doc = self._doc([fila], agregados=consultas.agregados([fila], AHORA,
                                                              analizador=AnalizadorFalso()))
        c = doc["consultas"][0]
        self.assertEqual(len(c["agregados"]), 3)
        errores, _ = validar_consultas(doc, {"consultas": [fila]})
        self.assertEqual(errores, [])
        # Y no se cuelan en el conteo de prensa, que mide otra cosa.
        self.assertNotIn("agregados", json.dumps(c["prensa"]))

    def test_se_leen_tambien_de_una_fila_apagada(self):
        apagada = dict(CONSULTA, activo=False, verificado=None, agregados=AGREGADOS)
        self.assertEqual(len(consultas.agregados([apagada], AHORA)["cq_vivelabaja"]), 3)


class TestArchivo(Base):
    def _datos(self, notas):
        d = os.path.join(self.dir, "datos")
        os.makedirs(os.path.join(d, "archivo"))
        with open(os.path.join(d, "notas.json"), "w", encoding="utf-8") as fh:
            json.dump({"notas": notas}, fh)
        return d

    def test_cuenta_solo_la_ventana_y_la_clave_es_coincidencias(self):
        d = self._datos([
            {"id": "a", "titulo": "VIVE LA BAJA inaugura", "fecha": "2026-08-20"},
            {"id": "b", "titulo": "Vive la Baja, hace meses", "fecha": "2026-06-01"},
            {"id": "c", "titulo": "Otra cosa", "fecha": "2026-08-30"},
        ])
        medios = {"medios": [{"id": "m1", "activo": True}, {"id": "m2", "activo": False}]}
        busq = {"busquedas": [{"id": "b1"}]}
        # La ventana por omision es la de la PRENSA (180 dias): la de junio entra.
        bloque = consultas.archivo([CONSULTA], d, AHORA, medios, busq)["cq_vivelabaja"]
        self.assertEqual((bloque["coincidencias"], bloque["medios"], bloque["busquedas"]),
                         (2, 1, 1))
        self.assertIn("180 días", bloque["muestra"])
        self.assertNotIn("notas", bloque)
        corto = consultas.archivo([CONSULTA], d, AHORA, medios, busq,
                                  ventana_dias=30)["cq_vivelabaja"]
        self.assertEqual(corto["coincidencias"], 1)
        self.assertIn("30 días", corto["muestra"])

    def test_se_cuenta_para_las_filas_apagadas_tambien(self):
        d = self._datos([{"id": "a", "titulo": "Vive la Baja inaugura", "fecha": "2026-08-20"}])
        apagada = dict(CONSULTA, activo=False, verificado=None)
        self.assertEqual(consultas.archivo([apagada], d, AHORA)["cq_vivelabaja"]["coincidencias"], 1)

    def test_un_archivo_vacio_no_afirma_cero(self):
        self.assertEqual(consultas.archivo([CONSULTA], self._datos([]), AHORA), {})


class TestDerivar(Base):
    def test_youtube_y_x_sin_dato_y_las_tres_con_conteos(self):
        doc = self._doc()
        c = doc["consultas"][0]
        for p in ("youtube", "x"):
            self.assertEqual(set(c["plataformas"][p]), {"estado", "razon"})
            self.assertEqual(c["plataformas"][p]["estado"], "sin_dato")
        tk = c["plataformas"]["tiktok"]
        self.assertEqual((tk["estado"], tk["publicaciones"], tk["comentarios_cosechados"]),
                         ("ok", 1, 2))
        self.assertEqual(c["plataformas"]["instagram"]["publicaciones"], 2)
        self.assertEqual(c["plataformas"]["facebook"]["publicaciones"], 1)

    def test_los_destacados_llevan_origen_fuente_y_las_cifras_de_su_plataforma(self):
        c = self._doc()["consultas"][0]
        tk = c["plataformas"]["tiktok"]["destacados"][0]
        self.assertEqual((tk["cuenta"], tk["origen"], tk["fuente"], tk["creador"]),
                         ("cq_vivelabaja", "busqueda", "vive la baja", "@vivelabaja"))
        self.assertEqual((tk["zona"], tk["alcance"]), ("Ensenada", "zona"))
        self.assertIn("compartidos", tk)
        ig = c["plataformas"]["instagram"]["destacados"]
        self.assertEqual([d["origen"] for d in ig], ["cuenta", "hashtag"])
        self.assertTrue(all("compartidos" not in d and "creador" not in d for d in ig))
        fb = c["plataformas"]["facebook"]["destacados"][0]
        self.assertEqual((fb["fuente"], fb["compartidos"], fb["zona"]), ("vivelabaja", 2, "Tijuana"))
        claves = [(-d["likes"], -d["comentarios"], d["url"]) for d in ig]
        self.assertEqual(claves, sorted(claves))

    def test_tono_con_la_salvedad_exacta_y_temas_solo_termino_y_n(self):
        c = self._doc()["consultas"][0]
        t = c["tono"]
        self.assertEqual(t["salvedad_tono"], consultas.SALVEDAD_TONO)
        self.assertEqual(t["comentarios"], 6)
        self.assertEqual(t["sin_clasificar"], 6, "sin modelo, todo queda sin clasificar")
        self.assertEqual((t["metodo"], t["modelo"]), ("ninguno", None))
        for tema in c["temas"]["temas"]:
            self.assertEqual(set(tema), {"termino", "n"})
        self.assertNotIn("ejemplos", json.dumps(c["temas"]))

    def test_el_modelo_falso_etiqueta_y_el_ingles_queda_sin_modelo(self):
        self._cosechar()
        consultas.clasificar_cache(self.cache, [CONSULTA], AnalizadorFalso())
        _, (_, salud, gasto) = self._cosechar()
        doc = consultas.derivar([CONSULTA], AHORA, salud, gasto, cache=self.cache, cosecha=COSECHA)
        t = doc["consultas"][0]["tono"]
        self.assertEqual(t["metodo"], "modelo")
        self.assertEqual(t["sin_clasificar"], 0)
        self.assertEqual(t["positivo"] + t["negativo"] + t["neutral"], 6)

        en = dict(CONSULTA, id="cq_en", idioma="en")
        cache_en = os.path.join(self.dir, "cache_en")
        with patch.object(consultas, "correr_actor", _Actor()):
            _, salud, gasto = consultas.cosechar([en], AHORA, tok="t", cache=cache_en,
                                                 cosecha=COSECHA)
        consultas.clasificar_cache(cache_en, [en], AnalizadorFalso())
        doc = consultas.derivar([en], AHORA, salud, gasto, cache=cache_en, cosecha=COSECHA)
        self.assertEqual(doc["consultas"][0]["tono"]["sin_modelo_idioma"], 6)

    def test_una_fila_apagada_entra_con_sus_redes_sin_dato(self):
        """`activo` gobierna el gasto, no la existencia del termino: la prensa
        se lee de todas, asi que la fila apagada sale con redes `sin_dato`."""
        apagada = dict(PERSONA, activo=False, verificado=None)
        doc = self._doc([CONSULTA, apagada])
        self.assertEqual([c["id"] for c in doc["consultas"]], ["cq_persona", "cq_vivelabaja"])
        c = doc["consultas"][0]
        for p in consultas.PLATAFORMAS:
            self.assertEqual(c["plataformas"][p]["estado"], "sin_dato", p)
            self.assertNotIn("publicaciones", c["plataformas"][p])
        self.assertEqual(c["tono"]["comentarios"], 0)
        errores, _ = validar_consultas(doc, {"consultas": [CONSULTA, apagada]})
        self.assertEqual(errores, [])

    def test_una_persona_sin_cuentas_dice_sin_dato_donde_no_tiene_fuente(self):
        c = self._doc([PERSONA])["consultas"][0]
        self.assertEqual(c["tipo"], "persona")
        self.assertEqual(c["plataformas"]["instagram"],
                         {"estado": "sin_dato", "razon": consultas.RAZON_SIN_FUENTE["instagram"]})
        self.assertEqual(c["plataformas"]["tiktok"]["estado"], "ok")

    def test_pasa_el_validador_con_y_sin_config(self):
        doc = self._doc()
        cfg = {"consultas": [CONSULTA]}
        errores, _ = validar_consultas(doc, cfg)
        self.assertEqual(errores, [])
        errores, _ = validar_consultas(doc)
        self.assertEqual(errores, [])

    def test_determinismo_byte_a_byte(self):
        a = _serializar(self._doc())
        otro = Base()
        otro.setUp()
        b = _serializar(otro._doc())
        self.assertEqual(a, b)
        self.assertIn("Márquez" if "Márquez" in a else "Vive la Baja", a)
        self.assertTrue(a.endswith("\n"))

    def test_idempotencia_la_segunda_corrida_no_duplica_ni_pierde(self):
        doc1 = self._doc()
        mas_tarde = (datetime.fromisoformat(AHORA) + timedelta(hours=6)).isoformat()
        doc2 = self._doc(ahora=mas_tarde)
        a, b = doc1["consultas"][0], doc2["consultas"][0]
        self.assertEqual(a["tono"]["comentarios"], b["tono"]["comentarios"])
        for p in consultas.PLATAFORMAS:
            self.assertEqual(a["plataformas"][p]["comentarios_cosechados"],
                             b["plataformas"][p]["comentarios_cosechados"], p)


class TestPublicar(Base):
    def test_cuatro_claves_menciones_enmascaradas_y_pasa_su_validador(self):
        doc = self._doc()
        texto = consultas.publicar_comentarios(doc, AHORA, cache=self.cache)
        self.assertEqual(texto["plataforma"], "consultas")
        urls = set(texto["por_post"])
        self.assertTrue(any("tiktok.com" in u for u in urls))
        self.assertTrue(any("instagram.com" in u for u in urls))
        self.assertTrue(any("facebook.com" in u for u in urls))
        for lista in texto["por_post"].values():
            for c in lista:
                self.assertEqual(set(c), {"texto", "likes", "fecha", "sentimiento"})
                self.assertNotIn("@amiga", c["texto"])
        self.assertIn("@…", json.dumps(texto, ensure_ascii=False))
        errores, _ = validar_consultas_comentarios(texto, doc)
        self.assertEqual(errores, [])
        huerfano = dict(texto, por_post={"https://www.tiktok.com/@x/video/1": []})
        errores, _ = validar_consultas_comentarios(huerfano, doc)
        self.assertTrue(errores)


def _feed_valido(url, timeout=15):
    if url.startswith("https://news.google.com/"):
        return [_gn("Vive la Baja abre temporada en Ensenada", "CBMiXabc",
                    "Fri, 14 Aug 2026 14:00:00 GMT")]
    return [_wp("Crecen quejas contra Vive la Baja; denuncia por fraudes", "quejas",
                "Wed, 11 Mar 2026 09:00:00 GMT")]


class TestValidador(Base):
    def setUp(self):
        super().setUp()
        prensa = consultas.prensa([CONSULTA], MEDIOS_PRENSA, AHORA, feed=_feed_valido,
                                  cosecha=COSECHA, buscadores=[BUSCADOR],
                                  robots=lambda url: True, analizador=AnalizadorFalso())
        self.doc = self._doc(prensa=prensa,
                             agregados=consultas.agregados([dict(CONSULTA, agregados=AGREGADOS)],
                                                           AHORA, analizador=AnalizadorFalso()))
        self.c = self.doc["consultas"][0]

    def _errores(self):
        return validar_consultas(self.doc, {"consultas": [CONSULTA]})[0]

    def test_una_mutacion_por_regla(self):
        # `P()` y no una variable: cada caso vuelve a llamar a setUp, asi que el
        # bloque de prensa se lee en el momento de mutar.
        def P():
            return self.c["prensa"]
        casos = [
            ("prensa: tono de comentarios", lambda: P()["resultados"][0].update(tono="negativo")),
            ("prensa: tono inventado", lambda: P()["resultados"][0].update(tono="favorable")),
            ("prensa: titular del medio con token", lambda: P()["resultados"][1].update(
                url="https://news.google.com/rss/articles/x?oc=5")),
            ("prensa: titular de noticias con enlace real", lambda: P()["resultados"][0].update(
                url="https://www.elvigia.net/nota")),
            ("prensa: dominio ajeno al enlace", lambda: P()["resultados"][1].update(
                dominio="otro.mx")),
            ("prensa: fuera de la ventana", lambda: P()["resultados"][1].update(
                fecha="2025-09-01")),
            ("prensa: ventana distinta a la raiz", lambda: P().update(ventana_dias=90)),
            ("prensa: ventana de un ano y un dia", lambda: (P().update(ventana_dias=366),
                                                            self.doc.update(
                                                                ventana_prensa_dias=366))),
            ("prensa: titulares no cuadran", lambda: P()["tono"].update(titulares=9)),
            ("prensa: por_medio no cuadra", lambda: P()["por_medio"][0].update(adversa=5)),
            ("prensa: por_medio incompleto", lambda: P()["por_medio"].pop()),
            ("prensa: titular repetido", lambda: P()["resultados"].append(
                dict(P()["resultados"][0], url="https://news.google.com/rss/articles/y?oc=5"))),
            ("prensa: anterior dentro de la ventana", lambda: P()["anteriores"].append(
                dict(P()["resultados"][1], titulo="Otro sobre Vive la Baja"))),
            ("prensa: sin anteriores", lambda: P().pop("anteriores")),
            ("prensa: sin muestra", lambda: P().pop("muestra")),
            ("prensa: ningun buscador ok", lambda: [b.update(estado="fallo")
                                                    for b in P()["buscadores"]]),
            ("prensa: origen desconocido", lambda: P()["resultados"][0].update(origen="web")),
            ("prensa: sin excluidos", lambda: P().pop("excluidos")),
            ("agregado: lista vacia", lambda: self.c.update(agregados=[])),
            ("agregado: origen no manual", lambda: self.c["agregados"][0].update(origen="medio")),
            ("agregado: url http", lambda: self.c["agregados"][0].update(url="http://x.mx/a")),
            ("agregado: repite la prensa", lambda: self.c["agregados"][0].update(
                url=P()["resultados"][0]["url"])),
            ("agregado: tono de comentarios", lambda: self.c["agregados"][0].update(
                tono="negativo")),
            ("agregado: fecha inventada", lambda: self.c["agregados"][0].update(fecha="mayo")),
            ("agregado: desordenado", lambda: self.c["agregados"].reverse()),
            ("agregado: url repetida", lambda: self.c["agregados"].append(
                dict(self.c["agregados"][0], titulo="otro"))),
            ("raiz sin ventana de prensa", lambda: self.doc.pop("ventana_prensa_dias")),
            ("texto", lambda: self.c["plataformas"]["tiktok"]["destacados"][0].update(texto="x")),
            ("profileName", lambda: self.c["plataformas"]["facebook"].update(profileName="x")),
            ("porcentaje", lambda: self.c["tono"].update(porcentaje=50)),
            ("orden", lambda: self.c["plataformas"]["instagram"]["destacados"].reverse()),
            ("salvedad", lambda: self.c["tono"].update(salvedad_tono="otra")),
            ("sin_dato con conteo", lambda: self.c["plataformas"]["youtube"].update(publicaciones=0)),
            ("youtube ok", lambda: self.c["plataformas"]["youtube"].update(estado="ok")),
            ("razon mecanismo", lambda: self.c["plataformas"]["x"].update(razon="Apify no busca")),
            ("ventana", lambda: self.c["plataformas"]["tiktok"]["destacados"][0].update(
                publicado="2026-07-01T00:00:00+00:00", fecha="2026-07-01")),
            ("compartidos en ig", lambda: self.c["plataformas"]["instagram"]["destacados"][0].update(
                compartidos=0)),
            ("sin compartidos en fb", lambda: self.c["plataformas"]["facebook"]["destacados"][0].pop(
                "compartidos")),
            ("creador en ig", lambda: self.c["plataformas"]["instagram"]["destacados"][0].update(
                creador="@x")),
            ("creador ajeno", lambda: self.c["plataformas"]["tiktok"]["destacados"][0].update(
                creador="@otro")),
            ("tono no suma", lambda: self.c["tono"].update(comentarios=99)),
            ("tema con ejemplos", lambda: self.c["temas"]["temas"].append(
                {"termino": "z", "n": 5, "ejemplos": []})),
            ("archivo notas", lambda: self.c["prensa"].update(archivo={"notas": 0})),
            ("fuente no configurada", lambda: self.c["plataformas"]["facebook"]["destacados"][0].update(
                fuente="otrapagina")),
            ("cuenta ajena", lambda: self.c["plataformas"]["facebook"]["destacados"][0].update(
                cuenta="cq_otra")),
            ("plataforma de menos", lambda: self.c["plataformas"].pop("x")),
        ]
        for nombre, mutar in casos:
            with self.subTest(regla=nombre):
                self.setUp()
                self.assertEqual(self._errores(), [])
                mutar()
                self.assertTrue(self._errores(), "la mutacion {!r} paso".format(nombre))

    def test_prensa_el_enlace_sigue_al_origen(self):
        """Del buscador de noticias, el token opaco tal cual; del buscador del
        medio, el enlace https del propio medio con su host como dominio."""
        self.assertEqual(self._errores(), [])
        noticias, medio = self.c["prensa"]["resultados"]
        self.assertEqual((noticias["origen"], medio["origen"]), ("noticias", "medio"))
        noticias["url"] = "https://www.elvigia.net/nota"
        self.assertTrue([e for e in self._errores() if "Google" in e])

    def test_config_buscadores(self):
        with open(CONFIG, encoding="utf-8") as fh:
            base = json.load(fh)
        medios = {"medios": [{"id": "zeta", "url": "https://zetatijuana.com/feed"}]}

        def cfg(**cambios):
            d = json.loads(json.dumps(base))
            d["buscadores"] = [dict(BUSCADOR, **cambios)]
            return d
        self.assertEqual(validar_consultas_config(cfg(), None, medios)[0], [])
        self.assertTrue(validar_consultas_config(cfg(activo=True, verificado=None), None)[0])
        self.assertTrue(validar_consultas_config(cfg(url="http://x.mx/?s={q}"), None)[0])
        self.assertTrue(validar_consultas_config(cfg(url="https://x.mx/?s=q"), None)[0])
        self.assertTrue(validar_consultas_config(cfg(url="https://{q}.mx/?s={q}"), None)[0])
        self.assertTrue(validar_consultas_config(cfg(id="noticias"), None)[0])
        self.assertTrue(validar_consultas_config(cfg(idioma="fr"), None)[0])
        # El id de un medio del catalogo exige el host del medio.
        self.assertTrue(validar_consultas_config(cfg(id="zeta"), None, medios)[0])
        self.assertEqual(validar_consultas_config(
            cfg(id="zeta", url="https://zetatijuana.com/?s={q}&feed=rss2"), None, medios)[0], [])
        largo = json.loads(json.dumps(base))
        largo["cosecha"]["ventana_prensa_dias"] = 366
        self.assertTrue([e for e in validar_consultas_config(largo, None)[0]
                         if "ventana_prensa_dias" in e])

    def test_config_reglas(self):
        with open(CONFIG, encoding="utf-8") as fh:
            base = json.load(fh)

        def cfg(**cambios):
            d = json.loads(json.dumps(base))
            fila = d["consultas"][0]
            fila.update(cambios)
            return d
        self.assertEqual(validar_consultas_config(base, None)[0], [])
        self.assertTrue(validar_consultas_config(cfg(zona="Tijuana"), None)[0])
        self.assertTrue(validar_consultas_config(cfg(activo=True, verificado=None), None)[0])
        self.assertTrue(validar_consultas_config(cfg(facebook={"paginas": [], "busqueda": "x"}),
                                                 None)[0])
        self.assertEqual(validar_consultas_config(cfg(facebook={"paginas": [], "busqueda": "x"}),
                                                  "un~actor")[0], [])
        self.assertTrue(validar_consultas_config(cfg(instagram={"hashtags": ["#Mal"]}), None)[0])
        self.assertTrue(validar_consultas_config(cfg(id="tk_mal"), None)[0])
        chico = json.loads(json.dumps(base))
        chico["cosecha"]["presupuesto_resultados"] = 10
        self.assertTrue([e for e in validar_consultas_config(chico, None)[0]
                         if "presupuesto" in e])


class TestConfigReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(CONFIG, encoding="utf-8") as fh:
            cls.cfg = json.load(fh)

    def test_pasa_su_validador(self):
        errores, _ = validar_consultas_config(self.cfg, facebook.ACTOR_BUSQUEDA)
        self.assertEqual(errores, [])

    def test_cada_fila_trae_nota_sin_zona_y_al_menos_una_fuente(self):
        ids = [c["id"] for c in self.cfg["consultas"]]
        self.assertEqual(len(ids), len(set(ids)))
        for c in self.cfg["consultas"]:
            with self.subTest(id=c["id"]):
                self.assertNotIn("zona", c)
                self.assertTrue(c["nota"].strip())
                self.assertTrue(consultas._fuentes(c) or (c.get("prensa") or {}).get("q"))
                if c["activo"]:
                    self.assertTrue(c.get("verificado"))
                    self.assertIn("--probar", c["nota"])

    def test_el_tope_cubre_todas_las_filas(self):
        cos = self.cfg["cosecha"]
        fuentes = sum(len(consultas._fuentes(c)) for c in self.cfg["consultas"])
        self.assertGreaterEqual(cos["presupuesto_resultados"],
                                fuentes * cos["posts_por_fuente"] * (1 + cos["comentarios_por_post"]))

    def test_la_ventana_no_excede_la_retencion(self):
        self.assertLessEqual(self.cfg["cosecha"]["ventana_dias"], consultas.RETENCION_DIAS)
        # La de la prensa es otra, y es la de seis meses que pidio el cliente.
        self.assertEqual(self.cfg["cosecha"]["ventana_prensa_dias"], 180)

    def test_lo_curado_a_mano_lleva_su_razon_escrita(self):
        """Descartar o agregar a mano se justifica por escrito, como una fila
        apagada de cualquier catalogo de este repo."""
        agregados = excluidos = 0
        for c in self.cfg["consultas"]:
            for x in (c.get("prensa") or {}).get("excluidos") or []:
                excluidos += 1
                with self.subTest(excluido=x["titulo"][:30]):
                    self.assertGreaterEqual(len(x["titulo"]), 12, "se empareja por contencion")
                    self.assertIn("2026", x["razon"], "la razon lleva la fecha de la decision")
            for a in c.get("agregados") or []:
                agregados += 1
                with self.subTest(agregado=a["url"][:40]):
                    self.assertTrue(a["nota"].strip())
                    self.assertTrue(a["url"].startswith("https://"))
                    self.assertTrue(a["titulo"].strip() and a["fuente"].strip())
        self.assertEqual((agregados, excluidos), (3, 3),
                         "los tres enlaces y los tres descartes del 21 de septiembre de 2026")

    def test_ningun_agregado_lo_traeria_la_busqueda_sola(self):
        """La razon de existir de `agregados`: su titular NO nombra el termino,
        asi que el filtro por titular los dejaria fuera. Si alguno lo nombrara,
        sobra en la lista y su sitio es la busqueda."""
        for c in self.cfg["consultas"]:
            for a in c.get("agregados") or []:
                with self.subTest(agregado=a["titulo"][:40]):
                    self.assertFalse(consultas._nombra(a["titulo"], c["termino"]))

    def test_cada_buscador_trae_nota_y_los_encendidos_fecha(self):
        ids = [b["id"] for b in self.cfg["buscadores"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn("blancoynegro", ids, "el caso que justifica la lista")
        for b in self.cfg["buscadores"]:
            with self.subTest(id=b["id"]):
                self.assertTrue(b["nota"].strip())
                self.assertIn("{q}", b["url"])
                if b["activo"]:
                    self.assertTrue(b.get("verificado"))
                    self.assertIn("2026", b["nota"])
                else:
                    self.assertIn("APAGADO", b["nota"])


if __name__ == "__main__":
    unittest.main()
