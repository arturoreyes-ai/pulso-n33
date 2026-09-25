/**
 * Si el titulo de una publicacion nombra un rubro. Puro.
 *
 * Existe porque el cliente pidio el 24 de septiembre de 2026 la fila de temas
 * de En Tendencia tambien en Redes. Alla un rubro es una BUSQUEDA de Google
 * con los terminos de rubros.ts; aqui no hay busqueda que lanzar, porque las
 * publicaciones ya estan cosechadas. Asi que se corre la MISMA lista de
 * terminos sobre el titulo de cada una, y la afirmacion es la misma y no
 * mas: «este titulo contiene una de estas palabras». No es un clasificador;
 * rubros.ts explica por que no se hace uno, y esto no lo es porque no
 * decide nada que la lista no diga ya, escrita y a la vista.
 *
 * Solo el `titulo` (la primera linea del pie), nunca el pie entero ni los
 * comentarios: es lo unico que la pantalla publica del medio.
 *
 * Tres cuidados que la busqueda de Google hacia sola:
 *  - Palabra entera, no subcadena: «actor» no es «factor», «vino» no es
 *    «vinotinto», «ia» no es «guia».
 *  - Las siglas (PAN, INE, IA, AI, CBP) distinguen mayusculas: «pan» y «ia»
 *    en minusculas son pan y el verbo ir en portugues. Una sigla es un
 *    termino todo en mayusculas de hasta cuatro letras.
 *  - Una frase cuenta tambien como etiqueta pegada: «inteligencia
 *    artificial» encuentra #InteligenciaArtificial, que es como se escribe en
 *    un pie de TikTok.
 *  - Una palabra suelta admite su plural (-s, -es): «Huracanes Polo y
 *    Odalys» no nombraba «huracán» y se quedaba fuera de Clima.
 *
 * Y una lista corta propia, `DEL_PIE`, con lo que un pie de redes dice y un
 * titular de prensa no: medido el 24 de septiembre de 2026 sobre los 303
 * destacados, Seguridad dejaba fuera «Emboscan a elementos», «fosas de
 * Michoacán» y «6 cuerpos localizados», y Politica «La #Presidenta ...
 * recibió en Palacio Nacional». Va aparte y no en rubros.ts porque aquella
 * lista es la consulta a Google de En Tendencia, y alargarla cambia lo que
 * trae la portada.
 *
 * Los dos idiomas a la vez: un titulo no declara el suyo de manera fiable y
 * aqui no se le pasa a ningun modelo, asi que no hay regla 5 en juego.
 */

import { TERMINOS_RUBRO, type Rubro } from "./rubros";

const COMBINANTES = /[̀-ͯ]/g;

/** Sin acentos, conservando mayusculas: las siglas las necesitan. */
const sinAcentos = (s: string) => s.normalize("NFD").replace(COMBINANTES, "");

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Borde de palabra sobre texto sin acentos: letra o digito a los lados no. */
const entera = (cuerpo: string, banderas: string) =>
  new RegExp(`(?:^|[^\\p{L}\\p{N}])${cuerpo}(?:$|[^\\p{L}\\p{N}])`, banderas);

const esSigla = (t: string) => /^[A-Z]{2,4}$/.test(t);

/** Los terminos de un rubro en los dos idiomas. Desde el 25 de septiembre
 *  de 2026 rubros.ts los guarda como lista y no como consulta armada. */
function terminos(rubro: Rubro): string[] {
  return [...new Set(Object.values(TERMINOS_RUBRO[rubro]).flat())];
}

/**
 * Lo que el pie de redes dice y la consulta de prensa no; ver arriba.
 *
 * Y, desde el 25 de septiembre de 2026, lo que la consulta dejo por su tope:
 * Google lee 31 palabras (rubros.ts::PALABRAS_MAXIMAS_GOOGLE) y las listas se
 * recortaron a lo que cabe, pero aqui no hay consulta y un titulo que dice
 * «secuestro» sigue siendo de Seguridad. Van SOLO las que salieron por el
 * tope; las que salieron por ambiguas no vuelven: «pronóstico» (las apuestas
 * de futbol), «Congreso» (el de bomberos), «Padres» en espanol, «Wave»,
 * «cross-border», «comercio», «forecast», «redes sociales» y «vino».
 */
const DEL_PIE: Partial<Record<Rubro, readonly string[]>> = {
  seguridad: ["asesinado", "asesinada", "asesinato", "emboscan", "ataque armado", "fosa", "cuerpo", "sin vida",
    "desaparecido", "desaparecida", "policía", "sicarios", "narco", "murder", "suspect",
    "detenido", "fiscalía", "secuestro", "crimen organizado", "ejecutado", "hallan cuerpos", "feminicidio",
    "extorsión", "smuggling", "robbery", "stabbing"],
  // Sin nombres de politicos, por la regla de rubros.ts.
  politica: ["presidenta", "senado", "senador", "senadora",
    "gobernador", "diputada", "regidor", "elecciones", "INE", "PAN", "conferencia matutina",
    "senator", "legislature", "ballot"],
  clima: ["hurricane", "sismo", "temblor", "earthquake", "granizo", "vientos", "heat wave"],
  deportes: ["Club Tijuana", "béisbol", "maratón", "Gulls", "boxing", "marathon"],
  economia: ["inflación", "cruce fronterizo", "vivienda", "layoffs"],
  // Sin «serie»: la Serie Mundial es Deportes.
  espectaculos: ["cantante", "K-pop", "película", "movie", "espectáculos", "viral", "reality show"],
  // Sin «playa»: con el plural, «Playas de Rosarito» es el nombre de una zona
  // y todo Rosarito caeria en Turismo.
  turismo: ["vinos", "brewery", "cervecería", "desarrollo residencial", "desarrollo inmobiliario",
    "real estate development"],
  ia: ["Anthropic"],
};

/** Los patrones de una lista de terminos, con las reglas del encabezado. */
function compilar(lista: readonly string[]): RegExp[] {
  return lista.flatMap((t) => {
    const limpio = sinAcentos(t);
    if (esSigla(limpio)) return [entera(escapar(limpio), "u")];
    const plural = /\s/.test(limpio) ? "" : "(?:e?s)?";
    const frase = escapar(limpio).replace(/\s+/g, "\\s+") + plural;
    const salida = [entera(frase, "iu")];
    if (/\s/.test(limpio)) salida.push(entera(`#${escapar(limpio.replace(/\s+/g, ""))}`, "iu"));
    return salida;
  });
}

const PATRONES = new Map<Rubro, RegExp[]>();
const DE_LISTA = new WeakMap<readonly string[], RegExp[]>();

function patrones(rubro: Rubro): RegExp[] {
  const hechos = PATRONES.get(rubro);
  if (hechos !== undefined) return hechos;
  const lista = compilar([...terminos(rubro), ...(DEL_PIE[rubro] ?? [])]);
  PATRONES.set(rubro, lista);
  return lista;
}

export function nombraRubro(titulo: string, rubro: Rubro): boolean {
  const texto = sinAcentos(titulo);
  return patrones(rubro).some((p) => p.test(texto));
}

/**
 * Lo mismo sobre una lista propia, para quien necesita un eje que no es un
 * rubro: los de Noticias 33 en el guion de locucion (garitas, mañanera,
 * California), que el cliente no quiso como pestanas. La lista debe ser una
 * constante del modulo: se compila una vez por identidad.
 */
export function nombraAlguno(titulo: string, lista: readonly string[]): boolean {
  let hechos = DE_LISTA.get(lista);
  if (hechos === undefined) {
    hechos = compilar(lista);
    DE_LISTA.set(lista, hechos);
  }
  const texto = sinAcentos(titulo);
  return hechos.some((p) => p.test(texto));
}
