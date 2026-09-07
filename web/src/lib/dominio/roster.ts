import type { DocRoster, Figura } from "@/lib/datos/tipos";

export function indexarRoster(doc: DocRoster | undefined): Map<string, Figura> {
  const m = new Map<string, Figura>();
  if (doc === undefined) return m;
  for (const f of doc.figuras) m.set(f.id, f);
  return m;
}

/**
 * El nombre corto para un chip. El primer alias es la forma con la que se
 * conoce a la persona ("Marina del Pilar", "Abdiel Gutiérrez"), que es mas
 * util en una etiqueta que el nombre completo con los dos apellidos.
 */
export function nombreCorto(id: string, roster: Map<string, Figura>): string {
  const f = roster.get(id);
  if (f === undefined) return id;
  return f.alias[0] ?? f.nombre;
}

export function cargoDe(id: string, roster: Map<string, Figura>): string | null {
  return roster.get(id)?.cargo ?? null;
}
