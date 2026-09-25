/**
 * La reja de Mexico para las filas en vivo: lo que demostrablemente es de
 * otro pais no entra al capitulo de un rubro con la entrada Mexico. Pura.
 *
 * EL CASO, 25 de septiembre de 2026: con la entrada Mexico, Espectaculos
 * abria con «Soda Stereo en Madrid: el concierto del holograma...» (EL PAIS)
 * y «Susan Sarandon es arrestada en Nueva York» (Univision). La busqueda de
 * un rubro para Mexico no lleva lugar (ambito.ts::componerConsulta: la
 * edicion la da el locale), y el locale no filtra el pais de la nota: filtra
 * el idioma y el mercado del lector.
 *
 * NO ES UNA LISTA NUEVA. Es la del gacetero del pipeline para redes
 * (pulso/zonas.py::EXTRANJERO, con sus exclusiones y sus dos reglas finas),
 * copiada, porque esa se midio sobre los 6,699 titulares de notas.json y esta
 * no tendria contra que medirse. scripts/probar-busqueda.cjs lee el .py y
 * compara las tres listas: si alguien corrige alla, la prueba de aqui lo dice.
 * Por lo mismo no se agrega aqui lo que falta alla (Milan, por ejemplo): se
 * agrega alla, con su medicion, y se copia.
 *
 * Solo resta, como region.ts: un titular que no nombra lugar se queda, porque
 * no se puede probar que sea de fuera. Y nombrar a Mexico, un lugar de Mexico
 * o una institucion federal gana siempre: «Bad Bunny anuncia gira por Mexico y
 * España» es de aqui.
 */

import { esDominioExtranjero, esRedSocial, nombraLugarDeAqui } from "./region";
import type { ResultadoExterno } from "./tipos";

/** pulso/zonas.py::EXTRANJERO. Plegado como alla: sin acentos y con la ñ
 *  como «nn», para que «la cañada» no sea Canada. */
export const EXTRANJERO: readonly string[] = [
  "canada", "guatemala", "belice", "honduras", "el salvador", "nicaragua",
  "costa rica", "panama", "cuba", "haiti", "republica dominicana",
  "puerto rico", "venezuela", "colombia", "ecuador", "peru",
  "bolivia", "argentina", "uruguay", "paraguay", "brasil",
  "centroamerica", "sudamerica", "caribe",
  "la habana", "managua", "tegucigalpa", "bogota",
  "caracas", "santiago de chile", "buenos aires", "montevideo",
  "sao paulo", "rio de janeiro", "toronto", "montreal", "vancouver",
  "los angeles", "nueva york", "new york", "washington", "texas", "florida",
  "arizona", "las vegas", "chicago", "miami", "houston", "dallas",
  "phoenix", "seattle", "boston", "atlanta", "nuevo mexico", "new mexico",
  "alaska", "hawai", "hawaii", "oregon", "utah", "illinois", "michigan",
  "georgia", "carolina del norte", "carolina del sur",
  "pensilvania", "nueva jersey", "new jersey", "luisiana", "louisiana",
  "hollywood",
  "europa", "union europea", "españa", "espana", "madrid", "barcelona", "francia",
  "paris", "alemania", "berlin", "italia", "roma", "vaticano",
  "reino unido", "inglaterra", "londres", "escocia", "irlanda", "portugal",
  "lisboa", "belgica", "bruselas", "paises bajos", "holanda", "suiza",
  "ginebra", "austria", "viena", "suecia", "noruega", "dinamarca",
  "finlandia", "polonia", "hungria", "rumania", "serbia",
  "croacia", "republica checa", "ucrania", "kiev", "kyiv", "rusia", "moscu",
  "bielorrusia", "turquia", "estambul", "groenlandia", "islandia",
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
  "ukraine", "russia", "moscow", "germany", "spain", "france", "italy",
  "england", "london", "britain", "ireland", "europe", "japan", "tokyo",
  "korea", "brazil", "philippines", "syria", "lebanon", "egypt", "iraq",
  "tehran", "jerusalem", "afghanistan",
];

/** pulso/zonas.py::_NO_ES_EXTRANJERO: se borran antes de buscar. */
export const NO_ES_EXTRANJERO: readonly string[] = [
  "chile en nogada", "chiles en nogada",
  "colonia roma", "roma norte", "roma sur", "farmacia roma", "farmacias roma",
  "bahia de los angeles",
  "air france", "france 24",
  "serie del caribe",
  "china poblana", "india maria", "cuba libre",
];

/** pulso/zonas.py::_MARCAS_MEXICO: Mexico sin escribir «Mexico». */
export const MARCAS_MEXICO: readonly string[] = [
  "sheinbaum", "lopez obrador", "amlo", "harfuch", "pemex", "cfe", "imss",
  "issste", "banxico", "inegi", "unam", "sedena", "semar", "conagua", "profeco",
  "aicm", "fgr",
];

const COMBINANTES = /[̀-ͯ]/g;
const plegar = (s: string) => s.toLowerCase().normalize("NFD").replace(COMBINANTES, "").replace(/\s+/g, " ").trim();
/** zonas.py::_plegar_n: la ñ se queda como «nn» antes de plegar. */
const plegarN = (s: string) => plegar(s.replace(/ñ/g, "nn").replace(/Ñ/g, "NN"));
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const frase = (cuerpo: string, banderas = "") => new RegExp(`(?<![a-z0-9])(?:${cuerpo})(?![a-z0-9])`, banderas);

const PATRONES = EXTRANJERO.map((t) => frase(escapar(plegarN(t))));
const QUITAR = NO_ES_EXTRANJERO.map((t) => frase(escapar(plegarN(t)), "g"));
/** «Iran a audiencia...»: el verbo, no el pais (zonas.py::_VERBO_IRAN). */
const VERBO_IRAN = /(?<![a-z0-9])(?:se|no|ya|que|lo|la|los|las|le|les|nos|me|te)\s+iran(?![a-z0-9])|(?<![a-z0-9])iran\s+al?\s/g;
const ALTERNATIVA = [...EXTRANJERO].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).map((t) => escapar(plegarN(t))).join("|");
/** «Argentina 1100 colonia Alamitos»: una calle con nombre de pais. */
const CALLE_EXTRANJERA = new RegExp(
  `(?<![a-z0-9])(?:calle|avenida|av|blvd|bulevar|boulevard|colonia|col|fraccionamiento|fracc|privada|callejon)\\.?\\s+(?:${ALTERNATIVA})(?![a-z0-9])`
  + `|(?<![a-z0-9])(?:${ALTERNATIVA})\\s+\\d{3,}`, "g");
const MEXICO = frase(`mexic(?:o|ano|ana|anos|anas|an|ans)|${MARCAS_MEXICO.map((t) => escapar(plegar(t))).join("|")}`);
const NO_ES_MEXICO = [frase("nuevo mexico", "g"), frase("new mexico", "g")];

/** Si el texto nombra un lugar del extranjero (zonas.py::extranjero_en). */
export function nombraExtranjero(texto: string): boolean {
  let t = plegarN(texto).replace(CALLE_EXTRANJERA, " ").replace(VERBO_IRAN, " ");
  for (const p of QUITAR) t = t.replace(p, " ");
  return PATRONES.some((p) => p.test(t));
}

/** Si nombra al pais o a una institucion federal (zonas.py::nombra_mexico). */
export function nombraMexico(texto: string): boolean {
  let t = plegar(texto);
  for (const p of NO_ES_MEXICO) t = t.replace(p, " ");
  return MEXICO.test(t);
}

/**
 * Si esta fila no es de Mexico: una red social como fuente, un medio con
 * dominio de otro pais hispanohablante, o un titular que nombra un lugar del
 * extranjero y ni a Mexico ni un lugar de aqui (region.ts::nombraLugarDeAqui).
 */
export function esDeOtroPais(r: ResultadoExterno): boolean {
  if (esRedSocial(r.dominio) || esDominioExtranjero(r.dominio)) return true;
  if (nombraMexico(r.titulo) || nombraLugarDeAqui(r.titulo)) return false;
  return nombraExtranjero(r.titulo);
}

/** Las filas que se quedan, en su orden: el del buscador. */
export const soloDeMexico = (filas: readonly ResultadoExterno[]): ResultadoExterno[] =>
  filas.filter((r) => !esDeOtroPais(r));
