"""Temas y tendencias: agrupamiento no supervisado sobre titulares y comentarios.

Responde "de qué se está hablando y qué va subiendo" sin modelo y sin API.
Es conteo de n-gramas por documento, con dos ventanas de tiempo para sacar
momento. Determinista y solo stdlib.

Tres reglas honestas que el diseno impone, no sugiere:

1. **Se reportan conteos, nunca porcentajes.** Con seis notas al dia un
   porcentaje se mueve con dos comentarios. Ver docs/PLAN.md seccion 6.
2. **Prensa y comentarios NUNCA se mezclan en un mismo numero.** La prensa
   sale neutra porque informa; los comentarios salen adversos porque opinan.
   La brecha entre los dos es la senal, asi que `temas()` se llama una vez
   por origen y el resultado lleva de donde vino.
3. **Un tema con pocos documentos no es un tema.** Debajo de `minimo` no se
   publica; queda en `descartados` para poder auditar por que.

Frecuencia por DOCUMENTO, no por termino: un titular que repite una palabra
cuatro veces cuenta una vez. Si no, un solo texto largo inventa un tema.
"""

import re
from datetime import datetime, timedelta

from .normalizar import fold

# Palabras que no distinguen un tema de otro. Espanol primero; ingles porque
# las fuentes de San Diego publican en ingles y comparten el mismo muro.
VACIAS = frozenset("""
a al algo alguna algunas alguno algunos ante antes aqui asi aun aunque cada
casi como con contra cual cuales cuando cuanto de del desde donde dos durante
el ella ellas ellos en entre era eran eres es esa esas ese eso esos esta
estaba estan estar estas este esto estos estoy fue fueron ha habia han hasta
hay hoy incluso la las le les lo los mas me mi mientras mis mucho muchos muy
nada ni no nos nosotros nuestra nuestro o os otra otras otro otros para pero
poco por porque pues que quien quienes se segun ser si sido sin sobre solo
son su sus tambien tan tanto te tiene tienen toda todas todo todos tras tu
tus un una unas uno unos ver vez y ya yo
about after again against all also and any are around
because been before being between both but can could did does doing down
during each few for from further had has have having her here hers him his
how into its itself just more most much must new now off once only other
our out over own said same she should since some such than that the their
them then there these they this those through too under until very was way
were what when where which while who whom why will with would you your
dice dijo tras vs via mil millones ciento por_ciento
anos ano dia dias mes meses hora horas
""".split())

# Vocabulario de fondo de cualquier nota: verbos y sustantivos de titular que
# aparecen en todo y no distinguen un tema de otro. Salieron de mirar los
# temas de una corrida real de 504 notas, donde 'llega', 'nuevo', 'personas',
# 'pesos' y 'septiembre' desplazaban a los temas de verdad.
DEMASIADO_COMUNES = frozenset("""
mexico mexicano mexicana noticias nota notas video fotos foto entrevista
opinion editorial columna
llega llegan llego llegara nuevo nueva nuevos nuevas viejo
personas persona gente vecinos ciudadanos habitantes
pesos peso dolares dolar millones millon miles
falta faltan tiene tienen tuvo tendra hacer hacen hizo haran
dice dicen dijo diran anuncia anuncian anuncio buscan busca buscara
piden pide pidio dan daran dara pone ponen puso
van vamos viene vienen vino sigue siguen siguio queda quedan
hoy ayer manana semana semanas mañana
enero febrero marzo abril mayo junio julio agosto septiembre octubre
noviembre diciembre lunes martes miercoles jueves viernes sabado domingo
january february march april june july august september october november
december monday tuesday wednesday thursday friday saturday sunday
first last next year years week weeks day days new
""".split())


# Los nombres de lugar no son temas: son la faceta 'zona'. Sin esto, 'diego'
# (de 'San Diego') y 'tijuana' salen como temas principales, que es como decir
# que el tema del dia es el lugar donde vive el lector.
#
# Esta lista esta escrita a mano y NO se deriva del gazetero de zonas.py.
# Derivarla partiendo las frases en palabras parece mas limpio y esta mal: el
# gazetero trae 'Agua Prieta' (Sonora) y 'La Presa' (Tijuana), asi que
# partirlas tiraba 'agua' y 'presa' — o sea el tema mas importante de Baja
# California y su principal infraestructura. Solo van palabras que no son
# nada mas que un lugar.
LUGARES_PALABRAS = frozenset("""
tijuana mexicali ensenada tecate rosarito otay cachanilla maneadero
popotla camalu colonet puertecitos algodones sauzal cucapah rumorosa
quintin ysidro banda bufadora taboada
diego chula jolla cajon coronado escondido oceanside carlsbad santee
poway encinitas sandag
sonora hermosillo obregon cajeme navojoa guaymas nogales caborca empalme
penasco prieta
sinaloa culiacan mazatlan mochis jalisco guadalajara zapopan monterrey
chihuahua juarez saltillo torreon matamoros reynosa michoacan morelia
guanajuato queretaro puebla veracruz oaxaca chiapas yucatan merida cancun
tulum acapulco loreto comondu mulege
california baja
""".split())

MAX_N = 3          # hasta trigramas
UMBRAL_TRASLAPE = 0.6


def tokenizar(texto):
    """Palabras significativas, plegadas y sin vacias, en orden.

    Despues de fold() no quedan acentos ni ñ (se pliega a n), asi que la
    clase de caracteres no necesita contemplarlos.
    """
    crudo = re.split(r"[^0-9a-z]+", fold(texto))
    salida = []
    for t in crudo:
        if len(t) < 4:
            continue
        if t in VACIAS or t in DEMASIADO_COMUNES or t in LUGARES_PALABRAS:
            continue
        if t.isdigit():
            continue
        salida.append(t)
    return salida


def ngramas(tokens, n_max=MAX_N):
    """N-gramas de 1 a n_max sobre los tokens ya filtrados.

    Se filtran las vacias ANTES de formar los n-gramas, asi que
    'percepcion de inseguridad' llega como el bigrama
    'percepcion inseguridad', que es justo la forma que se quiere agrupar.
    """
    salida = set()
    for n in range(1, n_max + 1):
        for i in range(len(tokens) - n + 1):
            salida.add(" ".join(tokens[i:i + n]))
    return salida


def _fecha(s):
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def temas(registros, ahora, origen="prensa", ventana_dias=7, minimo=3, tope=25):
    """Temas del periodo, con momento contra el periodo anterior.

    `registros` son dicts con al menos id, titulo y fecha; zona y fuente se
    usan si estan. `ahora` es fecha ISO o date.

    Devuelve {origen, ventana, generado, temas: [...], descartados, notas_*}.
    """
    hoy = _fecha(ahora) if isinstance(ahora, str) else ahora
    corte_actual = hoy - timedelta(days=ventana_dias)
    corte_previo = hoy - timedelta(days=ventana_dias * 2)

    actuales, previos = [], []
    for r in registros:
        f = _fecha(r.get("fecha"))
        if f is None:
            continue
        if f > hoy:
            continue                      # fecha futura: feed mal fechado
        if f > corte_actual:
            actuales.append(r)
        elif f > corte_previo:
            previos.append(r)

    # Frecuencia por documento.
    docs_actual, docs_previo = {}, {}
    for r in actuales:
        for g in ngramas(tokenizar(r.get("titulo", ""))):
            docs_actual.setdefault(g, set()).add(r["id"])
    for r in previos:
        for g in ngramas(tokenizar(r.get("titulo", ""))):
            docs_previo.setdefault(g, set()).add(r["id"])

    por_id = {r["id"]: r for r in actuales}

    # Candidatos que pasan el minimo de volumen.
    candidatos = [(g, ids) for g, ids in docs_actual.items() if len(ids) >= minimo]
    # Mas especifico primero, luego mas voluminoso: asi la etiqueta que
    # sobrevive al desempate es la mas legible ('percepcion inseguridad'
    # antes que 'inseguridad').
    candidatos.sort(key=lambda x: (-len(x[0].split()), -len(x[1]), x[0]))

    elegidos, descartados = [], []
    for g, ids in candidatos:
        choque = next((e for e in elegidos if _jaccard(ids, e["_ids"]) > UMBRAL_TRASLAPE), None)
        if choque is not None:
            # Mismo grupo de notas con otra etiqueta: no es un tema nuevo.
            descartados.append({"termino": g, "n": len(ids), "porque": "duplica «{}»".format(choque["termino"])})
            continue
        previo = len(docs_previo.get(g, ()))
        elegidos.append({
            "termino": g,
            "n": len(ids),
            "n_previo": previo,
            "momento": len(ids) - previo,
            "_ids": ids,
        })

    for e in elegidos:
        ids = e.pop("_ids")
        regs = [por_id[i] for i in ids if i in por_id]
        zonas, fuentes = {}, {}
        for r in regs:
            # Una nota puede ser de varias zonas a la vez (una nota de la
            # garita es de Tijuana Y de San Diego), asi que suma en todas.
            # Sin zona = nota nacional que no baja a un municipio. Se rotula
            # como tal en vez de 'sin zona', que suena a dato faltante.
            for z in (r.get("zonas") or ["nacional"]):
                zonas[z] = zonas.get(z, 0) + 1
            f = r.get("fuente") or "sin fuente"
            fuentes[f] = fuentes.get(f, 0) + 1
        e["zonas"] = dict(sorted(zonas.items(), key=lambda kv: (-kv[1], kv[0])))
        e["fuentes"] = dict(sorted(fuentes.items(), key=lambda kv: (-kv[1], kv[0])))
        # Un tema sostenido por un solo medio es la agenda de ese medio, no
        # un tema de la region. Se publica, pero rotulado.
        e["un_solo_medio"] = len(e["fuentes"]) == 1
        e["notas"] = sorted(ids)
        e["ejemplos"] = [r["titulo"] for r in sorted(
            regs, key=lambda r: (r.get("fecha") or "", r["id"]), reverse=True)][:3]

    elegidos.sort(key=lambda e: (-e["momento"], -e["n"], e["termino"]))
    elegidos = elegidos[:tope]

    return {
        "origen": origen,
        "generado": ahora if isinstance(ahora, str) else hoy.isoformat(),
        "ventana_dias": ventana_dias,
        "minimo": minimo,
        "notas_ventana": len(actuales),
        "notas_previas": len(previos),
        "temas": elegidos,
        "descartados": sorted(descartados, key=lambda d: (-d["n"], d["termino"]))[:20],
    }
