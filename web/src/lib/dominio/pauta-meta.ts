import type { AnuncioMeta, PerfilMeta, RangoMeta, TotalMeta } from "@/lib/datos/tipos";
import { plegar } from "./formato";

export interface FiltrosMeta {
  texto: string;
  estado: string;
  desde: string;
  hasta: string;
  plataforma: string;
  formato: string;
  region: string;
  orden: string;
}

export function filtrarAnunciosMeta(anuncios: AnuncioMeta[], filtros: FiltrosMeta): AnuncioMeta[] {
  const texto = plegar(filtros.texto);
  return anuncios.filter((a) =>
    (!texto || plegar(`${a.texto ?? ""} ${a.pagador ?? ""} ${a.id}`).includes(texto)) &&
    (filtros.estado === "todos" || a.estado === filtros.estado) &&
    (!filtros.desde || (a.hasta ? a.hasta >= filtros.desde : a.estado === "activo" || !!a.desde && a.desde >= filtros.desde)) &&
    (!filtros.hasta || !!a.desde && a.desde <= filtros.hasta) &&
    (filtros.plataforma === "todas" || a.plataformas.includes(filtros.plataforma)) &&
    (filtros.formato === "todos" || a.formato === filtros.formato) &&
    (filtros.region === "todas" || a.regiones.includes(filtros.region))
  ).toSorted((a, b) => filtros.orden === "antiguos"
    ? (a.desde ?? "9999").localeCompare(b.desde ?? "9999") || a.id.localeCompare(b.id)
    : (b.desde ?? "").localeCompare(a.desde ?? "") || b.id.localeCompare(a.id));
}

/** Los limites abiertos siguen abiertos; no se reemplazan por cero. */
export function sumarRangosMeta(anuncios: AnuncioMeta[]): { moneda: string; rango: RangoMeta; anuncios: number }[] {
  const monedas = new Map<string, { minimo: number | null; maximo: number | null; anuncios: number }>();
  for (const anuncio of anuncios) {
    if (!anuncio.moneda || !anuncio.gasto || anuncio.grupo) continue;
    const previo = monedas.get(anuncio.moneda) ?? { minimo: 0, maximo: 0, anuncios: 0 };
    monedas.set(anuncio.moneda, {
      minimo: previo.minimo === null || anuncio.gasto.minimo === null ? null : previo.minimo + anuncio.gasto.minimo,
      maximo: previo.maximo === null || anuncio.gasto.maximo === null ? null : previo.maximo + anuncio.gasto.maximo,
      anuncios: previo.anuncios + 1,
    });
  }
  return [...monedas].toSorted(([a], [b]) => a.localeCompare(b)).map(([moneda, { anuncios: n, ...rango }]) => ({ moneda, rango, anuncios: n }));
}

export function claveTotalMeta(total: TotalMeta): string | null {
  return total.moneda ? [total.desde, total.hasta, total.geografia, total.moneda].join("|") : null;
}

export function gruposComparablesMeta(perfiles: PerfilMeta[]) {
  const grupos = new Map<string, { total: TotalMeta; filas: { perfil: PerfilMeta; total: TotalMeta }[] }>();
  for (const perfil of perfiles) {
    const vistos = new Set<string>();
    for (const total of perfil.totales) {
      const clave = claveTotalMeta(total);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      const grupo = grupos.get(clave) ?? { total, filas: [] };
      grupo.filas.push({ perfil, total });
      grupos.set(clave, grupo);
    }
  }
  return [...grupos].filter(([, g]) => g.filas.length >= 2)
    .map(([clave, grupo]) => ({ clave, ...grupo, filas: grupo.filas.toSorted((a, b) => b.total.importe - a.total.importe || a.perfil.id.localeCompare(b.perfil.id)) }));
}

export function filtrarPerfilesMeta(perfiles: PerfilMeta[], texto: string, partido: string, ambito: string) {
  const busqueda = plegar(texto);
  return perfiles.filter((p) => (!busqueda || plegar(`${p.nombre} ${p.cargo}`).includes(busqueda)) &&
    (!partido || p.partido === partido) && (!ambito || p.ambito === ambito));
}
