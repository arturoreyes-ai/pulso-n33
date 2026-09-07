import type { DocNotas, Nota } from "@/lib/datos/tipos";
import type { Tono } from "./frases";

/**
 * Tono de los titulares, contado en el navegador a partir de `postura`.
 *
 * notas.json ya viene descargado, asi que no hace falta un campo nuevo en el
 * pipeline. Y se cuenta por ZONA de la nota, no del medio: una nota de la
 * garita suma en Tijuana y en San Diego.
 *
 * Es TONO de la frase, asignado por un modelo entrenado en texto de redes.
 * No es postura hacia una persona, y por eso nunca se cruza con figuras.
 */
export function tonoDe(notas: readonly Nota[]): Tono | undefined {
  const t: Tono = { favorable: 0, neutral: 0, adversa: 0 };
  let alguna = false;
  for (const n of notas) {
    const p = n.postura;
    if (p === null) continue;
    alguna = true;
    t[p.etiqueta] += 1;
  }
  return alguna ? t : undefined;
}

export function tonoPorZona(doc: DocNotas | undefined, zona: string | null): Tono | undefined {
  if (doc === undefined) return undefined;
  const notas = doc.notas.filter(
    (n) =>
      n.alcance !== "fuera" &&
      (zona === null || (n.zonas as readonly string[]).includes(zona)),
  );
  return tonoDe(notas);
}
