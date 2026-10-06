import { Heart as Corazon } from "@phosphor-icons/react/dist/ssr";

import { numero, pluralizar } from "@/lib/dominio/formato";

/**
 * Los likes de UN comentario, con su corazon, en la columna izquierda de una
 * lista de comentarios: cuando la lista abre por los mas votados, el orden se
 * lee de un vistazo, como en un foro.
 *
 * Nacio en /seguimiento el 29 de septiembre de 2026 y se extrajo aqui el 1 de
 * octubre, cuando /redes los volvio a pintar (paneles/comentarios-publicacion.tsx):
 * el mismo dato no puede verse distinto en dos pantallas.
 *
 * Un 0 no se pinta: los actores devuelven 0 tambien cuando no traen el campo,
 * y pintarlo diria «nadie» donde puede ser «no se sabe». Medido el 1 de octubre
 * de 2026 sobre los archivos de texto: traen likes el 87% de los comentarios de
 * TikTok, el 68% de Instagram y el 17% de Facebook.
 */
export function LikesComentario({ n, nombre: [uno, varios] }: { n: number; nombre: readonly [string, string] }) {
  if (n <= 0) return <span aria-hidden />;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-tinta-dato">
      <Corazon size={12} weight="fill" aria-hidden className="shrink-0 text-tinta-meta" />
      {numero(n)}
      <span className="sr-only"> {pluralizar(n, uno, varios)}</span>
    </span>
  );
}

/** La rejilla de un comentario con su columna de likes. Solo cuando alguno
 *  de la lista los trae: sin ninguno, la columna seria un margen vacio. */
export const CON_COLUMNA_LIKES = "grid grid-cols-[2.75rem_minmax(0,1fr)] items-baseline gap-x-3 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-4";
