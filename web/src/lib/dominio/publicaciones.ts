import type { Destacado, DocRedes } from "../datos/tipos";

/** La vista visual conserva la selección de la lista: primero el límite por
 * plataforma y zona, después el orden de lectura. Mezclar antes del límite
 * dejaría a la plataforma más numerosa ocupar toda la selección. */
export type RedVisual = "instagram" | "tiktok";
export interface PublicacionVisual {
  post: Destacado;
  red: RedVisual;
  fuente: string;
  clave: string;
  url: string | null;
}

export function compararPublicaciones(a: Destacado, b: Destacado): number {
  return b.fecha.localeCompare(a.fecha) ||
    (b.publicado ?? "").localeCompare(a.publicado ?? "") ||
    b.likes - a.likes || a.url.localeCompare(b.url);
}

/**
 * Las tres cubetas de la vista de región. En una página de zona no aplican:
 * ahí el filtro es la zona y ya.
 *
 * Existen porque `internacional` y `nacional` no tienen página propia y antes
 * caían en la misma lista que el corredor, ordenada por likes. Un video del
 * mundo trae órdenes de magnitud más likes que uno de Tecate, así que sin
 * separarlos el corredor desaparecía de su propia portada de redes.
 */
export type CubetaRegion = "corredor" | "mexico" | "mundo";

const EN_CUBETA: Record<CubetaRegion, (zona: string) => boolean> = {
  corredor: (z) => z !== "nacional" && z !== "internacional",
  mexico: (z) => z === "nacional",
  mundo: (z) => z === "internacional",
};

/** Solo las cubetas que TIENEN filas. Una pastilla que siempre sale vacía no
 *  informa de un hueco, estorba: Instagram, por ejemplo, nunca tiene `mundo`
 *  porque la zona de una cuenta es su sede declarada. */
export function cubetasConFilas(datos: DocRedes): CubetaRegion[] {
  const posts = datos.destacados ?? [];
  return (["corredor", "mexico", "mundo"] as const).filter((c) =>
    posts.some((post) => EN_CUBETA[c](post.zona)));
}

export function seleccionarPublicaciones(
  datos: DocRedes,
  zona: string | null,
  cubeta: CubetaRegion = "corredor",
): Destacado[] {
  const posts = datos.destacados ?? [];
  const dentro = zona === null ? EN_CUBETA[cubeta] : (z: string) => z === zona;
  return posts.filter((post) => dentro(post.zona)).slice(0, datos.destacados_maximo ?? 15);
}

/** Solo enlaces de publicaciones, nunca perfiles, redirecciones ni HTML. */
export function canonizarPublicacion(valor: string, red: RedVisual): string | null {
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (red === "instagram") {
      if (!["instagram.com", "www.instagram.com"].includes(url.hostname)) return null;
      const partes = /^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
      return partes ? `https://www.instagram.com/p/${partes[2]}/` : null;
    }
    if (!["tiktok.com", "www.tiktok.com"].includes(url.hostname)) return null;
    const partes = /^\/@([A-Za-z0-9_.]+)\/video\/(\d+)\/?$/.exec(url.pathname);
    return partes ? `https://www.tiktok.com/@${partes[1]!.toLowerCase()}/video/${partes[2]}` : null;
  } catch { return null; }
}

export function reunirPublicaciones(instagram: DocRedes | undefined, tiktok: DocRedes | undefined, zona: string | null, cubeta: CubetaRegion = "corredor"): PublicacionVisual[] {
  const salida: PublicacionVisual[] = [];
  const vistos = new Set<string>();
  for (const [red, datos] of [["instagram", instagram], ["tiktok", tiktok]] as const) {
    if (!datos) continue;
    const nombres = new Map(datos.cuentas?.map((cuenta) => [cuenta.cuenta, cuenta.nombre]));
    for (const post of seleccionarPublicaciones(datos, zona, cubeta)) {
      const url = canonizarPublicacion(post.url, red);
      const clave = `${red}:${url ?? post.url}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ post, red, clave, url,
        // Sin `creador` no se cae al id de la busqueda: `tk_mexicali_noticias`
        // es el mecanismo, y el mecanismo no se le ensena al lector. El
        // validador exige `creador` en TikTok, asi que esto no deberia pasar
        // nunca; con once busquedas la superficie es once veces mas grande.
        fuente: red === "tiktok"
          ? (post.creador === undefined ? "un creador" : `@${post.creador.replace(/^@/, "")}`)
          : nombres.get(post.cuenta) ?? post.cuenta });
    }
  }
  return salida.sort((a, b) => compararPublicaciones(a.post, b.post) || a.clave.localeCompare(b.clave));
}
