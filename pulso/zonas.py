"""Alcance geografico de una nota: ¿de que zona habla, y habla de la region?

El problema que resuelve, con un caso real: el feed de El Imparcial trae al
grupo entero y la mayoria de sus notas son de Hermosillo y Ciudad Obregon.
Si se confia en la zona del medio, 'hermosillo' y 'sonora' salen como temas
principales de un tablero de Baja California. Ese fue el resultado de la
primera corrida con 504 notas.

Confiar en el medio tampoco es del todo malo: un medio de una sola ciudad SI
es evidencia de su ciudad. La regla que sale de ahi:

  Medio de una zona (zona != 'estatal')  -> se le cree su zona si la nota no
                                            nombra otra
  Cable o grupo (zona == 'estatal')      -> tiene que NOMBRAR el lugar; si no,
                                            no se le asigna zona

`alcance` clasifica cada nota en cuatro cajones:

  zona      nombra un lugar de BC o San Diego, o viene de un medio local
  estatal   habla de Baja California sin bajar a municipio
  nacional  no nombra la region ni un lugar de fuera; es nota nacional
  fuera     nombra un lugar de otra region (Sonora, BCS, Sinaloa...)

Solo 'fuera' se excluye de los temas. 'nacional' se conserva porque una
decision federal si pega en la region, pero no se le inventa una zona.

Delegaciones. Tijuana es la unica zona con subdivision: `delegaciones_en`
dice que delegacion nombra el titular. Tres reglas que la separan del
gazetero municipal:

  1. Solo se consulta cuando la nota YA es de Tijuana. 'zona centro' existe
     tambien en Mexicali y Ensenada; este gazetero no re-zonifica nada.
  2. Empata por frase completa con frontera alfanumerica, no por subcadena.
     'natura' esta dentro de 'gubernatura' y 'playas' dentro de 'Playas de
     Rosarito'; con subcadena las dos darian delegacion.
  3. Solo terminos inequivocos. Quedan fuera a proposito: 'playas' a secas
     (Rosarito), 'zona norte' a secas (la liga de beisbol), 'zona este' y
     'bulevar 2000' (cruzan tres o cuatro delegaciones), 'el pipila' (hay uno
     en Cerro Colorado y otro en Sanchez Taboada), 'la mesa' a secas (La
     Mesa, California, sale en el feed de KPBS; y 'sobre la mesa'),
     'aeropuerto' y 'centro' a secas, 'ciudad industrial' (tambien en
     Mexicali). Las colonias (El Florido, La Morita, Camino Verde, Villa
     Fontana...) entran cuando se verifique su delegacion en el mapa del
     IMPLAN, no antes.
"""

import re

from . import DELEGACIONES_TIJUANA
from .delegaciones import delegaciones_en as _delegaciones_catalogo
from .normalizar import fold

# Gazetero. Se evalua por frase, plegado, sobre el titular. El orden importa
# donde una entrada contiene a otra.
LUGARES = {
    "Tijuana": [
        "tijuana", "otay", "playas de tijuana", "zona rio", "la mesa",
        "sanchez taboada", "cerro colorado", "el florido", "la presa",
        "mesa de otay", "san ysidro garita", "xolos",
        "san antonio de los buenos", "el chaparral", "presa abelardo",
    ],
    "Mexicali": [
        "mexicali", "valle de mexicali", "los algodones", "cachanilla",
        "guadalupe victoria", "ciudad morelos", "cucapah",
    ],
    "Ensenada": [
        "ensenada", "valle de guadalupe", "maneadero", "el sauzal",
        "punta banda", "ojos negros", "san vicente", "santo tomas",
        "bahia de todos santos", "la bufadora",
    ],
    "Tecate": [
        "tecate", "la rumorosa", "valle de las palmas",
    ],
    "Playas de Rosarito": [
        "rosarito", "primo tapia", "puerto nuevo", "popotla",
    ],
    "San Quintín": [
        "san quintin", "vicente guerrero", "camalu", "colonet", "el rosario",
        "valle de san quintin",
    ],
    "San Felipe": [
        "san felipe", "puertecitos",
    ],
    "San Diego": [
        "san diego", "chula vista", "national city", "imperial beach",
        "san ysidro", "otay mesa", "coronado", "la jolla", "escondido",
        "oceanside", "carlsbad", "el cajon", "sandag", "encinitas",
        "vista california", "poway", "santee", "bonita california",
    ],
}

# Baja California a secas: estatal, no municipal.
ESTATAL = ["baja california", "bc norte", "gobierno del estado"]

# Fuera de la region. Se revisa ANTES que ESTATAL porque 'baja california sur'
# contiene 'baja california'.
FUERA = [
    "baja california sur", "bcs", "la paz", "los cabos", "cabo san lucas",
    "todos santos bcs", "loreto", "comondu", "mulege",
    "sonora", "hermosillo", "ciudad obregon", "cajeme", "navojoa", "guaymas",
    "nogales", "puerto penasco", "san luis rio colorado", "agua prieta",
    "caborca", "magdalena de kino", "empalme",
    "sinaloa", "culiacan", "mazatlan", "los mochis",
    "jalisco", "guadalajara", "zapopan",
    "nuevo leon", "monterrey", "chihuahua", "ciudad juarez",
    "coahuila", "saltillo", "torreon", "tamaulipas", "matamoros", "reynosa",
    "michoacan", "morelia", "guanajuato", "leon guanajuato", "queretaro",
    "puebla", "veracruz", "oaxaca", "chiapas", "yucatan", "merida",
    "quintana roo", "cancun", "tulum", "guerrero", "acapulco",
    # La capital faltaba entera, que es de donde sale la mayor parte de la
    # nota nacional mexicana. El caso, medido el 21 de septiembre de 2026:
    # "Hoy No Circula sabado 19 de septiembre: que autos no circulan en CDMX",
    # leida de un medio de una sola zona, devolvia ('zona', ['Tijuana']) --- la
    # rama de `zona_medio` dispara cuando no hay veredicto de fuera, asi que el
    # tablero le acreditaba a Tijuana el programa vehicular de la Ciudad de
    # Mexico. Es el bug de El Imparcial/Hermosillo por omision del gacetero.
    # Toca 76 de 6,699 titulares de la ventana: 73 pasan de 'nacional' a
    # 'fuera' (1.1%) y 3 no cambian porque ademas nombran la region, que gana
    # sobre nombrar fuera.
    "ciudad de mexico", "cdmx", "distrito federal",
    "estado de mexico", "edomex", "toluca", "ecatepec", "naucalpan",
    "nezahualcoyotl", "cuernavaca", "cuautla", "pachuca", "tlaxcala",
    "san luis potosi", "aguascalientes", "zacatecas", "nayarit", "tepic",
    "colima", "tabasco", "villahermosa", "campeche",
    # NO se agregan "morelos", "hidalgo" ni "durango" aunque sean estados:
    # Tijuana tiene una colonia con cada uno de esos nombres, y "morelos" esta
    # ademas en LUGARES. Un estado cuyo nombre es tambien una colonia de la
    # region no puede vivir aqui: el mismo token significaria dos lugares.
]

_LUGARES_PLEGADOS = {z: [fold(t) for t in ts] for z, ts in LUGARES.items()}
_ESTATAL_PLEGADO = [fold(t) for t in ESTATAL]
_FUERA_PLEGADO = [fold(t) for t in FUERA]

# Gazetero de delegaciones de Tijuana. El orden del dict es el de EMPATE: la
# mas especifica va primero y se consume del texto al empatar, para que 'la
# presa este' no cuente tambien como 'la presa'. La salida se reordena al
# orden del catalogo.
DELEGACIONES = {
    "La Presa Este": ["la presa este", "presa este"],
    "Otay Centenario": [
        "otay", "mesa de otay", "garita de otay", "garita otay",
        "aeropuerto de tijuana", "aeropuerto internacional de tijuana",
    ],
    "Playas de Tijuana": ["playas de tijuana", "delegacion playas"],
    "Centro": [
        "zona centro", "centro de tijuana", "zona rio", "zona urbana rio",
        "zona norte de tijuana", "el chaparral", "garita el chaparral",
        "avenida revolucion", "av. revolucion",
    ],
    "Cerro Colorado": ["cerro colorado"],
    "La Mesa": ["delegacion la mesa", "delegacion de la mesa"],
    "La Presa A.L.R.": [
        "presa abelardo", "presa abelardo l. rodriguez", "abelardo l. rodriguez",
        "presa rodriguez", "la presa",
    ],
    "San Antonio de los Buenos": ["san antonio de los buenos"],
    "Sánchez Taboada": ["sanchez taboada"],
}

# Se borran del texto ANTES de buscar delegaciones. 'Otay Mesa' es San Diego.
_NO_ES_DELEGACION = ["otay mesa"]


def _patron(term):
    """Frase completa con frontera alfanumerica, sobre texto ya plegado."""
    return re.compile(r"(?<![a-z0-9])" + re.escape(fold(term)) + r"(?![a-z0-9])")


_DELEGACIONES_PATRONES = {d: [_patron(t) for t in ts] for d, ts in DELEGACIONES.items()}
_NO_ES_DELEGACION_PATRONES = [_patron(t) for t in _NO_ES_DELEGACION]
_ORDEN_DELEGACION = {d: i for i, d in enumerate(DELEGACIONES_TIJUANA)}


def zonas_en(texto):
    """Zonas de la region nombradas en el texto, en orden del gazetero."""
    t = fold(texto)
    salida = []
    for zona, terminos in _LUGARES_PLEGADOS.items():
        if any(term in t for term in terminos):
            salida.append(zona)
    return salida


def fuera_en(texto):
    """Lugares de otra region nombrados en el texto."""
    t = fold(texto)
    return [term for term in _FUERA_PLEGADO if term in t]


def es_estatal(texto):
    t = fold(texto)
    return any(term in t for term in _ESTATAL_PLEGADO)


def delegaciones_en(texto):
    """Delegaciones de Tijuana nombradas en el texto, en orden del catalogo.

    Frase completa, no subcadena; la mas especifica se consume primero. Quien
    llama decide si la nota es de Tijuana: esta funcion no lo sabe.
    """
    # El snapshot oficial añade colonias contextualizadas y alias revisados;
    # la funcion publica conserva el contrato y el orden historico.
    return _delegaciones_catalogo(texto)


def alcance(titulo, zona_medio, tiene_figura=False):
    """Devuelve (alcance, zonas).

    `zona_medio` es la cobertura declarada del medio; 'estatal' significa
    cable o grupo, o sea que no se le cree la zona sin que la nota la nombre.
    `tiene_figura` es True si el roster resolvio alguna figura, que ya es
    evidencia de que la nota es de la region.
    """
    fuera = fuera_en(titulo)
    zonas = zonas_en(titulo)
    # Un titular puede nombrar una colonia de Tijuana sin escribir "Tijuana".
    # La resolucion oficial es evidencia suficiente para la zona, pero solo
    # cuando el matcher ya encontro una entrada revisada.
    if delegaciones_en(titulo) and "Tijuana" not in zonas:
        zonas = ["Tijuana"] + zonas

    # Nombrar un lugar de la region gana sobre nombrar uno de fuera: una nota
    # sobre la garita Tijuana-San Ysidro puede mencionar Sonora de paso.
    if zonas:
        return "zona", zonas
    if fuera:
        return "fuera", []
    if es_estatal(titulo) or tiene_figura:
        return "estatal", ["estatal"]
    if zona_medio and zona_medio != "estatal":
        # Medio de una sola zona y la nota no nombra otra: se le cree.
        return "zona", [zona_medio]
    return "nacional", []
