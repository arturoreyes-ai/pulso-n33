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

from pulso import redes as _redes
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
        "videoMeta": {"duration": 47},
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
        self.assertEqual(sorted(v), ["alcance", "comentarios", "compartidos", "creador",
                                     "cuenta", "duracion", "fecha", "guardados", "likes",
                                     "publicado", "reproducciones", "tipo", "titulo", "url",
                                     "zona"])

    def test_las_dos_pasadas_cruzan_por_url_canonica(self):
        # webVideoUrl trae mayusculas y ?lang=es; videoWebUrl no. Sin canonizar,
        # cosechados quedaria en 0 y nada avisaria.
        _, (nuevos, salud, _) = self._cosechar()
        self.assertEqual({c["post"] for c in nuevos}, {"https://www.tiktok.com/@tjnoticias/video/7301"})
        panel = tiktok.derivar(nuevos, AHORA, salud, {}, [], tiktok.leer_publicaciones(self.cache),
                               [BUSQUEDA])
        self.assertEqual(panel["destacados"][0]["cosechados"], 2)


MIXCOAC = ("Circula en redes sociales el video del momento en que un grupo de sujetos "
           "agrede a automovilistas y les rompen los cristales del coche en Mixcoac, "
           "cerca de Av. Revolución")


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

    def test_sin_lugar_se_tira_y_estatal_es_estatal(self):
        # El caso, del 22 de septiembre de 2026: lo que las busquedas de
        # Rosarito, Ensenada y Mexicali traian sin nombrar lugar llenaba la
        # cubeta Mexico (una lluvia en Tegucigalpa, un herido en Ancash, pies
        # vacios). Mapearlo a estatal seria acreditar la zona de la consulta
        # con otro disfraz, asi que se tira y se cuenta.
        self.assertEqual(self._limpio(text="Sube el dolar otra vez #noticias"),
                         (None, "sin_lugar"))
        # Salvo que nombre a Mexico: eso si es nota nacional.
        self.assertEqual(self._limpio(text="Sube el dolar en Mexico")[0]["zona"], "nacional")
        self.assertEqual(self._limpio(text="Baja California estrena ley")[0]["zona"], "estatal")

    def test_el_alcance_viaja_al_lado_de_la_zona(self):
        # `alcance` es el veredicto crudo del gacetero; `zona` es donde cae
        # despues del ambito. En una busqueda regional coinciden salvo el
        # residuo, y aun asi los dos se publican.
        self.assertEqual(self._limpio()[0]["alcance"], "zona")
        self.assertEqual(self._limpio(text="Baja California estrena ley")[0]["alcance"],
                         "estatal")
        self.assertEqual(self._limpio(text="Sube el dolar en Mexico")[0]["alcance"], "nacional")

    def test_la_tabla_de_ambitos(self):
        """El ambito decide el residuo, NUNCA la zona de un pie que nombra lugar.

        Es la regla entera de pulso/tiktok.py::_zona en una sola prueba: si
        alguna vez un ambito empieza a mover la primera o la segunda fila, es
        la acreditacion por consulta que todo el modulo existe para impedir.
        """
        pies = {
            "zona": "Cierran la garita #tijuana",
            "estatal": "Baja California estrena ley",
            "fuera": "Balacera en Hermosillo, Sonora",
            "extranjero": "Rusia lanza drones contra Ucrania",
            "nacional": "Sube el dolar otra vez",
        }
        # La fila `extranjero` (22 de septiembre de 2026) va como la de zona:
        # igual en los tres. En el regional tambien, por decision de ese dia:
        # antes caia en la cubeta Mexico, que es peor que Mundo y que tirarlo.
        # Y el residuo regional se tira desde el 22 de septiembre de 2026:
        # "Sube el dolar otra vez" no nombra a Mexico (ver
        # test_sin_lugar_se_tira_y_estatal_es_estatal).
        # Un PERFIL es un medio fijo y conserva el residuo de su ambito.
        perfil = {
            "regional":      {"zona": "Tijuana", "estatal": "estatal", "fuera": None,
                              "extranjero": "internacional", "nacional": None},
            "nacional":      {"zona": "Tijuana", "estatal": "estatal", "fuera": "nacional",
                              "extranjero": "internacional", "nacional": "nacional"},
            "internacional": {"zona": "Tijuana", "estatal": "estatal", "fuera": "nacional",
                              "extranjero": "internacional", "nacional": "internacional"},
        }
        # Una BUSQUEDA tira el pie sin lugar en los tres ambitos desde el 24 de
        # septiembre de 2026: es de cualquier creador (el meme en portugues de
        # @rhoizz en Mundo). Lo demas es igual que en un perfil.
        busqueda = {a: dict(f, nacional=None) for a, f in perfil.items()}
        for tirar, esperado in ((False, perfil), (True, busqueda)):
            for ambito, filas in esperado.items():
                for alc, zona in filas.items():
                    with self.subTest(tirar_sin_lugar=tirar, ambito=ambito, alcance=alc):
                        self.assertEqual(tiktok._zona(pies[alc], ambito, tirar_sin_lugar=tirar),
                                         (zona, alc))

    def test_los_casos_medidos_del_filtro_internacional(self):
        """Los pies reales que motivaron `extranjero`, con la busqueda de donde salieron."""
        casos = [
            # Etiqueta: #tijuana en el pie de un video del mundo. El texto
            # nombra Iran y el lugar del corredor solo esta en la etiqueta.
            ("31 Millones de Soldados vs EEUU!! Iran Prepara Su Mayor Fuerza #tijuana",
             "internacional", ("internacional", "extranjero")),
            # Y la etiqueta sigue contando cuando el texto no nombra nada de fuera.
            ("Balacera en la colonia #tijuana", "regional", ("Tijuana", "zona")),
            # Homonimo de Mexico: El Rosario es de San Quintin y de Sinaloa.
            ("En El Rosario, Sinaloa, localizan cinco recipientes", "nacional",
             ("nacional", "fuera")),
            ("En El Rosario, Sinaloa, localizan cinco recipientes", "regional",
             (None, "fuera")),
            # Homonimo del extranjero: "la paz" es BCS, y aqui no.
            ("Rusia advierte que las sanciones complican la paz", "nacional",
             ("internacional", "extranjero")),
            # Mexico nombrado bloquea el extranjero: es nota nacional.
            ("Mexico vence a Argentina en el Mundial", "nacional", ("nacional", "nacional")),
            # El corredor nombrado de verdad gana sobre el extranjero.
            ("Deportados desde Texas llegan a Tijuana", "internacional", ("Tijuana", "zona")),
            # Una calle con nombre de pais no es el pais (busqueda de Mexicali).
            ("te veo el lunes en Argentina 1100 colonia Alamitos #mexicali", "regional",
             ("Mexicali", "zona")),
            # Una fuente del mundo que habla de Mexico es nota nacional
            # (Telemundo 20; "morelos" no esta en FUERA porque es colonia de
            # Tijuana)...
            ("Hacen anuncio sobre feminicidio de Claudia Tacoronte en Morelos, Mexico",
             "internacional", ("nacional", "nacional")),
            # Uno TV en la busqueda de Ensenada, 24 de septiembre de 2026: salio
            # `zona: Tijuana` por la avenida, que es alias de la Zona Centro, y
            # el guion de locucion la ofrecio como informacion de Tijuana. El
            # pie completo no se guarda; la cola es la de su primera linea.
            (MIXCOAC, "regional", (None, "fuera")),
            (MIXCOAC + "\n#noticias #unotv #tijuana", "regional", (None, "fuera")),
            (MIXCOAC, "nacional", ("nacional", "fuera")),
        ]
        for pie, ambito, esperado in casos:
            with self.subTest(pie=pie, ambito=ambito):
                self.assertEqual(tiktok._zona(pie, ambito), esperado)
        # ...pero un #mexico de relleno no la saca de Mundo. En un perfil; en
        # una busqueda un pie sin lugar se tira (24 de septiembre de 2026).
        asturias = "Cae un avion en Asturias #mexico #noticias"
        self.assertEqual(tiktok._zona(asturias, "internacional", tirar_sin_lugar=False),
                         ("internacional", "nacional"))
        self.assertEqual(tiktok._zona(asturias, "internacional"), (None, "nacional"))

    def test_el_ambito_llega_desde_la_busqueda_y_omite_regional(self):
        mundo = dict(BUSQUEDA, ambito="internacional")
        v, _ = tiktok._limpiar_video(_video(text="Rusia lanza drones contra Ucrania"), mundo, AHORA)
        self.assertEqual((v["zona"], v["alcance"]), ("internacional", "extranjero"))
        # El caso que lo motivo: la busqueda del mundo trajo un meme en
        # portugues sin lugar. Se tira y se cuenta; un perfil del mundo no.
        meme = _video(text="NOTÍCIA DE ÚLTIMA HORA 🚨")
        self.assertEqual(tiktok._limpiar_video(meme, mundo, AHORA), (None, "sin_lugar"))
        perfil = dict(mundo, perfil="@rhoizz")
        v, _ = tiktok._limpiar_video(meme, perfil, AHORA)
        self.assertEqual((v["zona"], v["alcance"]), ("internacional", "nacional"))
        # Una fila sin el campo se comporta como antes del 15 de septiembre de
        # 2026: un video de fuera se tira.
        self.assertNotIn("ambito", BUSQUEDA)
        self.assertEqual(
            tiktok._limpiar_video(_video(text="Balacera en Hermosillo"), BUSQUEDA, AHORA)[1],
            "fuera")

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

    def test_duracion_en_segundos_solo_si_la_trae_y_es_positiva(self):
        """Decide el precio de todo lo que Apify cobra por segundo de video."""
        self.assertEqual(self._limpio()[0]["duracion"], 47)
        # Sin videoMeta, sin el campo: un 0 se leeria como "duracion cero".
        self.assertNotIn("duracion", self._limpio(videoMeta={})[0])
        self.assertNotIn("duracion", self._limpio(videoMeta={"duration": 0})[0])
        self.assertNotIn("duracion", self._limpio(videoMeta={"duration": "raro"})[0])

    def test_los_subtitulos_se_cuentan_y_no_se_guardan(self):
        """El texto de unos subtitulos es el cuerpo del video: no entra a data/."""
        con = _video(videoMeta={"duration": 47, "subtitleLinks": [
            {"language": "spa-ES", "downloadLink": "https://x.test/s.vtt"}]})
        self.assertTrue(tiktok._tiene_subtitulos(con))
        self.assertFalse(tiktok._tiene_subtitulos(_video()))
        self.assertFalse(tiktok._tiene_subtitulos(_video(videoMeta={"subtitleLinks": []})))
        # Y de ahi no sale ninguna clave nueva en el registro.
        limpio, _ = tiktok._limpiar_video(con, BUSQUEDA, AHORA)
        self.assertEqual(
            [k for k in limpio if "subtitul" in k or "subtitle" in k.lower()], [])

    def test_la_entrada_pide_los_subtitulos_que_tiktok_ya_genero(self):
        """La opcion gratuita. Las dos de transcripcion cobran y no se piden."""
        entrada = tiktok._entrada_videos("tijuana noticias", 15, "PAST_24_HOURS")
        self.assertEqual(entrada["downloadSubtitlesOptions"], "DOWNLOAD_SUBTITLES")
        self.assertNotIn(entrada["downloadSubtitlesOptions"],
                         ("TRANSCRIBE_ALL_VIDEOS",
                          "DOWNLOAD_AND_TRANSCRIBE_VIDEOS_WITHOUT_SUBTITLES"))
        # Y las descargas cobradas siguen apagadas.
        self.assertFalse(any(entrada[k] for k in tiktok.SIN_DESCARGAS))

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

    def test_tiktok_no_reparte_sus_destacados_por_cuenta(self):
        """El reparto por turnos es de Instagram, y esto lo deja pinchado.

        Decision del cliente del 17 de septiembre de 2026. La razon tecnica va
        en la misma direccion: aqui `cuenta` es el id de una busqueda, no una
        voz, asi que repartir por cuenta seria repartir el mecanismo. El
        equivalente honesto seria `creador`, y no se pidio.

        Hacen falta dos busquedas: con una sola `cuenta` el reparto seria
        identidad. Hasta el 25 de septiembre de 2026 esta prueba llamaba al
        nucleo compartido con `turnos=False` a mano, asi que seguia verde si
        `tiktok.derivar` encendia el reparto: no fijaba lo que decia fijar.
        Ahora pasa por `tiktok.derivar`, que es donde se decide.
        """
        pubs = {}
        for i in range(18):
            grande = i < 15
            url = "https://www.tiktok.com/@x/video/{}".format(i)
            pubs[url] = {"url": url, "cuenta": "tk_a" if grande else "tk_b",
                         "zona": "Tijuana", "fecha": "2026-09-03", "tipo": "video",
                         "publicado": "2026-09-03T10:00:00+00:00", "titulo": "t",
                         "likes": (1000 - i) if grande else (10 - i), "comentarios": 0}
        busquedas = [dict(BUSQUEDA, id="tk_a"), dict(BUSQUEDA, id="tk_b")]
        panel = tiktok.derivar([], AHORA, [], {}, [], pubs, busquedas)
        self.assertEqual({d["cuenta"] for d in panel["destacados"]}, {"tk_a"})
        # Y el interruptor existe de verdad: encendido, si entraria la chica.
        encendido = _redes._destacados(pubs, [], [], [], busquedas, lambda p: True, turnos=True)
        self.assertEqual({d["cuenta"] for d in encendido}, {"tk_a", "tk_b"})

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
        # Desde el 22 de septiembre de 2026 una busqueda regional solo deja en
        # `nacional` lo que nombra a Mexico; lo que no nombra nada se tira.
        p = self._panel([_video(text="Sube el dolar en Mexico #noticias")])
        self.assertEqual(p["destacados"][0]["zona"], "nacional")
        self.assertEqual(validar_redes(p, plataforma="tiktok")[0], [])

    def test_una_busqueda_nunca_publica_residuo_del_corredor(self):
        # `estatal` sin lugar es de un MEDIO del corredor (YouTube, Instagram).
        # En TikTok seria la consulta acreditando su zona: el validador lo tira.
        p = self._panel([_video(text="Baja California estrena ley")])
        p["destacados"][0]["alcance"] = "nacional"
        self.assertTrue(any("ninguna zona se le puede acreditar" in e
                            for e in validar_redes(p, plataforma="tiktok")[0]))


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


# --- Perfiles: la cuenta del medio (22 de septiembre de 2026) ----------------

PERFIL = {"id": "tk_dwespanol", "nombre": "DW Español", "perfil": "@dw_espanol",
          "idioma": "es", "ambito": "internacional", "activo": True,
          "verificado": "2026-09-22", "marca": "dw", "seguidores": 3100000,
          "nota": "fixture"}


def _video_dw(vid, publicado, texto="Rusia lanza drones contra Ucrania", autor="dw_espanol"):
    return _video(id=vid, text=texto, createTime=_epoch(publicado),
                  createTimeISO=publicado.replace("+00:00", ".000Z"),
                  webVideoUrl="https://www.tiktok.com/@{}/video/{}".format(autor, vid),
                  authorMeta={"id": "2", "name": autor, "fans": 3100000,
                              "privateAccount": False})


class _ActorPerfil(_Actor):
    """Como _Actor, pero la pasada 1 puede ser de busqueda o de perfil."""

    def __call__(self, actor, entrada, tok, limite, timeout=None):
        self.llamadas.append((actor, entrada))
        es_videos = "searchQueries" in entrada or "profiles" in entrada
        return self.videos if es_videos else self.comentarios


class TestPerfiles(BaseCache):
    def test_la_entrada_es_la_del_actor_y_sin_filtro_cobrado(self):
        e = tiktok._entrada_perfil("@DW_espanol", 10)
        self.assertEqual(e["profiles"], ["DW_espanol"])
        self.assertEqual(e["profileScrapeSections"], ["videos"])
        self.assertEqual(e["profileSorting"], "latest")
        self.assertTrue(e["excludePinnedPosts"])
        self.assertEqual(e["resultsPerPage"], 10)
        for cobrado in ("searchQueries", "videoSearchDateFilter", "oldestPostDateUnified"):
            self.assertNotIn(cobrado, e)

    def test_la_ventana_se_impone_antes_de_pagar_comentarios(self):
        # Un perfil trae lo ultimo que publico la cuenta, sea de hoy o de la
        # semana pasada. Solo lo de la ventana paga comentarios.
        actor = _ActorPerfil(videos=[_video_dw("1", "2026-09-03T12:00:00+00:00"),
                                     _video_dw("2", "2026-08-30T12:00:00+00:00")])
        with patch.object(tiktok, "correr_actor", actor):
            _, salud, _ = tiktok.cosechar([], AHORA, tok="t", cache=self.cache,
                                          perfiles=[PERFIL])
        coms = [e for _, e in actor.llamadas if "postURLs" in e]
        self.assertEqual(len(coms), 1)
        self.assertEqual(coms[0]["postURLs"], ["https://www.tiktok.com/@dw_espanol/video/1"])
        self.assertEqual(coms[0]["commentsPerPost"], tiktok.COMENTARIOS_POR_VIDEO_PERFIL)
        self.assertEqual(salud[0]["fuera_de_ventana"], 1)
        # El viejo igual entra al catalogo: sus likes se refrescan.
        self.assertIn("https://www.tiktok.com/@dw_espanol/video/2",
                      tiktok.leer_publicaciones(self.cache))

    def test_un_video_de_otro_autor_se_tira(self):
        v, motivo = tiktok._limpiar_de_fila(
            _video_dw("3", "2026-09-03T12:00:00+00:00", autor="otro"), PERFIL, AHORA)
        self.assertIsNone(v)
        self.assertEqual(motivo, "otro_creador")

    def test_un_perfil_sin_verificar_no_se_cosecha(self):
        actor = _ActorPerfil(videos=[_video_dw("1", "2026-09-03T12:00:00+00:00")])
        with patch.object(tiktok, "correr_actor", actor):
            tiktok.cosechar([], AHORA, tok="t", cache=self.cache,
                            perfiles=[dict(PERFIL, verificado=None)])
        self.assertEqual(actor.llamadas, [])

    def test_el_perfil_es_una_cuenta_del_documento_y_valida(self):
        actor = _ActorPerfil(videos=[_video_dw("1", "2026-09-03T12:00:00+00:00")],
                             comentarios=[_comentario(
                                 "Que tristeza", videoWebUrl="https://www.tiktok.com/@dw_espanol/video/1")])
        with patch.object(tiktok, "correr_actor", actor):
            nuevos, salud, gasto = tiktok.cosechar([BUSQUEDA], AHORA, tok="t",
                                                   cache=self.cache, perfiles=[PERFIL])
        panel = tiktok.derivar(nuevos, AHORA, salud, gasto, [],
                               tiktok.leer_publicaciones(self.cache), [BUSQUEDA],
                               perfiles=[PERFIL])
        self.assertIn("tk_dwespanol", [c["cuenta"] for c in panel["cuentas"]])
        dw = [d for d in panel["destacados"] if d["cuenta"] == "tk_dwespanol"]
        self.assertEqual([(d["creador"], d["zona"], d["alcance"]) for d in dw],
                         [("@dw_espanol", "internacional", "extranjero")])
        self.assertEqual(validar_redes(panel, plataforma="tiktok")[0], [])

    def test_probar_una_fila_apagada_y_sus_seguidores(self):
        actor = _ActorPerfil(videos=[_video_dw("1", "2026-09-03T12:00:00+00:00")])
        with patch.object(tiktok, "correr_actor", actor):
            salida = tiktok.probar([BUSQUEDA], AHORA, tok="t",
                                   perfiles=[dict(PERFIL, activo=False)],
                                   filas=["tk_dwespanol"])
        self.assertEqual([s["busqueda"] for s in salida], ["tk_dwespanol"])
        self.assertEqual(salida[0]["seguidores"], 3100000)
        self.assertIn("profiles", actor.llamadas[0][1])


class TestValidadorPerfiles(unittest.TestCase):
    BASE = {"nota": "x", "cosecha": {"videos_por_busqueda": 15, "comentarios_por_video": 20,
                                     "dias_entre_cosechas": 3, "ventana_horas": 24,
                                     "filtro_fecha": "PAST_24_HOURS",
                                     "presupuesto_resultados": 3800,
                                     "videos_por_perfil": 10,
                                     "comentarios_por_video_perfil": 7},
            "busquedas": [dict(BUSQUEDA, nota="x")]}

    def _con(self, **cambios):
        return dict(self.BASE, perfiles=[dict(PERFIL, **cambios)])

    def test_un_perfil_bueno_valida(self):
        self.assertEqual(validar_tiktok_config(self._con())[0], [])

    def test_reglas_de_un_perfil(self):
        casos = [
            ({"ambito": None}, "'ambito' debe ser"),
            ({"consulta": "dw"}, "no lleva 'consulta'"),
            ({"zona": "Tijuana"}, "no lleva 'zona'"),
            ({"perfil": "dw_espanol"}, "'perfil' debe ser un @handle"),
            ({"verificado": None}, "necesita 'verificado'"),
            ({"id": "tk_tijuana_noticias"}, "id repetido"),
            ({"marca": "DW"}, "'marca' invalida"),
        ]
        for cambio, mensaje in casos:
            with self.subTest(cambio=cambio):
                e, _ = validar_tiktok_config(self._con(**cambio))
                self.assertTrue(any(mensaje in x for x in e), e)


class TestValidadorTikTok(unittest.TestCase):
    DESTACADO = {
        "url": "https://www.tiktok.com/@tjnoticias/video/7301", "cuenta": "tk_tijuana_noticias",
        "creador": "@tjnoticias", "zona": "Tijuana", "alcance": "zona",
        "publicado": "2026-09-03T10:00:00+00:00",
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

    def test_duracion_es_opcional_y_nunca_cero(self):
        """Un corte anterior al campo sigue siendo valido: data/ lo escribe el bot."""
        # Sin el campo: aviso, nunca error. Mismo trato que `alcance`.
        errores, avisos = validar_redes(dict(self.BASE), plataforma="tiktok")
        self.assertEqual(errores, [])
        self.assertTrue(any("duracion" in a for a in avisos), avisos)
        # Con el campo: ni error ni aviso.
        errores, avisos = validar_redes(self._con(duracion=47), plataforma="tiktok")
        self.assertEqual(errores, [])
        self.assertFalse(any("duracion" in a for a in avisos), avisos)
        # Un 0 se leeria como "video de duracion cero" y no como "no la trae".
        for malo in (0, -1, "47", 1.5, None):
            e, _ = validar_redes(self._con(duracion=malo), plataforma="tiktok")
            self.assertTrue(any("duracion" in x for x in e), (malo, e))

    def test_duracion_no_aplica_a_instagram(self):
        """Su actor no la publica; emitirla seria inventarla."""
        from tests.test_instagram import TestValidadorDestacados as TD
        d = dict(TD.CON); d["destacados"] = [dict(TD.DESTACADO, duracion=47)]
        self.assertTrue(any("'duracion' no aplica" in x for x in validar_redes(d)[0]))

    def test_ventana_dias_no_aplica_a_tiktok_y_las_dos_juntas_son_error(self):
        e, _ = validar_redes(dict(self.BASE, ventana_dias=7), plataforma="tiktok")
        self.assertTrue(any("no aplica" in x for x in e))
        # Instagram mide en horas desde el 10 de septiembre de 2026; su
        # `ventana_dias` solo se acepta SOLA, como corte anterior al cambio, y
        # nunca junto a la otra.
        from tests.test_instagram import TestValidadorDestacados as TD
        e, _ = validar_redes(dict(TD.CON, ventana_dias=7))
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

    def test_alcance_y_zona_tienen_que_cuadrar(self):
        """Un cruce mal hecho aqui es la acreditacion por consulta disfrazada."""
        e, _ = validar_redes(self._con(alcance="mundial"), plataforma="tiktok")
        self.assertTrue(any("'alcance' debe ser" in x for x in e))
        # El pie nombro un lugar del producto: la zona tiene que ser uno.
        e, _ = validar_redes(self._con(alcance="zona", zona="nacional"), plataforma="tiktok")
        self.assertTrue(any("alcance 'zona' con zona" in x for x in e))
        # Un lugar de fuera solo sobrevive como `nacional`, y solo fuera de una
        # busqueda regional. Nunca como una zona del corredor.
        e, _ = validar_redes(self._con(alcance="fuera"), plataforma="tiktok")
        self.assertTrue(any("alcance 'fuera' con zona" in x for x in e))
        # El gacetero no nombro lugar: ninguna zona se le puede acreditar.
        e, _ = validar_redes(self._con(alcance="nacional", zona="Mexicali"), plataforma="tiktok")
        self.assertTrue(any("ninguna zona se le puede acreditar" in x for x in e))
        # Nombrar el extranjero solo puede caer en Mundo.
        e, _ = validar_redes(self._con(alcance="extranjero", zona="nacional"), plataforma="tiktok")
        self.assertTrue(any("alcance 'extranjero' con zona" in x for x in e))
        self.assertEqual(validar_redes(self._con(alcance="extranjero", zona="internacional"),
                                       plataforma="tiktok")[0], [])

    def test_internacional_en_instagram_solo_con_alcance(self):
        d = self._con(zona="internacional", alcance="nacional")
        self.assertEqual(validar_redes(d, plataforma="tiktok")[0], [])
        # Una cuenta de Instagram con `zona` estampa su sede, y ninguna sede es
        # "el mundo". Solo una cuenta con `ambito` llega a `internacional`, y
        # entonces trae el alcance del pie que la puso ahi.
        from tests.test_instagram import TestValidadorDestacados as TD
        d = dict(TD.CON); d["destacados"] = [dict(TD.DESTACADO, zona="internacional")]
        self.assertTrue(any("sin 'alcance'" in x for x in validar_redes(d)[0]))
        d = dict(TD.CON)
        d["destacados"] = [dict(TD.DESTACADO, zona="internacional", alcance="extranjero")]
        self.assertEqual(validar_redes(d)[0], [])

    def test_alcance_en_instagram_es_opcional_pero_cuadra_y_faltar_solo_avisa(self):
        from tests.test_instagram import TestValidadorDestacados as TD
        # Una cuenta estampada no lo trae y no pasa nada...
        self.assertEqual(validar_redes(dict(TD.CON))[0], [])
        # ...y cuando lo trae, cuadra igual que en TikTok.
        d = dict(TD.CON); d["destacados"] = [dict(TD.DESTACADO, alcance="nacional")]
        self.assertTrue(any("ninguna zona se le puede acreditar" in x
                            for x in validar_redes(d)[0]))
        # Un corte anterior al campo sigue siendo valido: data/ lo escribe el
        # bot y el cron lo regenera. Mismo trato que `ventana_legado`.
        d = self._con(); del d["destacados"][0]["alcance"]
        e, a = validar_redes(d, plataforma="tiktok")
        self.assertEqual(e, [])
        self.assertTrue(any("anteriores al campo 'alcance'" in x for x in a))

    def test_config_ambito_es_un_enum_y_no_sustituye_a_zona(self):
        from pulso.validador import validar_tiktok_config
        base = {"nota": "x", "cosecha": {"videos_por_busqueda": 15, "comentarios_por_video": 20,
                                         "dias_entre_cosechas": 3, "ventana_horas": 24,
                                         "filtro_fecha": "PAST_24_HOURS",
                                         "presupuesto_resultados": 3600},
                "busquedas": [{"id": "tk_xx", "nombre": "x", "consulta": "x", "idioma": "es",
                               "activo": True, "nota": "x"}]}
        for bueno in tiktok.AMBITOS:
            b = dict(base); b["busquedas"] = [dict(base["busquedas"][0], ambito=bueno)]
            with self.subTest(ambito=bueno):
                self.assertEqual(validar_tiktok_config(b)[0], [])
        b = dict(base); b["busquedas"] = [dict(base["busquedas"][0], ambito="mundial")]
        self.assertTrue(any("'ambito'" in x for x in validar_tiktok_config(b)[0]))
        # Tener ambito NO habilita zona: es la puerta de atras que hay que cerrar.
        b = dict(base)
        b["busquedas"] = [dict(base["busquedas"][0], ambito="nacional", zona="Tijuana")]
        self.assertTrue(any("no lleva 'zona'" in x for x in validar_tiktok_config(b)[0]))

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

    def test_una_busqueda_apagada_dice_por_que(self):
        """Apagar es un registro deliberado, no un pendiente: lleva razon.

        Tecate, San Felipe y San Quintin se probaron de verdad el 15 de
        septiembre de 2026 y no devolvieron noticia sino falsos positivos --
        un incendio en Apodaca zonificado como Tecate, una carrera en
        Manhattan como San Felipe. Es el mismo patron que `sanquintin` en
        config/medios.json: se registra el hueco con el numero que lo delato.
        """
        for b in self.cfg["busquedas"]:
            if not b["activo"]:
                with self.subTest(busqueda=b["id"]):
                    self.assertIn("APAGADA", b["nota"])

    def test_el_tope_alcanza_para_todas_las_filas_no_solo_las_activas(self):
        """`reparto - posts` recorta la pasada de comentarios EN SILENCIO.

        Por eso el tope se calcula sobre TODAS las busquedas y no sobre las
        activas: encender una apagada no debe recortar a las demas sin aviso.
        """
        c = self.cfg["cosecha"]
        por_busqueda = c["videos_por_busqueda"] * (1 + c["comentarios_por_video"])
        # Los perfiles cuentan como filas enteras: Presupuesto.reparto divide
        # parejo entre todas, asi que cada una tiene que alcanzar para lo que
        # pide la mas cara, que es una busqueda (22 de septiembre de 2026).
        filas = len(self.cfg["busquedas"]) + len(self.cfg.get("perfiles", []))
        self.assertGreaterEqual(c["presupuesto_resultados"], por_busqueda * filas)


if __name__ == "__main__":
    unittest.main()
