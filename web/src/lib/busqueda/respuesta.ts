/**
 * Como contestan /api/buscar y /api/actualidad. Un solo lugar para la
 * politica de cache y las dos cabeceras, para que las dos rutas no puedan
 * divergir en silencio.
 */

/** Nunca se cachea una respuesta con un feed caido, ni un 400. */
export const SIN_CACHE = "private, no-store";

/**
 * Cinco minutos en el CDN y diez de gracia. Solo cuando TODOS los feeds
 * respondieron: una falla pasajera de Google clavada cinco minutos en el CDN
 * es peor que la falla.
 */
export const CACHE_CDN = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export function json(cuerpo: unknown, status: number, cache: string): Response {
  return Response.json(cuerpo, {
    status,
    headers: {
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      // layout.tsx pone robots:noindex para las PAGINAS; un route handler no
      // queda cubierto por eso.
      "X-Robots-Tag": "noindex",
    },
  });
}
