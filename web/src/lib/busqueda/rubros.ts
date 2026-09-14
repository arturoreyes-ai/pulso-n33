/**
 * Los rubros de la actualidad: Clima, Seguridad, Deportes, Politica y
 * Economia. Puro: solo cadenas.
 *
 * Existe porque el cliente mostro, el 11 de septiembre de 2026, la caja
 * "Trending topics" de la pagina local de Google Noticias -- Weather, Crime,
 * Sports, Politics, Business, con notas debajo de cada pastilla -- y pidio
 * algo asi. El RSS de Google no expone esa clasificacion: hay seccion por
 * lugar y hay busqueda, pero no seccion por lugar Y tema, y tampoco trae las
 * imagenes. Asi que un rubro es una BUSQUEDA: los terminos del rubro mas los
 * terminos de lugar que ya prueba ambito.ts::componerConsulta, acotada a dos
 * dias. El panel lo dice asi; no es la seccion ni la clasificacion de Google.
 *
 * Los terminos van en el idioma de cada edicion, por la misma regla que el
 * modelo de tono: un termino en espanol pedido a la edicion en ingles no
 * devuelve nada. Y NO se clasifica del lado del cliente: un lexico que archive
 * un titular bajo "Seguridad" por una palabra fabrica una afirmacion que no
 * se puede sostener; aqui la unica afirmacion es "esto devolvio Google para
 * estos terminos". Sin nombres propios de politicos: caducan y cruzarian el
 * rubro con una figura.
 */

import type { Idioma } from "./tipos";

export const RUBROS = ["clima", "seguridad", "deportes", "politica", "economia"] as const;

export type Rubro = (typeof RUBROS)[number];

export const esRubro = (s: string | null): s is Rubro =>
  (RUBROS as readonly string[]).includes(s ?? "");

export const NOMBRE_RUBRO: Record<Rubro, string> = {
  clima: "Clima",
  seguridad: "Seguridad",
  deportes: "Deportes",
  politica: "Política",
  economia: "Economía",
};

/**
 * Dos dias: "ahora" para un tema, con margen para las zonas chicas, donde un
 * dia trae dos o tres titulares. Google honra `when:` de forma irregular
 * (pulso/busquedas.py lo documenta), asi que es un sesgo, no una garantia.
 */
export const VENTANA_RUBRO = "when:2d";

/**
 * Entre parentesis para que el OR no se coma los terminos de lugar que
 * componerConsulta pega despues; frases de varias palabras entre comillas.
 */
export const TERMINOS_RUBRO: Record<Rubro, Record<Idioma, string>> = {
  clima: {
    es: '(clima OR lluvia OR lluvias OR tormenta OR "ola de calor" OR "frente frío" OR pronóstico OR huracán OR granizo OR vientos)',
    en: '(weather OR rain OR storm OR "heat wave" OR forecast OR flooding OR "Santa Ana winds" OR wildfire)',
  },
  seguridad: {
    es: '(homicidio OR asesinan OR balacera OR detienen OR detenido OR fiscalía OR secuestro OR "crimen organizado" OR ejecutado OR "hallan cuerpos" OR feminicidio OR extorsión)',
    en: '(shooting OR homicide OR arrested OR police OR sheriff OR "border patrol" OR smuggling OR robbery OR stabbing OR crime)',
  },
  deportes: {
    es: '(Xolos OR "Club Tijuana" OR "Liga MX" OR Toros OR béisbol OR futbol OR boxeo OR "Águilas de Mexicali" OR maratón OR Padres)',
    en: '(Padres OR "San Diego FC" OR Wave OR Aztecs OR Gulls OR baseball OR soccer OR boxing OR marathon OR sports)',
  },
  politica: {
    es: '(alcalde OR alcaldesa OR gobernadora OR gobernador OR cabildo OR Congreso OR diputado OR diputada OR regidor OR Morena OR PAN OR elecciones OR INE)',
    en: '(mayor OR "city council" OR supervisors OR governor OR election OR Congress OR senator OR legislature OR ballot)',
  },
  economia: {
    es: '(empresas OR inversión OR empleo OR maquiladora OR aranceles OR comercio OR precios OR inflación OR "cruce fronterizo" OR turismo OR vivienda)',
    en: '(business OR economy OR tariffs OR jobs OR housing OR "cross-border" OR trade OR tourism OR prices OR layoffs)',
  },
};
