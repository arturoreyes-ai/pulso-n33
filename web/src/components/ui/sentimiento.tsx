import type { Sentimiento, Tono } from "@/lib/dominio/frases";
import { BarraSegmentada } from "./primitivas";

/**
 * Las dos barras de partes del tablero. Aqui el color ES el dato, asi que van
 * los tokens sube/baja y no la paleta de series. Negativo y adverso comparten
 * color a proposito: son la misma lectura en dos vocabularios que nunca se
 * suman.
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

export function BarraTono({ t, ariaLabel }: { t: Tono; ariaLabel: string }) {
  return (
    <BarraSegmentada
      ariaLabel={ariaLabel}
      segmentos={[
        { etiqueta: "adversos", n: t.adversa, color: "var(--color-baja)" },
        { etiqueta: "neutrales", n: t.neutral, color: NEUTRAL },
        { etiqueta: "favorables", n: t.favorable, color: "var(--color-sube)" },
      ]}
    />
  );
}
