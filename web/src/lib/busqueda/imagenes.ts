/**
 * Miniaturas para las filas en vivo, por titular plegado. Puro.
 *
 * Una fila en vivo (ResultadoExterno) nunca trae imagen: el RSS de Google no
 * la publica y su redirector no se sigue. Lo que si puede haber es la MISMA
 * nota en el corpus, llegada por el feed del propio medio con su miniatura.
 * El cruce es por titular plegado, la misma llave que usa `enlaces.ts` y por
 * la misma razon: las URLs no empatan nunca (redirector contra enlace del
 * medio).
 *
 * Gana la primera nota del archivo con ese titular e imagen, en su orden: el
 * indice es determinista para el mismo notas.json. Sin empate no hay imagen,
 * y nunca se toma la de otra nota: una foto ajena bajo un titular es una
 * afirmacion que nadie hizo.
 */

import type { Nota } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";
import type { ResultadoExterno } from "./tipos";

export function indiceDeImagenes(notas: readonly Nota[]): ReadonlyMap<string, string> {
  const indice = new Map<string, string>();
  for (const n of notas) {
    if (!n.imagen) continue;
    const clave = plegar(n.titulo);
    if (clave === "" || indice.has(clave)) continue;
    indice.set(clave, n.imagen);
  }
  return indice;
}

export function imagenPara(r: ResultadoExterno, indice: ReadonlyMap<string, string>): string | null {
  return indice.get(plegar(r.titulo)) ?? null;
}
