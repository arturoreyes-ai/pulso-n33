"""El ano en redes de un expediente (pulso/expediente_redes.py). Sin red.

Apify se sustituye por funciones que devuelven items con la forma de cada
actor; el reloj se inyecta. Lo que se fija: que la busqueda solo deja lo que
lo nombra, que cada red se ordena por su propia unidad, que a git no llega
texto ni identidad, y que la corrida asincrona de apify.py espera, pagina y
devuelve lo cobrado.
"""

import json
import os
import tempfile
import unittest
from unittest import mock

from pulso import apify, expediente_redes as er
from pulso.consultas import SALVEDAD_TONO
from pulso.validador import validar_expediente_redes, validar_expedientes_comentarios

AHORA = "2026-10-02T18:00:00+00:00"


def fila(**cambios):
    base = {
        "id": "prueba-2026", "persona": "Ismael Burgueño Ruiz", "idioma": "es",
        "desde": "2025-10-01", "hasta": "2026-10-02", "por_mes": 2,
        "comentarios_por_post": 3, "tope_usd": 20,
        "terminos": ["Burgueño"], "contexto": ["Tijuana", "alcalde", "Ismael"],
        "cuentas": [
            {"red": "instagram", "valor": "@burguenotj", "activo": True,
             "verificado": "2026-10-02", "tope_posts": 10, "razon": "prueba"},
            {"red": "facebook", "valor": "BurguenoIsmael", "activo": True,
             "verificado": "2026-10-02", "tope_posts": 10, "razon": "prueba"},
        ],
        "busquedas_tiktok": [{"consulta": "Ismael Burgueño", "orden": "MOST_RELEVANT",
                              "filtro_fecha": "ALL_TIME", "tope": 10}],
    }
    base.update(cambios)
    return base


def video(n, texto, vistas, likes=10, creador="canal33tijuana", cuando="2026-09-29T15:00:00.000Z"):
    return {"webVideoUrl": "https://www.tiktok.com/@{}/video/{}".format(creador, n),
            "authorMeta": {"name": creador, "nickName": "Canal 33", "fans": 9},
            "createTimeISO": cuando, "text": texto, "diggCount": likes, "commentCount": 4,
            "shareCount": 1, "collectCount": 0, "playCount": vistas}


def post_ig(code, likes, cuando="2026-09-10T12:00:00.000Z"):
    return {"url": "https://www.instagram.com/p/{}/".format(code), "timestamp": cuando,
            "caption": "Informe de labores\nmas texto", "likesCount": likes, "commentsCount": 2,
            "type": "Image", "ownerUsername": "burguenotj"}


def post_fb(n, likes, cuando="2026-08-05T12:00:00.000Z"):
    return {"url": "https://www.facebook.com/BurguenoIsmael/posts/pfbid{}".format(n),
            "time": cuando, "text": "Obra en Tijuana", "likes": likes, "comments": 3,
            "shares": 2, "user": {"name": "BurguenoIsmael"}}


def comentario(red, texto, likes):
    if red == "tiktok":
        return {"text": texto, "diggCount": likes, "createTimeISO": "2026-09-30T00:00:00.000Z",
                "uniqueId": "alguien", "avatarThumbnail": "x"}
    if red == "instagram":
        return {"text": texto, "likesCount": likes, "timestamp": "2026-09-30T00:00:00.000Z",
                "ownerUsername": "alguien"}
    return {"text": texto, "likesCount": likes, "date": "2026-09-30T00:00:00.000Z",
            "profileName": "Alguien", "profileId": "1"}


def falso_largo(por_actor):
    def correr(actor, entrada, tok, limite, max_usd=None):
        return por_actor[actor](entrada)[:limite], "SUCCEEDED", 0.25
    return correr


class TestFiltro(unittest.TestCase):
    def test_lo_nombra_con_contexto(self):
        e = fila()
        self.assertTrue(er.nombra("🚨 Burgueño asegura que no tiene investigación en Tijuana", e))
        self.assertTrue(er.nombra("ISMAEL BURGUEÑO, ALCALDE", e))

    def test_el_apellido_solo_no_basta(self):
        # Hay Burguenos fuera de Tijuana: sin contexto, la busqueda traeria a cualquiera.
        self.assertFalse(er.nombra("Héctor Burgueño gana en Culiacán", fila()))

    def test_lo_que_no_lo_nombra_se_tira(self):
        # Lo que devolvio MOST_LIKED en el sondeo del 2 de octubre de 2026.
        self.assertFalse(er.nombra("👔 I'm Bellingham. Jude Bellingham. #GoldenBoy", fila()))

    def test_palabra_entera(self):
        self.assertFalse(er.nombra("burguenomania en Tijuana", fila()))


class TestConfig(unittest.TestCase):
    def test_el_config_real_es_valido_y_cabe_en_su_tope(self):
        cfg = er.leer_config(os.path.join("config", "expedientes-redes.json"))
        for e in cfg["expedientes"]:
            self.assertEqual(er.validar_config(e), [], e["id"])
            self.assertLessEqual(er.estimado_usd(e), e["tope_usd"], e["id"])

    def test_activa_sin_verificado_es_error(self):
        e = fila()
        e["cuentas"][0].pop("verificado")
        self.assertTrue(any("verificado" in x for x in er.validar_config(e)))

    def test_cuenta_apagada_no_se_lee(self):
        e = fila()
        e["cuentas"][1]["activo"] = False
        self.assertEqual([t["red"] for t in er.tareas(e)], ["instagram", "tiktok"])

    def test_meses_de_la_ventana(self):
        self.assertEqual(er.meses_de("2025-11-15", "2026-02-01"),
                         ["2025-11", "2025-12", "2026-01", "2026-02"])


class TestCorrida(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.cache = os.path.join(self.dir, "cache")
        self.e = fila()
        self.listado = falso_largo({
            "clockworks~tiktok-scraper": lambda _: [
                video(1, "Burgueño buscará la reelección en Tijuana", 900),
                video(2, "Ismael Burgueño rinde informe", 5000, creador="mxbajanews"),
                video(3, "Jude Bellingham", 99999, creador="otro"),
                video(4, "Burgueño en Tijuana, hace dos años", 70000,
                      cuando="2024-09-01T00:00:00.000Z"),
                video(5, "Alcalde Burgueño en el cabildo de Tijuana", 3000, creador="lanota"),
            ],
            "apify~instagram-scraper": lambda _: [post_ig("A", 50), post_ig("B", 900),
                                                   post_ig("C", 10)],
            "apify~facebook-posts-scraper": lambda _: [post_fb(1, 30), post_fb(2, 300)],
        })

    def _comentarios(self, actor, entrada, tok, limite):
        red = {"clockworks~tiktok-comments-scraper": "tiktok",
               "apify~instagram-scraper": "instagram",
               "apify~facebook-comments-scraper": "facebook"}[actor]
        # Texto distinto por post: el mismo en tres posts es brigada y no se publica.
        n = len(entrada.get("postURLs") or entrada.get("directUrls") or entrada.get("startUrls"))
        sello = json.dumps(entrada, sort_keys=True)[-12:]
        return [comentario(red, "Muy bien alcalde " + sello, 5),
                comentario(red, "Pura obra " + sello, 9 * n),
                comentario(red, "🔥", 1), comentario(red, "Otro " + sello, 0)][:limite]

    def correr(self):
        pubs, fuentes, usd = er.listar(self.e, AHORA, "tok", correr=self.listado)
        _, facturados, _ = er.comentar(self.e, er.seleccionar(pubs, self.e), AHORA, "tok",
                                       self.cache, correr=self._comentarios)
        doc = er.derivar(self.e, pubs, fuentes, AHORA, self.cache,
                         gasto={"usd_listado": usd, "comentarios_facturados": facturados})
        return pubs, fuentes, doc

    def test_busqueda_y_ventana(self):
        pubs, fuentes, _ = self.correr()
        tk = sorted(p["url"].rsplit("/", 1)[1] for p in pubs.values() if p["red"] == "tiktok")
        self.assertEqual(tk, ["1", "2", "5"])     # sin Bellingham y sin 2024
        f = fuentes["tiktok|busqueda|Ismael Burgueño|MOST_RELEVANT|ALL_TIME"]
        self.assertEqual(f["descartes"], {"fuera_de_ventana": 1, "no_lo_nombra": 1})

    def test_cada_red_por_su_unidad_y_tope_por_mes(self):
        _, _, doc = self.correr()
        sep = next(m for m in doc["meses"] if m["mes"] == "2026-09")["redes"]
        self.assertEqual([p["reproducciones"] for p in sep["tiktok"]], [5000, 3000])
        self.assertEqual([p["likes"] for p in sep["instagram"]], [900, 50])
        ago = next(m for m in doc["meses"] if m["mes"] == "2026-08")["redes"]
        self.assertEqual([p["likes"] for p in ago["facebook"]], [300, 30])
        self.assertEqual(len(doc["meses"]), 13)
        self.assertEqual(next(m for m in doc["meses"] if m["mes"] == "2026-01")["redes"]["tiktok"], [])

    def test_comentarios_con_tope_y_sin_identidad(self):
        _, _, doc = self.correr()
        p = next(m for m in doc["meses"] if m["mes"] == "2026-09")["redes"]["instagram"][0]
        self.assertEqual(p["cosechados"], 3)
        self.assertEqual(sum(p["tono"].values()), 3)
        crudo = json.dumps(doc, ensure_ascii=False)
        for prohibido in ("Muy bien alcalde", "Pura obra", "alguien", "Alguien", "ownerUsername", "uniqueId"):
            self.assertNotIn(prohibido, crudo)
        self.assertEqual(validar_expediente_redes(doc), ([], []))

    def test_el_texto_va_aparte_y_valida(self):
        _, _, doc = self.correr()
        texto = er.publicar_texto(self.e, doc, AHORA, self.cache)
        bloque = texto["expedientes"]["prueba-2026"]
        por_post = bloque["comentarios"]
        self.assertTrue(por_post)
        self.assertEqual(bloque["resumenes"], {})
        primera = next(iter(por_post.values()))
        self.assertTrue(primera[0]["texto"].startswith("Pura obra"))   # mas likes primero
        self.assertNotIn("🔥", [c["texto"] for c in primera])   # reaccion sin palabras
        self.assertEqual(validar_expedientes_comentarios(texto, {"prueba-2026": doc}), ([], []))

    def _resumen(self, url, lista, **cambios):
        r = {"firma": er.firma(lista), "texto": "Se repite el reclamo por la obra.", "leidos": len(lista),
             "fecha": AHORA, "modelo": "prueba",
             "temas": [{"nombre": "Obra", "detalle": "Hablan de la obra.", "comentarios": [0, 1]}]}
        r.update(cambios)
        ruta = os.path.join(self.cache, self.e["id"], "resumenes.json")
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump({url: r}, fh, ensure_ascii=False)

    def test_el_resumen_se_publica_si_su_lista_es_la_de_hoy(self):
        # El 5 de octubre de 2026: el resumen de cada publicacion, escrito por
        # web/scripts/resumir-expediente.cjs, viaja en el archivo de texto.
        _, _, doc = self.correr()
        bloque = er.publicar_texto(self.e, doc, AHORA, self.cache)["expedientes"]["prueba-2026"]
        url, lista = next(iter(bloque["comentarios"].items()))
        self._resumen(url, lista)
        texto = er.publicar_texto(self.e, doc, AHORA, self.cache)
        r = texto["expedientes"]["prueba-2026"]["resumenes"][url]
        self.assertEqual(set(r), {"texto", "leidos", "fecha", "temas"})
        self.assertNotIn("firma", r)
        self.assertEqual(validar_expedientes_comentarios(texto, {"prueba-2026": doc}), ([], []))

    def test_un_resumen_de_otra_lista_o_vencido_no_se_publica(self):
        _, _, doc = self.correr()
        bloque = er.publicar_texto(self.e, doc, AHORA, self.cache)["expedientes"]["prueba-2026"]
        url, lista = next(iter(bloque["comentarios"].items()))
        self._resumen(url, lista, firma="otra-lista")
        self.assertEqual(er.publicar_texto(self.e, doc, AHORA, self.cache)["expedientes"]["prueba-2026"]["resumenes"], {})
        self._resumen(url, lista, fecha="2026-08-01T00:00:00+00:00")
        self.assertEqual(er.publicar_texto(self.e, doc, AHORA, self.cache)["expedientes"]["prueba-2026"]["resumenes"], {})

    def test_un_tema_que_cita_fuera_de_la_lista_es_error(self):
        _, _, doc = self.correr()
        texto = er.publicar_texto(self.e, doc, AHORA, self.cache)
        bloque = texto["expedientes"]["prueba-2026"]
        url, lista = next(iter(bloque["comentarios"].items()))
        bloque["resumenes"][url] = {"texto": "x", "leidos": 3, "fecha": AHORA,
                                    "temas": [{"nombre": "A", "detalle": "b", "comentarios": [0, 99]}]}
        errores, _ = validar_expedientes_comentarios(texto, {"prueba-2026": doc})
        self.assertTrue(any("posiciones" in x for x in errores))

    def test_no_repaga_lo_ya_leido(self):
        self.correr()
        pubs, _, _ = er.listar(self.e, AHORA, "tok", correr=self.listado)
        llamadas = []
        er.comentar(self.e, er.seleccionar(pubs, self.e), AHORA, "tok", self.cache,
                    correr=lambda *a: llamadas.append(a) or [])
        self.assertEqual(llamadas, [])

    def test_un_fallo_se_dice_y_se_reintenta(self):
        # El tope mensual de Apify del 5 de octubre de 2026: la lectura falla,
        # se reporta, y el post no queda como leido.
        pubs, _, _ = er.listar(self.e, AHORA, "tok", correr=self.listado)
        def cae(*a):
            raise RuntimeError("HTTP 403: Monthly usage hard limit exceeded")
        _, facturados, fallos = er.comentar(self.e, er.seleccionar(pubs, self.e), AHORA, "tok",
                                            self.cache, correr=cae)
        self.assertEqual(facturados, {})
        self.assertTrue(fallos and all("hard limit" in err for _, err in fallos))
        llamadas = []
        er.comentar(self.e, er.seleccionar(pubs, self.e), AHORA, "tok", self.cache,
                    correr=lambda *a: llamadas.append(a) or [])
        self.assertEqual(len(llamadas), len(fallos))

    def test_determinista(self):
        pubs, fuentes, _ = self.correr()
        a = er.derivar(self.e, pubs, fuentes, AHORA, self.cache)
        b = er.derivar(self.e, dict(reversed(list(pubs.items()))), fuentes, AHORA, self.cache)
        self.assertEqual(json.dumps(a, ensure_ascii=False), json.dumps(b, ensure_ascii=False))

    def test_lo_excluido_cede_su_lugar_y_se_cuenta(self):
        # El caso del 5 de octubre de 2026: el mas visto lo nombraba en el pie
        # y no trataba de el.
        url = "https://www.tiktok.com/@mxbajanews/video/2"
        self.e["excluidos"] = [{"url": url, "razon": "no trata de él, prueba"}]
        pubs, fuentes, _ = er.listar(self.e, AHORA, "tok", correr=self.listado)
        doc = er.derivar(self.e, pubs, fuentes, AHORA, self.cache)
        sep = next(m for m in doc["meses"] if m["mes"] == "2026-09")["redes"]["tiktok"]
        self.assertEqual([p["reproducciones"] for p in sep], [3000, 900])
        self.assertNotIn(url, [p["url"] for p in sep])
        self.assertEqual(doc["excluidos"], 1)
        self.assertEqual(validar_expediente_redes(doc)[0], [])

    def test_un_excluido_sin_razon_es_error(self):
        e = fila(excluidos=[{"url": "https://www.tiktok.com/@a/video/1", "razon": ""}])
        self.assertTrue(any("razon" in x for x in er.validar_config(e)))

    def test_una_red_que_falla_es_sin_dato(self):
        def correr(actor, entrada, tok, limite, max_usd=None):
            if actor == "apify~facebook-posts-scraper":
                raise RuntimeError("caida")
            return self.listado(actor, entrada, tok, limite)
        pubs, fuentes, _ = er.listar(self.e, AHORA, "tok", correr=correr)
        doc = er.derivar(self.e, pubs, fuentes, AHORA, self.cache)
        self.assertEqual(doc["sin_dato"], ["facebook"])
        self.assertTrue(all("facebook" not in m["redes"] for m in doc["meses"]))
        self.assertEqual(validar_expediente_redes(doc)[0], [])


class TestValidador(unittest.TestCase):
    def doc(self):
        return {"id": "x", "desde": "2025-10-01", "hasta": "2026-10-02", "por_mes": 2,
                "comentarios_por_post": 50, "unidades": {}, "sin_dato": [], "fuentes": [],
                "salvedad_tono": SALVEDAD_TONO,
                "meses": [{"mes": "2026-09", "redes": {"tiktok": [
                    {"url": "https://www.tiktok.com/@a/video/1", "cuenta": "@a", "propia": False,
                     "fecha": "2026-09-02", "titulo": "t", "likes": 1, "comentarios": 2,
                     "reproducciones": 50, "cosechados": 0}]}}]}

    def test_valido(self):
        self.assertEqual(validar_expediente_redes(self.doc())[0], [])

    def test_texto_de_comentario_es_error(self):
        d = self.doc()
        d["meses"][0]["redes"]["tiktok"][0]["texto"] = "algo"
        self.assertTrue(validar_expediente_redes(d)[0])

    def test_reproducciones_en_cero_es_error(self):
        d = self.doc()
        d["meses"][0]["redes"]["tiktok"][0]["reproducciones"] = 0
        self.assertTrue(any("> 0" in x for x in validar_expediente_redes(d)[0]))

    def test_meses_desordenados(self):
        d = self.doc()
        d["meses"].insert(0, {"mes": "2026-10", "redes": {}})
        self.assertTrue(any("ordenado" in x for x in validar_expediente_redes(d)[0]))

    def test_tono_que_no_suma(self):
        d = self.doc()
        p = d["meses"][0]["redes"]["tiktok"][0]
        p["cosechados"] = 2
        p["tono"] = {"positivo": 1, "negativo": 0, "neutral": 0, "sin_clasificar": 0,
                     "sin_modelo_idioma": 0}
        self.assertTrue(any("suma" in x for x in validar_expediente_redes(d)[0]))

    def test_salvedad_parafraseada(self):
        d = self.doc()
        d["salvedad_tono"] = "otra cosa"
        self.assertTrue(validar_expediente_redes(d)[0])


class TestCorridaLarga(unittest.TestCase):
    def test_espera_pagina_y_cobra(self):
        respuestas = iter([
            {"data": {"id": "r1", "defaultDatasetId": "d1", "status": "RUNNING"}},
            {"data": {"status": "RUNNING"}},
            {"data": {"status": "SUCCEEDED", "usageTotalUsd": 1.25}},
            [{"n": i} for i in range(1000)],
            [{"n": 1000}],
        ])
        pedidas = []

        def pedir(metodo, ruta, tok, cuerpo=None, params=None, timeout=30):
            pedidas.append((metodo, ruta, params))
            return next(respuestas)
        with mock.patch.object(apify, "_pedir", pedir):
            items, estado, usd = apify.correr_actor_largo("a~b", {"x": 1}, "t", 5000,
                                                          max_usd=3, dormir=lambda s: None)
        self.assertEqual((len(items), estado, usd), (1001, "SUCCEEDED", 1.25))
        self.assertEqual(pedidas[0][2], {"maxItems": 5000, "maxTotalChargeUsd": "3.00"})

    def test_con_sesion_no_arranca(self):
        with self.assertRaises(apify.ActorProhibido):
            apify.correr_actor_largo("a~b", {"cookies": "x"}, "t", 10)

    def test_se_aborta_al_pasar_la_espera(self):
        respuestas = iter([{"data": {"id": "r1", "defaultDatasetId": "d1", "status": "RUNNING"}},
                           {}, []])
        pedidas = []

        def pedir(metodo, ruta, tok, cuerpo=None, params=None, timeout=30):
            pedidas.append(ruta)
            return next(respuestas)
        with mock.patch.object(apify, "_pedir", pedir):
            _, estado, _ = apify.correr_actor_largo("a~b", {}, "t", 10, espera=0,
                                                    dormir=lambda s: None)
        self.assertEqual(estado, "ABORTED")
        self.assertIn("actor-runs/r1/abort", pedidas)


if __name__ == "__main__":
    unittest.main()
