"""El rubro de una nota de prensa: la seccion en que el medio la publico y su titular.

Existe por la pregunta del 25 de septiembre de 2026, con que organizar las
notas por tema y por lugar. El lugar ya lo decide el gacetero (zonas.py). El
tema no lo decidia nadie, y la primera medicion dijo por que no bastaba lo que
habia: la regla de titulo de pulso/rubros.py, pasada sobre los 1,851 titulares
del 18 al 25 de septiembre, ponia 498 (27%) en algun rubro, y con dos errores
de idioma que se repetian: «mayor» era 33 de las 112 notas de Politica («Mujer
mayor de 65 años perdió su pensión») y «Padres» 19 de las 43 de Deportes
(«tras protestas de padres de familia»). Esa regla es la de las publicaciones
de redes y junta los dos idiomas porque un pie no declara el suyo. Una nota si
lo declara: `idioma` en config/medios.json.

Dos evidencias, y ninguna es un clasificador:

  seccion   La que el propio medio le asigno. Catorce de los dieciseis feeds
            RSS del catalogo la traen en cada item como <category> (Uniradio:
            Deportes, Negocios, Fama, Policiaca) y siete medios la escriben en
            la ruta de la URL (El Imparcial: /deporte/, /dinero/,
            /tij/policiaca/). La ruta se guarda con la nota, asi que se
            recalcula en cada corrida sobre todo el historico; la <category>
            solo existe al cosechar, y por eso lo que dijo se guarda en la nota
            como `rubros_categoria`. El mapa de seccion a rubro es de cada medio
            y va escrito a mano en config/medios.json (`secciones`, `rutas`):
            las secciones genericas («Local», «Noticias del día», «General») no
            dicen tema y no estan. Tampoco las que parecen tema y no lo son:
            /el-valle/ de El Vigia es el valle de San Quintin, no el de
            Guadalupe.
  titular   rubros.ts::nombraRubro, la regla con la que la portada ya filtra
            sus titulares en vivo, con la lista del idioma de la nota. Copiada
            y no inventada para que una nota del archivo y una fila en vivo en
            el mismo capitulo pasen la misma prueba. La copia se fija contra
            web/scripts/fixtures/rubros/esperado.json (clave `titulares`), que
            escribe el sitio:

                node web/scripts/probar-capitulos.cjs --escribir-rubros

            Mas SIN_TOPE: los terminos que esas listas perdieron solo por el
            tope de 31 palabras de Google («salió solo por el tope, no por
            ambiguo», dice rubros.ts), que no rige sobre una nota guardada. Sin
            ellos San Felipe se quedaba sin un solo rubro de Clima en la semana
            en que sus nueve notas de Clima eran sismos. Cada uno esta en la
            lista de redes del sitio (rubros.TERMINOS); la prueba lo exige.

Medido sobre la ventana del 18 al 25 de septiembre de 2026, solo con ruta y
titular (la <category> aparece desde la primera cosecha): 709 de 1,851 notas
(38%) con rubro, contra 498 (27%) de la regla de redes, y sin sus dos errores.

`rubros` es la union de las tres, en el orden de rubros.RUBROS. Afirma lo
mismo que cada pieza y nada mas: «el medio la archivo en esta seccion» o «el
titular dice esta palabra». Una nota sin rubro no es una nota sin tema.
"""

import re
from urllib.parse import urlsplit

from .normalizar import fold
from .rubros import RUBROS
from .sentimiento import IDIOMA_OMISION

# rubros.ts::TERMINOS_RUBRO, lista por lista. El porque de cada termino (y de
# cada uno que salio, como «Padres» en espanol) esta escrito alla.
TERMINOS_TITULAR = {
    "clima": {
        "es": ("clima", "lluvia", "lluvias", "tormenta", "huracán", "calor", "frente frío"),
        "en": ("weather", "rain", "storm", "hurricane", "flooding", "wildfire", "Santa Ana winds"),
    },
    "seguridad": {
        "es": ("detienen", "homicidio", "asesinan", "balacera", "balean", "desaparecida",
               "sin vida"),
        "en": ("shooting", "homicide", "arrested", "police", "sheriff", "crime", "border patrol"),
    },
    "deportes": {
        "es": ("Xolos", "Liga MX", "Toros", "futbol", "boxeo", "Águilas", "Zonkeys"),
        "en": ("Padres", "San Diego FC", "Aztecs", "soccer", "baseball", "sports", "Xolos"),
    },
    "politica": {
        "es": ("alcalde", "alcaldesa", "gobernadora", "cabildo", "diputado", "Morena", "mañanera",
               "presidenta"),
        "en": ("mayor", "city council", "governor", "election", "Congress", "supervisors",
               "Mexican president"),
    },
    "economia": {
        "es": ("empresas", "inversión", "empleo", "maquiladora", "aranceles", "precios", "turismo",
               "economía"),
        "en": ("business", "economy", "tariffs", "jobs", "housing", "trade", "tourism", "prices"),
    },
    "espectaculos": {
        "es": ("farándula", "famosos", "concierto", "cantante", "actriz", "actor", "influencer",
               "festival"),
        "en": ("celebrity", "concert", "singer", "actress", "actor", "influencer", "festival"),
    },
    "turismo": {
        "es": ("turismo", "hotel", "hoteles", "restaurante", "gastronomía", "vinícola",
               "Valle de Guadalupe"),
        "en": ("tourism", "hotel", "resort", "restaurant", "winery", "dining",
               "Valle de Guadalupe"),
    },
    "ia": {
        "es": ("inteligencia artificial", "IA", "ChatGPT", "OpenAI", "Gemini", "chatbot",
               "robótica"),
        "en": ("artificial intelligence", "AI", "ChatGPT", "OpenAI", "Gemini", "chatbot",
               "robotics"),
    },
}


# Lo que rubros.ts dejo fuera por el tope de Google, con su idioma. Todos
# vienen de la lista de redes del sitio. Fuera a proposito, cada uno por un
# titular: «vivienda» («Camión de transporte se impacta contra vivienda» salia
# de Economia), «viral» («Video viral: Max, el perro que juega con las olas
# del huracán» salia de Espectaculos), «PAN» (aqui se pliega, y es el pan),
# «cuerpo» (el de bomberos; «hallan cuerpos» se queda) y «vientos», que en
# prosa politica es metafora.
SIN_TOPE = {
    "clima": {"es": ("sismo", "temblor", "granizo"), "en": ("earthquake", "heat wave")},
    "seguridad": {
        "es": ("asesinado", "asesinada", "asesinato", "emboscan", "ataque armado", "fosa",
               "hallan cuerpos", "desaparecido", "sicarios", "narco", "fiscalía", "secuestro",
               "feminicidio", "extorsión", "crimen organizado", "ejecutado", "detenido", "policía"),
        "en": ("murder", "suspect", "robbery", "stabbing", "smuggling"),
    },
    "deportes": {"es": ("béisbol", "maratón", "Club Tijuana"), "en": ("boxing", "marathon", "Gulls")},
    "politica": {
        "es": ("senado", "senador", "senadora", "gobernador", "diputada", "regidor", "elecciones",
               "INE", "conferencia matutina"),
        "en": ("senator", "legislature", "ballot"),
    },
    "economia": {"es": ("inflación", "cruce fronterizo"), "en": ("layoffs",)},
    "espectaculos": {"es": ("película", "espectáculos", "reality show", "K-pop"), "en": ("movie",)},
    "turismo": {"es": ("vinos", "cervecería", "desarrollo residencial", "desarrollo inmobiliario"),
                "en": ("brewery", "real estate development")},
    "ia": {"es": ("Anthropic",), "en": ("Anthropic",)},
}


def _patron(termino):
    """rubros.ts::patronDe: palabra entera sobre el texto plegado, con plural
    opcional. Plegado quiere decir en minusculas: aqui «pan» SI es el PAN, y
    por eso «PAN» no esta en la lista del titular (rubros.ts lo explica)."""
    return re.compile(r"(?<![a-z0-9])" + re.escape(fold(termino)) + r"(?:e?s)?(?![a-z0-9])")


_PATRONES = {(r, idioma): [_patron(t) for t in listas[idioma]]
             for r, listas in TERMINOS_TITULAR.items() for idioma in listas}
_PATRONES_NOTA = {(r, idioma): patrones + [_patron(t) for t in SIN_TOPE[r].get(idioma, ())]
                  for (r, idioma), patrones in _PATRONES.items()}


def _nombra(patrones, titulo):
    if not patrones:          # un idioma sin lista no nombra nada: no se adivina
        return False
    texto = fold(titulo)
    return any(p.search(texto) for p in patrones)


def nombra_rubro_titular(titulo, rubro, idioma):
    """rubros.ts::nombraRubro tal cual: lo que la portada decide de un titular."""
    return _nombra(_PATRONES.get((rubro, idioma)), titulo)


def rubros_de_titular(titulo, idioma):
    return [r for r in RUBROS if nombra_rubro_titular(titulo, r, idioma)]


def rubros_de_titular_nota(titulo, idioma):
    """La regla de la portada mas SIN_TOPE: la que lleva una nota guardada."""
    return [r for r in RUBROS if _nombra(_PATRONES_NOTA.get((r, idioma)), titulo)]


def ordenar(rubros):
    """En el orden de RUBROS y sin repetir: dos corridas dan los mismos bytes
    aunque el feed cambie el orden de sus <category>."""
    vistos = set(rubros or ())
    return [r for r in RUBROS if r in vistos]


def rubros_de_categorias(medio, categorias):
    """Lo que dicen las <category> del item segun el mapa `secciones` del medio.

    Se compara plegado: el mismo medio escribe «Policiaca» en un item y
    «POLICIACA» en otro. Una etiqueta que no esta en el mapa no dice nada,
    y la mayoria no esta: WordPress manda las etiquetas libres junto con las
    secciones, y ahi van nombres de personas que no tienen por que llegar a
    ningun archivo.
    """
    mapa = {fold(k): v for k, v in ((medio or {}).get("secciones") or {}).items()}
    if not mapa:
        return []
    return ordenar(mapa.get(fold(c)) for c in (categorias or ()) if fold(c) in mapa)


def rubros_de_ruta(medio, url):
    """Lo que dice la ruta de la URL segun el mapa `rutas` del medio.

    Prefijo de ruta, en minusculas y con las diagonales: «/deporte/» no es
    «/deportes-extremos/». La ruta de una nota de busqueda es el redirector de
    Google y no empata nada, que es lo correcto: ese enlace no es del medio.
    """
    rutas = (medio or {}).get("rutas") or {}
    if not rutas or not isinstance(url, str):
        return []
    ruta = urlsplit(url).path.lower()
    if not ruta.endswith("/"):
        ruta += "/"
    return ordenar(v for k, v in rutas.items() if ruta.startswith(k.lower()))


def idioma_de_nota(nota, medios_por_id, idioma_por_busqueda=None):
    """El idioma de la nota, del catalogo y nunca del texto.

    Medio del catalogo, luego la busqueda que trajo a una fuente sintetica
    (lo mismo que hace el pipeline para el tono, y por la misma razon: la
    fuente sintetica no esta en el catalogo en la corrida siguiente), luego la
    omision.
    """
    medio = medios_por_id.get(nota.get("fuente"))
    if medio is not None:
        return medio.get("idioma", IDIOMA_OMISION)
    idioma = (idioma_por_busqueda or {}).get(nota.get("descubierta_por"))
    return idioma or IDIOMA_OMISION


def rubros_de_nota(nota, medio, idioma):
    """La union de las tres evidencias, en el orden de RUBROS."""
    return ordenar(list(nota.get("rubros_categoria") or ())
                   + rubros_de_ruta(medio, nota.get("url"))
                   + rubros_de_titular_nota(nota.get("titulo") or "", idioma))
