import { SLUG_DE_ZONA, type Slug, type ZonaRuta } from "./zonas";

/**
 * El eje de VISTA: que se esta mirando. El otro eje del producto —el LUGAR—
 * vive en zonas.ts, y juntos forman la rejilla de rutas.
 *
 * Antes esto no existia. Las ocho vistas eran ANCLAS dentro de una sola
 * pagina (#muro, #redes, #tiktok, #panorama, #indicadores, #temas,
 * #conversacion, #cobertura) y la pildora flotante llevaba diez pastillas
 * para recorrerlas. Tres costos concretos, no de gusto:
 *
 *  1. Ninguna vista se podia compartir por enlace: "mirate las redes de
 *     Ensenada" era "abre /ensenada y baja como seis pantallas".
 *  2. `aria-current` no tenia nada que marcar, porque un ancla no es una
 *     pagina. La nav no sabia decir donde estabas.
 *  3. Todo el JSON del tablero se pedia en cada carga, sin importar que
 *     mirabas.
 *
 * Son DOS secciones y la portada, no ocho. Lo que se fusiono, y por que:
 *
 *  - Instagram, TikTok, YouTube y X son `redes`. Son la MISMA pregunta —de que
 *    se habla— en cuatro plataformas, y darle a TikTok su propia entrada en la
 *    nav lo convertia en un tema del producto en vez de en una fuente.
 *    Dentro de la pagina se eligen con un selector, como una faceta.
 *
 * La PORTADA dejo de ser el muro el 15 de septiembre de 2026, a peticion del
 * cliente: es el recorrido de titulares en vivo, «En Tendencia», que hasta ese
 * dia era la suelta /ahora. Las dos superficies decian lo mismo con dos
 * disenos —la portada abria con una seccion titulada «En Tendencia» y /ahora
 * recorria esos mismos titulares a pantalla completa—, y esa duplicacion es lo
 * que se elimino.
 *
 * El muro vivio ese mismo dia como una tercera seccion, `prensa`, y el cliente
 * la quito al verla: el producto es el recorrido. Con ella se fueron el muro,
 * los temas, «Hoy en cifras», el tono en pantalla y la faceta de delegaciones.
 * El pipeline los sigue calculando —el historial de git ES el archivo—, asi
 * que volver a mostrarlos es trabajo de interfaz y no de datos. La BUSQUEDA no
 * se fue con ellos: vive en la portada, dentro del lector.
 *
 * `cobertura` fue la tercera seccion hasta el 14 de septiembre de 2026. Era la pagina
 * «Que se cubre y que no»: la matriz de zonas por fuente, el estado de cada
 * feed y los huecos declarados. Se quito a peticion del cliente.
 *
 * Lo que rotula los huecos NO estaba ahi y sigue en pie: cada panel dibuja su
 * propio `Hueco` («sin cuenta de Instagram con sede en Tecate», «X no publica
 * lista para Ensenada»), el pie del sitio dice que la cobertura es desigual
 * por zona, y el resumen de la portada publica cuantas fuentes respondieron.
 * La regla 4 de PRODUCT.md vive en esos tres sitios, no en una pagina.
 */
export const SECCIONES = ["redes", "indicadores"] as const;

export type Seccion = (typeof SECCIONES)[number];

/** `null` es la PORTADA, que no tiene segmento propio: es `/` o `/<zona>`. */
export type Vista = Seccion | null;

/** Como se llama cada vista en la nav y en el titulo de su pagina. */
const NOMBRE = {
  portada: "En Tendencia",
  redes: "Redes",
  indicadores: "Indicadores",
} as const satisfies Record<Seccion | "portada", string>;

export const nombreVista = (v: Vista): string => NOMBRE[v ?? "portada"];

/**
 * Como se titula una seccion cuando habla de un lugar. La preposicion no es
 * la misma en las dos —se esta EN una red y se tienen indicadores DE un
 * municipio— asi que se escribe una vez y la usan el h1 de la pagina y el
 * <title> de la pestana. Separadas, una decia "Indicadores de Ensenada" en la
 * pagina y "Indicadores en Ensenada" en la pestana.
 */
const TITULO: Record<Seccion, (nombre: string) => string> = {
  redes: (n) => `Redes en ${n}`,
  indicadores: (n) => `Indicadores de ${n}`,
};

export const tituloSeccion = (s: Seccion, nombre: string | null): string =>
  nombre === null ? NOMBRE[s] : TITULO[s](nombre);

/** El orden de la nav: la portada primero, y luego las dos secciones. */
export const VISTAS: readonly Vista[] = [null, ...SECCIONES];

/**
 * Paginas que estan en la nav pero NO en la rejilla lugar x vista.
 *
 * Garitas mide esperas del corredor, no de un municipio. Gasto electoral
 * mezcla gubernatura, senadurias, distritos y ayuntamientos: forzarlo al
 * selector geografico acreditaria toda candidatura a una sola zona. Ninguna
 * de las dos admite `/tecate/<pagina>`.
 *
 * `ahora` fue una suelta del 14 al 15 de septiembre de 2026, y el argumento de
 * entonces era que el lugar no podia estar en la ruta porque solo describe el
 * primer capitulo. Al volverse la PORTADA deja de aplicar: `/tecate` ya
 * significaba «el tablero de Tecate», asi que significar «empieza el recorrido
 * en Tecate» no agrega un eje, usa el que ya estaba. Los capitulos que no son
 * de ningun municipio —Mexico e Internacional— tampoco ocupan segmento: son
 * una faceta en `?e=`, como el alcance del muro es `?a=`.
 *
 * Se declara aqui, y no como un `<li>` a mano en la pildora, para que la nav
 * siga teniendo una sola lista de la que salen sus elementos.
 */
export const SUELTAS = [
  { id: "garitas", ruta: "/garitas", nombre: "Garitas" },
  { id: "gasto-electoral", ruta: "/gasto-electoral", nombre: "Gasto electoral" },
] as const;

export type PaginaSuelta = (typeof SUELTAS)[number]["id"];

const SECCION_DE_SLUG = new Map<string, Seccion>(SECCIONES.map((s) => [s, s]));

export const seccionDeSlug = (s: string): Seccion | null => SECCION_DE_SLUG.get(s) ?? null;

/**
 * La ruta de una celda de la rejilla lugar x vista. Es la unica que construye
 * rutas del tablero: cambiar de zona conserva la vista y cambiar de vista
 * conserva la zona, que es lo que hace que los dos ejes sean independientes.
 */
export function ruta(zona: ZonaRuta | null, vista: Vista): string {
  const lugar = zona === null ? "" : `/${SLUG_DE_ZONA[zona]}`;
  const seccion = vista === null ? "" : `/${vista}`;
  return `${lugar}${seccion}` || "/";
}

/**
 * Guardia de compilacion, no un comentario.
 *
 * `app/redes/` y `app/[zona]/` son hermanos: Next resuelve primero el
 * segmento literal, asi que `/redes` es la seccion y nunca una zona. Eso
 * funciona mientras ningun nombre de seccion sea tambien un slug de zona. El
 * dia que alguien agregue una seccion llamada `tecate`, la ruta de ese
 * municipio desaparece EN SILENCIO —sigue construyendo bien, solo sirve la
 * otra pagina—, que es el peor modo de falla posible.
 *
 * Con esto deja de compilar, y `pnpm tipos` corre en CI.
 */
/**
 * Todo segmento literal de primer nivel que compite con `[zona]`: las tres
 * secciones, las sueltas de la nav, la puerta (/entrar, ver proxy.ts) y
 * /ahora, que ya no es una pagina pero sobrevive como redirect permanente a la
 * portada y por lo tanto sigue ocupando el segmento. Una zona llamada "entrar"
 * dejaria a esa zona sin pagina y a la puerta intacta, el mismo fallo mudo.
 */
type SegmentoLiteral = Seccion | PaginaSuelta | "entrar" | "ahora";

export const RUTAS_SIN_COLISION: [Extract<SegmentoLiteral, Slug>] extends [never]
  ? true
  : "Una pagina literal no puede llamarse igual que un slug de zona: /<slug> ya es una zona" = true;
