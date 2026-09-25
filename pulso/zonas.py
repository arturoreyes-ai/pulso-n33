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

Redes. `alcance_redes` es `alcance` mas un quinto cajon, `extranjero`, y lo
usan solo las piezas de redes (pulso/redes.py::zona_por_ambito). Las notas de
prensa siguen en `alcance`, que no ve el extranjero. Lo que si comparten desde
el 24 de septiembre de 2026 es que lo debil (AMBIGUOS) cede ante un lugar
mexicano de fuera nombrado. Ver el docstring de `alcance_redes` para el caso
que lo motivo.
"""

import re

from . import DELEGACIONES_TIJUANA
from .delegaciones import delegaciones_en as _delegaciones_catalogo
from .delegaciones import resolver_delegaciones as _resolver_delegaciones
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
    # Las alcaldias y barrios de la capital que el archivo nombra sin decir
    # CDMX. El caso, 24 de septiembre de 2026: «...les rompen los cristales
    # del coche en Mixcoac, cerca de Av. Revolucion» (Uno TV, por la busqueda
    # de Ensenada) llego al muro de Tijuana porque nada del pie decia fuera.
    # Medidas sobre los 6,699 titulares y 1,013 piezas de redes: 13 titulares
    # y 2 piezas, todas de la capital. NO "insurgentes": sus 7 apariciones son
    # el bulevar de Tijuana. NO "cuauhtemoc", "benito juarez", "miguel
    # hidalgo" ni "alvaro obregon": son tambien colonias y calles del corredor.
    "mixcoac", "iztapalapa", "tlahuac", "xochimilco", "tlatelolco", "polanco",
    "coyoacan", "tlalpan", "azcapotzalco", "iztacalco", "cuajimalpa",
    "milpa alta", "magdalena contreras", "gustavo a. madero",
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


# Terminos de delegacion que son calle o barrio de casi cualquier municipio:
# solo hacen Tijuana si el titular no nombra otro municipio de Baja
# California. Tres casos de notas.json, 24 de septiembre de 2026, que salian
# ['Tijuana', <el otro>]: «Cierran la Av. Revolucion en Tecate por obras»
# (Tecate tiene la suya), «Asesinan a hombre ... en zona Centro de Ensenada» y
# «Pausa CBP cruce en Garita Zona Centro de Mexicali». San Diego no cuenta
# como otro municipio: no tiene ni zona centro ni avenida Revolucion, y
# «turistas de San Diego en la Revolucion» es Tijuana. NO entra "valle de las
# palmas": el catalogo oficial lo pone en La Presa Este, y las tres notas que
# lo nombran junto a Tecate son del campus de la UABC, que esta en Tijuana.
DELEGACION_HOMONIMA = ["zona centro", "avenida revolucion", "av. revolucion"]
_DELEGACION_HOMONIMA = {fold(t) for t in DELEGACION_HOMONIMA}


def _delegacion_de_tijuana(texto, zonas):
    """True si el texto nombra una delegacion de Tijuana que cuenta como
    Tijuana ante `zonas`, las otras zonas que nombra."""
    terminos = [fold(t) for _, _, t in _resolver_delegaciones(texto)]
    if not terminos:
        return False
    otro_municipio = any(z != "San Diego" for z in zonas)
    return not otro_municipio or any(t not in _DELEGACION_HOMONIMA for t in terminos)


def alcance(titulo, zona_medio, tiene_figura=False):
    """Devuelve (alcance, zonas).

    `zona_medio` es la cobertura declarada del medio; 'estatal' significa
    cable o grupo, o sea que no se le cree la zona sin que la nota la nombre.
    `tiene_figura` es True si el roster resolvio alguna figura, que ya es
    evidencia de que la nota es de la region.
    """
    fuera = fuera_en(titulo)
    leido = titulo
    if fuera:
        # Lo debil cede ante un lugar de fuera nombrado, como en
        # `alcance_redes`. El caso, en notas.json el 24 de septiembre de 2026:
        # «Lluvias dejan bajo el agua a 12 colonias de Iztapalapa; Vicente
        # Guerrero, la zona mas afectada» salia San Quintin. Sin lo debil tiene
        # que quedar algo de fuera: «Rusia ... complican la paz» no tiene otra
        # cosa y sigue `fuera` por su «la paz». Medido sobre los 7,167
        # titulares de ese dia, junto con DELEGACION_HOMONIMA: cambian 6, los
        # 6 bien -- tres dejan Tijuana, y este, «Congreso pone sobre la mesa
        # ... de Sonora» y un «Guerrero ... con Vicente Guerrero» pasan a
        # `fuera`. Ninguna de las 303 piezas destacadas de redes se mueve.
        sin_debiles = _sin_debiles(titulo, _DEBILES_LUGAR, _LARGOS_LUGAR)
        if fuera_en(sin_debiles):
            leido = sin_debiles
    zonas = zonas_en(leido)
    # Un titular puede nombrar una colonia de Tijuana sin escribir "Tijuana".
    # La resolucion oficial es evidencia suficiente para la zona, pero solo
    # cuando el matcher ya encontro una entrada revisada, y no cuando la
    # entrada es una calle o un barrio que otro municipio tambien tiene y el
    # titular nombra ese municipio (DELEGACION_HOMONIMA).
    if "Tijuana" not in zonas and _delegacion_de_tijuana(leido, zonas):
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


# --- Redes: el quinto cajon, `extranjero` -----------------------------------
#
# Lugares del extranjero. Los consulta SOLO `alcance_redes`; `alcance`, que
# zonifica la prensa, no los ve. Frase completa con frontera alfanumerica,
# nunca subcadena: 'iran' esta dentro de 'tirano', 'roma' dentro de 'aroma' y
# 'chile' dentro de 'chiles'. Los terminos van plegados como FUERA, salvo la
# ene: aqui se pliega a "nn" (`_plegar_n`), porque fold() hace de "la canada
# del arroyo" Canada. Por eso "españa" va con su ene, y "espana" aparte para
# los titulares en mayusculas que la pierden.
EXTRANJERO = [
    # America, sin Mexico ni Estados Unidos (ver abajo)
    "canada", "guatemala", "belice", "honduras", "el salvador", "nicaragua",
    "costa rica", "panama", "cuba", "haiti", "republica dominicana",
    "puerto rico", "venezuela", "colombia", "ecuador", "peru",
    "bolivia", "argentina", "uruguay", "paraguay", "brasil",
    "centroamerica", "sudamerica", "caribe",
    "la habana", "managua", "tegucigalpa", "bogota",
    "caracas", "santiago de chile", "buenos aires", "montevideo",
    "sao paulo", "rio de janeiro", "toronto", "montreal", "vancouver",
    # Estados Unidos fuera del corredor: el estado o la ciudad, no el pais
    "los angeles", "nueva york", "new york", "washington", "texas", "florida",
    "arizona", "las vegas", "chicago", "miami", "houston", "dallas",
    "phoenix", "seattle", "boston", "atlanta", "nuevo mexico", "new mexico",
    "alaska", "hawai", "hawaii", "oregon", "utah", "illinois", "michigan",
    "georgia", "carolina del norte", "carolina del sur",
    "pensilvania", "nueva jersey", "new jersey", "luisiana", "louisiana",
    "hollywood",
    # Europa
    "europa", "union europea", "españa", "espana", "madrid", "barcelona", "francia",
    "paris", "alemania", "berlin", "italia", "roma", "vaticano",
    "reino unido", "inglaterra", "londres", "escocia", "irlanda", "portugal",
    "lisboa", "belgica", "bruselas", "paises bajos", "holanda", "suiza",
    "ginebra", "austria", "viena", "suecia", "noruega", "dinamarca",
    "finlandia", "polonia", "hungria", "rumania", "serbia",
    "croacia", "republica checa", "ucrania", "kiev", "kyiv", "rusia", "moscu",
    "bielorrusia", "turquia", "estambul", "groenlandia", "islandia",
    # Asia, Oriente Medio, Africa, Oceania
    "israel", "tel aviv", "jerusalen", "gaza", "franja de gaza",
    "cisjordania", "palestina", "libano", "siria", "irak", "iran", "teheran",
    "arabia saudita", "qatar", "catar", "emiratos arabes", "dubai", "yemen",
    "afganistan", "pakistan", "india", "china", "pekin", "beijing",
    "shanghai", "hong kong", "taiwan", "japon", "tokio", "corea del norte",
    "corea del sur", "seul", "filipinas", "vietnam", "tailandia",
    "indonesia", "medio oriente", "oriente medio", "egipto", "el cairo",
    "marruecos", "argelia", "nigeria", "sudan", "sudafrica",
    "etiopia", "somalia", "africa", "asia", "australia",
    "nueva zelanda",
    # Los mismos en ingles, que es la lengua de "world news" y de San Diego
    "ukraine", "russia", "moscow", "germany", "spain", "france", "italy",
    "england", "london", "britain", "ireland", "europe", "japan", "tokyo",
    "korea", "brazil", "philippines", "syria", "lebanon", "egypt", "iraq",
    "tehran", "jerusalem", "afghanistan",
]
# NO se agregan, y cada uno por un caso:
#   - "estados unidos", "eeuu", "ee.uu.", "e.u.", "usa", "eu", "gringo": la
#     frontera nombra a Estados Unidos todo el dia. "Asi esta la fila para
#     cruzar a Estados Unidos" es nota del corredor, y con estos terminos se
#     iria a Mundo cada video de garita que no escribio "Tijuana".
#   - "california": esta dentro de "baja california".
#   - "papa": fold() convierte "Papa" en "papa", y "su Papa regresa a pagar la
#     gasolina en Puebla" (N+, septiembre de 2026) no es el Vaticano.
#   - "lima" (la fruta y la herramienta), "san francisco", "san antonio",
#     "el paso", "colorado", "sacramento", "casa blanca": son tambien palabras
#     comunes o lugares de Mexico; "san antonio de los buenos" es delegacion de
#     Tijuana y "cerro colorado" otra.
#   - "latinoamerica", "america latina": incluyen a Mexico.
#   - "turkey", "jordan", "chad", "niger": en ingles son tambien un ave o un
#     nombre de pila.
# Y estos salieron de medir la lista sobre los 6,699 titulares de notas.json
# el 22 de septiembre de 2026, que no se zonifican con ella pero son el corpus
# en espanol mas grande que hay para encontrarle falsos positivos:
#   - "chile": el chile de la salsa ("Mientras en Mexico el chile suele
#     acompanar tacos"). Queda "santiago de chile".
#   - "quito": fold() hace de "le quito el invicto" y "se quito la vida" la
#     capital de Ecuador.
#   - "kenia", "grecia", "libia", "virginia": nombres de pila con presencia en
#     la nota nacional (Kenia Os, Grecia Quiroz, Libia Dennise).
#   - "nevada": en espanol es tambien la nevada de Chihuahua. Queda "las vegas".
#   - "jamaica": el agua de jamaica.
#   - "san salvador": San Salvador Atenco es del Estado de Mexico.

# Se borran del texto ANTES de buscar extranjero, como _NO_ES_DELEGACION.
_NO_ES_EXTRANJERO = [
    # "Festival del Chile en Nogada en Rosarito" (YouTube, septiembre de 2026)
    "chile en nogada", "chiles en nogada",
    # La colonia de la capital, y la cadena de farmacias de Baja California
    "colonia roma", "roma norte", "roma sur", "farmacia roma", "farmacias roma",
    # "tarifa de verano ... de Bahia de los Angeles": es de Baja California
    "bahia de los angeles",
    # "Lluvias complican vuelos de Air France; AICM anuncia apoyo", y el nombre
    # del canal: "Noticias del 2026/09/22 12h30 • FRANCE 24 Español" no dice
    # nada de Francia (sondeo del 22 de septiembre de 2026)
    "air france", "france 24",
    # Rota de sede, y la de 2027 es en Hermosillo
    "serie del caribe",
    "china poblana", "india maria", "cuba libre",
]
# "Iran a audiencia por fusion en octubre" y "los alumnos iran a clases": el
# verbo, no el pais. fold() quita la tilde que en espanol llevan los dos. Se
# borra tras un pronombre o una negacion, o seguido de "a"/"al": de 27
# "iran" en 8,600 titulares, el unico verbo tenia esa forma.
_VERBO_IRAN = re.compile(
    r"(?<![a-z0-9])(?:se|no|ya|que|lo|la|los|las|le|les|nos|me|te)\s+iran(?![a-z0-9])"
    r"|(?<![a-z0-9])iran\s+al?\s")

# Terminos del gacetero que son lugar homonimo de OTRO lugar. Solo cuentan
# mientras la pieza no nombre, en su texto, un lugar de fuera del corredor,
# mexicano o no: ahi ceden. "Rusia advierte que las sanciones complican la
# paz" (El Vigia) no es Baja California Sur; "En El Rosario, Sinaloa,
# localizan..." (TikTok, busqueda de Mexico) no es San Quintin.
# "vicente guerrero" desde el 24 de septiembre de 2026: es el insurgente y la
# calle, el parque o la colonia de media republica. «Lluvias dejan bajo el
# agua a 12 colonias de Iztapalapa; Vicente Guerrero, la zona mas afectada»
# era la capital. Desde ese dia `alcance`, la prensa, tambien los hace ceder.
AMBIGUOS = ["el rosario", "la paz", "merida", "vicente guerrero"]
# Terminos del corredor que son ademas palabra comun. Ceden SOLO ante el
# extranjero: ante un lugar mexicano de fuera no, porque "Balacera en La Mesa;
# el detenido llego de Sonora" es de Tijuana. "Se rompe la presa en..." y "un
# tesoro escondido en Egipto" son el caso.
AMBIGUOS_EXTRANJERO = ["la mesa", "la presa", "escondido", "el cajon"]
# Y la palabra comun en su frase, que no es lugar ante nadie: "Congreso pone
# sobre la mesa avances y pendientes de Sonora" no es Tijuana. Se borra en las
# dos lecturas; sin nada de fuera en el texto, `alcance` la sigue contando.
_FRASES_COMUNES = ["sobre la mesa", "a la mesa", "en la mesa de"]
# Un termino del corredor que casi toda ciudad mexicana repite: cede ante un
# LUGAR de fuera nombrado, nunca ante el mero nombre de Mexico. El caso del
# 24 de septiembre de 2026: «en Mixcoac, cerca de Av. Revolucion» era la
# capital. Y la razon del «nunca»: en el archivo las 11 apariciones de la
# avenida son de Tijuana y casi todas nombran a Sheinbaum («Mantienen cierre
# en Avenida Revolucion por visita de Claudia Sheinbaum»); con AMBIGUOS, que
# desde ese mismo dia cede ante Mexico, esas se irian a la cubeta Mexico.
# Cuesta un caso: «Asaltan comercio en Av. Revolucion; el detenido llego de
# Sonora», sin escribir Tijuana, sale `fuera`. En el archivo no hay ninguno.
AMBIGUOS_LUGAR = ["avenida revolucion", "av. revolucion"]

# Mexico sin escribir "Mexico": las instituciones federales y quien preside.
# Bloquean `extranjero` igual que el nombre del pais, y sacan de Mundo lo que
# una fuente del mundo diga de ellas. Tres casos del archivo, 22 de septiembre
# de 2026: "El gobierno de Sheinbaum frena el alza de gasolina pese al
# encarecimiento internacional ... en Medio Oriente", "Harfuch informa
# decomiso de polvo de hojas de coca en AICM; llego de Colombia" y "Claudia
# Sheinbaum priorizara el transporte ferroviario" salian Mundo. Los nombres
# propios envejecen con el cargo; las siglas no. Quien la actualice, que
# pruebe contra notas.json como aqui.
_MARCAS_MEXICO = [
    "sheinbaum", "lopez obrador", "amlo", "harfuch", "pemex", "cfe", "imss",
    "issste", "banxico", "inegi", "unam", "sedena", "semar", "conagua", "profeco",
    "aicm", "fgr",
]


def _plegar_n(texto):
    """fold() sin perder la ene: "la canada del arroyo" no es Canada."""
    return fold((texto or "").replace("ñ", "nn").replace("Ñ", "NN"))


def _patron_n(term):
    """Como _patron, sobre texto plegado con _plegar_n."""
    return re.compile(r"(?<![a-z0-9])" + re.escape(_plegar_n(term)) + r"(?![a-z0-9])")


_EXTRANJERO_PATRONES = [(t, _patron_n(t)) for t in EXTRANJERO]
_NO_ES_EXTRANJERO_PATRONES = [_patron_n(t) for t in _NO_ES_EXTRANJERO]
# Una calle con nombre de pais no es el pais. El caso, medido el 22 de
# septiembre de 2026 sobre la busqueda de Mexicali: "tacos de hielera ... te
# veo el lunes en Argentina 1100 colonia Alamitos" salia Mundo. Se borra el
# pais precedido de via o colonia, o seguido de un numero de tres cifras o mas
# (un marcador, "Argentina 2", si cuenta).
_EXTRANJERO_ALTERNATIVA = "|".join(
    re.escape(_plegar_n(t)) for t in sorted(EXTRANJERO, key=lambda t: (-len(t), t)))
_CALLE_EXTRANJERA = re.compile(
    r"(?<![a-z0-9])(?:calle|avenida|av|blvd|bulevar|boulevard|colonia|col|"
    r"fraccionamiento|fracc|privada|callejon)\.?\s+(?:" + _EXTRANJERO_ALTERNATIVA
    + r")(?![a-z0-9])"
    r"|(?<![a-z0-9])(?:" + _EXTRANJERO_ALTERNATIVA + r")\s+\d{3,}")
_MEXICO = re.compile(
    r"(?<![a-z0-9])(?:mexic(?:o|ano|ana|anos|anas|an|ans)|"
    + "|".join(re.escape(t) for t in _MARCAS_MEXICO) + r")(?![a-z0-9])")
_NO_ES_MEXICO = [_patron(t) for t in ("nuevo mexico", "new mexico")]


def _largos(debiles):
    """Terminos del gacetero que CONTIENEN uno de los `debiles`: 'la presa
    este' es una delegacion inequivoca y no puede perder su 'la presa'."""
    gacetero = ({fold(t) for ts in LUGARES.values() for t in ts} | set(_FUERA_PLEGADO)
                | {fold(t) for ts in DELEGACIONES.values() for t in ts})
    return [_patron(t) for t in sorted(gacetero, key=lambda t: (-len(t), t))
            if t not in debiles and any(d in t for d in debiles)]


# Lo que cede ante un lugar mexicano de fuera, y lo que cede ante el
# extranjero, que es eso mas las palabras comunes del corredor.
_DEBILES_FUERA = tuple(AMBIGUOS + _FRASES_COMUNES)
_DEBILES_EXTRANJERO = _DEBILES_FUERA + tuple(AMBIGUOS_EXTRANJERO) + tuple(AMBIGUOS_LUGAR)
_DEBILES_LUGAR = _DEBILES_FUERA + tuple(AMBIGUOS_LUGAR)
_LARGOS_FUERA = _largos(_DEBILES_FUERA)
_LARGOS_EXTRANJERO = _largos(_DEBILES_EXTRANJERO)
_LARGOS_LUGAR = _largos(_DEBILES_LUGAR)

# La cola de etiquetas de una linea: "... anuncio #tijuana #noticias".
_COLA_ETIQUETAS = re.compile(r"(?:#\w+[^\w#]*)+$")
_ETIQUETA = re.compile(r"#\w+")
# "Migrantes de Haiti llegan a #Tijuana": la etiqueta tras una preposicion es
# parte de la frase aunque cierre la linea.
_PREPOSICION_FINAL = re.compile(r"(?:^|\s)(?:en|a|de|desde|hacia|para|por|del|al)\s*$",
                                re.IGNORECASE)


def _sin_firma(linea, firmas):
    """La linea sin la firma del canal al final, cortada por texto plegado."""
    for firma in firmas:
        f = fold(firma)
        if not f or not fold(linea).endswith(f):
            continue
        # fold() cambia el largo (tildes, espacios), asi que el corte se busca
        # en el original: el primer punto desde el que lo que queda es la firma.
        for i in range(len(linea)):
            if fold(linea[i:]) == f:
                return linea[:i]
    return linea


def _sin_cola(linea):
    m = _COLA_ETIQUETAS.search(linea)
    if not m:
        return linea
    cabeza = linea[:m.start()]
    if cabeza.strip() and _PREPOSICION_FINAL.search(cabeza):
        return cabeza + _ETIQUETA.match(linea, m.start()).group(0)
    return cabeza


def prosa_de(texto, firmas=()):
    """Lo que la pieza DICE: sin la cola de etiquetas de cada linea ni la firma
    del canal (`sufijos_titulo` en config/youtube.json).

    Las etiquetas del principio ("#TIJUANA | Deportan a ...", el antetitulo de
    CNR) y las de en medio son parte de la frase. Si no queda nada, el texto
    era solo etiquetas y se devuelve entero: ahi las etiquetas son lo unico
    que la pieza dice.
    """
    lineas = [_sin_cola(_sin_firma(l, firmas)) for l in (texto or "").split("\n")]
    prosa = "\n".join(lineas)
    if not _ETIQUETA.sub("", prosa).strip():
        return texto or ""
    return prosa


def extranjero_en(texto):
    """Lugares del extranjero nombrados en el texto, en orden de EXTRANJERO."""
    t = _VERBO_IRAN.sub(" ", _CALLE_EXTRANJERA.sub(" ", _plegar_n(texto)))
    for p in _NO_ES_EXTRANJERO_PATRONES:
        t = p.sub(" ", t)
    return [term for term, p in _EXTRANJERO_PATRONES if p.search(t)]


def nombra_mexico(texto):
    """True si el texto nombra al pais ('Mexico', 'mexicanos', no 'Nuevo
    Mexico') o a sus instituciones federales (_MARCAS_MEXICO)."""
    t = fold(texto)
    for p in _NO_ES_MEXICO:
        t = p.sub(" ", t)
    return bool(_MEXICO.search(t))


def _sin_debiles(texto, debiles, largos):
    """El texto plegado sin los `debiles`, borrados como SUBCADENA -- igual que
    los empata LUGARES, o "tesoros escondidos" seguiria siendo San Diego --,
    salvo donde forman parte de un termino mas largo del gacetero."""
    t = fold(texto)
    guardados = []

    def guardar(m):
        guardados.append(m.group(0))
        return "\x00{}\x00".format(len(guardados) - 1)

    for p in largos:
        t = p.sub(guardar, t)
    for d in debiles:
        # " | " y no "": borrar no puede pegar dos palabras en un termino nuevo.
        t = t.replace(d, " | ")
    return re.sub("\x00(\\d+)\x00", lambda m: guardados[int(m.group(1))], t)


def alcance_redes(texto, firmas=()):
    """(alcance, zonas) de una pieza de redes: los cuatro cajones de `alcance`
    mas `extranjero`, que nombra un lugar de fuera de Mexico.

    Existe porque el gacetero no conocia el extranjero, y lo que no conoce lo
    llama "nacional". El caso: "Mas de 280 mil ninos en Gaza regresaron a
    clases", de N+, caia en la cubeta Mexico, indistinguible de una nota
    nacional mexicana. Y lo poco que si caia en Mundo no estaba verificado: los
    15 videos de la busqueda del mundo estaban ahi porque no nombraban nada.

    Medido el 22 de septiembre de 2026 sobre los titulos: de 552 piezas de
    YouTube en cache, 21 pasan de Mexico a Mundo (17 de canales nacionales y 4
    de regionales, como "Descubren nuevo gato salvaje en Bolivia", de Sintesis)
    y ninguna zona del corredor cambia; de 745 destacados de TikTok desde el 15
    de septiembre, 5 pasan a Mundo y "En El Rosario, Sinaloa" deja San Quintin.
    Las exclusiones de EXTRANJERO salieron de la misma medicion.

    Precedencia, de mas fuerte a mas debil:
      1. Un lugar del corredor nombrado en la PROSA con un termino inequivoco.
         "Deportados desde Texas llegan a Tijuana" es Tijuana.
      2. Baja California a secas (`estatal`), como en `alcance`.
      3. Un lugar mexicano de fuera, o Mexico mismo: "Mexico vence a
         Argentina" es nacional. Nombrar Mexico NO crea `fuera`, porque eso
         tiraria la nota nacional de una fuente regional.
      4. Un lugar del extranjero.
      5. Lo debil, que cuenta mientras nada mas fuerte hable:
         - un homonimo (AMBIGUOS, que cede ante cualquier lugar de fuera, y
           AMBIGUOS_EXTRANJERO, que solo ante el extranjero);
         - un lugar en la cola de etiquetas del pie. "31 millones de soldados
           vs EEUU, Iran prepara su mayor fuerza" llego al muro de Tijuana por
           un #tijuana al final;
         - la firma del canal (`firmas`): "| TELEMUNDO SAN DIEGO" hace San
           Diego lo que no nombra nada -- casi siempre lo es, porque el
           gacetero no conoce Pacific Beach ni City Heights -- pero no un
           helicoptero caido "en Los Angeles".

    `alcance(texto, None)` sigue siendo el primer paso y decide todo lo que no
    toca lo de fuera, asi que una pieza que no nombra nada de fuera sale igual
    que antes.
    """
    texto = texto or ""
    alc, zonas = alcance(texto, None)
    if alc == "estatal":
        return alc, zonas
    prosa = prosa_de(texto, firmas)
    lejos = extranjero_en(prosa)
    sin_homonimos = _sin_debiles(prosa, _DEBILES_FUERA, _LARGOS_FUERA)
    if alc == "zona":
        # La zona descansaba en lo debil y la prosa nombra algo de fuera: se
        # vuelve a leer la prosa sin lo que cede ante eso.
        sin_lugar = _sin_debiles(prosa, _DEBILES_LUGAR, _LARGOS_LUGAR)
        if lejos:
            leida = _sin_debiles(prosa, _DEBILES_EXTRANJERO, _LARGOS_EXTRANJERO)
        elif fuera_en(sin_lugar):
            # Un lugar de fuera nombrado: cede todo lo debil, la avenida
            # Revolucion incluida (AMBIGUOS_LUGAR).
            leida = sin_lugar
        elif nombra_mexico(prosa):
            # Mexico mismo es el nivel 3 de arriba y la cola de etiquetas el 5.
            # Hasta el 24 de septiembre de 2026 solo cedia ante un lugar de
            # fuera, asi que nombrar Mexico no pesaba: «Donald Trump volvio a
            # referirse a Mexico… ante la Asamblea General» (N+) y «La
            # designacion de coordinadores estatales por parte de Morena»
            # llegaron al muro de Tijuana por una etiqueta del pie, con otros
            # dos de N+ y Azteca Noticias, el primer dia de sus perfiles.
            leida = sin_homonimos
        else:
            return alc, zonas
        alc, zonas = alcance(leida, None)
        if alc in ("zona", "estatal"):
            return alc, zonas
    if alc == "fuera" and lejos and not fuera_en(sin_homonimos):
        # El unico "fuera" era un homonimo ("la paz") o una etiqueta.
        alc, zonas = "nacional", []
    if alc == "nacional":
        if lejos and not nombra_mexico(prosa):
            return "extranjero", []
        # La prosa no nombra nada: lo debil (etiquetas, firma) es lo unico que
        # la pieza dice de donde es, y cuenta, con Mexico contado igual.
        if not lejos and extranjero_en(texto) and not nombra_mexico(texto):
            return "extranjero", []
    return alc, zonas
