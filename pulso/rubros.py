"""Si el titulo de una publicacion nombra un rubro: copia en Python de la regla del sitio.

Existe por la cosecha de TikTok por tema (25 de septiembre de 2026). Ese dia
el cliente pidio un top 10 de TikTok por cada pestana de la fila «Tema» de
Redes, y la medicion decia por que: de los 80 videos publicados, Espectaculos
tenia 0, Turismo 1, IA 1, Deportes 2, Clima y Economia 3, Politica 6 y
Seguridad 13. Ni los 184 videos cosechados de la ventana llegaban a diez en
seis de los ocho rubros. Asi que hay una busqueda por rubro (`rubro` en
config/tiktok.json), y el pipeline tiene que saber que rubro nombra cada
video para (1) no pagar comentarios de lo que la busqueda trajo de relleno y
(2) cortar el top de cada rubro en redes._destacados.

La regla NO es de aqui: es web/src/lib/busqueda/tema-publicacion.ts, con los
terminos de rubros.ts::TERMINOS_RUBRO y su lista `DEL_PIE`, y es la que decide
que se ve en cada pestana. Si las dos divergieran, el pipeline cortaria un top
10 que la pagina filtra a siete, y los tres restantes serian comentarios
pagados que nadie ve: la misma falla que AGENTS.md cuenta de Instagram, pagado
y tirado en el paso de destacar. Por eso esta copia se fija contra
web/scripts/fixtures/rubros/esperado.json, que escribe el sitio:

    node web/scripts/probar-capitulos.cjs --escribir-rubros

tests/test_rubros.py compara estas listas y estos veredictos contra el
fixture. Cambiar un termino en el sitio es regenerar el fixture y portar lo
que la prueba de Python diga.

Lo que la regla afirma es lo que la lista dice y nada mas: «este titulo
contiene una de estas palabras». No es un clasificador. rubros.ts explica por
que no se hace uno, y la busqueda de TikTok es la razon de que la regla
importe aqui: el 18 de septiembre de 2026 devolvio tres de tres videos ajenos
para cada termino del cliente, y la busqueda en vivo lo midio otra vez el 23
(1 de 20 en TikTok). La busqueda trae candidatos; el titulo decide.

Solo el `titulo` (la primera linea del pie, sin la cola de hashtags), nunca el
pie entero: es lo unico que la pantalla publica y lo unico contra lo que el
sitio compara. Los cuidados son los del sitio, uno por uno:
  - Palabra entera: «actor» no es «factor», «ia» no es «guia».
  - Las siglas (dos a cuatro mayusculas) distinguen mayusculas: «pan» no es el
    PAN.
  - Una frase cuenta tambien como etiqueta pegada: «inteligencia artificial»
    encuentra #InteligenciaArtificial.
  - Una palabra suelta admite plural (-s, -es).
  - Sin acentos en los dos lados, conservando mayusculas.
"""

import re
import unicodedata

# El orden de la fila de temas (rubros.ts::RUBROS). Es tambien el orden en que
# se emiten los rubros de un destacado, para que dos corridas den lo mismo.
RUBROS = ("politica", "seguridad", "economia", "clima", "deportes", "espectaculos", "turismo",
          "ia")

# rubros.ts::TERMINOS_RUBRO, espanol e ingles juntos (el sitio los junta igual:
# un titulo no declara su idioma de manera fiable), y luego
# tema-publicacion.ts::DEL_PIE. El porque de cada termino esta escrito alla, al
# lado de la lista que manda; aqui solo se copia.
TERMINOS = {
    "clima": (
        "clima", "lluvia", "lluvias", "tormenta", "huracán", "calor", "frente frío",
        "weather", "rain", "storm", "hurricane", "flooding", "wildfire", "Santa Ana winds",
        "sismo", "temblor", "earthquake", "granizo", "vientos", "heat wave",
    ),
    "seguridad": (
        "detienen", "homicidio", "asesinan", "balacera", "balean", "desaparecida", "sin vida",
        "shooting", "homicide", "arrested", "police", "sheriff", "crime", "border patrol",
        "asesinado", "asesinada", "asesinato", "emboscan", "ataque armado", "fosa", "cuerpo",
        "desaparecido", "policía", "sicarios", "narco", "murder", "suspect", "detenido",
        "fiscalía", "secuestro", "crimen organizado", "ejecutado", "hallan cuerpos",
        "feminicidio", "extorsión", "smuggling", "robbery", "stabbing",
    ),
    "deportes": (
        "Xolos", "Liga MX", "Toros", "futbol", "boxeo", "Águilas", "Zonkeys",
        "Padres", "San Diego FC", "Aztecs", "soccer", "baseball", "sports",
        "Club Tijuana", "béisbol", "maratón", "Gulls", "boxing", "marathon",
    ),
    "politica": (
        "alcalde", "alcaldesa", "gobernadora", "cabildo", "diputado", "Morena", "mañanera",
        "presidenta",
        "mayor", "city council", "governor", "election", "Congress", "supervisors",
        "Mexican president",
        "senado", "senador", "senadora", "gobernador", "diputada", "regidor", "elecciones",
        "INE", "PAN", "conferencia matutina", "senator", "legislature", "ballot",
    ),
    "economia": (
        "empresas", "inversión", "empleo", "maquiladora", "aranceles", "precios", "turismo",
        "economía",
        "business", "economy", "tariffs", "jobs", "housing", "trade", "tourism", "prices",
        "inflación", "cruce fronterizo", "vivienda", "layoffs",
    ),
    "espectaculos": (
        "farándula", "famosos", "concierto", "cantante", "actriz", "actor", "influencer",
        "festival",
        "celebrity", "concert", "singer", "actress",
        "K-pop", "película", "movie", "espectáculos", "viral", "reality show",
    ),
    "turismo": (
        "turismo", "hotel", "hoteles", "restaurante", "gastronomía", "vinícola",
        "Valle de Guadalupe",
        "tourism", "resort", "restaurant", "winery", "dining",
        "vinos", "brewery", "cervecería", "desarrollo residencial", "desarrollo inmobiliario",
        "real estate development",
    ),
    "ia": (
        "inteligencia artificial", "IA", "ChatGPT", "OpenAI", "Gemini", "chatbot", "robótica",
        "artificial intelligence", "AI", "robotics",
        "Anthropic",
    ),
}

# Letra o digito a los lados no: el `[^\p{L}\p{N}]` del sitio. En Python `\W`
# es lo que no es letra, digito ni guion bajo, y el guion bajo tampoco es
# letra ni digito para el sitio, asi que va aparte.
_BORDE_ANTES = r"(?:\A|[\W_])"
_BORDE_DESPUES = r"(?:\Z|[\W_])"


def sin_acentos(texto):
    """Sin marcas combinantes (U+0300 a U+036F), conservando mayusculas.

    No es normalizar.fold: fold pasa a minusculas, y las siglas las necesitan.
    """
    return "".join(c for c in unicodedata.normalize("NFD", texto or "")
                   if not "̀" <= c <= "ͯ")


def _es_sigla(termino):
    return re.fullmatch(r"[A-Z]{2,4}", termino) is not None


def _compilar(termino):
    """Los patrones de un termino, con las reglas del encabezado."""
    limpio = sin_acentos(termino)
    if _es_sigla(limpio):
        return [re.compile(_BORDE_ANTES + re.escape(limpio) + _BORDE_DESPUES)]
    palabras = limpio.split()
    frase = r"\s+".join(re.escape(p) for p in palabras)
    if len(palabras) == 1:
        frase += r"(?:e?s)?"
    salida = [re.compile(_BORDE_ANTES + frase + _BORDE_DESPUES, re.IGNORECASE)]
    if len(palabras) > 1:
        salida.append(re.compile(_BORDE_ANTES + "#" + re.escape("".join(palabras))
                                 + _BORDE_DESPUES, re.IGNORECASE))
    return salida


_PATRONES = {r: [p for t in TERMINOS[r] for p in _compilar(t)] for r in RUBROS}


def nombra_rubro(titulo, rubro):
    """Si el titulo nombra un termino del rubro. tema-publicacion.ts::nombraRubro."""
    texto = sin_acentos(titulo)
    return any(p.search(texto) for p in _PATRONES[rubro])


def rubros_de(titulo):
    """Los rubros que nombra el titulo, en el orden de RUBROS."""
    return [r for r in RUBROS if nombra_rubro(titulo, r)]
