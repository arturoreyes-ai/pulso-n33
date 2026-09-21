import type { Nota } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";
import type { NotaRelacionada } from "./tipos";

/**
 * Notas del archivo que hablan de lo mismo que un titular en vivo. Puro.
 *
 * EL CASO: una tarjeta de En Tendencia es titular, fuente y enlace, sin cuerpo
 * ni extracto, y no hay desde donde seguir un tema. El archivo son miles de
 * titulares de las ultimas semanas, y ahi esta la respuesta a «esto ya se
 * habia contado».
 *
 * DONDE CORRE, que cambio el 18 de septiembre de 2026: esto lo ejecuta el
 * SERVIDOR, contra el mismo disco del que salen las miniaturas, y /api/
 * relacionadas devuelve como mucho seis filas recortadas. Antes lo ejecutaba
 * el navegador sobre el corpus entero, que para eso se descargaba en la
 * portada: 917 KB comprimidos por lector para un indice que el 87% de las
 * veces devuelve seis titulares. Sigue sin costar un centavo —no hay modelo ni
 * proveedor—, pero ya no es gratis en bytes y por eso se pide al pulsar el
 * chip y no antes.
 *
 * POR QUE SE PUNTUA POR RAREZA Y NO HAY LISTA DE PALABRAS VACIAS. En
 * `pulso/temas.py` hay tres listas a mano (VACIAS, DEMASIADO_COMUNES,
 * LUGARES_PALABRAS) que salieron de mirar una corrida real de 504 notas:
 * «llega», «nuevo», «personas», «pesos» y «septiembre» desplazaban a los temas
 * de verdad. Portarlas aqui seria mantener dos copias de una lista afinada a
 * mano, y la que no se usa al afinar es la que se queda vieja en silencio. La
 * rareza hace ese trabajo sola y con el corpus de hoy: un termino que aparece
 * en mil titulares no distingue nada y pesa casi cero; un apellido que aparece
 * en tres, decide. Si manana el corredor habla de otra cosa, se ajusta solo.
 *
 * Es la unica funcion de similitud del lado de TypeScript. La otra del repo es
 * `_jaccard` en pulso/temas.py, y mide otra cosa (cuanto se traslapan dos
 * conjuntos de notas, no cuanto se parecen dos titulares).
 *
 * MEDIDO el 17 de septiembre de 2026 contra el archivo real (5,629 notas,
 * 5,160 utiles, 11,775 terminos): el indice se arma en 56 ms y cada consulta
 * cuesta 0.20 ms, o sea que cabe en el `useMemo` que ya existe sin que nadie
 * lo note. Devuelve algo para el 87% de los titulares.
 *
 * LO QUE HACE MAL, porque conviene saberlo antes de creerle: compara bolsas de
 * palabras, no sentido. Acierta de sobra cuando dos notas cuentan el mismo
 * hecho -- el homicidio del joyero de Mexicali y la detencion de Los Rusos se
 * encuentran solas, y las dos versiones de una misma nota de dos medios
 * tambien --, y se equivoca cuando dos titulares comparten vocabulario sin
 * compartir tema: «primer semestre» empareja cifras de vivienda con multas de
 * transito. Por eso esto se ofrece como notas relacionadas y no como «la
 * cobertura de este tema»: es una sugerencia, no una afirmacion.
 */

/** Mismo criterio que `temas.py::tokenizar`: nada corto, nada numerico. */
const LARGO_MINIMO = 4;

/**
 * Dos terminos en comun. Con uno solo empareja cualquier par de titulares que
 * nombren la misma ciudad, que es la forma mas facil de que un panel de
 * «relacionadas» mienta con cara de acierto.
 */
const TERMINOS_MINIMOS = 2;

/**
 * Y que juntos digan algo. El puntaje se mide en la misma escala que el peso
 * de un termino -- el logaritmo de cuantas notas hay por cada una que lo trae
 * --, asi que este umbral se lee: «lo compartido tiene que ser al menos tan
 * revelador como una palabra que sale en una nota de cada cincuenta».
 *
 * Sin esto, dos palabras corrientes bastaban: «tijuana» y «gobierno» estan en
 * media region y no relacionan nada. Con esto, una sola palabra de verdad rara
 * ya alcanza, y dos corrientes no llegan por mucho que se sumen -- que es
 * exactamente el reparto que se quiere.
 *
 * Va en proporciones y no en un numero de notas a proposito: un tope fijo
 * cambia de significado cuando el archivo crece.
 */
const UMBRAL_PUNTAJE = Math.log(50);

export interface IndiceRelacionadas {
  readonly notas: readonly Nota[];
  /** termino -> indices en `notas`. */
  readonly porTermino: ReadonlyMap<string, readonly number[]>;
  /** Cuantas notas hay detras, para pesar la rareza. */
  readonly total: number;
}

export function terminos(titulo: string): string[] {
  const vistos = new Set<string>();
  for (const t of plegar(titulo).split(/[^a-z0-9]+/)) {
    if (t.length < LARGO_MINIMO) continue;
    if (!/[a-z]/.test(t)) continue; // puro numero: un año no es un tema
    vistos.add(t);
  }
  return [...vistos];
}

export function indiceDeRelacionadas(notas: readonly Nota[]): IndiceRelacionadas {
  const porTermino = new Map<string, number[]>();
  // `fuera` es lo que el gacetero marco como ajeno a la region: el feed de El
  // Imparcial trae al grupo entero, y por ahi entraron «hermosillo» y «sonora»
  // como temas de un tablero de Baja California. No son notas que relacionar.
  const utiles = notas.filter((n) => n.alcance !== "fuera");
  utiles.forEach((n, i) => {
    for (const t of terminos(n.titulo)) {
      const filas = porTermino.get(t);
      if (filas === undefined) porTermino.set(t, [i]);
      else filas.push(i);
    }
  });
  return { notas: utiles, porTermino, total: utiles.length };
}

/**
 * Las notas mas cercanas a `titulo`, de la mas a la menos. Vacio cuando no hay
 * ninguna que cumpla, que es el caso comun fuera del corredor: el panel lo
 * dice con una frase y no rellena con lo que sea.
 */
export function relacionadasPara(
  titulo: string,
  indice: IndiceRelacionadas,
  tope = 6,
): Nota[] {
  if (indice.total === 0) return [];
  const propios = terminos(titulo);
  if (propios.length < TERMINOS_MINIMOS) return [];
  const plegado = plegar(titulo);

  const puntaje = new Map<number, number>();
  const cuantos = new Map<number, number>();

  for (const t of propios) {
    const filas = indice.porTermino.get(t);
    if (filas === undefined) continue;
    // Peso por rareza: un termino en la mitad del archivo pesa casi nada.
    const peso = Math.log(indice.total / filas.length);
    for (const i of filas) {
      puntaje.set(i, (puntaje.get(i) ?? 0) + peso);
      cuantos.set(i, (cuantos.get(i) ?? 0) + 1);
    }
  }

  const candidatos: { nota: Nota; puntos: number }[] = [];
  for (const [i, puntos] of puntaje) {
    if ((cuantos.get(i) ?? 0) < TERMINOS_MINIMOS || puntos < UMBRAL_PUNTAJE) continue;
    const nota = indice.notas[i];
    if (nota === undefined) continue;
    // La misma nota no es una nota relacionada. El cruce es por titular
    // plegado, la misma llave que imagenes.ts y enlaces.ts.
    if (plegar(nota.titulo) === plegado) continue;
    candidatos.push({ nota, puntos });
  }

  // Determinista para el mismo notas.json: a igual puntaje manda la mas
  // reciente, y a igual fecha el id, que no se repite.
  candidatos.sort((a, b) =>
    b.puntos - a.puntos
    || (b.nota.fecha ?? "").localeCompare(a.nota.fecha ?? "")
    || a.nota.id.localeCompare(b.nota.id));
  return candidatos.slice(0, tope).map((c) => c.nota);
}

/**
 * Lo que de una nota sale por el cable. Cinco campos, que son los cinco que la
 * hoja pinta.
 *
 * Es donde la regla 5 de PRODUCT.md deja de ser una convencion: `postura` no
 * se omite al pintar, no llega. Y con ella se quedan fuera `figuras`, `zonas`
 * y `alcance`, que juntas son lo que convertiria una sugerencia por parecido
 * de palabras en una afirmacion sobre alguien.
 */
export function recortar(notas: readonly Nota[]): NotaRelacionada[] {
  return notas.map((n) => ({
    id: n.id,
    titulo: n.titulo,
    url: n.url,
    dominio: n.dominio,
    fecha: n.fecha,
  }));
}
