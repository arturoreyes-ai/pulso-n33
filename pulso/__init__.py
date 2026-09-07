"""Pulso N33 — inteligencia regional del corredor Tijuana–San Diego.

La ingesta RSS usa la biblioteca estandar; las portadas HTML usan Scrapy.
"""

VERSION = "0.2.0"

# Zonas validas. El roster y el catalogo de medios se validan contra esta lista;
# agregar una zona nueva es editar aqui.
ZONAS = (
    "estatal",
    "Tijuana",
    "Mexicali",
    "Ensenada",
    "Playas de Rosarito",
    "Tecate",
    "San Quintín",
    "San Felipe",
    "San Diego",
)

# Delegaciones de Tijuana, en el orden en que las muestra el tablero. Es la
# unica zona con subdivision: la prensa de Tijuana nombra colonias y
# delegaciones; los indicadores oficiales no bajan de municipio.
DELEGACIONES_TIJUANA = (
    "Centro",
    "Cerro Colorado",
    "La Mesa",
    "La Presa A.L.R.",
    "La Presa Este",
    "Otay Centenario",
    "Playas de Tijuana",
    "San Antonio de los Buenos",
    "Sánchez Taboada",
)
