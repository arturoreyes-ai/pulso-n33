import type { Tema } from "@/lib/datos/tipos";
import { numero, pluralizar } from "./formato";

/**
 * Todas las frases del tablero salen de aqui. Funciones puras, sin React, para
 * que se puedan leer de corrido y probar sin montar nada.
 *
 * Tres reglas que vienen de docs/PLAN.md y se imponen aqui, no se sugieren:
 *
 *  1. Debajo de UMBRAL_PORCENTAJE se dicen conteos, nunca porcentajes. Con
 *     doce comentarios un porcentaje se mueve con dos.
 *  2. Prensa y comentarios no se suman en un numero. `fraseBrecha` los pone
 *     lado a lado y en palabras, nada mas.
 *  3. Un hueco se dice con palabras ("sin dato", "fuera de muestra"), nunca
 *     con un cero ni con un guion.
 */

export const UMBRAL_PORCENTAJE = 30;

export interface Sentimiento {
  positivo: number;
  negativo: number;
  neutral: number;
}

export interface Tono {
  favorable: number;
  neutral: number;
  adversa: number;
}

export const totalSentimiento = (s: Sentimiento) => s.positivo + s.negativo + s.neutral;
export const totalTono = (t: Tono) => t.favorable + t.neutral + t.adversa;

export function porcentaje(n: number, base: number): string {
  return base <= 0 ? "0%" : `${Math.round((n / base) * 100)}%`;
}

// ------------------------------------------------------------ sentimiento

export function fraseSentimiento(
  s: Sentimiento | undefined,
  sujeto: string,
  dias = 30,
  umbral = UMBRAL_PORCENTAJE,
): string {
  const total = s === undefined ? 0 : totalSentimiento(s);
  if (s === undefined || total === 0) {
    return `Sin comentarios clasificados sobre ${sujeto} en los últimos ${dias} días.`;
  }
  if (total === 1) {
    const cual = s.negativo === 1 ? "negativo" : s.positivo === 1 ? "positivo" : "neutral";
    return `Un solo comentario sobre ${sujeto} en ${dias} días, y fue ${cual}.`;
  }
  if (total < umbral) {
    return (
      `De ${numero(total)} comentarios sobre ${sujeto}, ` +
      `${numero(s.negativo)} ${s.negativo === 1 ? "fue" : "fueron"} ` +
      `${pluralizar(s.negativo, "negativo", "negativos")}, ` +
      `${numero(s.neutral)} ${pluralizar(s.neutral, "neutral", "neutrales")} y ` +
      `${numero(s.positivo)} ${pluralizar(s.positivo, "positivo", "positivos")}.`
    );
  }
  return (
    `De ${numero(total)} comentarios sobre ${sujeto}, ` +
    `${porcentaje(s.negativo, total)} fueron negativos, ` +
    `${porcentaje(s.neutral, total)} neutrales y ${porcentaje(s.positivo, total)} positivos.`
  );
}

/**
 * Los comentarios de UN post, siempre en conteos. No tiene umbral a proposito:
 * con ~30 comentarios por post un porcentaje se mueve con uno, y el validador
 * de redes.json rechaza porcentajes en cualquier nivel.
 *
 * El denominador es el total del post, no lo que se alcanzo a leer. La frase
 * decia «5 de 7 comentarios leidos; 3 son opinion y suenan: …» y contaba tres
 * cosas que el lector no necesita —cuantos se leyeron, cuantos traian opinion,
 * cuantos quedaron sin clasificar—, todas contabilidad de la cosecha. Lo que
 * si necesita es que las cifras cuadren con los «7 comentarios» que la fila ya
 * muestra arriba, y por eso la razon se queda: el numero antes de los dos
 * puntos es `clasificados`, que SIEMPRE suma el desglose. Sin el, el lector ve
 * tres numeros que dan 3 debajo de un 7 y nada que lo explique.
 */
export function fraseComentariosPost(
  s: Sentimiento & { sin_clasificar: number },
  cosechados: number,
  comentarios: number,
  opinion: number,
): string {
  // El conteo de la plataforma puede ir atrasado respecto de lo que se leyo.
  const total = Math.max(cosechados, comentarios);
  if (total === 0) return "Sin comentarios en este post.";
  const de = `De ${numero(total)} ${pluralizar(total, "comentario", "comentarios")}`;
  if (cosechados === 0 || opinion === 0) return `${de}, ninguno con sentimiento.`;
  const clasificados = totalSentimiento(s);
  if (clasificados === 0) {
    return `${de}, ${numero(opinion)} con sentimiento; sin desglose.`;
  }
  return (
    `${de}, ${numero(clasificados)} ${pluralizar(clasificados, "suena", "suenan")}: ` +
    `${numero(s.negativo)} ${pluralizar(s.negativo, "negativo", "negativos")}, ` +
    `${numero(s.neutral)} ${pluralizar(s.neutral, "neutral", "neutrales")} y ` +
    `${numero(s.positivo)} ${pluralizar(s.positivo, "positivo", "positivos")}.`
  );
}

export function fraseTono(
  t: Tono | undefined,
  sujeto: string,
  dias: number,
  umbral = UMBRAL_PORCENTAJE,
): string {
  const total = t === undefined ? 0 : totalTono(t);
  if (t === undefined || total === 0) {
    return `Sin clasificación de tono para los titulares sobre ${sujeto}.`;
  }
  if (total === 1) {
    const cual = t.adversa === 1 ? "adverso" : t.favorable === 1 ? "favorable" : "neutral";
    return `Un solo titular sobre ${sujeto} en ${dias} días, con tono ${cual}.`;
  }
  if (total < umbral) {
    return (
      `De ${numero(total)} titulares sobre ${sujeto} en ${dias} días, ` +
      `${numero(t.neutral)} ${t.neutral === 1 ? "tuvo" : "tuvieron"} tono neutral, ` +
      `${numero(t.adversa)} adverso y ${numero(t.favorable)} favorable.`
    );
  }
  return (
    `De ${numero(total)} titulares sobre ${sujeto} en ${dias} días, ` +
    `${porcentaje(t.neutral, total)} tuvieron tono neutral, ` +
    `${porcentaje(t.adversa, total)} adverso y ${porcentaje(t.favorable, total)} favorable.`
  );
}

function predominio<K extends string>(pares: readonly (readonly [K, number])[]): K | null {
  const orden = pares.toSorted((a, b) => b[1] - a[1]);
  const primero = orden[0];
  const segundo = orden[1];
  if (primero === undefined) return null;
  if (segundo !== undefined && segundo[1] === primero[1]) return null;
  return primero[0];
}

/**
 * La brecha entre lo que escribe la prensa y lo que comenta la gente. Solo
 * cuando los dos lados tienen volumen, y siempre en palabras: nunca un
 * numero que los mezcle (docs/PLAN.md seccion 6, regla 3).
 */
export function fraseBrecha(
  t: Tono | undefined,
  s: Sentimiento | undefined,
  sujeto: string,
  umbral = UMBRAL_PORCENTAJE,
): string | null {
  if (t === undefined || s === undefined) return null;
  if (totalTono(t) < umbral || totalSentimiento(s) < umbral) return null;
  const prensa = predominio([
    ["neutral", t.neutral],
    ["adverso", t.adversa],
    ["favorable", t.favorable],
  ] as const);
  const gente = predominio([
    ["neutral", s.neutral],
    ["negativo", s.negativo],
    ["positivo", s.positivo],
  ] as const);
  const p = prensa === null ? "sin un tono predominante" : `en tono mayormente ${prensa}`;
  const g = gente === null ? "sin un sentimiento predominante" : `en tono mayormente ${gente}`;
  return `La prensa escribe sobre ${sujeto} ${p}; quien comenta lo hace ${g}.`;
}

// ------------------------------------------------------------------ prensa

export function frasePrensa(n: number, dias: number, nombre: string): string {
  if (n === 0) return `Ninguna nota mencionó ${nombre} en los últimos ${dias} días.`;
  if (n === 1) return `Una sola nota mencionó ${nombre} en los últimos ${dias} días.`;
  return `${numero(n)} notas mencionaron ${nombre} en los últimos ${dias} días.`;
}

export function fraseTemaPrincipal(t: Tema | undefined, nombre: string, dias: number): string {
  if (t === undefined) {
    return `Ningún tema alcanzó el mínimo de notas sobre ${nombre} en ${dias} días.`;
  }
  return `El tema con más notas sobre ${nombre} fue «${t.termino}», con ${numero(t.n)} ${pluralizar(t.n, "nota", "notas")} en ${dias} días.`;
}
