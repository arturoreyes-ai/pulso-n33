/**
 * Hasta donde llega una busqueda. Puro: solo arma cadenas.
 *
 * Cuatro peldanos que se abren hacia afuera. 'zona' solo existe estando en la
 * pagina de una zona, y ahi es el que viene puesto; en el indice el primero es
 * 'region'.
 *
 * El ambito manda sobre las DOS mitades del resultado, no solo sobre la
 * consulta en vivo. Por eso en 'mexico' e 'internacional' el corpus no
 * participa: el corpus es regional por construccion, y mezclarlo con una
 * busqueda nacional volveria la cifra de arriba imposible de leer.
 *
 * Y sin consulta esos dos peldanos NO dejan el muro vacio: muestran la
 * seccion de Google Noticias de ese momento (lib/busqueda/actualidad.ts).
 * Antes del 11 de septiembre de 2026 `/?a=mexico` sin consulta era una lista
 * vacia con pastillas que no hacian nada, porque el corpus no participa y la
 * busqueda en vivo no tenia que buscar.
 *
 * Los terminos de lugar de aqui NO salen de pulso/zonas.py::LUGARES. Ese
 * gazetero sirve para DETECTAR y esta plegado -- sin acentos, 'san quintin',
 * 'camalu' -- y ademas trae desambiguadores que no son toponimos: 'xolos' es
 * el equipo, 'sandag' es la agencia, y 'vista california' y 'bonita california'
 * son formas de dos palabras inventadas para no empatar con las palabras
 * comunes 'vista' y 'bonita'. Entrecomillados en una consulta, varios de esos
 * no devuelven nada.
 *
 * Asi que esta tabla se escribe a mano, con el estilo que ya probo
 * config/busquedas.json: forma con acentos, frases de varias palabras entre
 * comillas, y el calificador "Baja California" donde el nombre es ambiguo. Las
 * notas de ese archivo traen los casos: hay un San Felipe en Guanajuato y otro
 * en Chile, y Tecate sin calificador "se llena de la cerveza".
 */

import type { Idioma } from "./tipos";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

export type Ambito = "zona" | "region" | "mexico" | "internacional";

export const AMBITOS = ["zona", "region", "mexico", "internacional"] as const;

export const esAmbito = (s: string | null): s is Ambito =>
  (AMBITOS as readonly string[]).includes(s ?? "");

/**
 * Otay y San Ysidro aparecen en Tijuana Y en San Diego. No es un descuido: es
 * como funciona este corredor, y tests/test_zonas.py ya fija que un titular
 * sobre la garita de San Ysidro resuelve a las dos zonas. No "arreglarlo".
 */
const LUGARES: Record<ZonaRuta, string> = {
  Tijuana: '(Tijuana OR "Playas de Tijuana" OR Otay OR "Zona Río")',
  Mexicali: '(Mexicali OR "Valle de Mexicali" OR "Los Algodones")',
  Ensenada: '(Ensenada OR "Valle de Guadalupe" OR Maneadero OR "El Sauzal")',
  "Playas de Rosarito": '("Playas de Rosarito" OR Rosarito) "Baja California"',
  Tecate: '(Tecate OR "La Rumorosa") "Baja California"',
  "San Quintín": '("San Quintín" OR "Vicente Guerrero" OR Camalú OR Colonet)',
  "San Felipe": '"San Felipe" "Baja California"',
  "San Diego": '("San Diego" OR "Chula Vista" OR "San Ysidro" OR "Otay Mesa")',
};

const REGION =
  '("Baja California" OR Tijuana OR Mexicali OR Ensenada OR Tecate OR Rosarito OR "San Diego")';

/**
 * Consulta del usuario + el lugar que le toca al ambito.
 *
 * Se compone en el SERVIDOR, despues de validar. Si el cliente mandara la
 * cadena ya compuesta, los ocho terminos de San Diego se comerian casi todo el
 * presupuesto de 120 caracteres que validar.ts le mide a lo que escribio una
 * persona.
 */
export function componerConsulta(
  q: string,
  ambito: Ambito,
  zona: ZonaRuta | null,
): string {
  if (ambito === "zona" && zona !== null) return `${q} ${LUGARES[zona]}`;
  if (ambito === "region" || (ambito === "zona" && zona === null)) {
    return `${q} ${REGION}`;
  }
  // mexico e internacional no acotan por lugar: los distingue el locale.
  return q;
}

/**
 * Que ediciones de la fuente se consultan.
 *
 * La frontera se cubre en los dos idiomas porque de verdad se publica en los
 * dos. Mexico va solo en espanol, que es lo que significa pedir la edicion
 * mexicana. Internacional vuelve a abrir los dos.
 */
export function localesDe(ambito: Ambito): readonly Idioma[] {
  return ambito === "mexico" ? (["es"] as const) : (["es", "en"] as const);
}

/** El corpus solo participa mientras la busqueda siga siendo regional. */
export const usaCorpus = (ambito: Ambito) =>
  ambito === "zona" || ambito === "region";

/**
 * Los dos peldanos sin corpus. Sin consulta muestran la seccion de Google
 * Noticias en vivo; es el complemento exacto de `usaCorpus`, escrito como
 * predicado propio para que el tipo lo estreche.
 */
export type AmbitoActualidad = Extract<Ambito, "mexico" | "internacional">;

export const esAmbitoActualidad = (s: string | null): s is AmbitoActualidad =>
  s === "mexico" || s === "internacional";

/** Sin zona en la ruta no hay peldano 'zona': el primero es 'region'. */
export const ambitoPorOmision = (zona: ZonaRuta | null): Ambito =>
  zona === null ? "region" : "zona";

/** Los peldanos que se ofrecen; 'zona' solo en la pagina de una zona. */
export const ambitosDe = (zona: ZonaRuta | null): readonly Ambito[] =>
  zona === null ? AMBITOS.filter((a) => a !== "zona") : AMBITOS;

export function rotuloDe(ambito: Ambito, zona: ZonaRuta | null): string {
  if (ambito === "zona") return zona === null ? "Zona" : NOMBRE_CORTO[zona];
  if (ambito === "region") return "Región";
  return ambito === "mexico" ? "México" : "Internacional";
}
