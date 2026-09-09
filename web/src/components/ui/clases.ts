/**
 * Clases compartidas entre primitivas. Archivo `.ts`, sin JSX, a proposito.
 *
 * Vivia en `primitivas.tsx`, y un archivo que exporta componentes Y una
 * funcion de utilidad rompe el limite de Fast Refresh: al editar la funcion,
 * el recargador no puede sustituir solo el modulo y tira el estado del arbol.
 * En este tablero eso se siente al toque -- se pierde el filtro de tema, la
 * consulta del muro y las filas abiertas de cada grupo. Es molestia de
 * desarrollo, no de produccion, pero es gratis evitarla.
 */

/** Clases de una pastilla de filtro. Las comparten el boton (Chip) y el
 *  enlace (SelectorZona), que son la misma cosa con distinta semantica. */
export function clasesChip(activo: boolean): string {
  return [
    "inline-flex items-baseline gap-2 rounded-full px-4 py-2 text-cuerpo",
    "transition-colors duration-[var(--dur-cambio)] ease-firma",
    activo
      ? "bg-realce text-tinta-titulo"
      : "bg-vela text-tinta-prosa hover:bg-filo hover:text-tinta-titulo",
  ].join(" ");
}
