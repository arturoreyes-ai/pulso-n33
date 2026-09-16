/**
 * El enlace del PROPIO MEDIO para una fila en vivo, por titular plegado. Puro.
 *
 * El caso que lo motiva, medido el 15 de septiembre de 2026: la `url` de una
 * fila en vivo es un token opaco del buscador, y ese token NO redirige por
 * HTTP. Pedirlo desde el servidor devuelve 580 KB de la pagina del buscador
 * —que resuelve el destino con JavaScript— y ni un byte de la nota. Esto se
 * descubrio probando la lectura automatica: abria, no encontraba texto y
 * rotulaba «no hay suficiente texto en la nota», que era cierto y engañoso.
 *
 * Lo que si hay es la MISMA nota en el corpus, llegada por el feed del propio
 * medio con su enlace de verdad: 91% del corpus lo trae. El cruce es por
 * titular plegado, la misma llave y la misma razon que imagenes.ts —las URLs
 * no empatan nunca— y se salta las notas del corpus que tambien llegaron por
 * el buscador, porque esas cargan el mismo token que no sirve.
 *
 * Sin empate no hay enlace, y NUNCA se toma el de otra nota: leer un articulo
 * distinto del que dice el titular es peor que no leer ninguno.
 */

import type { Nota } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";
import type { ResultadoExterno } from "./tipos";

/** El anfitrion del buscador. Un enlace suyo no lleva a la nota. */
const OPACO = "news.google.com";

export const esEnlaceOpaco = (url: string): boolean => url.includes(OPACO);

export function indiceDeEnlaces(notas: readonly Nota[]): ReadonlyMap<string, string> {
  const indice = new Map<string, string>();
  for (const n of notas) {
    if (!n.url || esEnlaceOpaco(n.url)) continue;
    const clave = plegar(n.titulo);
    if (clave === "" || indice.has(clave)) continue;
    indice.set(clave, n.url);
  }
  return indice;
}

/**
 * El enlace legible de una fila: el suyo si ya es del medio, y si no el del
 * corpus. `null` cuando no hay ninguno, que es lo que dice «esta nota no se
 * puede abrir desde aqui».
 */
export function enlaceDelMedio(r: ResultadoExterno, indice: ReadonlyMap<string, string>): string | null {
  if (!esEnlaceOpaco(r.url)) return r.url;
  return indice.get(plegar(r.titulo)) ?? null;
}
