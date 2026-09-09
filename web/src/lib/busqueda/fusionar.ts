/**
 * Fusion de los dos locales y supresion de lo que ya esta en el muro. Puro.
 *
 * El cruce va por TITULAR PLEGADO y no por URL: el <link> de Google es un
 * redirector opaco y distinto para la misma nota en cada locale, asi que las
 * URLs no empatan nunca.
 */

import { plegar } from "@/lib/dominio/formato";
import type { ResultadoExterno } from "./tipos";

/**
 * Intercala los locales por turnos, en vez de concatenarlos.
 *
 * Concatenar parecia bastar y no bastaba: "tijuana sewage" devuelve 40 en
 * espanol y 40 en ingles, y al cortar la lista al tope se quedaban las 40
 * espanolas y NINGUNA en ingles. La busqueda bilingue dejaba de serlo justo
 * en las consultas con mucha cobertura, que son las que mas importan.
 *
 * Por turnos los dos locales sobreviven al corte, y un locale con pocos
 * resultados no desperdicia su parte: cuando se acaba, el otro sigue.
 *
 * Una consulta de nombre propio devuelve el mismo articulo en los dos
 * locales. Gana el primero en salir y el espanol va primero en cada vuelta,
 * asi que gana el espanol: el tablero esta en espanol.
 */
export function fusionarLocales(
  lotes: readonly (readonly ResultadoExterno[])[],
): ResultadoExterno[] {
  const vistos = new Set<string>();
  const salida: ResultadoExterno[] = [];
  const largo = Math.max(0, ...lotes.map((l) => l.length));
  for (let i = 0; i < largo; i++) {
    for (const lote of lotes) {
      const r = lote[i];
      if (r === undefined) continue;
      const clave = plegar(r.titulo);
      if (clave === "" || vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push(r);
    }
  }
  return salida;
}

export interface Suprimidas {
  visibles: ResultadoExterno[];
  suprimidas: number;
}

/**
 * Quita lo que el muro ya trae.
 *
 * `titulosCorpus` tiene que venir de TODA la base, no de las filas visibles:
 * si se cruzara contra lo visible, una nota escondida por el filtro de zona o
 * de delegacion reapareceria aqui abajo con otro sombrero.
 *
 * El conteo se devuelve y se dice. Igual que `fuera`, `nacionales` y
 * `descartados`, lo que no se muestra se reporta.
 */
export function suprimirConocidas(
  externos: readonly ResultadoExterno[],
  titulosCorpus: ReadonlySet<string>,
): Suprimidas {
  const visibles: ResultadoExterno[] = [];
  for (const r of externos) {
    if (titulosCorpus.has(plegar(r.titulo))) continue;
    visibles.push(r);
  }
  return { visibles, suprimidas: externos.length - visibles.length };
}
