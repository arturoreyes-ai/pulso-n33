import { plegar } from "@/lib/dominio/formato";
import type { ResultadoExterno } from "./tipos";

/**
 * La reja de region para las filas en vivo.
 *
 * El caso, medido el 16 de septiembre de 2026 sobre el capitulo de seguridad
 * de San Felipe: de trece filas, SIETE eran chilenas o costarricenses
 * —publimetro.cl, latercera.com, g5noticias.cl, chicureohoy.cl, fmplus.cl,
 * canal9.cl, lateja.cr— y el capitulo de politica traia a la gobernadora de
 * Guanajuato, porque hay un San Felipe en Guanajuato y otro en Chile. El de
 * clima abria con «Clima en Guanajuato». Ensenada traia Coahuila, San Quintin
 * traia Michoacan y Tecate traia Puebla.
 *
 * La causa no es la consulta: la consulta de San Felipe YA lleva
 * `"San Felipe" "Baja California"` (lib/busqueda/ambito.ts) y aun asi devuelve
 * Chile. El buscador RELAJA los terminos entrecomillados cuando el match
 * estricto da poco, y en una zona que produce una nota al dia da poco siempre.
 * Por eso no se arregla anclando mas la consulta, sino mirando lo que vuelve.
 *
 * Esto NO le pone zona a nadie. Las filas en vivo siguen sin zona, sin tono y
 * sin figura, y siguen sin contar en ninguna cifra (PRODUCT.md). Lo unico que
 * hace es DESCARTAR lo que demostrablemente no es de aqui, que es la misma
 * disciplina que pulso/zonas.py aplica a los pies de TikTok: fuera de la
 * region se cae, y lo que no nombra lugar se queda porque no se puede probar
 * que sea de fuera. Rellenar al reves —descartar por sospecha— seria peor.
 */

/** Paises hispanohablantes con dominio propio. Es la senal mas limpia que hay:
 *  un .cl no cubre Baja California ni San Diego, y no hay que adivinar. */
const CCTLD_FUERA = new Set([
  "cl", "ar", "pe", "ve", "ec", "bo", "uy", "py",
  "cr", "gt", "hn", "ni", "pa", "cu", "do", "es", "br",
]);

/** Un post no es una nota de un medio. El producto es titular, FUENTE y
 *  enlace, y «Facebook» como fuente no dice de quien es la nota. */
const SOCIALES = new Set([
  "facebook.com", "m.facebook.com", "web.facebook.com",
  "x.com", "twitter.com", "instagram.com", "tiktok.com",
  "youtube.com", "m.youtube.com", "reddit.com", "threads.net",
]);

/**
 * Lugares de AQUI. Si el titular nombra uno, se queda pase lo que pase: «Cierran
 * puertos en Sonora y Baja California» nombra los dos y es noticia de aqui.
 */
const DENTRO = [
  "baja california", "tijuana", "mexicali", "ensenada", "tecate", "rosarito",
  "san quintin", "san felipe", "san diego", "chula vista", "otay", "san ysidro",
  "la rumorosa", "valle de guadalupe", "maneadero", "el sauzal", "los algodones",
  "playas de tijuana", "zona rio", "imperial beach", "national city", "coronado",
  "camalu", "colonet", "vicente guerrero", "zona costa",
];

/**
 * Lugares de FUERA. Estados y ciudades de Mexico que no son esta region, mas
 * un par de instituciones que no existen aqui.
 *
 * Deliberadamente NO estan «guerrero» ni «hidalgo» sueltos: el primero es el
 * apellido de media republica y ademas es el nombre de una colonia de San
 * Quintin, y el segundo es una calle en cada pueblo. Se usan sus formas largas.
 * «leon» si esta, y ahi queda el riesgo escrito: un apellido Leon en un titular
 * sin lugar de aqui se descartaria.
 */
const FUERA = [
  "baja california sur", "sonora", "sinaloa", "chihuahua", "coahuila", "durango",
  "nayarit", "jalisco", "colima", "michoacan", "guanajuato", "queretaro",
  "puebla", "tlaxcala", "morelos", "oaxaca", "chiapas", "tabasco", "veracruz",
  "campeche", "yucatan", "quintana roo", "san luis potosi", "zacatecas",
  "aguascalientes", "nuevo leon", "tamaulipas", "estado de mexico",
  "ciudad de mexico", "cdmx",
  "hermosillo", "culiacan", "mazatlan", "monterrey", "guadalajara", "leon",
  "morelia", "cancun", "merida", "torreon", "saltillo", "ciudad juarez",
  "acapulco", "toluca", "tepic", "tuxtla", "villahermosa", "chetumal",
  "los cabos", "cabo san lucas", "dolores hidalgo", "irapuato", "celaya",
  // Carabineros es la policia de Chile. En un titular mexicano no aparece.
  "carabineros",
  // «Presunta falla mecanica provoca incendio de trailer en Apodaca, NL», de
  // N+, paso la reja el 25 de septiembre de 2026 en la busqueda de hechos de
  // impacto del corredor: «NL» no es «nuevo leon». «nl» suelto no entra: es
  // la Liga Nacional de los Padres («NL West»).
  "apodaca",
];

const contiene = (texto: string, marcas: readonly string[]): boolean =>
  marcas.some((m) => new RegExp(`(^|[^a-z0-9])${m}([^a-z0-9]|$)`).test(texto));

export const esRedSocial = (dominio: string): boolean =>
  SOCIALES.has(dominio.replace(/^www\./, "").toLowerCase());

export const esDominioExtranjero = (dominio: string): boolean => {
  const tld = dominio.toLowerCase().split(".").at(-1) ?? "";
  return CCTLD_FUERA.has(tld);
};

/**
 * Si esta fila NO es de esta region. Tres motivos, en orden de certeza: la
 * fuente es una red social, el medio es de otro pais, o el titular nombra un
 * lugar de fuera y ninguno de aqui.
 */
export function esDeFuera(r: ResultadoExterno): boolean {
  if (esRedSocial(r.dominio)) return true;
  // El PAIS DEL MEDIO manda sobre el nombre del lugar, y este es el caso que
  // lo obliga: «Detienen a dos adolescentes por crimen de hombre que
  // encumbraba volantines en Colina: presunto autor huyo hasta San Felipe»,
  // de publimetro.cl. Nombra San Felipe, pero el de Chile. Un medio chileno
  // que escribe «San Felipe» no esta hablando de Baja California, y el
  // toponimo compartido es justo lo que hace que la reja lo necesite.
  //
  // El costo: un medio espanol o argentino que SI cubra la region se cae con
  // ellos. Se acepta porque estos capitulos son de un lugar concreto, y lo de
  // fuera tiene sus propias secciones —Mexico e Internacional— que no se
  // filtran.
  if (esDominioExtranjero(r.dominio)) return true;
  const titulo = plegar(r.titulo);
  // «Baja California Sur» lleva dentro el nombre de nuestro estado y es otro:
  // se tapa SOLO para buscar los lugares de aqui. Si se tapara tambien para
  // los de fuera, dejaria de reconocerse a si mismo y pasaria la reja.
  const sinBcs = titulo.replace(/baja california sur/g, " bcs ");
  if (contiene(sinBcs, DENTRO)) return false;
  return contiene(titulo, FUERA);
}

/**
 * Si el titular nombra un lugar de aqui: de Mexico, dentro o fuera de la
 * region, o del corredor, San Diego incluido. Lo usa la reja de Mexico
 * (extranjero.ts), para la que «Culiacan» o «Tijuana» es tan de aqui como
 * «Mexico». Carabineros esta en FUERA y no es un lugar.
 */
const DE_AQUI = [...DENTRO, ...FUERA.filter((t) => t !== "carabineros")];
export const nombraLugarDeAqui = (titulo: string): boolean => contiene(plegar(titulo), DE_AQUI);

/** Las filas que se quedan. El orden no se toca: es el del buscador, y ese
 *  orden ES la senal (ver lib/busqueda/actualidad.ts). */
export const soloDeLaRegion = (filas: readonly ResultadoExterno[]): ResultadoExterno[] =>
  filas.filter((r) => !esDeFuera(r));
