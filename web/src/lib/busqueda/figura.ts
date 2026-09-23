import type { DocRoster } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";

/**
 * Si un termino buscado nombra a una figura del roster. Puro.
 *
 * Es la regla 5 de PRODUCT.md hecha comprobacion en la busqueda en vivo: el
 * tono lee frases, no posturas —«alcalde inaugura obra» sale positivo por el
 * verbo—, y juntar el tono de lo que se dice con el nombre de una persona
 * fabrica una afirmacion que el modelo no sostiene. El cliente abrio una
 * excepcion el 18 de septiembre de 2026 para los TRES terminos en seguimiento,
 * incluida una persona, y dejo escrito que el cruce con las figuras del roster
 * sigue prohibido. Una busqueda libre podria reabrirlo con solo escribir
 * «Marina del Pilar»; esto lo cierra.
 *
 * Empareja por palabras enteras, en los dos sentidos para el nombre y sus
 * alias («Burgueño» dentro de «Ismael Burgueño» y al reves), y en uno solo
 * para el cargo: «alcalde de Tijuana» en el termino si, pero «Tijuana» a secas
 * no es una figura aunque el cargo la nombre, o ninguna busqueda de la ciudad
 * tendria tono. Se equivoca hacia no mostrar: quitarle el tono a una busqueda
 * de «Cota» cuesta una cifra, y mostrarselo a una de «Román Cota» rompe la
 * regla.
 */

const palabras = (s: string): string => ` ${plegar(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

const contiene = (pajar: string, aguja: string): boolean =>
  aguja.trim() !== "" && pajar.includes(aguja);

export function nombraFigura(termino: string, roster: DocRoster | null): boolean {
  if (roster === null) return false;
  const t = palabras(termino);
  if (t.trim() === "") return false;
  return roster.figuras.some((f) => {
    const nombres = [f.nombre, ...f.alias].map(palabras);
    const cargos = f.alias_cargo.map(palabras);
    return nombres.some((n) => contiene(t, n) || contiene(n, t)) || cargos.some((c) => contiene(t, c));
  });
}
