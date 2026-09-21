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
 * Lo que si suele haber es la MISMA nota en el corpus, llegada por el feed del
 * propio medio con su enlace de verdad. Ese es el camino rapido. El cruce es
 * por titular plegado Y dominio: dos medios pueden sindicar el mismo titular
 * y leer el primero seria leer otra nota con una atribucion falsa.
 *
 * Sin empate se conserva el token para resolverlo bajo demanda, solo despues
 * de confirmar Analizar. NUNCA se toma el enlace de otro medio.
 */

import type { Nota } from "@/lib/datos/tipos";
import { dominioDeUrl, normalizarDominio } from "@/lib/analisis/dominio";
import { plegar } from "@/lib/dominio/formato";
import type { ReferenciaAnalisis, ResultadoExterno } from "./tipos";

// Vive en tipos.ts desde que viaja por el cable; se reexporta porque las
// tarjetas y analisis-titular.tsx lo importan de aqui.
export type { ReferenciaAnalisis };

/** El anfitrion del buscador. Un enlace suyo no lleva a la nota. */
const OPACO = "news.google.com";

export function esEnlaceOpaco(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === OPACO;
  } catch {
    return false;
  }
}

const claveDeEnlace = (titulo: string, dominio: string): string =>
  `${plegar(titulo)}\n${dominio}`;

export function indiceDeEnlaces(notas: readonly Nota[]): ReadonlyMap<string, string> {
  const indice = new Map<string, string>();
  for (const n of notas) {
    if (!n.url || esEnlaceOpaco(n.url)) continue;
    const dominio = dominioDeUrl(n.url);
    const clave = dominio === null ? "" : claveDeEnlace(n.titulo, dominio);
    if (plegar(n.titulo) === "" || clave === "" || indice.has(clave)) continue;
    indice.set(clave, n.url);
  }
  return indice;
}

/**
 * Lo que recibe Analizar: primero el enlace del medio que ya conoce el
 * archivo y, si la nota acaba de aparecer, el token opaco para resolverlo
 * solo despues de la confirmacion. El token nunca se abre como si fuera la
 * nota; esa distincion vive en lib/analisis/resolver-enlace.ts.
 *
 * La llama el SERVIDOR (lib/busqueda/archivo.ts) y el resultado viaja en la
 * fila. Antes la llamaba el navegador con el corpus entero en la mano.
 */
export function enlaceParaAnalisis(
  r: ResultadoExterno,
  indice: ReadonlyMap<string, string>,
): ReferenciaAnalisis | null {
  const dominio = normalizarDominio(r.dominio);
  if (dominio === null) return null;
  if (!esEnlaceOpaco(r.url)) {
    return dominioDeUrl(r.url) === dominio ? { url: r.url, dominio } : null;
  }
  const directo = indice.get(claveDeEnlace(r.titulo, dominio));
  return { url: directo ?? r.url, dominio };
}
