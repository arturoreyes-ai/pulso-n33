import type { Nota } from "@/lib/datos/tipos";
import { compararZona, zonasDeNota } from "@/lib/dominio/zonas";

export interface Grupo {
  zona: string;
  notas: Nota[];
}

export interface Indice {
  /** Ordenados por ZONAS_PRODUCTO y luego alfabeticamente. */
  grupos: Grupo[];
  /** Para que elegir una zona sea una busqueda O(1) y no un recalculo. */
  porZona: Map<string, Grupo>;
  /** Para las insignias de los chips. */
  conteo: Map<string, number>;
  /** Notas distintas mostradas: una nota en dos zonas cuenta UNA vez aqui. */
  visibles: number;
  /** Descartadas por alcance 'fuera'. Se reporta, no se esconde. */
  fuera: number;
  /** Sin lugar de la region en el titular. Igual: se reporta, no se esconde. */
  nacionales: number;
}

export const INDICE_VACIO: Indice = {
  grupos: [],
  porZona: new Map(),
  conteo: new Map(),
  visibles: 0,
  fuera: 0,
  nacionales: 0,
};

/**
 * Una sola pasada que filtra, agrupa por zona y acumula conteos.
 *
 * La idea que lo hace rapido: NO se filtra por zona. Se agrupan TODAS las
 * zonas en la misma pasada, y elegir una zona despues es buscar en un Map en
 * vez de recorrer las 669 notas otra vez. Tocar un chip pasa a ser O(1).
 */
export function indexar(notas: readonly Nota[]): Indice {
  const porZona = new Map<string, Grupo>();
  const conteo = new Map<string, number>();
  let visibles = 0;
  let fuera = 0;
  let nacionales = 0;

  for (let i = 0; i < notas.length; i++) {
    const n = notas[i];
    if (n === undefined) continue;

    // Tiene que ir primero. Sin esto, un tablero de Baja California se llena
    // de Hermosillo: el feed de El Imparcial trae al grupo entero. Es un bug
    // real que ya paso, no una precaucion teorica.
    if (n.alcance === "fuera") {
      fuera++;
      continue;
    }

    // Las nacionales salen del muro POR AHORA. Son notas cuyo titular no
    // nombra ningun lugar de la region, y formaban el grupo mas grande del
    // tablero regional —249 de 828— sin decir nada de una zona, que es
    // justo lo que la seccion promete. `zonasDeNota` sigue devolviendo
    // 'nacional' y el estado de la corrida sigue contandolas: esto es un
    // corte de la VISTA, no una perdida de dato.
    if (n.zonas.length === 0) {
      nacionales++;
      continue;
    }

    const zs = zonasDeNota(n);
    for (let j = 0; j < zs.length; j++) {
      const z = zs[j];
      if (z === undefined) continue;
      conteo.set(z, (conteo.get(z) ?? 0) + 1);
      let g = porZona.get(z);
      if (g === undefined) {
        g = { zona: z, notas: [] };
        porZona.set(z, g);
      }
      g.notas.push(n);
    }
    visibles++;
  }

  // sort() en sitio esta bien aqui: es un arreglo que esta funcion acaba de
  // crear. La regla de toSorted() aplica al otro extremo, sobre los datos que
  // SWR comparte entre consumidores.
  const grupos = Array.from(porZona.values()).sort((a, b) =>
    compararZona(a.zona, b.zona),
  );

  return { grupos, porZona, conteo, visibles, fuera, nacionales };
}
