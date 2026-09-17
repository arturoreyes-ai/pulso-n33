/**
 * Las reglas 1 y 2 de PRODUCT.md, ejecutables sobre lo que devuelve un modelo.
 *
 * EL CASO QUE LAS MOTIVA. Se le pide a un modelo «que se repite en los
 * comentarios» de una publicacion y devuelve «la mayoria de los comentarios
 * critica al ayuntamiento» o «el 60% pide mas patrullas». Las dos frases son
 * falsas de dos maneras distintas y las dos suenan bien:
 *
 *  - Regla 2: son entre uno y diez comentarios, muy por debajo del piso de
 *    treinta. Un porcentaje sobre seis se mueve con uno.
 *  - Regla 1: veinte comentarios de cinco mil cuatrocientos no son «la
 *    mayoria» de nadie, y «la gente» convierte un hilo en una ciudad.
 *
 * El prompt lo prohibe, y el prompt NO ES LA DEFENSA. Un modelo que lee
 * comentarios publicos sin moderar lee tambien lo que alguien escribio para
 * que un modelo lo leyera; los comentarios son DATOS, no instrucciones, y una
 * instruccion metida ahi no puede poder mas que esta funcion. Aqui la regla es
 * una prueba, como `pulso/validador.py` es ley y no una guia de estilo.
 *
 * Rechaza la respuesta entera, no el termino: una ficha a la que se le borro
 * una palabra ya no es lo que el modelo quiso decir.
 */

/** Un numero de esta escala, en cifra o deletreado. Es un trozo de patron en
 *  una cadena, asi que la contrabarra va DOBLE: `"\d"` en JavaScript es la
 *  letra `d` y dejaria la rama de las cifras muerta sin que nada avise. */
const NUMERAL = "(?:\\d+|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)";

/** Cada patron con el nombre que se pone en el registro cuando pega. */
const PROHIBIDOS: [string, RegExp][] = [
  // Regla 2: ningun porcentaje, fraccion ni proporcion.
  ["porcentaje", /%|\bpor\s+ciento\b|\bporcentaje\b/i],
  ["fraccion", /\b(la\s+mitad|un\s+tercio|dos\s+tercios|tres\s+cuartos|la\s+cuarta\s+parte)\b/i],
  // «tres de cada cinco» y no solo «3 de cada 5»: un modelo que escribe prosa
  // llana deletrea los numeros bajos, que son justo los de esta escala.
  ["proporcion", new RegExp(`\\b${NUMERAL}\\s+de\\s+cada\\s+${NUMERAL}\\b`, "i")],
  ["proporcion", /\b(la\s+mayor\s+parte|la\s+minor[ií]a|predomina|predominan|en\s+su\s+mayor[ií]a)\b/i],
  // Regla 1: esto no es una muestra de nadie. «mayoria de edad» y «mayoria
  // calificada» no pegan: el articulo y el sustantivo van en el patron.
  ["muestra", /\bla\s+mayor[ií]a\s+(de\s+(los|las|l[oa]s?\s+\w+|quienes)|opina|piensa|cree|considera|pide|exige)\b/i],
  ["muestra", /\bla\s+gente\b|\bopini[oó]n\s+p[uú]blica\b|\bel\s+sentir\b|\bse\s+percibe\b/i],
  ["muestra", /\blos\s+(ciudadanos|tijuanenses|mexicalenses|ensenadenses|habitantes|vecinos\s+de)\b/i],
  ["muestra", /\b(la\s+poblaci[oó]n|la\s+ciudadan[ií]a)\b/i],
];

/**
 * El primer termino prohibido que aparece en `texto`, o `null` si esta limpio.
 * Devuelve el NOMBRE de la regla y no la coincidencia: lo que se registra es
 * que regla se rompio, no el texto del modelo, que no se guarda en ningun lado.
 */
export function terminoProhibido(texto: string): string | null {
  for (const [nombre, patron] of PROHIBIDOS) {
    if (patron.test(texto)) return nombre;
  }
  return null;
}

/** Lo mismo sobre varios campos. `null` en la lista se ignora: un campo que no
 *  vino no puede romper una regla. */
export function reglaRota(campos: (string | null | undefined)[]): string | null {
  for (const campo of campos) {
    if (typeof campo !== "string") continue;
    const roto = terminoProhibido(campo);
    if (roto !== null) return roto;
  }
  return null;
}
