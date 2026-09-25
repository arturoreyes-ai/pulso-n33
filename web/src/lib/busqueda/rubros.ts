/**
 * Los rubros de la actualidad: Clima, Seguridad, Deportes, Politica y
 * Economia. Puro: solo cadenas.
 *
 * Existe porque el cliente mostro, el 11 de septiembre de 2026, la caja
 * "Trending topics" de la pagina local de Google Noticias -- Weather, Crime,
 * Sports, Politics, Business, con notas debajo de cada pastilla -- y pidio
 * algo asi. El RSS de Google no expone esa clasificacion: hay seccion por
 * lugar y hay busqueda, pero no seccion por lugar Y tema, y tampoco trae las
 * imagenes. Asi que un rubro es una BUSQUEDA: los terminos del rubro mas los
 * terminos de lugar que ya prueba ambito.ts::componerConsulta, acotada a dos
 * dias. El panel lo dice asi; no es la seccion ni la clasificacion de Google.
 *
 * Google empata la busqueda contra el CUERPO de la nota, que aqui no se lee,
 * asi que el titular tiene que nombrar un termino del rubro (`nombraRubro`).
 * El caso, 25 de septiembre de 2026: el cliente mando tres tarjetas de
 * Deportes, "San Diego Tijuana International Jazz Festival to celebrate third
 * year" (Union-Tribune) y dos paginas de partido de ESPN de julio y agosto.
 * Medido ese dia, de las 20 filas en ingles de Deportes del corredor, 16 no
 * eran deporte: el huracan Polo, el informe federal del rio Tijuana, el
 * festival de jazz. Economia en ingles, lo mismo. Las paginas viejas las
 * quita otra reja, fecha-titular.ts.
 *
 * Y NO se clasifica del lado del cliente: un lexico que archive un titular
 * bajo "Seguridad" por una palabra fabrica una afirmacion que no se puede
 * sostener. `nombraRubro` solo resta: lo que queda es lo que Google devolvio
 * para estos terminos Y cuyo titular los dice. Es la postura de
 * pulso/consultas.py::_nombra: el buscador empata de mas, y el titular es la
 * unica evidencia que aqui se tiene.
 *
 * `intitle:` parecia la version limpia y no lo es. Google la honra, pero cada
 * operador gasta mas del tope de la consulta que una palabra suelta, el
 * limite no es regular (con frases cambia) y lo que sobra se descarta EN
 * SILENCIO: con las listas completas desaparecieron el lugar y la ventana, y
 * Seguridad de Tijuana salio con balaceras de Houston y Portland. Ademas ve el
 * titulo con el « - Medio» del final, asi que "Hurricane Polo Heading To Baja
 * California - FOX Sports Radio" entraba a Deportes por la emisora.
 *
 * Los terminos van en el idioma de cada edicion, por la misma regla que el
 * modelo de tono: un termino en espanol pedido a la edicion en ingles no
 * devuelve nada. Sin nombres propios de politicos: caducan y cruzarian el
 * rubro con una figura.
 */

import { plegar } from "@/lib/dominio/formato";
import type { Idioma } from "./tipos";

export const RUBROS = ["clima", "seguridad", "deportes", "politica", "economia"] as const;

export type Rubro = (typeof RUBROS)[number];

export const esRubro = (s: string | null): s is Rubro =>
  (RUBROS as readonly string[]).includes(s ?? "");

export const NOMBRE_RUBRO: Record<Rubro, string> = {
  clima: "Clima",
  seguridad: "Seguridad",
  deportes: "Deportes",
  politica: "Política",
  economia: "Economía",
};

/**
 * Dos dias: "ahora" para un tema, con margen para las zonas chicas, donde un
 * dia trae dos o tres titulares. Google honra `when:` de forma irregular
 * (pulso/busquedas.py lo documenta), asi que es un sesgo, no una garantia:
 * fecha-titular.ts cubre el caso en que el titular mismo dice otra fecha.
 */
export const VENTANA_RUBRO = "when:2d";

/**
 * Cuantas palabras lee Google de una consulta, contando cada OR. Medido el 25
 * de septiembre de 2026 con palabras raras en OR y "Trump" al final: en la
 * posicion 31 contaba (99 de 100 titulares con Trump) y en la 33 ya no
 * (ninguno); la 32 no se midio, asi que el tope es 31. Lo que pasa del tope
 * se descarta sin aviso, y como el lugar y la
 * ventana van AL FINAL de la consulta, es lo primero que se pierde. Las
 * listas de antes pasaban de 32 en el corredor, cuyo lugar gasta 15: se
 * buscaba "Baja California OR Tijuana..." y el resto del corredor se caia.
 * scripts/probar-busqueda.cjs mide cada rubro contra cada lugar.
 */
export const PALABRAS_MAXIMAS_GOOGLE = 31;

/**
 * Cada lista cabe en 15 palabras con sus OR, que es lo que deja el corredor
 * (31, menos 15 de su lugar, menos la ventana). Por eso son cortas, y cada una
 * guarda lo que los titulares del rubro de verdad dicen, medido sobre las
 * filas correctas del 25 de septiembre de 2026. Lo que salio de la lista y
 * por que:
 *
 *  - "pronóstico": como titular, metia en Clima "Tijuana vs Atlas: Pronóstico
 *    y posibles alineaciones" y dos de apuestas.
 *  - "Padres" en espanol: es "padres de familia". En ingles se queda.
 *  - "Wave": es "heat wave", que es de Clima.
 *  - "PAN": es el pan, y Google no distingue mayusculas.
 *  - "Congreso": metia "Congreso Nacional de Posgrado" y "Congreso
 *    Internacional de Bomberos" en Politica.
 *  - "cross-border" y "comercio": un encuentro de patinadores y un "robo con
 *    violencia a comercio" en Economia.
 *  - "forecast": "Surf Forecast" y la economia.
 *
 * El resto de la lista anterior salio solo por el tope, no por ambiguo, y es
 * lo primero que vuelve si el corredor gasta menos: "granizo", "feminicidio",
 * "béisbol" (Toros y Águilas lo cubren en el titular), "fiscalía",
 * "secuestro", "extorsión", "maratón", "robbery", "senator", entre otros. La
 * lista entera esta en el historial de git.
 *
 * Y entraron las que el titular usa y la lista no tenia: "huracán" y
 * "hurricane" (Polo era toda la nota del clima esa semana), "balean", "sin
 * vida" y "desaparecida" (la familia desaparecida entre Tijuana y Rosarito),
 * "Zonkeys" y "Águilas", "Xolos" en ingles.
 */
export const TERMINOS_RUBRO: Record<Rubro, Record<Idioma, readonly string[]>> = {
  clima: {
    es: ["clima", "lluvia", "lluvias", "tormenta", "huracán", "calor", "frente frío"],
    en: ["weather", "rain", "storm", "hurricane", "flooding", "wildfire", "Santa Ana winds"],
  },
  seguridad: {
    es: ["detienen", "homicidio", "asesinan", "balacera", "balean", "desaparecida", "sin vida"],
    en: ["shooting", "homicide", "arrested", "police", "sheriff", "crime", "border patrol"],
  },
  deportes: {
    es: ["Xolos", "Liga MX", "Toros", "futbol", "boxeo", "Águilas", "Zonkeys"],
    en: ["Padres", "San Diego FC", "Aztecs", "soccer", "baseball", "sports", "Xolos"],
  },
  politica: {
    es: ["alcalde", "alcaldesa", "gobernadora", "gobernador", "cabildo", "diputado", "Morena",
      "elecciones"],
    en: ["mayor", "city council", "governor", "election", "Congress", "supervisors", "ballot"],
  },
  economia: {
    es: ["empresas", "inversión", "empleo", "maquiladora", "aranceles", "precios", "turismo",
      "economía"],
    en: ["business", "economy", "tariffs", "jobs", "housing", "trade", "tourism", "prices"],
  },
};

/**
 * La parte del rubro de la consulta: `(a OR "b c" ...)`. Entre parentesis
 * para que el OR no se coma los terminos de lugar que componerConsulta pega
 * despues; las frases de varias palabras, entre comillas.
 */
export function consultaDeTerminos(rubro: Rubro, idioma: Idioma): string {
  return `(${TERMINOS_RUBRO[rubro][idioma].map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(" OR ")})`;
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Palabra completa, plegada, con plural opcional: "diputados" nombra
 * "diputado" y "Balean" nombra "balean", pero "Cruz Azul" no nombra "Liga MX"
 * aunque la nota hable de la liga. Sin el plural, la reja cortaria lo que
 * Google si empata.
 */
const PATRONES = new Map<string, RegExp>();

function patronDe(termino: string): RegExp {
  let p = PATRONES.get(termino);
  if (p === undefined) {
    p = new RegExp(`(?<![a-z0-9])${escapar(plegar(termino))}(?:e?s)?(?![a-z0-9])`);
    PATRONES.set(termino, p);
  }
  return p;
}

/**
 * Si el titular (ya sin el sufijo del medio, que es como llega de rss.ts)
 * nombra un termino del rubro en el idioma de la edicion que lo devolvio.
 * Solo resta: ver el docstring del modulo.
 */
export function nombraRubro(titulo: string, rubro: Rubro, idioma: Idioma): boolean {
  const t = plegar(titulo);
  return TERMINOS_RUBRO[rubro][idioma].some((termino) => patronDe(termino).test(t));
}
