import type { Delegacion, Nota } from "@/lib/datos/tipos";

/**
 * Las delegaciones de Tijuana, la unica zona con subdivision. Espejo de
 * DELEGACIONES_TIJUANA en pulso/__init__.py y en el mismo orden de pantalla.
 *
 * Es una FACETA DEL MURO, no una pagina: la delegacion sale solo del titular
 * (~8% de las notas de Tijuana nombra una) y ningun indicador oficial baja de
 * municipio. Por eso vive en un parametro de consulta (?d=) y no en la ruta.
 */
export const DELEGACIONES = [
  "Centro",
  "Cerro Colorado",
  "La Mesa",
  "La Presa A.L.R.",
  "La Presa Este",
  "Otay Centenario",
  "Playas de Tijuana",
  "San Antonio de los Buenos",
  "Sánchez Taboada",
] as const satisfies readonly Delegacion[];

/** El cajon de las notas de Tijuana cuyo titular no nombra delegacion. Es la
 *  mayoria, y se muestra con nombre en vez de esconderse. */
export const SIN_DELEGACION = "sin";

export type FiltroDelegacion = Delegacion | typeof SIN_DELEGACION;

export const PARAM_DELEGACION = "d";

export const SLUG_DE_DELEGACION = {
  Centro: "centro",
  "Cerro Colorado": "cerro-colorado",
  "La Mesa": "la-mesa",
  "La Presa A.L.R.": "la-presa",
  "La Presa Este": "la-presa-este",
  "Otay Centenario": "otay",
  "Playas de Tijuana": "playas",
  "San Antonio de los Buenos": "sab",
  "Sánchez Taboada": "sanchez-taboada",
} as const satisfies Record<Delegacion, string>;

const DELEGACION_DE_SLUG = new Map<string, FiltroDelegacion>([
  ...DELEGACIONES.map((d): [string, FiltroDelegacion] => [SLUG_DE_DELEGACION[d], d]),
  [SIN_DELEGACION, SIN_DELEGACION],
]);

/** Un slug desconocido es "sin filtro", nunca un error: la pagina es estatica. */
export const delegacionDeSlug = (s: string | null): FiltroDelegacion | null =>
  s === null ? null : (DELEGACION_DE_SLUG.get(s) ?? null);

export const slugDeFiltro = (f: FiltroDelegacion): string =>
  f === SIN_DELEGACION ? SIN_DELEGACION : SLUG_DE_DELEGACION[f];

/** Como se le dice en un chip. 'SAB' y 'Playas' son los nombres que usa la
 *  ciudad; el nombre completo va en el title. */
export const NOMBRE_CORTO_DELEGACION: Record<Delegacion, string> = {
  Centro: "Centro",
  "Cerro Colorado": "Cerro Colorado",
  "La Mesa": "La Mesa",
  "La Presa A.L.R.": "La Presa A.L.R.",
  "La Presa Este": "La Presa Este",
  "Otay Centenario": "Otay Centenario",
  "Playas de Tijuana": "Playas",
  "San Antonio de los Buenos": "SAB",
  "Sánchez Taboada": "Sánchez Taboada",
};

export const nombreDeFiltro = (f: FiltroDelegacion): string =>
  f === SIN_DELEGACION ? "Tijuana sin delegación identificada" : NOMBRE_CORTO_DELEGACION[f];

/** Los cortes anteriores al campo no lo traen: ausente equivale a vacio. */
export const delegacionesDeNota = (n: Nota): readonly Delegacion[] => n.delegaciones ?? [];

export function tieneDelegacion(n: Nota, f: FiltroDelegacion): boolean {
  const ds = delegacionesDeNota(n);
  return f === SIN_DELEGACION ? ds.length === 0 : ds.includes(f);
}

/**
 * Conteo por delegacion en una pasada. Las nueve claves van SIEMPRE, con cero
 * si hace falta: un cero rotulado es informacion, una delegacion ausente de
 * la fila parece un olvido. Igual que ZONAS_PRODUCTO.
 */
export function contarDelegaciones(notas: readonly Nota[]): Map<FiltroDelegacion, number> {
  const conteo = new Map<FiltroDelegacion, number>();
  for (const d of DELEGACIONES) conteo.set(d, 0);
  conteo.set(SIN_DELEGACION, 0);
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i];
    if (n === undefined) continue;
    const ds = delegacionesDeNota(n);
    if (ds.length === 0) {
      conteo.set(SIN_DELEGACION, (conteo.get(SIN_DELEGACION) ?? 0) + 1);
      continue;
    }
    for (const d of ds) conteo.set(d, (conteo.get(d) ?? 0) + 1);
  }
  return conteo;
}
