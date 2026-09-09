"""Pruebas de la cosecha de TikTok por busqueda, siempre sin red.

Se sustituye 'pulso.tiktok.correr_actor', el unico punto que toca Apify. Los
nombres de campo del fixture son los que devuelven de verdad
clockworks~tiktok-scraper (`webVideoUrl`, `text`, `createTime`, `authorMeta`,
`diggCount`, `shareCount`, `collectCount`, `playCount`, `isAd`) y
clockworks~tiktok-comments-scraper (`text`, `diggCount`, `replyCommentTotal`,
`createTimeISO`, `uniqueId`, `uid`, `avatarThumbnail`, `cid`, `videoWebUrl`),
a proposito: la prueba que mas importa es que la identidad de quien comenta
NO sobreviva a la ingesta, mientras que el @handle del creador SI.
"""

import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from pulso import tiktok
from pulso.validador import validar_redes, validar_redes_comentarios, validar_tiktok_config

AHORA = "2026-09-03T18:00:00+00:00"

BUSQUEDA = {"id": "tk_tijuana_noticias", "nombre": "Tijuana noticias",
            "consulta": "tijuana noticias", "idioma": "es", "activo": True}


def _epoch(iso):
    return int(datetime.fromisoformat(iso).timestamp())


def _video(**cambios):
    base = {
        "id": "7301", "text": "Cierran la garita de San Ysidro por obras #tijuana #noticias",
        "textLanguage": "es",
        "createTime": _epoch("2026-09-03T10:00:00+00:00"),
        "createTimeISO": "2026-09-03T10:00:00.000Z",
        # Handle con mayusculas y query: la pasada de comentarios lo devuelve
        # distinto y las dos tienen que cruzar.
        "webVideoUrl": "https://www.tiktok.com/@TjNoticias/video/7301?lang=es",
        "authorMeta": {"id": "1", "name": "tjnoticias", "nickName": "TJ Noticias",
                       "verified": False, "fans": 1000, "avatar": "https://x.test/a.jpg",
                       "privateAccount": False},
        "diggCount": 120, "shareCount": 7, "playCount": 5000, "commentCount": 40,
        "collectCount": 3, "isAd": False, "isSponsored": False, "isSlideshow": False,
    }
    base.update(cambios)
    return base


def _comentario(texto, likes=0, **cambios):
    base = {"cid": "c-" + texto[:8], "text": texto, "diggCount": likes,
            "replyCommentTotal": 0, "createTimeISO": "2026-09-03T11:00:00.000Z",
            "uniqueId": "vecino_tj", "uid": "99", "avatarThumbnail": "https://x.test/p.jpg",
            "videoWebUrl": "https://www.tiktok.com/@tjnoticias/video/7301"}
    base.update(cambios)
    return base


VIDEOS = [_video()]
COMENTARIOS = [_comentario("El puente sigue cerrado, nadie avisa", likes=4),
               _comentario("Otra vez el agua", likes=0)]


class _Actor:
    """Sustituye correr_actor: videos en la 1a pasada, comentarios en la 2a."""

    def __init__(self, videos=None, comentarios=None):
        self.videos = VIDEOS if videos is None else videos
        self.comentarios = COMENTARIOS if comentarios is None else comentarios
        self.llamadas = []

    def __call__(self, actor, entrada, tok, limite, timeout=None):
        self.llamadas.append((actor, entrada))
        return self.videos if "searchQueries" in entrada else self.comentarios


class BaseCache(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.cache = os.path.join(self.dir, "tiktok")

    def _cosechar(self, actor=None, **kw):
        actor = actor or _Actor()
        with patch.object(tiktok, "correr_actor", actor):
            return actor, tiktok.cosechar([BUSQUEDA], AHORA, tok="t", cache=self.cache, **kw)


class TestIdentidad(BaseCache):
    """El comentarista se tira al ingerir; el creador se publica. Es la regla."""

    def test_el_comentarista_no_llega_al_cache(self):
        self._cosechar()
        crudo = json.dumps(tiktok.leer_cache(self.cache))
        for prohibido in ("vecino_tj", "uniqueId", "uid", "avatarThumbnail", "cid", "99"):
            self.assertNotIn('"{}"'.format(prohibido), crudo)
        self.assertNotIn("vecino_tj", crudo)

    def test_el_creador_si_se_conserva_en_minusculas(self):
        v, motivo = tiktok._limpiar_video(_video(), BUSQUEDA, AHORA)
        self.assertIsNone(motivo)
        self.assertEqual(v["creador"], "@tjnoticias")
        self.assertEqual(v["url"], "https://www.tiktok.com/@tjnoticias/video/7301")
        # Del autor no viaja nada mas: ni nickName, ni avatar, ni seguidores.
        self.assertEqual(sorted(v), ["comentarios", "compartidos", "creador", "cuenta", "fecha",
                                     "guardados", "likes", "publicado", "reproducciones",
                                     "tipo", "titulo", "url", "zona"])

    def test_las_dos_pasadas_cruzan_por_url_canonica(self):
        # webVideoUrl trae mayusculas y ?lang=es; videoWebUrl no. Sin canonizar,
        # cosechados quedaria en 0 y nada avisaria.
        _, (nuevos, salud, _) = self._cosechar()
        self.assertEqual({c["post"] for c in nuevos}, {"https://www.tiktok.com/@tjnoticias/video/7301"})
        panel = tiktok.derivar(nuevos, AHORA, salud, {}, [], tiktok.leer_publicaciones(self.cache),
                               [BUSQUEDA])
        self.assertEqual(panel["destacados"][0]["cosechados"], 2)


class TestLimpiezaVideo(unittest.TestCase):
    def _limpio(self, **k):
        return tiktok._limpiar_video(_video(**k), BUSQUEDA, AHORA)

    def test_anuncios_patrocinados_y_privados_fuera(self):
        self.assertEqual(self._limpio(isAd=True)[1], "anuncio")
        self.assertEqual(self._limpio(isSponsored=True)[1], "anuncio")
        autor = dict(_video()["authorMeta"], privateAccount=True)
        self.assertEqual(self._limpio(authorMeta=autor)[1], "privado")

    def test_la_zona_sale_del_pie_con_hashtags(self):
        self.assertEqual(self._limpio()[0]["zona"], "Tijuana")
        self.assertEqual(self._limpio(text="Lluvia en el puerto #ensenada")[0]["zona"], "Ensenada")

    def test_fuera_de_la_region_se_descarta(self):
        v, motivo = self._limpio(text="Balacera en Hermosillo, Sonora #noticias")
        self.assertIsNone(v)
        self.assertEqual(motivo, "fuera")

    def test_sin_lugar_es_nacional_y_estatal_es_estatal(self):
        # `nacional` es el veredicto del gacetero; mapearlo a estatal seria
        # acreditar la zona de la consulta con otro disfraz.
        self.assertEqual(self._limpio(text="Sube el dolar otra vez #noticias")[0]["zona"], "nacional")
        self.assertEqual(self._limpio(text="Baja California estrena ley")[0]["zona"], "estatal")

    def test_publicado_en_el_formato_de_ahora_y_futuro_fuera(self):
        v, _ = self._limpio()
        self.assertEqual(v["publicado"], "2026-09-03T10:00:00+00:00")
        self.assertEqual(v["fecha"], "2026-09-03")
        futuro = _epoch("2026-09-04T00:00:00+00:00")
        self.assertEqual(self._limpio(createTime=futuro)[1], "futuro")

    def test_sin_createtime_cae_a_createtimeiso(self):
        v, _ = self._limpio(createTime=None)
        self.assertEqual(v["publicado"], "2026-09-03T10:00:00+00:00")

    def test_el_titulo_pierde_la_cola_de_hashtags_pero_no_los_de_en_medio(self):
        self.assertEqual(self._limpio()[0]["titulo"], "Cierran la garita de San Ysidro por obras")
        v, _ = self._limpio(text="#Tijuana amanece con lluvia y trafico #clima")
        self.assertEqual(v["titulo"], "#Tijuana amanece con lluvia y trafico")

    def test_los_emoji_escapados_por_el_actor_se_desescapan(self):
        # El caso real: 7 de 30 pies de la primera cosecha traian el semaforo
        # como la cadena literal '🚦'. Un sustituto suelto se deja.
        v, _ = self._limpio(text="\\ud83d\\udea6 Nuevo carril para motos #tijuana")
        self.assertEqual(v["titulo"], "\U0001F6A6 Nuevo carril para motos")
        self.assertEqual(tiktok._desescapar("\\ud83d suelto"), "\\ud83d suelto")
        c = tiktok._limpiar_comentario(_comentario("\\ud83d\\ude02 jaja"), "u", BUSQUEDA, "Tijuana")
        self.assertEqual(c["texto"], "\U0001F602 jaja")

    def test_un_pie_solo_de_hashtags_se_deja_intacto(self):
        v, _ = self._limpio(text="#tijuana #noticias")
        self.assertEqual(v["titulo"], "#tijuana #noticias")

    def test_tipo_compartidos_guardados_y_reproducciones(self):
        v, _ = self._limpio(isSlideshow=True, shareCount=0, collectCount=0, playCount=0)
        self.assertEqual(v["tipo"], "carrusel")
        # TikTok SI publica estos: un 0 es cero medido y siempre viaja.
        self.assertEqual((v["compartidos"], v["guardados"]), (0, 0))
        # Reproducciones conserva la regla compartida: solo si > 0.
        self.assertNotIn("reproducciones", v)
        self.assertEqual(self._limpio()[0]["reproducciones"], 5000)

    def test_sin_url_o_sin_creador_no_hay_registro(self):
        self.assertEqual(self._limpio(webVideoUrl="https://www.tiktok.com/foo")[1], "sin_url")
        autor = dict(_video()["authorMeta"], name="")
        self.assertEqual(self._limpio(authorMeta=autor)[1], "sin_creador")


class TestCosecha(BaseCache):
    def test_la_entrada_de_videos_es_la_de_la_busqueda_sin_descargas(self):
        actor, _ = self._cosechar()
        actor_id, entrada = actor.llamadas[0]
        self.assertEqual(actor_id, tiktok.ACTOR_VIDEOS)
        self.assertEqual(entrada["searchQueries"], ["tijuana noticias"])
        self.assertEqual(entrada["searchSection"], "/video")
        self.assertEqual(entrada["videoSearchSorting"], "MOST_RELEVANT")
        self.assertEqual(entrada["videoSearchDateFilter"], "PAST_24_HOURS")
        self.assertFalse(any(v for k, v in entrada.items() if k.startswith("shouldDownload")))
        actor_id, entrada = actor.llamadas[1]
        self.assertEqual(actor_id, tiktok.ACTOR_COMENTARIOS)
        self.assertEqual(entrada, {"postURLs": ["https://www.tiktok.com/@tjnoticias/video/7301"],
                                   "commentsPerPost": 30, "maxRepliesPerComment": 0})

    def test_la_segunda_corrida_del_dia_no_vuelve_a_pagar_comentarios(self):
        self._cosechar()
        actor, _ = self._cosechar()
        self.assertEqual([a for a, _ in actor.llamadas], [tiktok.ACTOR_VIDEOS])

    def test_salud_cuenta_lo_fuera_y_lo_descartado(self):
        videos = [_video(), _video(id="2", text="Hermosillo hoy", webVideoUrl="https://www.tiktok.com/@a/video/2"),
                  _video(id="3", isAd=True, webVideoUrl="https://www.tiktok.com/@a/video/3")]
        _, (_, salud, _) = self._cosechar(_Actor(videos=videos))
        self.assertEqual((salud[0]["posts"], salud[0]["fuera"], salud[0]["descartados"]), (1, 1, 1))

    def test_sin_token_devuelve_vacio_y_lo_dice(self):
        nuevos, salud, _ = tiktok.cosechar([BUSQUEDA], AHORA, cache=self.cache, entorno={})
        self.assertEqual((nuevos, [s["estado"] for s in salud]), ([], ["sin_token"]))

    def test_los_comentarios_heredan_la_zona_del_video(self):
        _, (nuevos, _, _) = self._cosechar()
        self.assertEqual({c["zona_cuenta"] for c in nuevos}, {"Tijuana"})


class TestDerivar(BaseCache):
    def _panel(self, videos, comentarios=None, ahora=AHORA):
        actor, (nuevos, salud, gasto) = self._cosechar(_Actor(videos=videos, comentarios=comentarios or []))
        return tiktok.derivar(tiktok.leer_cache(self.cache), ahora, salud, gasto, [],
                              tiktok.leer_publicaciones(self.cache), [BUSQUEDA])

    def test_ventana_de_24_horas_sobre_la_hora_exacta(self):
        dentro = _video(id="1", createTime=_epoch("2026-09-02T19:00:00+00:00"),   # 23 h
                        webVideoUrl="https://www.tiktok.com/@a/video/1")
        fuera = _video(id="2", createTime=_epoch("2026-09-02T17:00:00+00:00"),    # 25 h
                       webVideoUrl="https://www.tiktok.com/@a/video/2")
        p = self._panel([dentro, fuera])
        self.assertEqual([d["url"] for d in p["destacados"]], ["https://www.tiktok.com/@a/video/1"])
        self.assertEqual(p["ventana_horas"], 24)
        self.assertNotIn("ventana_dias", p)

    def test_los_campos_de_tiktok_cruzan_al_destacado(self):
        d = self._panel(VIDEOS)["destacados"][0]
        for campo in ("creador", "publicado", "compartidos", "guardados"):
            self.assertIn(campo, d)
        self.assertEqual(d["creador"], "@tjnoticias")

    def test_el_catalogo_de_fuentes_es_la_busqueda_en_estatal_y_activa(self):
        p = self._panel(VIDEOS)
        self.assertEqual(p["cuentas"], [{"cuenta": "tk_tijuana_noticias", "nombre": "Tijuana noticias",
                                         "zona": "estatal", "activa": True}])

    def test_pasa_el_validador_y_es_identico(self):
        a = self._panel(VIDEOS, COMENTARIOS)
        b = tiktok.derivar(tiktok.leer_cache(self.cache), AHORA, a["salud"], a["gasto"], [],
                           tiktok.leer_publicaciones(self.cache), [BUSQUEDA])
        self.assertEqual(json.dumps(a), json.dumps(b))
        errores, _ = validar_redes(a, plataforma="tiktok")
        self.assertEqual(errores, [])
        crudo = json.dumps(a)
        for prohibido in ("uniqueId", "authorMeta", "nickName", "pct", "texto"):
            self.assertNotIn(prohibido, crudo)

    def test_nacional_es_zona_valida(self):
        p = self._panel([_video(text="Sube el dolar #noticias")])
        self.assertEqual(p["destacados"][0]["zona"], "nacional")
        self.assertEqual(validar_redes(p, plataforma="tiktok")[0], [])


class TestPublicar(BaseCache):
    def test_texto_sin_identidad_y_pasa_su_validador(self):
        _, (nuevos, salud, gasto) = self._cosechar(_Actor(comentarios=[
            _comentario("@vecina_tj tiene razon, el agua no llega", likes=3),
            _comentario("Pesimo servicio", likes=1)]))
        panel = tiktok.derivar(nuevos, AHORA, salud, gasto, [], tiktok.leer_publicaciones(self.cache),
                               [BUSQUEDA])
        doc = tiktok.publicar_comentarios(nuevos, panel["destacados"], AHORA)
        filas = doc["por_post"]["https://www.tiktok.com/@tjnoticias/video/7301"]
        self.assertEqual([f["texto"] for f in filas], ["@… tiene razon, el agua no llega", "Pesimo servicio"])
        self.assertEqual(doc["plataforma"], "tiktok")
        self.assertNotIn("vecino_tj", json.dumps(doc))
        self.assertEqual(validar_redes_comentarios(doc, panel, plataforma="tiktok")[0], [])


class TestProbar(BaseCache):
    def test_no_escribe_nada_y_devuelve_videos_limpios(self):
        actor = _Actor(videos=[_video(), _video(id="9", isAd=True, webVideoUrl="https://www.tiktok.com/@a/video/9")])
        with patch.object(tiktok, "correr_actor", actor):
            salida = tiktok.probar([BUSQUEDA], AHORA, tok="t")
        self.assertEqual(len(actor.llamadas), 1)
        self.assertEqual(actor.llamadas[0][1]["resultsPerPage"], 3)
        self.assertEqual(salida[0]["descartes"], {"anuncio": 1})
        self.assertEqual(salida[0]["videos"][0]["creador"], "@tjnoticias")
        self.assertFalse(os.path.exists(self.cache))


class TestValidadorTikTok(unittest.TestCase):
    DESTACADO = {
        "url": "https://www.tiktok.com/@tjnoticias/video/7301", "cuenta": "tk_tijuana_noticias",
        "creador": "@tjnoticias", "zona": "Tijuana", "publicado": "2026-09-03T10:00:00+00:00",
        "fecha": "2026-09-03", "titulo": "Titular", "tipo": "video", "likes": 10,
        "comentarios": 5, "compartidos": 2, "guardados": 1, "cosechados": 2, "opinion": 2,
        "sentimiento": {"positivo": 1, "negativo": 1, "neutral": 0, "sin_clasificar": 0,
                        "sin_modelo_idioma": 0},
        "temas": [],
    }
    BASE = {
        "esquema": 1, "generado": AHORA, "plataforma": "tiktok", "retencion_dias": 30,
        "comentarios_vigentes": 0, "posts_vigentes": 0, "opinion": 0, "repetidos": 0,
        "reacciones": 0, "por_zona": {}, "por_cuenta": {}, "por_idioma": {}, "por_tema": [],
        "sentimiento": {"metodo": "ninguno", "modelo": None, "positivo": 0, "negativo": 0,
                        "neutral": 0, "sin_clasificar": 0, "sin_modelo_idioma": 0},
        "ventana_horas": 24, "destacados_maximo": 15,
        "cuentas": [{"cuenta": "tk_tijuana_noticias", "nombre": "Tijuana noticias",
                     "zona": "estatal", "activa": True}],
        "destacados": [DESTACADO],
        "salud": [{"cuenta": "tk_tijuana_noticias", "estado": "ok"}],
        "gasto": {"resultados": 1000, "gastado": 0, "por_concepto": {}},
    }

    def _con(self, **cambios):
        d = dict(self.BASE)
        d["destacados"] = [dict(self.DESTACADO, **cambios)]
        return d

    def test_el_valido_pasa(self):
        self.assertEqual(validar_redes(dict(self.BASE), plataforma="tiktok")[0], [])

    def test_creador_obligatorio_y_debe_ser_el_de_la_url(self):
        d = self._con(); del d["destacados"][0]["creador"]
        self.assertTrue(any("'creador'" in x for x in validar_redes(d, plataforma="tiktok")[0]))
        e, _ = validar_redes(self._con(creador="@otro"), plataforma="tiktok")
        self.assertTrue(any("no es el de la url" in x for x in e))

    def test_creador_en_instagram_es_error(self):
        from tests.test_instagram import TestValidadorDestacados as TD
        d = dict(TD.CON); d["destacados"] = [dict(TD.DESTACADO, creador="@x")]
        self.assertTrue(any("'creador' no se publica" in x for x in validar_redes(d)[0]))

    def test_ventana_dias_no_aplica_a_tiktok_ni_horas_a_instagram(self):
        e, _ = validar_redes(dict(self.BASE, ventana_dias=7), plataforma="tiktok")
        self.assertTrue(any("no aplica" in x for x in e))
        from tests.test_instagram import TestValidadorDestacados as TD
        e, _ = validar_redes(dict(TD.CON, ventana_horas=24))
        self.assertTrue(any("no aplica" in x for x in e))

    def test_publicado_fuera_de_la_ventana_o_futuro_es_error(self):
        e, _ = validar_redes(self._con(publicado="2026-09-02T17:00:00+00:00", fecha="2026-09-02"),
                             plataforma="tiktok")
        self.assertTrue(any("fuera de la ventana de 24 horas" in x for x in e))
        e, _ = validar_redes(self._con(publicado="2026-09-03T19:00:00+00:00"), plataforma="tiktok")
        self.assertTrue(any("reloj roto" in x for x in e))
        e, _ = validar_redes(self._con(fecha="2026-09-02"), plataforma="tiktok")
        self.assertTrue(any("no es el dia de 'publicado'" in x for x in e))

    def test_compartidos_obligatorio_en_tiktok_y_prohibido_en_instagram(self):
        d = self._con(); del d["destacados"][0]["compartidos"]
        self.assertTrue(any("'compartidos'" in x for x in validar_redes(d, plataforma="tiktok")[0]))
        from tests.test_instagram import TestValidadorDestacados as TD
        d = dict(TD.CON); d["destacados"] = [dict(TD.DESTACADO, compartidos=3)]
        self.assertTrue(any("no existe en instagram" in x for x in validar_redes(d)[0]))

    def test_url_ajena_e_identidad_de_tiktok_son_error(self):
        e, _ = validar_redes(self._con(url="https://www.instagram.com/p/x/"), plataforma="tiktok")
        self.assertTrue(any("debe empezar con https://www.tiktok.com/" in x for x in e))
        e, _ = validar_redes(dict(self.BASE, extra=[{"uniqueId": "x"}]), plataforma="tiktok")
        self.assertTrue(any("clave prohibida" in x for x in e))

    def test_config_una_busqueda_no_lleva_zona_y_los_enums_son_los_del_actor(self):
        cfg = {"nota": "x", "cosecha": {"videos_por_busqueda": 30, "comentarios_por_video": 30,
                                       "dias_entre_cosechas": 3, "ventana_horas": 24,
                                       "filtro_fecha": "PAST_24_HOURS", "presupuesto_resultados": 1000},
               "busquedas": [{"id": "tk_xx", "nombre": "x", "consulta": "x", "idioma": "es",
                              "activo": True, "nota": "x"}]}
        self.assertEqual(validar_tiktok_config(cfg)[0], [])
        malo = json.loads(json.dumps(cfg)); malo["busquedas"][0]["zona"] = "Tijuana"
        self.assertTrue(any("no lleva 'zona'" in x for x in validar_tiktok_config(malo)[0]))
        malo = json.loads(json.dumps(cfg)); malo["cosecha"]["filtro_fecha"] = "LAST_24H"
        self.assertTrue(any("filtro_fecha" in x for x in validar_tiktok_config(malo)[0]))
        bueno = json.loads(json.dumps(cfg)); bueno["cosecha"]["orden"] = "LATEST"
        self.assertEqual(validar_tiktok_config(bueno)[0], [])
        malo = json.loads(json.dumps(cfg)); malo["cosecha"]["orden"] = "RELEVANCE"
        self.assertTrue(any("'orden'" in x for x in validar_tiktok_config(malo)[0]))


class TestConfigReal(unittest.TestCase):
    """Lee el config/tiktok.json real, como el resto de la suite."""

    def setUp(self):
        with open(os.path.join("config", "tiktok.json"), encoding="utf-8") as fh:
            self.cfg = json.load(fh)

    def test_el_config_real_pasa_su_validador(self):
        self.assertEqual(validar_tiktok_config(self.cfg)[0], [])

    def test_ninguna_busqueda_lleva_zona_y_todas_traen_nota_e_idioma(self):
        for b in self.cfg["busquedas"]:
            with self.subTest(busqueda=b["id"]):
                self.assertNotIn("zona", b)
                self.assertIn(b.get("idioma"), ("es", "en"))
                self.assertTrue((b.get("nota") or "").strip())

    def test_el_filtro_de_fecha_es_uno_del_actor(self):
        self.assertIn(self.cfg["cosecha"]["filtro_fecha"], tiktok.FILTROS_FECHA)


if __name__ == "__main__":
    unittest.main()
