/**
 * Frases que comparten el muro y el panel de actualidad para decir que paso
 * con los feeds en vivo. Puras: solo arman cadenas.
 */

import type { Idioma } from "./tipos";

/**
 * Cual de las dos ediciones fallo, cuando fallo exactamente una. Con las dos
 * caidas el aviso es otro (`fallo`), y con ninguna no hay nada que decir.
 *
 * Decia cual de las dos consultas se cayo —«La búsqueda en inglés falló; sólo
 * respondió la de español»— y con eso le contaba al lector que por dentro son
 * dos peticiones. Lo que necesita saber es que le falta, no quien fallo. El
 * parametro `que` sobraba en cuanto la frase dejo de nombrar la peticion.
 */
export function textoCaidos(caidos: readonly Idioma[]): string | null {
  if (caidos.length !== 1) return null;
  return caidos[0] === "en"
    ? "Faltan los titulares en inglés."
    : "Faltan los titulares en español.";
}

/** "en español", "en inglés" o "en español e inglés", segun que ediciones
 *  contestaron. Vacio si no se pidio ninguna. */
export function textoIdiomas(idiomas: readonly Idioma[]): string {
  const es = idiomas.includes("es");
  const en = idiomas.includes("en");
  if (es && en) return "en español e inglés";
  if (es) return "en español";
  if (en) return "en inglés";
  return "";
}
