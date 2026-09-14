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

export function seleccionarPublicaciones(datos: DocRedes, zona: string | null): Destacado[] {
  const posts = datos.destacados ?? [];
  return (zona === null ? posts : posts.filter((post) => post.zona === zona))
    .slice(0, datos.destacados_maximo ?? 15);
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

export function reunirPublicaciones(instagram: DocRedes | undefined, tiktok: DocRedes | undefined, zona: string | null): PublicacionVisual[] {
  const salida: PublicacionVisual[] = [];
  const vistos = new Set<string>();
  for (const [red, datos] of [["instagram", instagram], ["tiktok", tiktok]] as const) {
    if (!datos) continue;
    const nombres = new Map(datos.cuentas?.map((cuenta) => [cuenta.cuenta, cuenta.nombre]));
    for (const post of seleccionarPublicaciones(datos, zona)) {
      const url = canonizarPublicacion(post.url, red);
      const clave = `${red}:${url ?? post.url}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ post, red, clave, url,
        fuente: red === "tiktok" ? `@${(post.creador ?? post.cuenta).replace(/^@/, "")}` : nombres.get(post.cuenta) ?? post.cuenta });
    }
  }
  return salida.sort((a, b) => compararPublicaciones(a.post, b.post) || a.clave.localeCompare(b.clave));
}
