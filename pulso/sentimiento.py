"""Sentimiento con un modelo local. Paso reemplazable, apagado por omision.

El modelo es `pysentimiento/robertuito-sentiment-analysis`: RoBERTuito
afinado sobre el corpus TASS 2020 (tuits en espanol de varios dialectos),
que devuelve POS, NEG o NEU con probabilidades. Corre en CPU, no llama a
ninguna API y pesa unos 430 MB que se bajan una vez a ~/.cache/huggingface.

Lo que mide y lo que NO mide, dicho una vez para no repetirlo en cada panel:

  - Mide el TONO de una frase corta: si suena a queja, a celebracion o a
    informacion. Sobre comentarios de YouTube eso es sentimiento; sobre
    titulares de prensa es tono editorial.
  - NO mide postura hacia una persona. 'Alcalde inaugura obra' y 'Alcalde
    critica al gobernador' salen POS y NEG por el verbo, no por lo que
    signifiquen para el alcalde. Por eso el tablero nunca cruza tono con
    figura, y por eso docs/PLAN.md seccion 4 sigue prefiriendo un
    clasificador por lotes para postura politica.

La dependencia es OPCIONAL (requirements-modelo.txt). Si no esta instalada,
`disponible()` es False y pedir el metodo 'modelo' lanza SinModelo con la
instruccion de instalacion: un pedido explicito que no se puede cumplir
tiene que fallar en voz alta, no degradar en silencio.
"""

from .normalizar import fold

MODELO = "pysentimiento/robertuito-sentiment-analysis"
ETIQUETAS_MODELO = ("POS", "NEG", "NEU")

# Un modelo por idioma, y el idioma NO se adivina del texto: lo declara el
# medio en config/medios.json.
#
# Esto existe porque durante meses los cuatro medios de San Diego (KPBS,
# Voice of San Diego, Times of San Diego, inewsource) se etiquetaron con el
# modelo espanol. Son 98 de 888 notas: uno de cada nueve titulares del muro
# llevaba un tono calculado por un modelo entrenado con tuits en espanol,
# sobre texto en ingles, y nada en el codigo lo señalaba. Un modelo asi no
# devuelve error, devuelve una etiqueta plausible, que es peor.
IDIOMAS = ("es", "en")
IDIOMA_OMISION = "es"
MODELOS = {
    "es": MODELO,
    "en": "pysentimiento/bertweet-sentiment-analysis",
}

# Traducciones a los dos vocabularios del producto. Prensa y comentarios
# nunca se mezclan (docs/PLAN.md seccion 6), asi que tampoco comparten
# etiquetas: los titulares llevan tono, los comentarios sentimiento.
A_TONO = {"POS": "favorable", "NEG": "adversa", "NEU": "neutral"}
A_SENTIMIENTO = {"POS": "positivo", "NEG": "negativo", "NEU": "neutral"}

# RoBERTuito se entreno con tuits; mas alla de esto un comentario largo
# solo agrega ruido y tiempo.
TOPE_CARACTERES = 400


class SinModelo(RuntimeError):
    """pysentimiento no esta instalado y se pidio el metodo 'modelo'."""


def disponible():
    try:
        import pysentimiento  # noqa: F401
    except ImportError:
        return False
    return True


def recortar(texto, tope=TOPE_CARACTERES):
    return " ".join((texto or "").split())[:tope]


def _resultado(etiqueta, confianza, modelo):
    return {"etiqueta": etiqueta, "confianza": round(float(confianza), 4), "modelo": modelo}


class Analizador:
    """Envoltura perezosa: el modelo se carga en la primera prediccion."""

    def __init__(self, modelo=None, idioma=IDIOMA_OMISION):
        if idioma not in IDIOMAS:
            raise ValueError("idioma sin modelo: {!r}; hay {}".format(
                idioma, ", ".join(IDIOMAS)))
        self.idioma = idioma
        self.modelo = modelo or MODELOS[idioma]
        self._analizador = None

    def _cargar(self):
        if self._analizador is None:
            try:
                from pysentimiento import create_analyzer
            except ImportError as e:
                raise SinModelo(
                    "pysentimiento no esta instalado. Instala las dependencias "
                    "opcionales: python -m pip install torch --index-url "
                    "https://download.pytorch.org/whl/cpu && python -m pip "
                    "install -r requirements-modelo.txt"
                ) from e
            self._analizador = create_analyzer(task="sentiment", lang=self.idioma)
        return self._analizador

    def predecir(self, textos, lote=32):
        """Una etiqueta por texto, en el mismo orden. Vacios salen NEU sin
        pasar por el modelo."""
        textos = [recortar(t) for t in textos]
        salida = [None] * len(textos)
        indices = [i for i, t in enumerate(textos) if t]
        for i in range(len(textos)):
            if not textos[i]:
                salida[i] = _resultado("NEU", 0.0, self.modelo)
        if indices:
            analizador = self._cargar()
            for inicio in range(0, len(indices), lote):
                bloque = indices[inicio:inicio + lote]
                resultados = analizador.predict([textos[i] for i in bloque])
                for i, r in zip(bloque, resultados):
                    salida[i] = _resultado(r.output, max(r.probas.values()), self.modelo)
        return salida


class AnalizadorFalso:
    """Etiquetas deterministas por palabras clave, para pruebas y para la
    corrida sin red. No es un clasificador: es un doble con la misma forma."""

    modelo = "falso/palabras-clave"

    NEG = {"no", "sin", "falta", "mal", "peor", "inseguridad", "violencia",
           "robo", "basta", "corrupcion", "escasez", "crisis", "denuncia"}
    POS = {"gran", "excelente", "bien", "mejor", "logro", "inaugura",
           "felicidades", "apoyo", "gracias", "exito", "beneficio"}

    def __init__(self, idioma=IDIOMA_OMISION):
        # Las listas de arriba son de palabras en espanol, asi que el doble
        # tambien declara idioma: si no lo hiciera, las pruebas del reparto
        # por idioma pasarian sin ejercitarlo.
        self.idioma = idioma
        self.llamadas = 0

    def predecir(self, textos, lote=32):
        self.llamadas += 1
        salida = []
        for t in textos:
            palabras = set(fold(recortar(t)).split())
            if palabras & self.NEG:
                salida.append(_resultado("NEG", 0.9, self.modelo))
            elif palabras & self.POS:
                salida.append(_resultado("POS", 0.9, self.modelo))
            else:
                salida.append(_resultado("NEU", 0.6, self.modelo))
        return salida
