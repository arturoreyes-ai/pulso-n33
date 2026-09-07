/**
 * Constantes y ayudas de los indicadores oficiales que comparten el resumen
 * de zona y el panel de indicadores.
 */

/** Los ZIP de la franja fronteriza primero: son los que comparan con Tijuana. */
export const ZIPS_FRONTERA = ["92173", "92154", "91910", "91911", "92101", "92118"] as const;

/** La SHF llavea sus series municipales como "Baja California · Tijuana". */
export const claveShf = (zona: string) => `Baja California · ${zona}`;

/** "2026-2T" se lee "2T 2026"; cualquier otra forma se deja como viene. */
export function periodoLegible(p: string | null | undefined): string {
  if (p === null || p === undefined) return "sin periodo";
  const m = /^(\d{4})-(\d)T$/.exec(p);
  return m === null ? p : `${m[2]}T ${m[1]}`;
}

/** El ultimo mes con dato y el anterior, de una serie enero..ultimo. */
export function ultimoYPrevio(porMes: readonly number[]): {
  ultimo: number | undefined;
  previo: number | undefined;
  indice: number;
} {
  const n = porMes.length;
  return { ultimo: porMes[n - 1], previo: porMes[n - 2], indice: n - 1 };
}
