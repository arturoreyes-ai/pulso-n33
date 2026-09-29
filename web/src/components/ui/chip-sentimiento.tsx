import type { ComentarioPublicado } from "@/lib/datos/tipos";
import { clasesInsignia } from "./clases";

/**
 * El tono de UN comentario, como insignia. Vivia dentro de
 * paneles/comentarios-publicacion.tsx y se saco el 28 de septiembre de 2026
 * para el seguimiento de publicaciones, que pinta la misma insignia debajo de
 * cada comentario. El `title` es la salvedad de la regla 5 dicha donde se
 * lee: el modelo mide como suena la frase, no la postura hacia nadie.
 */
export function ChipSentimiento({ s }: { s: ComentarioPublicado["sentimiento"] }) {
  if (s === null) return null;
  const clase =
    s === "negativo"
      ? "border-baja/30 text-baja/80"
      : s === "positivo"
        ? "border-sube/30 text-sube/80"
        : "border-filo text-tinta-meta";
  return (
    <span
      title="Cómo suena la frase. No mide la postura hacia una persona."
      className={`${clasesInsignia("tono")} ${clase}`}
    >
      {s}
    </span>
  );
}
