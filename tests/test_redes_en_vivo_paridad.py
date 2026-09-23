"""Paridad entre los limpiadores del pipeline y su copia en TypeScript.

La busqueda en vivo de Redes (web/src/lib/redes-en-vivo/limpiar.ts) limpia lo
que devuelve Apify en el servidor del sitio, con una COPIA de
pulso/tiktok.py, pulso/instagram.py, pulso/facebook.py y
pulso/redes.py::publicar_comentarios. Dos copias de una regla de identidad
envejecen por separado, y esta no puede envejecer: es donde se tira quien
comenta.

Asi que las dos leen el mismo fixture (web/scripts/fixtures/redes-en-vivo/
crudos.json) y tienen que llegar al mismo esperado.json. Esta prueba lo
recalcula con el pipeline; web/scripts/probar-redes-en-vivo.cjs lo recalcula
con la copia. Si una cambia y la otra no, falla una de las dos.

Lo que se compara es lo que la copia promete: los campos de cada publicacion
menos la zona (el gacetero vive solo en Python y la busqueda de un termino no
lo usa) y el texto publicado de los comentarios sin su tono. La busqueda por
palabra de Facebook no esta: el pipeline nunca la leyo (facebook.ACTOR_BUSQUEDA
es None), asi que no hay contra que comparar; su forma la fija el .cjs.

Para regenerar esperado.json despues de un cambio DELIBERADO en el pipeline:

    python -m tests.test_redes_en_vivo_paridad --escribir
"""

import json
import os
import sys
import unittest

from pulso import facebook, instagram, redes, tiktok

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA = os.path.join(RAIZ, "web", "scripts", "fixtures", "redes-en-vivo")
CRUDOS = os.path.join(CARPETA, "crudos.json")
ESPERADO = os.path.join(CARPETA, "esperado.json")

CAMPOS = ("url", "creador", "publicado", "fecha", "titulo", "tipo", "likes", "comentarios",
          "compartidos", "guardados", "reproducciones", "duracion")


def _campos(post):
    return {k: post[k] for k in CAMPOS if k in post}


def _publicados(doc):
    return {url: [{"texto": c["texto"], "likes": c["likes"], "fecha": c["fecha"]} for c in lista]
            for url, lista in doc["por_post"].items()}


def calcular(crudos):
    ahora = crudos["ahora"]
    salida = {}

    busqueda = {"id": "vivo-tiktok", "ambito": "nacional", "idioma": "es"}
    posts, urls = [], []
    for item in crudos["tiktok"]["videos"]:
        registro, motivo = tiktok._limpiar_video(item, busqueda, ahora)
        if registro is None:
            posts.append({"descarte": motivo})
            continue
        posts.append(_campos(registro))
        urls.append(registro["url"])
    comentarios = []
    for c in crudos["tiktok"]["comentarios"]:
        url = tiktok._url_video(c.get("videoWebUrl") or "")
        limpio = tiktok._limpiar_comentario(c, url, busqueda, "nacional")
        if limpio is not None:
            comentarios.append(limpio)
    doc = redes.publicar_comentarios(comentarios, [{"url": u} for u in urls], ahora, plataforma="tiktok")
    salida["tiktok"] = {"posts": posts, "comentarios": _publicados(doc)}

    cuenta = {"id": "vivo-instagram", "zona": "nacional", "idioma": "es"}
    posts, urls = [], []
    for item in crudos["instagram"]["posts"]:
        registro = instagram._limpiar_post(item, cuenta)
        posts.append(_campos(registro))
        urls.append(registro["url"])
    comentarios = [c for c in (instagram._limpiar(x, x["postUrl"], cuenta) for x in crudos["instagram"]["comentarios"])
                   if c is not None]
    doc = redes.publicar_comentarios(comentarios, [{"url": u} for u in urls], ahora, plataforma="instagram")
    salida["instagram"] = {"posts": posts, "comentarios": _publicados(doc)}

    fuente = {"cuenta": "vivo-facebook", "idioma": "es"}
    comentarios, urls = [], set()
    for x in crudos["facebook"]["comentarios"]:
        url = facebook._url_post(x.get("inputUrl") or "")
        urls.add(url)
        limpio = facebook._limpiar_comentario(x, url, fuente, "nacional")
        if limpio is not None:
            comentarios.append(limpio)
    doc = redes.publicar_comentarios(comentarios, [{"url": u} for u in sorted(urls)], ahora, plataforma="facebook")
    salida["facebook"] = {"comentarios": _publicados(doc)}
    return salida


def _leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


class TestParidadRedesEnVivo(unittest.TestCase):
    def test_el_pipeline_llega_al_esperado(self):
        self.assertEqual(calcular(_leer(CRUDOS)), _leer(ESPERADO))

    def test_la_identidad_no_sale(self):
        texto = json.dumps(_leer(ESPERADO), ensure_ascii=False)
        for dato in ("persona1", "persona2", "persona3", "Persona Cinco", "555", "ownerUsername",
                     "profileName", "avatar", "fulano_de_tal", "maria_p", "amigo.bueno"):
            self.assertNotIn(dato, texto)

    def test_el_fixture_ejerce_cada_regla(self):
        # Si alguien "simplifica" el fixture, estas reglas dejan de probarse
        # en las dos copias a la vez y nadie se entera.
        esperado = _leer(ESPERADO)
        descartes = {p.get("descarte") for p in esperado["tiktok"]["posts"]}
        self.assertTrue({"anuncio", "privado", "sin_url"} <= descartes)
        tk = esperado["tiktok"]["comentarios"]
        todos = [c["texto"] for lista in tk.values() for c in lista]
        self.assertNotIn("PÁGINA FALSA NO LE CREAN", todos, "brigada")
        self.assertNotIn("🔥🔥🔥", todos, "reaccion")
        self.assertTrue(any("@…" in t for t in todos), "mencion enmascarada")
        self.assertTrue(any(t.endswith("…") and len(t) <= redes.TEXTO_MAXIMO for t in todos), "recorte")
        # Siete candidatos en el video de @dos: los cinco primeros siempre, y
        # los dos que siguen no tienen likes, asi que no salen.
        dos = tk["https://www.tiktok.com/@dos/video/7401000000000000002"]
        self.assertEqual(len(dos), redes.COMENTARIOS_VISIBLES)
        self.assertEqual(dos[0]["texto"], "Seis con likes", "los likes mandan")


if __name__ == "__main__":
    if "--escribir" in sys.argv:
        with open(ESPERADO, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(calcular(_leer(CRUDOS)), ensure_ascii=False, indent=1) + "\n")
        print("escrito", ESPERADO)
    else:
        unittest.main()
