import { dominioDeUrl } from "@/lib/analisis/dominio";
import { urlSegura } from "@/lib/analisis/url";
import { plegar } from "@/lib/dominio/formato";
import type { Robotero } from "./buscadores";
import { AGENTE } from "./google-noticias";
import { decodificar, imagenAbsoluta } from "./og-imagen";

/**
 * El enlace y la foto de una fila en vivo, preguntados AL PROPIO MEDIO. Solo
 * servidor.
 *
 * EL CASO: el 23 de septiembre de 2026 ninguna tarjeta de En Tendencia tenia
 * foto. Las treinta del primer tramo salian con placa y /api/imagen contestaba
 * `null` a todas, porque la unica via era resolver el token de Google, y Google
 * contestaba a esa IP con su pagina de «trafico inusual» (302 a
 * google.com/sorry). No es un fallo raro: resolver un token son dos peticiones
 * a Google por tarjeta y el bloqueo llega a las ~20 seguidas (memoria del 17
 * de septiembre). Y un bloqueo NO se esquiva: detras hay un CAPTCHA.
 *
 * Asi que primero se le pregunta al medio. Casi todo el corredor publica en
 * WordPress, y WordPress contesta `/wp-json/wp/v2/posts?search=` con el enlace
 * de la nota y su imagen destacada en UNA peticion, sin abrir la nota ni pasar
 * por Google. Medido ese dia con titulares reales del recorrido: Zeta,
 * inewsource, FOX 5, el Union-Tribune y el TecNM la devuelven; El Imparcial
 * (Arc), CBS 8 y 10News no son WordPress y siguen por Google.
 *
 * Las reglas son las de la busqueda por medio (buscadores.ts), por las mismas
 * razones:
 *  - robots.txt con nuestro agente, y uno ilegible es PROHIBIDO.
 *  - Solo vale una nota cuyo titulo plegado es EL MISMO que el de la fila (o
 *    uno empieza por el otro, porque el buscador recorta los largos). El
 *    buscador de WordPress empareja contra el cuerpo; tomar el primer
 *    resultado pondria la foto de otra nota.
 *  - El enlace es https y del dominio que la fila anuncia.
 *  - La imagen pasa por los mismos limites de forma que un `og:image`
 *    (og-imagen.ts): https, sin espacios, con tope de largo.
 *
 * Nada se guarda. De la respuesta se leen tres campos —enlace, titulo e
 * imagen— y lo demas muere con la peticion; `_fields` pide solo esos para que
 * el medio ni siquiera mande el extracto.
 */

const MS_LIMITE = 6_000;
const MAX_BYTES = 256_000;
/** Palabras del titular que se mandan al buscador. WordPress hace un AND de
 *  LIKE por palabra: con todas, una comilla curva o un signo mal codificado
 *  basta para no encontrar nada. */
const PALABRAS_CONSULTA = 8;
/** Por debajo de esto un prefijo comun no dice que sea la misma nota. */
const PREFIJO_MINIMO = 30;

const CAMPOS = "link,title,jetpack_featured_media_url,yoast_head_json.og_image";

/** Plegado y sin puntuacion: «Meet the Airbnb activist…» llega de Google con
 *  comilla curva y del medio como `&#8217;`. */
function normal(s: string): string {
  return plegar(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function consultaDe(titulo: string): string {
  return normal(titulo)
    .split(" ")
    .filter((p) => p.length >= 3)
    .slice(0, PALABRAS_CONSULTA)
    .join(" ");
}

export function mismoTitulo(a: string, b: string): boolean {
  const x = normal(a);
  const y = normal(b);
  if (x === "" || y === "") return false;
  if (x === y) return true;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  return corto.length >= PREFIJO_MINIMO && largo.startsWith(corto);
}

const sinEtiquetas = (s: string): string => s.replace(/<[^>]*>/g, "");

interface EntradaWp {
  link?: unknown;
  title?: { rendered?: unknown };
  jetpack_featured_media_url?: unknown;
  yoast_head_json?: { og_image?: { url?: unknown }[] };
}

export type EnlaceMedio =
  /** La nota encontrada; `imagen` null si el medio no declara destacada. */
  | { tipo: "nota"; url: URL; imagen: string | null }
  /** El sitio contesto y la nota no esta, o robots lo prohibe. */
  | { tipo: "nada" }
  /** El sitio no habla WordPress: no volver a preguntar en un rato. */
  | { tipo: "no_wordpress" };

export async function buscarEnWordpress(
  titulo: string,
  dominio: string,
  solicitar: typeof fetch,
  robots: Robotero,
): Promise<EnlaceMedio> {
  const q = consultaDe(titulo);
  if (q === "") return { tipo: "nada" };
  const url = `https://${dominio}/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=5&_fields=${CAMPOS}`;
  if (!(await robots(url))) return { tipo: "nada" };

  let entradas: unknown;
  try {
    const r = await solicitar(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/json" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(MS_LIMITE),
    });
    const tipo = (r.headers.get("content-type") ?? "").toLowerCase();
    // 404, una portada en HTML (Arc, Brightspot): no es WordPress.
    if (!r.ok || !tipo.includes("json")) return r.status >= 500 ? { tipo: "nada" } : { tipo: "no_wordpress" };
    entradas = JSON.parse((await r.text()).slice(0, MAX_BYTES));
  } catch {
    return { tipo: "nada" };
  }
  if (!Array.isArray(entradas)) return { tipo: "no_wordpress" };

  for (const e of entradas as EntradaWp[]) {
    const rendered = e.title?.rendered;
    if (typeof rendered !== "string" || typeof e.link !== "string") continue;
    if (!mismoTitulo(decodificar(sinEtiquetas(rendered)), titulo)) continue;
    const enlace = urlSegura(e.link);
    if (enlace === null || dominioDeUrl(enlace) !== dominio) continue;
    const candidatas = [e.jetpack_featured_media_url, e.yoast_head_json?.og_image?.[0]?.url];
    let imagen: string | null = null;
    for (const c of candidatas) {
      if (typeof c !== "string") continue;
      imagen = imagenAbsoluta(decodificar(c).trim(), enlace);
      if (imagen !== null) break;
    }
    return { tipo: "nota", url: enlace, imagen };
  }
  return { tipo: "nada" };
}
