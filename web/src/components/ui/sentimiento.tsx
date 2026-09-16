import type { Sentimiento } from "@/lib/dominio/frases";
import { BarraSegmentada } from "./primitivas";

/**
 * La barra de sentimiento de los comentarios. Aqui el color ES el dato, asi
 * que van los tokens sube/baja y no la paleta de series.
 *
 * Tuvo una hermana, `BarraTono`, para el tono de la prensa: mismo dibujo, otro
 * vocabulario —adverso / favorable en vez de negativo / positivo— porque son
 * dos lecturas que nunca se suman. Se fue con el muro el 15 de septiembre de
 * 2026, que era la unica pantalla que mostraba tono.
 */

/* El neutral no es una tercera opinion, es la ausencia de las otras dos: por
   eso va en `inerte` y no en un color. */
const NEUTRAL = "var(--color-tinta-inerte)";

export function BarraSentimiento({ s, ariaLabel }: { s: Sentimiento; ariaLabel: string }) {
  return (
    <BarraSegmentada
      ariaLabel={ariaLabel}
      segmentos={[
        { etiqueta: "negativos", n: s.negativo, color: "var(--color-baja)" },
        { etiqueta: "neutrales", n: s.neutral, color: NEUTRAL },
        { etiqueta: "positivos", n: s.positivo, color: "var(--color-sube)" },
      ]}
    />
  );
}
