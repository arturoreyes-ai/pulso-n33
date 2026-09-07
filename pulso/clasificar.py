"""Clasificacion de postura. Paso deliberadamente reemplazable.

Tres metodos, y el sistema tiene que poder degradar de cualquiera a
'ninguno' sin migrar datos:

  ninguno       postura null. Volumen de menciones sin etiqueta, que es un
                producto honesto.
  diccionario   la linea base lexica. No es publicable: falla de formas
                conocidas en prensa politica mexicana. El caso testigo esta
                en docs/PLAN.md seccion 4 -- 'toma protesta' es la ceremonia
                de juramentacion, y el diccionario lee 'protesta' como
                manifestacion, con lo que marca adversa cada cambio de
                administracion.
  modelo        pysentimiento en local (pulso/sentimiento.py). Mide el TONO
                del titular, nunca la postura hacia una persona; el tablero
                lo rotula asi y no lo cruza con figuras. Publicable con esa
                salvedad visible.

El metodo por omision sigue siendo 'ninguno'. Encender el clasificador es
cambiar un argumento, y el modelo es un paso por lotes: `clasificar_lote`
reclasifica solo lo que no traiga una etiqueta vigente del mismo modelo,
porque el id de una nota es el hash de su titulo y la etiqueta es estable.
"""

import re

from . import VERSION
from .normalizar import fold
from .sentimiento import (
    A_TONO,
    IDIOMA_OMISION,
    MODELO,
    SinModelo,
    disponible,
)

METODOS = ("ninguno", "diccionario", "modelo")
ETIQUETAS = ("favorable", "neutral", "adversa")

NEG = {
    "robo": -2, "robos": -2, "asalto": -2, "inseguridad": -3, "inseguro": -2,
    "violencia": -3, "crisis": -2, "desvio": -3, "corrupcion": -3,
    "denuncia": -2, "acusan": -2, "protesta": -2, "protestan": -2, "falta": -2,
    "escasez": -2, "sube": -1, "aumenta": -1, "crece": -1, "peor": -2,
    "suspende": -2, "bloqueo": -2, "huracan": -2, "riesgo": -2, "alerta": -2,
    "licencia": -1, "deja": -1, "abandona": -2, "renuncia": -2,
}

POS = {
    "logro": 2, "logros": 2, "inaugura": 2, "entrega": 2, "aprueba": 2,
    "aprueban": 2, "mejora": 2, "beneficio": 2, "apoyo": 2, "avanza": 2,
    "convenio": 2, "acuerdo": 1, "historico": 2, "conquista": 2,
    "medallas": 2, "exito": 2, "beca": 2, "reciben": 1, "combate": 1,
    "solucion": 2, "estrena": 1, "asume": 1, "confianza": 2,
}

# Las claves se pliegan una sola vez: el titular tambien llega plegado.
_PESOS = {fold(p): v for p, v in dict(NEG, **POS).items()}


def diccionario(titulo):
    """Puntaje y disparos del lexico. Diagnostico, no producto."""
    t = fold(titulo)
    puntaje, disparos = 0, []
    for palabra, valor in _PESOS.items():
        if re.search(r"\b" + re.escape(palabra) + r"\b", t):
            puntaje += valor
            disparos.append([palabra, valor])
    disparos.sort(key=lambda d: (-abs(d[1]), d[0]))
    etiqueta = "favorable" if puntaje >= 2 else "adversa" if puntaje <= -2 else "neutral"
    return {"etiqueta": etiqueta, "puntaje": puntaje, "disparos": disparos}


def clasificar(titulo, metodo="ninguno"):
    """Postura de UNA nota, o None si el paso esta apagado.

    El metodo 'modelo' no pasa por aqui: rinde por lotes y se pide con
    `clasificar_lote`.
    """
    if metodo not in METODOS:
        raise ValueError("metodo desconocido: {}".format(metodo))
    if metodo == "ninguno":
        return None
    if metodo == "modelo":
        raise ValueError("el metodo 'modelo' clasifica por lotes: usa clasificar_lote")
    r = diccionario(titulo)
    return {
        "etiqueta": r["etiqueta"],
        "puntaje": r["puntaje"],
        "metodo": "diccionario",
        "version": VERSION,
    }


def _vigente(postura, modelo):
    return (
        isinstance(postura, dict)
        and postura.get("metodo") == "modelo"
        and postura.get("modelo") == modelo
        and postura.get("etiqueta") in ETIQUETAS
    )


def idioma_de(nota, idiomas=None):
    """Idioma declarado del medio que publico la nota.

    Lo declara config/medios.json, no se adivina del texto: adivinar falla
    justo en los titulares cortos y con nombres propios, que son casi todos.
    """
    if not idiomas:
        return IDIOMA_OMISION
    return idiomas.get(nota.get("fuente"), IDIOMA_OMISION)


def clasificar_lote(notas, metodo="ninguno", analizador=None, idiomas=None):
    """Asigna 'postura' a cada nota, en sitio. Devuelve cuantas se clasificaron.

    Con 'modelo' conserva las etiquetas vigentes del mismo modelo y manda al
    analizador solo el resto, en un bloque. Si no hay analizador y
    pysentimiento no esta instalado, lanza SinModelo: un pedido explicito
    que no se puede cumplir falla en voz alta.

    `idiomas` es {id_de_medio: idioma} y sale de config/medios.json. Una nota
    en un idioma que el analizador no habla se queda con postura null en vez
    de recibir una etiqueta inventada. El caso: los cuatro medios de San
    Diego publican en ingles y se estaban etiquetando con el modelo espanol.
    """
    notas = list(notas)
    if metodo not in METODOS:
        raise ValueError("metodo desconocido: {}".format(metodo))
    if metodo == "ninguno":
        for n in notas:
            n["postura"] = None
        return 0
    if metodo == "diccionario":
        # El lexico es de palabras en espanol; sobre ingles no acierta ni por
        # casualidad, asi que no se le aplica.
        clasificadas = 0
        for n in notas:
            if idioma_de(n, idiomas) != IDIOMA_OMISION:
                n["postura"] = None
                continue
            n["postura"] = clasificar(n["titulo"], "diccionario")
            clasificadas += 1
        return clasificadas

    if analizador is None:
        if not disponible():
            raise SinModelo(
                "--metodo modelo requiere pysentimiento: "
                "python -m pip install -r requirements-modelo.txt"
            )
        from .sentimiento import Analizador
        analizador = Analizador()
    modelo = getattr(analizador, "modelo", MODELO)
    habla = getattr(analizador, "idioma", IDIOMA_OMISION)

    # Lo que el analizador no habla no se etiqueta. Sin este reparto el
    # modelo devuelve una etiqueta plausible para texto de otro idioma, que
    # es peor que no devolver nada porque no se distingue de un acierto.
    ajenas = [n for n in notas if idioma_de(n, idiomas) != habla]
    for n in ajenas:
        n["postura"] = None

    propias = [n for n in notas if idioma_de(n, idiomas) == habla]
    pendientes = [n for n in propias if not _vigente(n.get("postura"), modelo)]
    resultados = analizador.predecir([n["titulo"] for n in pendientes])
    for n, r in zip(pendientes, resultados):
        n["postura"] = {
            "etiqueta": A_TONO[r["etiqueta"]],
            "confianza": r["confianza"],
            "metodo": "modelo",
            "modelo": modelo,
            "version": VERSION,
        }
    return len(pendientes)


def sin_idioma(notas, analizador_idioma=IDIOMA_OMISION, idiomas=None):
    """Cuantas notas quedaron sin postura por no tener modelo de su idioma.

    El pipeline lo publica en estado.json: si uno de cada nueve titulares no
    se puede etiquetar, eso tiene que estar a la vista y no deducirse.
    """
    return sum(1 for n in notas
               if idioma_de(n, idiomas) != analizador_idioma)
