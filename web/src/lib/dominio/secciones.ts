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
 * Son TRES secciones y la portada, no ocho. Lo que se fusiono, y por que:
 *
 *  - Instagram, TikTok y YouTube son `redes`. Son la MISMA pregunta —que se
 *    comenta— en tres plataformas, y darle a TikTok su propia entrada en la
 *    nav lo convertia en un tema del producto en vez de en una fuente.
 *    Dentro de la pagina se eligen con un selector, como una faceta.
 *  - `temas` y `panorama` bajan a la portada. Temas FILTRA el muro que tiene
 *    encima (ver lib/muro/filtro-tema.ts): en otra pagina el filtro se queda
 *    sin nada que filtrar. Panorama es el resumen de la corrida y se lee
 *    junto a los titulares que resume.
 */
export const SECCIONES = ["redes", "indicadores", "cobertura"] as const;

export type Seccion = (typeof SECCIONES)[number];

/** `null` es la PORTADA, que no tiene segmento propio: es `/` o `/<zona>`. */
export type Vista = Seccion | null;

/** Como se llama cada vista en la nav y en el titulo de su pagina. */
const NOMBRE = {
  portada: "Titulares",
  redes: "Redes",
  indicadores: "Indicadores",
  cobertura: "Cobertura",
} as const satisfies Record<Seccion | "portada", string>;

export const nombreVista = (v: Vista): string => NOMBRE[v ?? "portada"];

/**
 * Como se titula una seccion cuando habla de un lugar. La preposicion no es
 * la misma en las tres —se esta EN una red y se tiene cobertura DE un
 * municipio— asi que se escribe una vez y la usan el h1 de la pagina y el
 * <title> de la pestana. Separadas, una decia "Cobertura de Ensenada" en la
 * pagina y "Cobertura en Ensenada" en la pestana.
 */
const TITULO: Record<Seccion, (nombre: string) => string> = {
  redes: (n) => `Redes en ${n}`,
  indicadores: (n) => `Indicadores de ${n}`,
  cobertura: (n) => `Cobertura de ${n}`,
};

export const tituloSeccion = (s: Seccion, nombre: string | null): string =>
  nombre === null ? NOMBRE[s] : TITULO[s](nombre);

/** El orden de la nav: la portada primero, y luego las tres secciones. */
export const VISTAS: readonly Vista[] = [null, ...SECCIONES];

/**
 * Paginas que estan en la nav pero NO en la rejilla lugar x vista.
 *
 * Garitas es la unica hasta hoy, y no es una omision: mide las esperas que
 * CBP reporta en San Ysidro y Otay Mesa, que son del CORREDOR y no de un
 * municipio. `/tecate/garitas` no querria decir nada. Tampoco comparte el
 * sistema visual —tiene su propio `main`, su propia hoja de estilos y su
 * propia navegacion de regreso—, asi que la pildora no se pinta ahi y por eso
 * ninguna de estas puede salir marcada como actual.
 *
 * Se declara aqui, y no como un `<li>` a mano en la pildora, para que la nav
 * siga teniendo una sola lista de la que salen sus elementos.
 */
export const SUELTAS = [{ ruta: "/garitas", nombre: "Garitas" }] as const;

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
 * secciones, las sueltas de la nav y la puerta (/entrar, ver proxy.ts). Una
 * zona llamada "entrar" dejaria a esa zona sin pagina y a la puerta intacta,
 * el mismo fallo mudo.
 */
type SegmentoLiteral = Seccion | "garitas" | "entrar";

export const RUTAS_SIN_COLISION: [Extract<SegmentoLiteral, Slug>] extends [never]
  ? true
  : "Una pagina literal no puede llamarse igual que un slug de zona: /<slug> ya es una zona" = true;
