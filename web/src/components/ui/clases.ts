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
 *  enlace (SelectorZona), que son la misma cosa con distinta semantica.
 *
 *  `py-3` y no `py-2` por el BLANCO DE TOQUE. Con `py-2` la pastilla medía 37px
 *  de alto (21 de linea + 16 de relleno), y estas son el control principal de
 *  varias paginas en movil: la faceta de red, la zona, el alcance, la
 *  delegacion y el rubro. 45px las pone por encima del minimo comodo de 44, que
 *  es el mismo que ya cumple el boton de /garitas.
 *
 *  Se sube el relleno y no un `min-h`: con `items-baseline` —que es lo que
 *  alinea la etiqueta con su cuenta, dos tamanos distintos— una altura minima
 *  deja el texto arriba y el aire debajo.
 *
 *  Al pulsar cede a 0.97: en el telefono no hay hover, y sin esto un toque no
 *  respondia hasta que llegaba lo que abria. */
export function clasesChip(activo: boolean): string {
  return [
    "inline-flex items-baseline gap-2 rounded-full px-4 py-3 text-cuerpo",
    "transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out active:scale-[0.97]",
    activo
      ? "bg-realce text-tinta-titulo"
      : "bg-vela text-tinta-prosa hover:bg-filo hover:text-tinta-titulo",
  ].join(" ");
}

/** La misma pastilla para un BOTON CON ICONO: icono y texto centrados.
 *
 *  `clasesChip` alinea por la linea base, que es lo correcto para una
 *  etiqueta con su cuenta en otro tamano, y lo incorrecto para un icono: un
 *  SVG no tiene linea base, asi que se apoya en la del texto y queda mas alto
 *  que el centro de la letra. El cliente lo vio el 23 de septiembre de 2026 en
 *  «Ver comentarios» y «Ver las 8 publicaciones» de la ficha de un termino. */
export function clasesBoton(activo: boolean): string {
  return clasesChip(activo).replace("items-baseline", "items-center justify-center");
}

/** Una insignia: la etiqueta chica junto a un dato («inglés», «comunicado»,
 *  un tema, el tono de un comentario, el estado de /garitas). Una sola forma
 *  desde el 23 de septiembre de 2026; habia cuatro, con rellenos de `px-2
 *  py-px` a `px-3 py-1`, y dos cadenas identicas copiadas.
 *
 *  - `dato`: borde y fondo tenues, texto de dato. Lo normal.
 *  - `tenue`: borde, sin fondo, texto meta. Un estado (el de /garitas).
 *  - `punteada`: borde punteado, sin fondo. Lo que NO es prensa (comunicado).
 *  - `tono`: solo la forma; el color lo pone quien la usa (borde y texto). */
export function clasesInsignia(variante: "dato" | "tenue" | "punteada" | "tono" = "dato"): string {
  const base = "inline-flex items-center gap-2 rounded-full border px-2 py-px text-meta whitespace-nowrap";
  if (variante === "punteada") return `${base} border-dashed border-filo text-tinta-meta`;
  if (variante === "tenue") return `${base} border-filo text-tinta-meta`;
  if (variante === "tono") return base;
  return `${base} border-filo bg-vela text-tinta-dato`;
}
